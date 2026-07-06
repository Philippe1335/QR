// Payment + Analytics Platform pour POS de restaurants.
// - Couche paiement : le client scanne un QR et paie sa facture (Stripe/Apple Pay simulé).
// - Couche analytics : chaque paiement alimente le dashboard d'insights du restaurant.

const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const store = require('./lib/store');
const analytics = require('./lib/analytics');
const { seedDemo } = require('./lib/seed');
const { dispatchPaymentCompleted } = require('./lib/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

store.load();
if (process.env.SEED_DEMO !== '0') seedDemo();

function baseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function checkoutUrl(req, facture) {
  return `${baseUrl(req)}/checkout?rest_id=${facture.restaurant_id}&table_id=${encodeURIComponent(facture.table_id)}&facture_id=${facture.id}`;
}

// Authentification POS : clé API via header X-API-Key, Authorization: Bearer, ou ?api_key.
function apiKeyFrom(req) {
  const auth = req.get('authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return req.get('x-api-key') || req.query.api_key || null;
}

function requireRestaurant(req, res) {
  const restId = req.body?.restaurant_id || req.query.rest_id || req.params.rest_id;
  const restaurant = store.authRestaurant(restId, apiKeyFrom(req));
  if (!restaurant) {
    res.status(401).json({ error: 'restaurant_id ou clé API invalide' });
    return null;
  }
  return restaurant;
}

// --- Pages ---

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'public', 'checkout.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// =====================================================================
// API v1 — appelée par le POS
// =====================================================================

// Enregistrer un restaurant (onboarding par l'intégrateur POS) → retourne la
// clé API du restaurant et l'URL de son dashboard.
const PLATFORM_KEY = process.env.PLATFORM_KEY || 'platform_key_123';
app.post('/api/v1/restaurants', (req, res) => {
  if (req.get('x-platform-key') !== PLATFORM_KEY) {
    return res.status(401).json({ error: 'Clé plateforme invalide (header X-Platform-Key)' });
  }
  const { name, webhook_url } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name est requis' });
  const restaurant = store.createRestaurant({ name, webhook_url });
  res.status(201).json({
    restaurant_id: restaurant.id,
    api_key: restaurant.api_key,
    webhook_url: restaurant.webhook_url,
    dashboard_url: `${baseUrl(req)}/dashboard?rest_id=${restaurant.id}&api_key=${restaurant.api_key}`
  });
});

// Créer une facture → retourne l'URL de checkout et le QR code à afficher/imprimer.
app.post('/api/v1/factures', async (req, res) => {
  const restaurant = requireRestaurant(req, res);
  if (!restaurant) return;
  try {
    const facture = store.createFacture({ ...req.body, restaurant_id: restaurant.id });
    const url = checkoutUrl(req, facture);
    res.status(201).json({
      facture_id: facture.id,
      status: facture.status,
      checkout_url: url,
      qr_code: await QRCode.toDataURL(url, { width: 480, margin: 2 })
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Vérifier le statut d'une facture.
app.get('/api/v1/factures/:id', (req, res) => {
  const facture = store.getFacture(req.params.id);
  if (!facture) return res.status(404).json({ error: 'Facture introuvable' });
  const restaurant = store.authRestaurant(facture.restaurant_id, apiKeyFrom(req));
  if (!restaurant) return res.status(401).json({ error: 'Clé API invalide' });
  res.json(store.posView(facture));
});

// Annuler une facture.
app.delete('/api/v1/factures/:id', (req, res) => {
  const facture = store.getFacture(req.params.id);
  if (!facture) return res.status(404).json({ error: 'Facture introuvable' });
  const restaurant = store.authRestaurant(facture.restaurant_id, apiKeyFrom(req));
  if (!restaurant) return res.status(401).json({ error: 'Clé API invalide' });
  try {
    store.cancelFacture(facture.id);
    res.json({ facture_id: facture.id, status: 'cancelled' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// QR code PNG d'une facture (à imprimer sur le ticket ou afficher sur la borne).
app.get('/api/v1/factures/:id/qr.png', async (req, res) => {
  const facture = store.getFacture(req.params.id);
  if (!facture) return res.status(404).send('Facture introuvable');
  const png = await QRCode.toBuffer(checkoutUrl(req, facture), { width: 480, margin: 2 });
  res.type('png').send(png);
});

// Analytics complets du restaurant (période : today | week | month | quarter).
app.get('/api/v1/analytics', (req, res) => {
  const restaurant = requireRestaurant(req, res);
  if (!restaurant) return;
  const period = String(req.query.period || 'week');
  if (!analytics.PERIODS[period]) {
    return res.status(400).json({ error: `period invalide (${Object.keys(analytics.PERIODS).join(' | ')})` });
  }
  res.json({ restaurant_name: restaurant.name, ...analytics.compute(restaurant.id, { period }) });
});

// =====================================================================
// API checkout — appelée par la page de paiement client (pas de clé API :
// connaître l'ID de facture — imprimé dans le QR — sert de capacité d'accès)
// =====================================================================

// Charger la facture ; le premier appel enregistre l'heure de scan.
app.get('/api/checkout/:factureId', (req, res) => {
  const facture = store.getFacture(req.params.factureId);
  if (!facture || facture.status === 'cancelled') {
    return res.status(404).json({ error: 'Facture introuvable' });
  }
  store.markScanned(facture.id);
  res.json(store.checkoutView(facture, store.getRestaurant(facture.restaurant_id)));
});

// Paiement simulé (Stripe/Apple Pay). En production, remplacer par un
// PaymentIntent Stripe confirmé côté serveur.
app.post('/api/checkout/:factureId/pay', (req, res) => {
  const facture = store.getFacture(req.params.factureId);
  if (!facture || facture.status === 'cancelled') {
    return res.status(404).json({ error: 'Facture introuvable' });
  }
  const { amount, tip, method, client_ids } = req.body || {};
  try {
    const updated = store.recordPayment(facture.id, {
      amount,
      tip,
      method: method === 'apple_pay' || method === 'google_pay' ? method : 'card',
      client_ids: Array.isArray(client_ids) ? client_ids.map(String) : []
    });
    if (updated.status === 'paid') {
      // Notifie le POS sans bloquer la réponse au client.
      dispatchPaymentCompleted(updated).catch(() => {});
    }
    res.json(store.checkoutView(updated, store.getRestaurant(updated.restaurant_id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =====================================================================
// Démo — crée une facture d'exemple et redirige vers le checkout
// =====================================================================

app.post('/api/demo/facture', (req, res) => {
  const restaurant = store.getRestaurant('rest_demo');
  if (!restaurant) return res.status(404).json({ error: 'Démo désactivée' });
  const items = [
    { name: 'Burger Gourmet', price: 16.5, qty: 1, client_id: '1', category: 'Plats' },
    { name: 'Bière Pression', price: 6.0, qty: 1, client_id: '1', category: 'Boissons' },
    { name: 'Salade César', price: 13.0, qty: 1, client_id: '2', category: 'Plats' },
    { name: 'Verre de Vin', price: 8.0, qty: 1, client_id: '2', category: 'Boissons' },
    { name: 'Pizza Margherita', price: 14.0, qty: 1, client_id: '3', category: 'Plats' },
    { name: 'Limonade Artisanale', price: 4.5, qty: 1, client_id: '3', category: 'Boissons' },
    { name: 'Tiramisu', price: 7.5, qty: 1, client_id: '3', category: 'Desserts' }
  ];
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const facture = store.createFacture({
    restaurant_id: restaurant.id,
    table_id: '5',
    items,
    tax: store.round2(subtotal * 0.15),
    party_size: 3
  });
  res.status(201).json({ facture_id: facture.id, checkout_url: checkoutUrl(req, facture) });
});

app.listen(PORT, () => {
  console.log(`Payment + Analytics Platform démarrée sur http://localhost:${PORT}`);
  console.log(`Dashboard démo : http://localhost:${PORT}/dashboard?rest_id=rest_demo&api_key=demo_key_123`);
});

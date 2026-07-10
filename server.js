// Payment + Analytics Platform pour POS de restaurants.
// - Couche paiement : le client scanne un QR et paie sa facture (Stripe/Apple Pay simulé).
// - Couche analytics : chaque paiement alimente le dashboard d'insights du restaurant.

const express = require('express');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const store = require('./lib/store');
const analytics = require('./lib/analytics');
const { MENU } = require('./lib/menu');
const { seedDemo } = require('./lib/seed');
const { dispatchPaymentCompleted } = require('./lib/webhook');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

app.use(express.json());
app.use(express.static(DIST_DIR));

store.load();
if (process.env.SEED_DEMO !== '0') seedDemo();

function baseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

// Le QR de table pointe vers l'écran d'accueil client (menu / serveur / payer).
function checkoutUrl(req, facture) {
  return `${baseUrl(req)}/table?rest_id=${facture.restaurant_id}&table_id=${encodeURIComponent(facture.table_id)}`;
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

// --- Pages (SPA React : toutes les routes servent dist/index.html) ---

const SPA_ROUTES = ['/', '/table', '/menu', '/call-server', '/checkout', '/feedback', '/server-view', '/dashboard'];
for (const route of SPA_ROUTES) {
  app.get(route, (req, res) => {
    const index = path.join(DIST_DIR, 'index.html');
    if (!fs.existsSync(index)) {
      return res.status(503).send('Frontend non compilé : lancez `npm run build` puis rechargez.');
    }
    res.sendFile(index);
  });
}

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

// Menu complet du restaurant (public : les clients le consultent après le scan).
app.get('/api/v1/menu', (req, res) => {
  const restaurant = store.getRestaurant(req.query.rest_id);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });
  res.json({ restaurant_name: restaurant.name, menu: restaurant.menu || MENU });
});

// =====================================================================
// Demandes serveur (appeler le serveur) + tablette temps réel
// =====================================================================

// Le client de la table crée une demande (eau, addition, …).
app.post('/api/v1/server-request', (req, res) => {
  const { restaurant_id, table_id, request_type } = req.body || {};
  const restaurant = store.getRestaurant(restaurant_id);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });
  if (!table_id) return res.status(400).json({ error: 'table_id est requis' });
  try {
    res.status(201).json(store.createRequest({ restaurant_id, table_id, request_type }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// La tablette serveur marque une demande comme traitée.
app.patch('/api/v1/server-request/:id', (req, res) => {
  if ((req.body || {}).status !== 'handled') {
    return res.status(400).json({ error: 'Seul { "status": "handled" } est supporté' });
  }
  const request = store.handleRequest(req.params.id);
  if (!request) return res.status(404).json({ error: 'Demande introuvable' });
  res.json(request);
});

// La tablette serveur récupère les demandes (polling toutes les 3-5 s).
// Renvoie les demandes en attente + celles traitées dans les 2 dernières minutes.
app.get('/api/v1/server-requests', (req, res) => {
  const restaurant = store.getRestaurant(req.query.rest_id);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });
  const now = Date.now();
  const cutoff = now - 2 * 60 * 1000;
  const requests = store
    .requestsForRestaurant(restaurant.id)
    .filter((q) => {
      if (q.status === 'pending') return true;
      const handledAt = q.handled_at ? new Date(q.handled_at).getTime() : 0;
      return handledAt > cutoff && handledAt <= now;
    })
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json({ requests });
});

// =====================================================================
// Feedback client post-paiement
// =====================================================================

app.post('/api/v1/feedback', (req, res) => {
  const { facture_id, rating, comment, issue_type, google_review } = req.body || {};
  const facture = facture_id ? store.getFacture(facture_id) : null;
  const restaurantId = facture ? facture.restaurant_id : req.body?.restaurant_id;
  if (!store.getRestaurant(restaurantId)) {
    return res.status(404).json({ error: 'Restaurant introuvable' });
  }
  try {
    res.status(201).json(
      store.addFeedback({
        restaurant_id: restaurantId,
        facture_id,
        rating,
        comment,
        issue_type,
        google_review
      })
    );
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =====================================================================
// API checkout — appelée par la page de paiement client (pas de clé API :
// connaître l'ID de facture — imprimé dans le QR — sert de capacité d'accès)
// =====================================================================

// Facture active d'une table (flux client : le QR n'encode que rest_id + table_id).
// En démo, une facture d'exemple est créée automatiquement si la table n'en a pas.
app.get('/api/checkout/table', (req, res) => {
  const { rest_id, table_id } = req.query;
  const restaurant = store.getRestaurant(rest_id);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant introuvable' });
  if (!table_id) return res.status(400).json({ error: 'table_id est requis' });
  let facture = store.activeFactureForTable(restaurant.id, table_id);
  if (!facture && restaurant.id === 'rest_demo') {
    facture = createDemoFacture(restaurant.id, String(table_id));
  }
  if (!facture) return res.status(404).json({ error: 'Aucune facture active pour cette table' });
  store.markScanned(facture.id);
  res.json(store.checkoutView(facture, restaurant));
});

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
function processPayment(factureId, body, res) {
  const facture = store.getFacture(factureId);
  if (!facture || facture.status === 'cancelled') {
    return res.status(404).json({ error: 'Facture introuvable' });
  }
  const { amount, tip, method, client_ids, split_type } = body || {};
  try {
    const updated = store.recordPayment(facture.id, {
      amount,
      tip,
      method: method === 'apple_pay' || method === 'google_pay' ? method : 'card',
      client_ids: Array.isArray(client_ids) ? client_ids.map(String) : [],
      split_type: ['full', 'equal', 'by_item'].includes(split_type) ? split_type : 'full'
    });
    if (updated.status === 'paid') {
      // Notifie le POS sans bloquer la réponse au client.
      dispatchPaymentCompleted(updated).catch(() => {});
    }
    res.json(store.checkoutView(updated, store.getRestaurant(updated.restaurant_id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

app.post('/api/checkout/:factureId/pay', (req, res) => processPayment(req.params.factureId, req.body, res));

// Alias conforme au contrat POS : POST /api/v1/payment { facture_id, split_type, amount, tip }.
app.post('/api/v1/payment', (req, res) => {
  const { facture_id } = req.body || {};
  if (!facture_id) return res.status(400).json({ error: 'facture_id est requis' });
  processPayment(facture_id, req.body, res);
});

// =====================================================================
// Démo — crée une facture d'exemple et redirige vers l'écran de table
// =====================================================================

function createDemoFacture(restaurantId, tableId = '5') {
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
  return store.createFacture({
    restaurant_id: restaurantId,
    table_id: tableId,
    items,
    tax: store.round2(subtotal * 0.15),
    party_size: 3
  });
}

app.post('/api/demo/facture', async (req, res) => {
  const restaurant = store.getRestaurant('rest_demo');
  if (!restaurant) return res.status(404).json({ error: 'Démo désactivée' });
  const facture =
    store.activeFactureForTable(restaurant.id, '5') || createDemoFacture(restaurant.id, '5');
  const url = checkoutUrl(req, facture);
  res.status(201).json({
    facture_id: facture.id,
    checkout_url: url,
    qr_code: await QRCode.toDataURL(url, { width: 480, margin: 2 })
  });
});

app.listen(PORT, () => {
  console.log(`Payment + Analytics Platform démarrée sur http://localhost:${PORT}`);
  console.log(`Dashboard démo : http://localhost:${PORT}/dashboard?rest_id=rest_demo&api_key=demo_key_123`);
  // Adresses réseau : à ouvrir depuis un téléphone sur le même Wi-Fi pour
  // que le QR code pointe vers une adresse que le téléphone peut atteindre.
  const nets = require('os').networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`Sur votre réseau (pour scanner le QR avec un téléphone) : http://${net.address}:${PORT}`);
      }
    }
  }
});

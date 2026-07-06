const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const store = require('./lib/store');

const app = express();
const PORT = process.env.PORT || 3000;

// Clés Stripe : sans clé, l'application tourne en mode démo (paiement simulé).
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;
const CURRENCY = process.env.CURRENCY || 'eur';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fichier de vérification du domaine pour Apple Pay (fourni par Stripe).
app.use(
  '/.well-known',
  express.static(path.join(__dirname, 'public', '.well-known'), { dotfiles: 'allow' })
);

// --- Pages ---

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/table/:tableId', (req, res) => {
  if (!store.getBill(req.params.tableId)) {
    return res.status(404).send('Table introuvable');
  }
  res.sendFile(path.join(__dirname, 'public', 'table.html'));
});

// --- QR codes ---

app.get('/qr/:tableId.png', async (req, res) => {
  const { tableId } = req.params;
  if (!store.getBill(tableId)) return res.status(404).send('Table introuvable');
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url = `${baseUrl}/table/${tableId}`;
  const png = await QRCode.toBuffer(url, { width: 480, margin: 2 });
  res.type('png').send(png);
});

// --- API ---

app.get('/api/config', (req, res) => {
  res.json({
    demoMode: !stripe,
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    currency: CURRENCY
  });
});

app.get('/api/tables', (req, res) => {
  res.json(store.listBills().map(store.publicBill));
});

app.get('/api/table/:tableId/bill', (req, res) => {
  const bill = store.getBill(req.params.tableId);
  if (!bill) return res.status(404).json({ error: 'Table introuvable' });
  res.json(store.publicBill(bill));
});

app.post('/api/table/:tableId/split', (req, res) => {
  const n = Number(req.body.splitCount);
  try {
    const bill = store.setSplit(req.params.tableId, n);
    if (!bill) return res.status(404).json({ error: 'Table introuvable' });
    res.json(store.publicBill(bill));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Crée un PaymentIntent Stripe pour la prochaine part (ou un intent de démo).
app.post('/api/table/:tableId/payment-intent', async (req, res) => {
  const bill = store.getBill(req.params.tableId);
  if (!bill) return res.status(404).json({ error: 'Table introuvable' });

  const remaining = store.remaining(bill);
  if (remaining <= 0) return res.status(400).json({ error: 'La facture est déjà réglée' });

  const amount = store.nextShareAmount(bill);

  if (!stripe) {
    // Mode démo : pas d'appel Stripe, le client "paiera" via /confirm-demo.
    return res.json({ demo: true, amount, currency: CURRENCY });
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: { tableId: bill.tableId }
    });
    res.json({ clientSecret: intent.client_secret, amount, currency: CURRENCY });
  } catch (err) {
    console.error('Erreur Stripe :', err.message);
    res.status(502).json({ error: 'Impossible de créer le paiement' });
  }
});

// Confirmation après paiement Stripe : on vérifie le PaymentIntent côté serveur.
app.post('/api/table/:tableId/confirm', async (req, res) => {
  const bill = store.getBill(req.params.tableId);
  if (!bill) return res.status(404).json({ error: 'Table introuvable' });
  if (!stripe) return res.status(400).json({ error: 'Stripe non configuré' });

  const { paymentIntentId } = req.body;
  if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId manquant' });

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded' || intent.metadata.tableId !== bill.tableId) {
      return res.status(400).json({ error: 'Paiement non validé' });
    }
    const updated = store.recordPayment(bill.tableId, {
      amount: intent.amount,
      method: 'stripe',
      reference: intent.id
    });
    res.json(store.publicBill(updated));
  } catch (err) {
    console.error('Erreur Stripe :', err.message);
    res.status(502).json({ error: 'Vérification du paiement impossible' });
  }
});

// Paiement simulé en mode démo.
app.post('/api/table/:tableId/confirm-demo', (req, res) => {
  if (stripe) return res.status(400).json({ error: 'Mode démo désactivé' });
  const bill = store.getBill(req.params.tableId);
  if (!bill) return res.status(404).json({ error: 'Table introuvable' });
  if (store.remaining(bill) <= 0) return res.status(400).json({ error: 'La facture est déjà réglée' });

  const amount = store.nextShareAmount(bill);
  const updated = store.recordPayment(bill.tableId, {
    amount,
    method: 'demo',
    reference: `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  });
  res.json(store.publicBill(updated));
});

app.listen(PORT, () => {
  console.log(`QR Restaurant Pay démarré sur http://localhost:${PORT}`);
  console.log(stripe ? 'Stripe configuré (paiements réels)' : 'Mode DÉMO (paiements simulés — définissez STRIPE_SECRET_KEY pour activer Stripe)');
});

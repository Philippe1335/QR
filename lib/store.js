// Stockage des restaurants et factures.
// En mémoire, avec persistance JSON sur disque (data/db.json).
// À remplacer par une vraie base de données en production.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const db = {
  restaurants: new Map(), // id -> restaurant
  factures: new Map() // id -> facture
};

let saveTimer = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const payload = JSON.stringify({
        restaurants: [...db.restaurants.values()],
        factures: [...db.factures.values()]
      });
      fs.writeFileSync(DB_FILE, payload);
    } catch (err) {
      console.error('Sauvegarde impossible :', err.message);
    }
  }, 500);
  saveTimer.unref?.();
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    for (const r of raw.restaurants || []) db.restaurants.set(r.id, r);
    for (const f of raw.factures || []) db.factures.set(f.id, f);
  } catch {
    // Pas de base existante : démarrage à vide (le seed s'en chargera).
  }
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// --- Restaurants ---

function createRestaurant({ id, name, api_key, webhook_url }) {
  const restaurant = {
    id: id || newId('rest'),
    name: name || 'Restaurant',
    api_key: api_key || newId('key'),
    webhook_url: webhook_url || null,
    created_at: new Date().toISOString()
  };
  db.restaurants.set(restaurant.id, restaurant);
  scheduleSave();
  return restaurant;
}

function getRestaurant(id) {
  return db.restaurants.get(id) || null;
}

function authRestaurant(id, apiKey) {
  const restaurant = db.restaurants.get(id);
  if (!restaurant || !apiKey || restaurant.api_key !== apiKey) return null;
  return restaurant;
}

// --- Factures ---

function normalizeItems(items) {
  return items.map((it) => ({
    name: String(it.name),
    price: round2(Number(it.price)),
    qty: Math.max(1, Math.round(Number(it.qty) || 1)),
    client_id: it.client_id != null ? String(it.client_id) : '1',
    category: it.category ? String(it.category) : 'Autres'
  }));
}

function createFacture({ restaurant_id, table_id, items, subtotal, tax, total, party_size }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items est requis et ne peut pas être vide');
  }
  const normalized = normalizeItems(items);
  for (const it of normalized) {
    if (!it.name || !Number.isFinite(it.price) || it.price < 0) {
      throw new Error('Chaque item requiert un name et un price valides');
    }
  }
  const computedSubtotal = round2(normalized.reduce((s, it) => s + it.price * it.qty, 0));
  const sub = Number.isFinite(Number(subtotal)) ? round2(Number(subtotal)) : computedSubtotal;
  const taxAmount = Number.isFinite(Number(tax)) ? round2(Number(tax)) : 0;
  const tot = Number.isFinite(Number(total)) ? round2(Number(total)) : round2(sub + taxAmount);
  if (tot <= 0) throw new Error('total doit être supérieur à 0');

  const clients = new Set(normalized.map((it) => it.client_id));
  const facture = {
    id: newId('fac'),
    restaurant_id,
    table_id: String(table_id ?? ''),
    items: normalized,
    subtotal: sub,
    tax: taxAmount,
    total: tot,
    tip: 0,
    amount_paid: 0,
    status: 'pending', // pending | partial | paid | cancelled
    payment_method: null,
    party_size: Math.max(1, Math.round(Number(party_size)) || clients.size),
    created_at: new Date().toISOString(),
    scanned_at: null,
    paid_at: null,
    payments: []
  };
  db.factures.set(facture.id, facture);
  scheduleSave();
  return facture;
}

function getFacture(id) {
  return db.factures.get(id) || null;
}

function cancelFacture(id) {
  const facture = db.factures.get(id);
  if (!facture) return null;
  if (facture.status === 'paid') throw new Error('Impossible d’annuler une facture déjà payée');
  facture.status = 'cancelled';
  scheduleSave();
  return facture;
}

function markScanned(id) {
  const facture = db.factures.get(id);
  if (!facture) return null;
  if (!facture.scanned_at) {
    facture.scanned_at = new Date().toISOString();
    scheduleSave();
  }
  return facture;
}

function remaining(facture) {
  return round2(facture.total - facture.amount_paid);
}

// Enregistre un paiement (total ou partiel) sur une facture.
function recordPayment(id, { amount, tip = 0, method = 'card', client_ids = [] }) {
  const facture = db.factures.get(id);
  if (!facture) throw new Error('Facture introuvable');
  if (facture.status === 'cancelled') throw new Error('Facture annulée');
  if (facture.status === 'paid') throw new Error('Facture déjà payée');

  const amt = round2(Number(amount));
  const tipAmt = round2(Math.max(0, Number(tip) || 0));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Montant invalide');
  if (amt > remaining(facture) + 0.01) throw new Error('Montant supérieur au restant dû');

  facture.payments.push({
    id: newId('pay'),
    amount: amt,
    tip: tipAmt,
    method,
    client_ids,
    at: new Date().toISOString()
  });
  facture.amount_paid = round2(facture.amount_paid + amt);
  facture.tip = round2(facture.tip + tipAmt);
  facture.payment_method = method;

  if (facture.amount_paid >= facture.total - 0.01) {
    facture.amount_paid = facture.total;
    facture.status = 'paid';
    facture.paid_at = new Date().toISOString();
  } else {
    facture.status = 'partial';
  }
  scheduleSave();
  return facture;
}

function facturesForRestaurant(restaurant_id) {
  return [...db.factures.values()].filter((f) => f.restaurant_id === restaurant_id);
}

// Vue publique pour le POS (statut d'une facture).
function posView(facture) {
  return {
    facture_id: facture.id,
    restaurant_id: facture.restaurant_id,
    table_id: facture.table_id,
    status: facture.status,
    amount_total: facture.total,
    amount_paid: facture.amount_paid,
    tip: facture.tip,
    created_at: facture.created_at,
    paid_at: facture.paid_at
  };
}

// Vue publique pour la page de paiement client (pas de données sensibles).
function checkoutView(facture, restaurant) {
  return {
    facture_id: facture.id,
    restaurant_name: restaurant ? restaurant.name : 'Restaurant',
    table_id: facture.table_id,
    items: facture.items,
    subtotal: facture.subtotal,
    tax: facture.tax,
    total: facture.total,
    tip: facture.tip,
    amount_paid: facture.amount_paid,
    remaining: remaining(facture),
    status: facture.status
  };
}

function timeToPayMinutes(facture) {
  if (!facture.scanned_at || !facture.paid_at) return null;
  const ms = new Date(facture.paid_at) - new Date(facture.scanned_at);
  return Math.round((ms / 60000) * 10) / 10;
}

module.exports = {
  load,
  round2,
  createRestaurant,
  getRestaurant,
  authRestaurant,
  createFacture,
  getFacture,
  cancelFacture,
  markScanned,
  remaining,
  recordPayment,
  facturesForRestaurant,
  posView,
  checkoutView,
  timeToPayMinutes,
  _db: db
};

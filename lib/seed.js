// Génère un restaurant de démo avec 60 jours de paiements réalistes,
// pour que le dashboard affiche des insights dès le premier lancement.
// PRNG déterministe : les mêmes données à chaque re-seed.

const store = require('./store');

const DAY_MS = 24 * 60 * 60 * 1000;

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Menu de démo. `trend` fait évoluer la popularité sur les 30 derniers jours
// (>1 = en hausse, <1 = en baisse) pour alimenter la section Item Trends.
const MENU = [
  { name: 'Burger Classique', price: 12.0, category: 'Plats', weight: 10, trend: 1.05 },
  { name: 'Burger Gourmet', price: 16.5, category: 'Plats', weight: 6, trend: 1.28 },
  { name: 'Poulet Rôti', price: 18.0, category: 'Plats', weight: 6, trend: 1.0 },
  { name: 'Poisson du Jour', price: 22.0, category: 'Plats', weight: 4, trend: 1.1 },
  { name: 'Pâtes Carbonara', price: 15.0, category: 'Plats', weight: 6, trend: 0.95 },
  { name: 'Pizza Margherita', price: 14.0, category: 'Plats', weight: 7, trend: 1.0 },
  { name: 'Salade César', price: 13.0, category: 'Plats', weight: 5, trend: 1.08 },
  { name: 'Steak Frites', price: 24.0, category: 'Plats', weight: 3, trend: 1.0, stopDaysAgo: 6 },
  { name: 'Soupe du Jour', price: 6.5, category: 'Entrées', weight: 4, trend: 0.85 },
  { name: 'Bruschetta', price: 7.0, category: 'Entrées', weight: 4, trend: 1.0 },
  { name: 'Planche Charcuterie', price: 14.5, category: 'Entrées', weight: 3, trend: 1.12 },
  { name: 'Calmars Frits', price: 11.0, category: 'Entrées', weight: 3, trend: 1.05 },
  { name: 'Bière Pression', price: 6.0, category: 'Boissons', weight: 9, trend: 1.0 },
  { name: 'Verre de Vin', price: 8.0, category: 'Boissons', weight: 7, trend: 1.05 },
  { name: 'Cocktail Maison', price: 11.0, category: 'Boissons', weight: 5, trend: 1.15 },
  { name: 'Limonade Artisanale', price: 4.5, category: 'Boissons', weight: 5, trend: 1.0 },
  { name: 'Café', price: 3.0, category: 'Boissons', weight: 8, trend: 1.0 },
  { name: 'Eau Pétillante', price: 3.5, category: 'Boissons', weight: 4, trend: 1.0 },
  { name: 'Tiramisu', price: 7.5, category: 'Desserts', weight: 5, trend: 1.1 },
  { name: 'Crème Brûlée', price: 7.5, category: 'Desserts', weight: 4, trend: 0.92 },
  { name: 'Fondant au Chocolat', price: 8.0, category: 'Desserts', weight: 5, trend: 1.0 },
  { name: 'Salade de Fruits', price: 6.5, category: 'Desserts', weight: 3, trend: 1.0 }
];

// Commentaires de feedback négatif plausibles (rating <= 3).
const NEGATIVE_COMMENTS = [
  { issue: 'slow_service', text: 'Attente trop longue pour les plats' },
  { issue: 'slow_service', text: 'Personne ne venait quand on appelait' },
  { issue: 'order_error', text: 'On a reçu le mauvais plat' },
  { issue: 'order_error', text: 'Il manquait une boisson sur la commande' },
  { issue: 'food_quality', text: 'Le burger était froid' },
  { issue: 'food_quality', text: 'Frites trop salées' },
  { issue: 'other', text: 'Musique trop forte' },
  { issue: 'other', text: null }
];

// Poids relatif des heures de service (déjeuner + gros rush du soir).
const HOUR_WEIGHTS = {
  11: 2, 12: 7, 13: 6, 14: 2, 17: 2, 18: 8, 19: 10, 20: 8, 21: 4, 22: 1
};

// Poids des jours (0=dim … 6=sam) : vendredi/samedi dominants.
const DAY_WEIGHTS = [5, 3, 3, 4, 5, 9, 8];

function pickWeighted(rand, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function menuWeight(item, daysAgo) {
  if (item.stopDaysAgo != null && daysAgo < item.stopDaysAgo) return 0; // plus commandé → alerte
  // Les 30 derniers jours appliquent le facteur de tendance.
  return daysAgo < 30 ? item.weight * item.trend : item.weight;
}

// Facture active plausible pour une table (2-4 clients, plats + boissons).
function seedActiveFacture(restaurantId, tableId, rand) {
  if (store.activeFactureForTable(restaurantId, tableId)) return;
  const partySize = 2 + Math.floor(rand() * 3);
  const items = [];
  for (let c = 1; c <= partySize; c++) {
    const n = 2 + Math.floor(rand() * 2);
    for (let d = 0; d < n; d++) {
      const entries = MENU.map((m) => [m, m.stopDaysAgo ? 0 : m.weight]).filter(([, w]) => w > 0);
      const dish = pickWeighted(rand, entries);
      items.push({ name: dish.name, price: dish.price, qty: 1, client_id: String(c), category: dish.category });
    }
  }
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  store.createFacture({
    restaurant_id: restaurantId,
    table_id: tableId,
    items,
    tax: store.round2(subtotal * 0.15),
    party_size: partySize
  });
}

function seedDemo({ days = 60, now = Date.now() } = {}) {
  if (store.getRestaurant('rest_demo')) return store.getRestaurant('rest_demo');

  const restaurant = store.createRestaurant({
    id: 'rest_demo',
    name: 'Chez Philippe',
    api_key: 'demo_key_123',
    webhook_url: null
  });

  const rand = mulberry32(20260706);
  const hourEntries = Object.entries(HOUR_WEIGHTS).map(([h, w]) => [Number(h), w]);

  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const dayStart = now - daysAgo * DAY_MS;
    const weekday = new Date(dayStart).getDay();
    // Légère croissance du trafic au fil du temps + variation aléatoire.
    const growth = 1 + (days - daysAgo) * 0.003;
    const count = Math.round(DAY_WEIGHTS[weekday] * 5 * growth * (0.85 + rand() * 0.3));

    for (let i = 0; i < count; i++) {
      const hour = pickWeighted(rand, hourEntries);
      // Aujourd'hui : ne pas générer de transactions dans le futur.
      const candidatePaidAt = new Date(dayStart);
      candidatePaidAt.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
      if (candidatePaidAt.getTime() > now) continue;
      const partySize = pickWeighted(rand, [[1, 2], [2, 8], [3, 4], [4, 4], [5, 1], [6, 1]]);

      const items = [];
      for (let c = 1; c <= partySize; c++) {
        const nDishes = 1 + Math.floor(rand() * 2.4); // 1 à 3 items par personne
        for (let d = 0; d < nDishes; d++) {
          const entries = MENU.map((m) => [m, menuWeight(m, daysAgo)]).filter(([, w]) => w > 0);
          const dish = pickWeighted(rand, entries);
          items.push({ name: dish.name, price: dish.price, qty: 1, client_id: String(c), category: dish.category });
        }
      }

      const facture = store.createFacture({
        restaurant_id: restaurant.id,
        table_id: String(1 + Math.floor(rand() * 20)),
        items,
        tax: store.round2(items.reduce((s, it) => s + it.price * it.qty, 0) * 0.15),
        party_size: partySize
      });

      // Horodatage réaliste : scan, puis paiement quelques minutes plus tard.
      const paidAt = candidatePaidAt;
      const timeToPay = 3 + rand() * 12; // minutes entre scan et paiement
      const scannedAt = new Date(paidAt.getTime() - timeToPay * 60000);

      const tipRate = pickWeighted(rand, [[0, 1], [0.1, 3], [0.15, 5], [0.18, 3], [0.2, 3], [0.25, 1]]);
      const method = pickWeighted(rand, [['apple_pay', 5], ['card', 4], ['google_pay', 1]]);
      const splitType = pickWeighted(rand, [['full', 11], ['equal', 5], ['by_item', 4]]);

      store.recordPayment(facture.id, {
        amount: facture.total,
        tip: store.round2(facture.total * tipRate),
        method,
        split_type: splitType
      });

      // Réécrit les horodatages générés (recordPayment a mis "maintenant").
      facture.created_at = new Date(scannedAt.getTime() - 20 * 60000).toISOString();
      facture.scanned_at = scannedAt.toISOString();
      facture.paid_at = paidAt.toISOString();
      facture.payments[0].at = paidAt.toISOString();

      // ~40% des tables font une demande serveur pendant le repas,
      // traitée entre 1 et 8 minutes plus tard.
      if (rand() < 0.4) {
        const type = pickWeighted(rand, [
          ['water', 5], ['ready_to_order', 6], ['condiments', 2], ['assistance', 3], ['bill', 4]
        ]);
        const reqAt = new Date(scannedAt.getTime() - (5 + rand() * 30) * 60000);
        const request = store.createRequest({
          restaurant_id: restaurant.id,
          table_id: facture.table_id,
          request_type: type
        });
        request.created_at = reqAt.toISOString();
        request.status = 'handled';
        request.handled_at = new Date(reqAt.getTime() + (1 + rand() * 7) * 60000).toISOString();
      }

      // ~35% des clients répondent au feedback post-paiement.
      if (rand() < 0.35) {
        const rating = pickWeighted(rand, [[5, 8], [4, 5], [3, 2], [2, 1], [1, 1]]);
        let comment = null;
        let issue = null;
        if (rating <= 3) {
          const neg = NEGATIVE_COMMENTS[Math.floor(rand() * NEGATIVE_COMMENTS.length)];
          comment = neg.text;
          issue = neg.issue;
        }
        const feedback = store.addFeedback({
          restaurant_id: restaurant.id,
          facture_id: facture.id,
          rating,
          comment,
          issue_type: issue,
          google_review: rating >= 4 && rand() < 0.4
        });
        feedback.created_at = new Date(paidAt.getTime() + 60000).toISOString();
      }
    }
  }

  // Factures actives (non payées) sur quelques tables, pour tester le flux client.
  for (const tableId of ['3', '5', '8', '12']) {
    seedActiveFacture(restaurant.id, tableId, rand);
  }

  // Demandes serveur en attente pour la tablette (créées "à l'instant").
  const pendingSpecs = [
    { table: '5', type: 'assistance', secondsAgo: 30 },
    { table: '3', type: 'water', secondsAgo: 70 },
    { table: '8', type: 'ready_to_order', secondsAgo: 130 },
    { table: '12', type: 'bill', secondsAgo: 200 },
    { table: '7', type: 'condiments', secondsAgo: 320 }
  ];
  for (const spec of pendingSpecs) {
    const request = store.createRequest({
      restaurant_id: restaurant.id,
      table_id: spec.table,
      request_type: spec.type
    });
    request.created_at = new Date(now - spec.secondsAgo * 1000).toISOString();
  }

  const count = store.facturesForRestaurant(restaurant.id).length;
  console.log(`Seed démo : ${count} factures générées pour ${restaurant.name} (${restaurant.id})`);
  return restaurant;
}

module.exports = { seedDemo };

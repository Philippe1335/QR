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
  { name: 'Bière Pression', price: 6.0, category: 'Boissons', weight: 9, trend: 1.0 },
  { name: 'Verre de Vin', price: 8.0, category: 'Boissons', weight: 7, trend: 1.05 },
  { name: 'Cocktail Maison', price: 11.0, category: 'Boissons', weight: 5, trend: 1.15 },
  { name: 'Limonade Artisanale', price: 4.5, category: 'Boissons', weight: 5, trend: 1.0 },
  { name: 'Café', price: 3.0, category: 'Boissons', weight: 8, trend: 1.0 },
  { name: 'Tiramisu', price: 7.5, category: 'Desserts', weight: 5, trend: 1.1 },
  { name: 'Crème Brûlée', price: 7.5, category: 'Desserts', weight: 4, trend: 0.92 },
  { name: 'Fondant au Chocolat', price: 8.0, category: 'Desserts', weight: 5, trend: 1.0 }
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
      const paidAt = new Date(dayStart);
      paidAt.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
      const timeToPay = 3 + rand() * 12; // minutes entre scan et paiement
      const scannedAt = new Date(paidAt.getTime() - timeToPay * 60000);

      const tipRate = pickWeighted(rand, [[0, 1], [0.1, 3], [0.15, 5], [0.18, 3], [0.2, 3], [0.25, 1]]);
      const method = pickWeighted(rand, [['apple_pay', 5], ['card', 4], ['google_pay', 1]]);

      store.recordPayment(facture.id, {
        amount: facture.total,
        tip: store.round2(facture.total * tipRate),
        method
      });

      // Réécrit les horodatages générés (recordPayment a mis "maintenant").
      facture.created_at = new Date(scannedAt.getTime() - 20 * 60000).toISOString();
      facture.scanned_at = scannedAt.toISOString();
      facture.paid_at = paidAt.toISOString();
      facture.payments[0].at = paidAt.toISOString();
    }
  }

  const count = store.facturesForRestaurant(restaurant.id).length;
  console.log(`Seed démo : ${count} factures générées pour ${restaurant.name} (${restaurant.id})`);
  return restaurant;
}

module.exports = { seedDemo };

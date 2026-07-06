// Données mock : menu pré-défini + 20 tables (quelques-unes avec des factures actives).
// Tout est persisté dans localStorage via src/store.js — supprimer la clé (ou
// utiliser le bouton « Réinitialiser la démo ») pour revenir à cet état.

export const TABLE_COUNT = 20;

export const MENU = [
  { id: 'poutine', name: 'Poutine', price: 5.0, cat: 'Plats' },
  { id: 'burger', name: 'Burger classique', price: 12.0, cat: 'Plats' },
  { id: 'pizza', name: 'Pizza margherita', price: 14.0, cat: 'Plats' },
  { id: 'salade', name: 'Salade César', price: 10.0, cat: 'Plats' },
  { id: 'fish', name: 'Fish & chips', price: 15.0, cat: 'Plats' },
  { id: 'pates', name: 'Pâtes carbonara', price: 13.5, cat: 'Plats' },
  { id: 'nachos', name: 'Nachos à partager', price: 11.0, cat: 'Entrées' },
  { id: 'soupe', name: 'Soupe du jour', price: 4.5, cat: 'Entrées' },
  { id: 'pain', name: 'Panier de pain', price: 3.0, cat: 'Entrées' },
  { id: 'biere', name: 'Bière pression', price: 6.0, cat: 'Boissons' },
  { id: 'vin', name: 'Verre de vin', price: 8.0, cat: 'Boissons' },
  { id: 'cocktail', name: 'Cocktail maison', price: 9.5, cat: 'Boissons' },
  { id: 'boisson', name: 'Boisson gazeuse', price: 2.5, cat: 'Boissons' },
  { id: 'cafe', name: 'Café', price: 3.0, cat: 'Boissons' },
  { id: 'dessert', name: 'Gâteau au chocolat', price: 6.5, cat: 'Desserts' },
  { id: 'tarte', name: 'Tarte au sucre', price: 5.5, cat: 'Desserts' },
];

let uidCounter = 0;
function item(menuId, qty, client) {
  const m = MENU.find((x) => x.id === menuId);
  return {
    uid: `seed-${++uidCounter}`,
    menuId: m.id,
    name: m.name,
    price: m.price,
    qty,
    client, // 1..guests, ou null = partagé / non assigné
    paid: false,
  };
}

function emptyTable(id) {
  return { id, guests: 4, items: [], payments: [] };
}

export function seedData() {
  uidCounter = 0;
  const tables = [];
  for (let i = 1; i <= TABLE_COUNT; i++) tables.push(emptyTable(i));

  // Table 1 : table de 2, facture active (pratique pour tester /pay?table=1)
  tables[0].guests = 2;
  tables[0].items = [
    item('burger', 1, 1),
    item('biere', 2, 1),
    item('pizza', 1, 2),
    item('vin', 1, 2),
    item('nachos', 1, null),
  ];

  // Table 3 : table de 4 (l'exemple du split : ~15 / 20 / 18 / 22 $)
  tables[2].guests = 4;
  tables[2].items = [
    item('poutine', 1, 1),
    item('biere', 1, 1),
    item('soupe', 1, 1),
    item('burger', 1, 2),
    item('vin', 1, 2),
    item('fish', 1, 3),
    item('cafe', 1, 3),
    item('pates', 1, 4),
    item('cocktail', 1, 4),
  ];

  // Table 8 : table de 3, avec un item partagé
  tables[7].guests = 3;
  tables[7].items = [
    item('pizza', 1, 1),
    item('salade', 1, 2),
    item('boisson', 2, 2),
    item('burger', 1, 3),
    item('pain', 1, null),
    item('dessert', 1, null),
  ];

  // Table 12 : table de 2, petite facture
  tables[11].guests = 2;
  tables[11].items = [
    item('cafe', 2, 1),
    item('tarte', 1, 2),
  ];

  return { tables };
}

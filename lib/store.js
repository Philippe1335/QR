// Stockage simple des factures sur disque (JSON). Suffisant pour une démo /
// un petit restaurant ; à remplacer par une vraie base de données en production.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'bills.json');

// Montants en centimes d'euro.
function seedBills() {
  return {
    '1': {
      tableId: '1',
      items: [
        { name: 'Salade de chèvre chaud', qty: 1, unitPrice: 1250 },
        { name: 'Entrecôte frites', qty: 2, unitPrice: 2600 },
        { name: 'Verre de Bordeaux', qty: 2, unitPrice: 700 },
        { name: 'Crème brûlée', qty: 1, unitPrice: 850 }
      ],
      splitCount: 1,
      payments: []
    },
    '2': {
      tableId: '2',
      items: [
        { name: 'Burger maison', qty: 3, unitPrice: 1750 },
        { name: 'Limonade artisanale', qty: 3, unitPrice: 450 },
        { name: 'Fondant au chocolat', qty: 2, unitPrice: 900 }
      ],
      splitCount: 1,
      payments: []
    },
    '3': {
      tableId: '3',
      items: [
        { name: 'Menu du jour', qty: 4, unitPrice: 2200 },
        { name: 'Bouteille de rosé', qty: 1, unitPrice: 2400 },
        { name: 'Café', qty: 4, unitPrice: 250 }
      ],
      splitCount: 1,
      payments: []
    }
  };
}

let bills;

function load() {
  if (bills) return bills;
  try {
    bills = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    bills = seedBills();
    save();
  }
  return bills;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(bills, null, 2));
}

function total(bill) {
  return bill.items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
}

function paidAmount(bill) {
  return bill.payments.reduce((sum, p) => sum + p.amount, 0);
}

function remaining(bill) {
  return total(bill) - paidAmount(bill);
}

// Montant de la prochaine part : le reste divisé par les parts restantes,
// le dernier payeur règle exactement le solde (gère les arrondis).
function nextShareAmount(bill) {
  const rem = remaining(bill);
  const sharesLeft = Math.max(1, bill.splitCount - bill.payments.length);
  if (sharesLeft === 1) return rem;
  return Math.round(rem / sharesLeft);
}

function getBill(tableId) {
  return load()[tableId] || null;
}

function listBills() {
  return Object.values(load());
}

function setSplit(tableId, n) {
  const bill = getBill(tableId);
  if (!bill) return null;
  if (![1, 2, 3, 4].includes(n)) throw new Error('Le partage doit être en 1, 2, 3 ou 4 parts');
  if (bill.payments.length > 0 && n < bill.payments.length) {
    throw new Error('Impossible de réduire le partage en dessous du nombre de parts déjà payées');
  }
  bill.splitCount = n;
  save();
  return bill;
}

function recordPayment(tableId, { amount, method, reference }) {
  const bill = getBill(tableId);
  if (!bill) return null;
  if (bill.payments.some((p) => p.reference === reference)) return bill; // idempotent
  bill.payments.push({
    amount,
    method,
    reference,
    paidAt: new Date().toISOString()
  });
  save();
  return bill;
}

function publicBill(bill) {
  const tot = total(bill);
  const rem = remaining(bill);
  return {
    tableId: bill.tableId,
    items: bill.items,
    splitCount: bill.splitCount,
    payments: bill.payments,
    total: tot,
    paid: tot - rem,
    remaining: rem,
    nextShareAmount: rem > 0 ? nextShareAmount(bill) : 0,
    settled: rem <= 0
  };
}

module.exports = {
  getBill,
  listBills,
  setSplit,
  recordPayment,
  publicBill,
  remaining,
  nextShareAmount
};

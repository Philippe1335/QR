// Store partagé entre l'interface client (/pay) et l'interface resto (/admin).
// Persistance : localStorage. La synchro entre onglets repose sur l'événement
// « storage » du navigateur (ouvrir /admin et /pay dans 2 onglets pour tester).

import { useSyncExternalStore } from 'react';
import { seedData, MENU } from './data/mockData.js';

const KEY = 'qr-resto-v2';

export const TPS = 0.05; // TPS 5 %
export const TVQ = 0.09975; // TVQ 9,975 %

let cache = null;
const listeners = new Set();

function readStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // données corrompues → on repart du seed
  }
  const seed = seedData();
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
}

function getSnapshot() {
  if (cache === null) cache = readStorage();
  return cache;
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Un autre onglet a modifié les données → on invalide le cache local.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    cache = null;
    emit();
  }
});

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useTable(tableId) {
  const data = useStore();
  return data.tables.find((t) => t.id === Number(tableId)) || null;
}

function mutate(fn) {
  const data = JSON.parse(JSON.stringify(getSnapshot()));
  fn(data);
  cache = data;
  localStorage.setItem(KEY, JSON.stringify(data));
  emit();
}

function findTable(data, tableId) {
  const t = data.tables.find((x) => x.id === Number(tableId));
  if (!t) throw new Error(`Table ${tableId} introuvable`);
  return t;
}

// ---------- Actions (interface resto) ----------

export function setGuests(tableId, guests) {
  mutate((data) => {
    const t = findTable(data, tableId);
    t.guests = Math.max(1, Math.min(12, guests));
    // Les items assignés à un client qui n'existe plus deviennent « partagés »
    t.items.forEach((it) => {
      if (it.client !== null && it.client > t.guests) it.client = null;
    });
  });
}

export function addItem(tableId, { menuId, qty, client }) {
  const m = MENU.find((x) => x.id === menuId);
  if (!m) return;
  mutate((data) => {
    const t = findTable(data, tableId);
    t.items.push({
      uid: `it-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      menuId: m.id,
      name: m.name,
      price: m.price,
      qty: Math.max(1, qty),
      client: client ?? null,
      paid: false,
    });
  });
}

export function removeItem(tableId, uid) {
  mutate((data) => {
    const t = findTable(data, tableId);
    t.items = t.items.filter((it) => it.uid !== uid);
  });
}

// « Marquer payée » / « Libérer la table » : remet la table à VIDE.
export function clearTable(tableId) {
  mutate((data) => {
    const t = findTable(data, tableId);
    t.items = [];
    t.payments = [];
    t.guests = 4;
  });
}

export function resetDemo() {
  localStorage.removeItem(KEY);
  cache = null;
  emit();
}

// ---------- Actions (interface client) ----------

// clients : liste de n° de clients qui paient ensemble ; includeShared : les
// items « non assignés » sont-ils inclus dans ce paiement ?
export function recordPayment(tableId, { clients, includeShared, amount, payerName }) {
  mutate((data) => {
    const t = findTable(data, tableId);
    t.items.forEach((it) => {
      if (it.paid) return;
      if (it.client === null ? includeShared : clients.includes(it.client)) {
        it.paid = true;
      }
    });
    t.payments.push({
      clients,
      includeShared,
      amount,
      payerName: payerName || 'Client',
      at: new Date().toISOString(),
    });
  });
}

// ---------- Helpers dérivés ----------

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function money(n) {
  return `${round2(n).toFixed(2).replace('.', ',')} $`;
}

export function lineTotal(it) {
  return round2(it.price * it.qty);
}

export function subtotalOf(items) {
  return round2(items.reduce((s, it) => s + lineTotal(it), 0));
}

export function taxesOf(subtotal) {
  const tps = round2(subtotal * TPS);
  const tvq = round2(subtotal * TVQ);
  return { tps, tvq, total: round2(subtotal + tps + tvq) };
}

export function withTaxes(subtotal) {
  return taxesOf(subtotal).total;
}

// 'VIDE' | 'ACTIVE' | 'FERMEE'
export function tableStatus(table) {
  if (!table.items.length) return 'VIDE';
  return table.items.every((it) => it.paid) ? 'FERMEE' : 'ACTIVE';
}

export function tableTotals(table) {
  const subtotal = subtotalOf(table.items);
  const paidSub = subtotalOf(table.items.filter((it) => it.paid));
  const remainingSub = round2(subtotal - paidSub);
  return {
    subtotal,
    total: withTaxes(subtotal),
    remainingSub,
    remainingTotal: withTaxes(remainingSub),
    paidTotal: withTaxes(paidSub),
  };
}

// Regroupe la facture par client : [{ client: 1..n | null, items, subtotal,
// total, paid }] — « paid » = tous les items de ce groupe sont réglés.
export function clientBreakdown(table) {
  const groups = [];
  for (let c = 1; c <= table.guests; c++) {
    const items = table.items.filter((it) => it.client === c);
    groups.push(makeGroup(c, items));
  }
  const shared = table.items.filter((it) => it.client === null);
  if (shared.length) groups.push(makeGroup(null, shared));
  return groups;
}

function makeGroup(client, items) {
  const subtotal = subtotalOf(items);
  return {
    client,
    label: client === null ? 'Partagé / non assigné' : `Client ${client}`,
    items,
    subtotal,
    total: withTaxes(subtotal),
    paid: items.length > 0 && items.every((it) => it.paid),
  };
}

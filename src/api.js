// Petit client API + helpers de query string partagés par toutes les pages.

import { useSearchParams } from 'react-router-dom';

export function useTableParams() {
  const [sp] = useSearchParams();
  const restId = sp.get('rest_id') || 'rest_demo';
  const tableId = sp.get('table_id') || '5';
  return { restId, tableId, query: `rest_id=${encodeURIComponent(restId)}&table_id=${encodeURIComponent(tableId)}` };
}

export async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body != null ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const fmtMoney = (n) => `$${Number(n).toFixed(2)}`;
export const fmtMoneyRound = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

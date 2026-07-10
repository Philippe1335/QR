// Appeler le serveur : 5 demandes rapides, un tap suffit.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useTableParams } from '../api.js';
import BackBar from '../components/BackBar.jsx';

const REQUESTS = [
  { type: 'ready_to_order', emoji: '🍽️', label: 'Prêt à commander' },
  { type: 'water', emoji: '💧', label: "De l'eau" },
  { type: 'condiments', emoji: '🧂', label: 'Condiments', sub: 'Ketchup, sel, poivre…' },
  { type: 'assistance', emoji: '🙋', label: 'Assistance générale' },
  { type: 'bill', emoji: '🧾', label: "Demander l'addition" }
];

export default function CallServer() {
  const { restId, tableId, query } = useTableParams();
  const [sent, setSent] = useState(null); // label de la demande envoyée
  const [busy, setBusy] = useState(false);

  async function send(request) {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/v1/server-request', {
        method: 'POST',
        body: { restaurant_id: restId, table_id: tableId, request_type: request.type }
      });
      setSent(request.label);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center text-neutral-900 dark:text-neutral-100">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-5xl text-green-700 dark:bg-green-950 dark:text-green-400">
          ✓
        </span>
        <h1 className="mt-6 text-2xl font-bold">Le serveur a été averti</h1>
        <p className="mt-2 text-lg text-neutral-600 dark:text-neutral-400">{sent} · Table {tableId}</p>
        <div className="mt-10 flex w-full flex-col gap-3">
          <button
            onClick={() => setSent(null)}
            className="w-full rounded-2xl border-2 border-blue-600 py-4 text-lg font-semibold text-blue-600 dark:border-blue-400 dark:text-blue-400"
          >
            Faire une autre demande
          </button>
          <Link to={`/table?${query}`} className="w-full rounded-2xl bg-blue-600 py-4 text-center text-lg font-semibold text-white">
            Retour à l'accueil
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-10 text-neutral-900 dark:text-neutral-100">
      <BackBar query={query} title="Appeler le serveur" />
      <div className="space-y-3 px-4 pt-6">
        {REQUESTS.map((r) => (
          <button
            key={r.type}
            onClick={() => send(r)}
            disabled={busy}
            className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 text-left shadow-sm active:scale-[0.99] disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <span className="text-3xl">{r.emoji}</span>
            <span>
              <span className="block text-lg font-semibold">{r.label}</span>
              {r.sub && <span className="block text-sm text-neutral-500 dark:text-neutral-400">{r.sub}</span>}
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}

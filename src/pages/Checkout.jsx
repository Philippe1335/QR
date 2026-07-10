// Paiement de la facture : affichage, split (tout / égal / par item),
// pourboire, paiement simulé, puis redirection vers le feedback.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtMoney, useTableParams } from '../api.js';
import BackBar from '../components/BackBar.jsx';
import SplitSelector from '../components/SplitSelector.jsx';

const round2 = (n) => Math.round(n * 100) / 100;

export default function Checkout() {
  const { restId, tableId, query } = useTableParams();
  const navigate = useNavigate();
  const [facture, setFacture] = useState(null);
  const [error, setError] = useState(null);
  const [split, setSplit] = useState('full');
  const [equalCount, setEqualCount] = useState(2);
  const [selectedClients, setSelectedClients] = useState(new Set(['1']));
  const [tipRate, setTipRate] = useState(0.18);
  const [customTip, setCustomTip] = useState(''); // montant $ si "autre"
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api(`/api/checkout/table?${query}`)
      .then(setFacture)
      .catch((err) => setError(err.message));
  }, [query]);

  const clientGroups = useMemo(() => {
    if (!facture) return [];
    const groups = new Map();
    for (const it of facture.items) {
      if (!groups.has(it.client_id)) groups.set(it.client_id, []);
      groups.get(it.client_id).push(it);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [facture]);

  const itemsTotal = (items) => items.reduce((s, it) => s + it.price * it.qty, 0);

  const amountDue = useMemo(() => {
    if (!facture) return 0;
    if (split === 'full') return facture.remaining;
    if (split === 'equal') return Math.min(round2(facture.total / equalCount), facture.remaining);
    let share = 0;
    for (const [clientId, items] of clientGroups) {
      if (selectedClients.has(clientId)) share += itemsTotal(items);
    }
    if (share <= 0) return 0;
    const withTax = share * (facture.total / (facture.subtotal || facture.total));
    return Math.min(round2(withTax), facture.remaining);
  }, [facture, split, equalCount, selectedClients, clientGroups]);

  const tip = useMemo(() => {
    if (tipRate === 'custom') return round2(Math.max(0, Number(customTip) || 0));
    return round2(amountDue * tipRate);
  }, [tipRate, customTip, amountDue]);

  async function pay(method) {
    if (paying || amountDue <= 0) return;
    setPaying(true);
    try {
      // Simule la latence du prestataire (Stripe test mode / Apple Pay).
      await new Promise((r) => setTimeout(r, 1300));
      const updated = await api(`/api/checkout/${facture.facture_id}/pay`, {
        method: 'POST',
        body: {
          amount: amountDue,
          tip,
          method,
          split_type: split,
          client_ids: split === 'by_item' ? [...selectedClients] : []
        }
      });
      navigate(`/feedback?${query}&facture_id=${updated.facture_id}&remaining=${updated.remaining}`);
    } catch (err) {
      alert(err.message);
      setPaying(false);
    }
  }

  function toggleClient(clientId) {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      next.has(clientId) ? next.delete(clientId) : next.add(clientId);
      return next;
    });
  }

  if (error) {
    return (
      <main className="mx-auto min-h-dvh max-w-md text-neutral-900 dark:text-neutral-100">
        <BackBar query={query} title="Payer la facture" />
        <p className="px-6 py-24 text-center text-lg text-neutral-500">{error}</p>
      </main>
    );
  }
  if (!facture) {
    return (
      <main className="mx-auto min-h-dvh max-w-md text-neutral-900 dark:text-neutral-100">
        <BackBar query={query} title="Payer la facture" />
        <p className="px-6 py-24 text-center text-lg text-neutral-500">Chargement de la facture…</p>
      </main>
    );
  }

  const showCheckboxes = split === 'by_item';

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-8 text-neutral-900 dark:text-neutral-100">
      <BackBar query={query} title={`Facture · Table ${facture.table_id}`} />

      <div className="space-y-5 px-4 pt-5">
        {/* Facture complète */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-3 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Votre addition</h2>
          {clientGroups.map(([clientId, items]) => (
            <div key={clientId} className="border-t border-neutral-100 py-2 first:border-t-0 dark:border-neutral-800">
              <label className={`flex items-center gap-3 py-1 font-semibold ${showCheckboxes ? 'cursor-pointer' : ''}`}>
                {showCheckboxes && (
                  <input
                    type="checkbox"
                    checked={selectedClients.has(clientId)}
                    onChange={() => toggleClient(clientId)}
                    className="h-6 w-6 accent-blue-600"
                  />
                )}
                <span>Client {clientId}</span>
                <span className="ml-auto tabular-nums">{fmtMoney(itemsTotal(items))}</span>
              </label>
              {items.map((it, i) => (
                <div key={i} className="flex justify-between py-1 text-[15px] text-neutral-600 dark:text-neutral-400">
                  <span>{it.qty > 1 ? `${it.qty}× ` : ''}{it.name}</span>
                  <span className="tabular-nums">{fmtMoney(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="mt-2 space-y-1 border-t border-neutral-200 pt-3 text-[15px] text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            <div className="flex justify-between"><span>Sous-total</span><span className="tabular-nums">{fmtMoney(facture.subtotal)}</span></div>
            {facture.tax > 0 && <div className="flex justify-between"><span>Taxes</span><span className="tabular-nums">{fmtMoney(facture.tax)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-neutral-900 dark:text-neutral-100">
              <span>Total</span><span className="tabular-nums">{fmtMoney(facture.total)}</span>
            </div>
            {facture.amount_paid > 0 && (
              <p className="pt-1 font-semibold text-green-700 dark:text-green-400">
                ✓ {fmtMoney(facture.amount_paid)} déjà payé — reste {fmtMoney(facture.remaining)}
              </p>
            )}
          </div>
        </section>

        {/* Split */}
        <SplitSelector
          split={split}
          onSplit={setSplit}
          equalCount={equalCount}
          onEqualCount={setEqualCount}
          clientGroups={clientGroups}
          selectedClients={selectedClients}
          onToggleClient={toggleClient}
          perShare={round2(facture.total / equalCount)}
        />

        {/* Pourboire */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-3 text-xs font-semibold tracking-wider text-neutral-500 uppercase">Pourboire</h2>
          <div className="grid grid-cols-4 gap-2">
            {[0.15, 0.18, 0.2].map((rate) => (
              <button
                key={rate}
                onClick={() => setTipRate(rate)}
                className={`rounded-xl border-2 py-3 font-semibold ${
                  tipRate === rate
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {Math.round(rate * 100)}%
                <span className="block text-xs font-normal text-neutral-500">{fmtMoney(amountDue * rate)}</span>
              </button>
            ))}
            <button
              onClick={() => setTipRate('custom')}
              className={`rounded-xl border-2 py-3 font-semibold ${
                tipRate === 'custom'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300'
                  : 'border-neutral-200 dark:border-neutral-700'
              }`}
            >
              Autre
            </button>
          </div>
          {tipRate === 'custom' && (
            <input
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              placeholder="Montant en $"
              value={customTip}
              onChange={(e) => setCustomTip(e.target.value)}
              className="mt-3 w-full rounded-xl border-2 border-neutral-200 bg-transparent px-4 py-3 text-lg dark:border-neutral-700"
            />
          )}
        </section>

        {/* Paiement */}
        <div className="space-y-2.5">
          <button
            onClick={() => pay('apple_pay')}
            disabled={paying || amountDue <= 0}
            className="w-full rounded-2xl bg-black py-4 text-lg font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {paying ? 'Paiement en cours…' : ` Payer ${fmtMoney(amountDue + tip)}`}
          </button>
          <button
            onClick={() => pay('card')}
            disabled={paying || amountDue <= 0}
            className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-bold text-white disabled:opacity-50"
          >
            {paying ? 'Paiement en cours…' : `💳 Payer par carte ${fmtMoney(amountDue + tip)}`}
          </button>
          <p className="text-center text-xs text-neutral-400">
            Stripe test mode — aucun montant réel débité (carte test : 4242 4242 4242 4242)
          </p>
        </div>
      </div>
    </main>
  );
}

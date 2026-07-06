import { useState } from 'react';
import { money } from '../store.js';

// Paiement simulé façon « Stripe test mode » : aucune transaction réelle.
// Carte de test : 4242 4242 4242 4242.
export default function PaymentForm({ amount, onSuccess, onCancel }) {
  const [name, setName] = useState('');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  function formatCard(value) {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  }

  function formatExpiry(value) {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  }

  function submit(e) {
    e.preventDefault();
    setError('');
    const digits = card.replace(/\D/g, '');
    if (!name.trim()) return setError('Entrez le nom sur la carte.');
    if (digits.length !== 16) return setError('Numéro de carte invalide (16 chiffres).');

    setProcessing(true);
    // Simulation d'un appel Stripe (test mode) — ~1,2 s de latence.
    setTimeout(() => {
      if (digits === '4242424242424242') {
        onSuccess(name.trim());
      } else {
        setProcessing(false);
        setError('Carte refusée (mode test : utilisez 4242 4242 4242 4242).');
      }
    }, 1200);
  }

  return (
    <form className="pay-form" onSubmit={submit}>
      <div className="pay-form-badge">🔒 Paiement simulé — Stripe test mode</div>

      <label className="field">
        <span>Nom sur la carte</span>
        <input
          type="text"
          autoComplete="cc-name"
          placeholder="Jean Tremblay"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={processing}
        />
      </label>

      <label className="field">
        <span>Numéro de carte</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          value={card}
          onChange={(e) => setCard(formatCard(e.target.value))}
          disabled={processing}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Expiration</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="12/28"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            disabled={processing}
          />
        </label>
        <label className="field">
          <span>CVC</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            maxLength={4}
            disabled={processing}
          />
        </label>
      </div>

      {error && <p className="pay-error">⚠️ {error}</p>}

      <button type="submit" className="btn btn-primary btn-block btn-xl" disabled={processing}>
        {processing ? 'Paiement en cours…' : `Payer maintenant ${money(amount)}`}
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={onCancel} disabled={processing}>
        ← Retour
      </button>

      <p className="pay-hint">Carte de test : 4242 4242 4242 4242 — aucune somme réelle n'est débitée.</p>
    </form>
  );
}

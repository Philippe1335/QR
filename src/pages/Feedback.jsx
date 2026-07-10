// Feedback post-paiement : 2 questions max.
// Q1 : note 1-5. Q2 : avis Google (si 4-5) ou "quoi améliorer" (si 1-3).
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useTableParams } from '../api.js';
import RatingStars from '../components/RatingStars.jsx';

const ISSUES = [
  { id: 'slow_service', label: '🐢 Service lent' },
  { id: 'order_error', label: '📝 Erreur de commande' },
  { id: 'food_quality', label: '🍽️ Qualité de la nourriture' },
  { id: 'other', label: '💬 Autre' }
];

// Lien d'avis Google du restaurant (mock pour le MVP).
const GOOGLE_REVIEW_URL = 'https://www.google.com/maps';

export default function Feedback() {
  const { query } = useTableParams();
  const [sp] = useSearchParams();
  const factureId = sp.get('facture_id');
  const remaining = Number(sp.get('remaining') || 0);

  const [rating, setRating] = useState(0);
  const [step, setStep] = useState('q1'); // q1 | q2 | done
  const [issue, setIssue] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit({ googleReview = false } = {}) {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/v1/feedback', {
        method: 'POST',
        body: {
          facture_id: factureId,
          rating,
          comment: comment || null,
          issue_type: issue,
          google_review: googleReview
        }
      });
    } catch {
      // Le feedback ne doit jamais bloquer le client : on continue quoi qu'il arrive.
    }
    if (googleReview) window.open(GOOGLE_REVIEW_URL, '_blank');
    setStep('done');
    setBusy(false);
  }

  if (step === 'done') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center text-neutral-900 dark:text-neutral-100">
        <span className="text-6xl">🙏</span>
        <h1 className="mt-5 text-3xl font-bold">Merci de votre visite !</h1>
        <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
          {remaining > 0 ? `Il reste $${remaining.toFixed(2)} à payer sur la table.` : 'À bientôt !'}
        </p>
        {remaining > 0 && (
          <Link
            to={`/checkout?${query}`}
            className="mt-8 w-full rounded-2xl bg-blue-600 py-4 text-center text-lg font-bold text-white"
          >
            Payer une autre part
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10 text-neutral-900 dark:text-neutral-100">
      <div className="text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-700 dark:bg-green-950 dark:text-green-400">
          ✓
        </span>
        <h1 className="mt-4 text-2xl font-bold">Paiement reçu</h1>
      </div>

      {step === 'q1' && (
        <section className="mt-12 text-center">
          <h2 className="text-xl font-semibold">Comment était votre expérience ?</h2>
          <div className="mt-6">
            <RatingStars value={rating} onChange={(r) => { setRating(r); setStep('q2'); }} />
          </div>
          <button onClick={() => setStep('done')} className="mt-10 text-sm text-neutral-400 underline">
            Passer
          </button>
        </section>
      )}

      {step === 'q2' && rating >= 4 && (
        <section className="mt-12 text-center">
          <p className="text-4xl">{'⭐'.repeat(rating)}</p>
          <h2 className="mt-5 text-xl font-semibold">Génial ! Voulez-vous laisser un avis Google ?</h2>
          <p className="mt-1 text-neutral-500 dark:text-neutral-400">Ça aide énormément le restaurant.</p>
          <div className="mt-8 space-y-3">
            <button
              onClick={() => submit({ googleReview: true })}
              disabled={busy}
              className="w-full rounded-2xl bg-blue-600 py-4 text-lg font-bold text-white disabled:opacity-50"
            >
              ⭐ Laisser un avis Google
            </button>
            <button
              onClick={() => submit()}
              disabled={busy}
              className="w-full rounded-2xl border-2 border-neutral-200 py-4 text-lg font-semibold text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
            >
              Non merci
            </button>
          </div>
        </section>
      )}

      {step === 'q2' && rating <= 3 && (
        <section className="mt-12">
          <h2 className="text-center text-xl font-semibold">Qu'est-ce qui pourrait être amélioré ?</h2>
          <div className="mt-6 space-y-2.5">
            {ISSUES.map((i) => (
              <button
                key={i.id}
                onClick={() => setIssue(i.id)}
                className={`w-full rounded-2xl border-2 p-4 text-left text-lg font-semibold ${
                  issue === i.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Un mot de plus ? (optionnel)"
            rows={2}
            maxLength={500}
            className="mt-3 w-full rounded-2xl border-2 border-neutral-200 bg-white p-4 text-lg dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            onClick={() => submit()}
            disabled={busy}
            className="mt-4 w-full rounded-2xl bg-blue-600 py-4 text-lg font-bold text-white disabled:opacity-50"
          >
            Envoyer
          </button>
        </section>
      )}
    </main>
  );
}

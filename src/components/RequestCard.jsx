// Carte d'une demande sur la tablette serveur.
// Code couleur : rouge = urgent (assistance/addition), jaune = normal, gris = traité.
import { useEffect, useState } from 'react';

export const REQUEST_META = {
  ready_to_order: { emoji: '🍽️', label: 'Prêt à commander' },
  water: { emoji: '💧', label: "De l'eau" },
  condiments: { emoji: '🧂', label: 'Condiments' },
  assistance: { emoji: '🙋', label: 'Assistance' },
  bill: { emoji: '🧾', label: "L'addition" }
};

const URGENT_TYPES = ['assistance', 'bill'];

function timeAgo(iso) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000));
  if (seconds < 60) return `Il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes} min`;
  return `Il y a ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default function RequestCard({ request, onHandle }) {
  // Re-rend chaque seconde pour que "il y a X s" reste vivant.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const meta = REQUEST_META[request.request_type] || { emoji: '❓', label: request.request_type };
  const handled = request.status === 'handled';
  const urgent = !handled && URGENT_TYPES.includes(request.request_type);

  const tone = handled
    ? 'border-neutral-200 bg-neutral-50 opacity-60 dark:border-neutral-800 dark:bg-neutral-900'
    : urgent
      ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950'
      : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950';

  return (
    <div className={`flex items-center gap-4 rounded-2xl border-2 p-4 ${tone}`}>
      <span className="text-3xl">{meta.emoji}</span>
      <div className="min-w-0">
        <p className="text-lg font-bold">
          Table {request.table_id} <span className="font-normal text-neutral-500">•</span> {meta.label}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {handled ? '✓ Traité' : timeAgo(request.created_at)}
        </p>
      </div>
      {!handled && (
        <button
          onClick={() => onHandle(request.id)}
          className="ml-auto shrink-0 rounded-xl bg-neutral-900 px-5 py-3 font-bold text-white active:scale-95 dark:bg-white dark:text-black"
        >
          Traité
        </button>
      )}
    </div>
  );
}

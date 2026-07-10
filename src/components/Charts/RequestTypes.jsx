// Répartition des demandes serveur + temps de réponse moyen.
// Barres de pourcentage simples : plus lisible qu'un camembert pour 5 types.
import { REQUEST_META } from '../RequestCard.jsx';

export default function RequestTypes({ metrics }) {
  const max = Math.max(...metrics.by_type.map((t) => t.pct), 1);
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-4">
        <div className="rounded-xl bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Demandes reçues</p>
          <p className="text-xl font-semibold">{metrics.total}</p>
        </div>
        <div className="rounded-xl bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Temps de réponse moyen</p>
          <p className="text-xl font-semibold">
            {metrics.avg_response_minutes != null ? `${metrics.avg_response_minutes} min` : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">En attente</p>
          <p className="text-xl font-semibold">{metrics.pending}</p>
        </div>
      </div>

      <div className="space-y-3">
        {metrics.by_type.map((t) => {
          const meta = REQUEST_META[t.type] || { emoji: '❓', label: t.type };
          return (
            <div key={t.type} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-sm">
                {meta.emoji} {meta.label}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full rounded"
                  style={{ width: `${(t.pct / max) * 100}%`, background: 'var(--series-1)' }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                {t.pct}% <span className="text-neutral-400">({t.count})</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

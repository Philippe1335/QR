// Feedback client : score moyen, distribution 5★→1★, % avis Google,
// et commentaires négatifs récents pour action rapide.
const ISSUE_LABELS = {
  slow_service: 'Service lent',
  order_error: 'Erreur de commande',
  food_quality: 'Qualité nourriture',
  other: 'Autre'
};

export default function FeedbackScore({ feedback }) {
  const max = Math.max(...feedback.distribution.map((d) => d.count), 1);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="mb-5 flex items-end gap-6">
          <div>
            <p className="text-4xl font-bold">
              {feedback.avg_rating != null ? feedback.avg_rating : '—'}
              <span className="text-xl font-normal text-neutral-400"> / 5</span>
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{feedback.total} réponses</p>
          </div>
          <div className="pb-1">
            <p className="text-xl font-semibold">{feedback.google_review_pct}%</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">ont laissé un avis Google</p>
          </div>
        </div>
        <div className="space-y-2">
          {feedback.distribution.map((d) => (
            <div key={d.stars} className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-sm tabular-nums">{d.stars} ★</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(d.count / max) * 100}%`,
                    background: d.stars >= 4 ? 'var(--series-2)' : d.stars === 3 ? 'var(--series-3)' : 'var(--series-6)'
                  }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-sm tabular-nums text-neutral-500">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
          Commentaires négatifs récents
        </h3>
        {feedback.negative_comments.length === 0 && (
          <p className="text-sm text-neutral-400">Aucun — tout va bien 🎉</p>
        )}
        <ul className="space-y-2">
          {feedback.negative_comments.map((c, i) => (
            <li key={i} className="rounded-xl bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
              <span className="font-semibold">{'★'.repeat(c.rating)}{'☆'.repeat(5 - c.rating)}</span>
              {c.issue_type && (
                <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                  {ISSUE_LABELS[c.issue_type] || c.issue_type}
                </span>
              )}
              {c.comment && <p className="mt-1 text-neutral-600 dark:text-neutral-300">« {c.comment} »</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

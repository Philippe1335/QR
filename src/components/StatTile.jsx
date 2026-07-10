// Tuile de statistique : label, valeur, delta optionnel vs période précédente.
export default function StatTile({ label, value, deltaPct, upIsGood = true }) {
  const up = deltaPct != null && deltaPct >= 0;
  const good = up === upIsGood;
  return (
    <div className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {deltaPct != null && (
        <p className="mt-1 text-xs font-semibold" style={{ color: good ? 'var(--up)' : 'var(--down)' }}>
          {up ? '↑' : '↓'} {Math.abs(deltaPct)}%{' '}
          <span className="font-normal text-neutral-400">vs période préc.</span>
        </p>
      )}
    </div>
  );
}

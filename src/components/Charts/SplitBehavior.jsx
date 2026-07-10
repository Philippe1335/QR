// Comportement de split : comment les tables choisissent de payer.
const EMOJI = { full: '💳', equal: '➗', by_item: '🧾' };

export default function SplitBehavior({ data }) {
  return (
    <div className="space-y-4">
      {data.map((s) => (
        <div key={s.type}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span>{EMOJI[s.type]} {s.label}</span>
            <span className="font-semibold tabular-nums">
              {s.pct}% <span className="font-normal text-neutral-400">({s.count} tables)</span>
            </span>
          </div>
          <div className="h-5 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800">
            <div className="h-full rounded" style={{ width: `${s.pct}%`, background: 'var(--series-1)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

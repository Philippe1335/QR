// Choix du mode de division : tout / également / par item.
// Rend aussi les contrôles propres à chaque mode (nb de personnes, cases par client).
import { fmtMoney } from '../api.js';

const MODES = [
  { id: 'full', label: 'Payer tout' },
  { id: 'equal', label: 'Diviser également' },
  { id: 'by_item', label: 'Par item' }
];

export default function SplitSelector({
  split,
  onSplit,
  equalCount,
  onEqualCount,
  clientGroups,
  selectedClients,
  onToggleClient,
  perShare
}) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => onSplit(m.id)}
            className={`rounded-xl border-2 px-2 py-3 text-sm font-semibold ${
              split === m.id
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300'
                : 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {split === 'equal' && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div>
            <p className="font-semibold">Entre combien de personnes ?</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{fmtMoney(perShare)} par personne</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onEqualCount(Math.max(2, equalCount - 1))}
              className="h-11 w-11 rounded-full bg-neutral-100 text-xl font-bold dark:bg-neutral-800"
              aria-label="Moins de personnes"
            >
              −
            </button>
            <span className="w-6 text-center text-xl font-bold tabular-nums">{equalCount}</span>
            <button
              onClick={() => onEqualCount(Math.min(12, equalCount + 1))}
              className="h-11 w-11 rounded-full bg-neutral-100 text-xl font-bold dark:bg-neutral-800"
              aria-label="Plus de personnes"
            >
              +
            </button>
          </div>
        </div>
      )}

      {split === 'by_item' && (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          Coche les clients dont tu paies la part (plusieurs choix possibles) :
        </p>
      )}
    </div>
  );
}

export { MODES };

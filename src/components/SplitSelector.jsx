import { money } from '../store.js';

// Sélection des clients qui paient ensemble. groups = clientBreakdown(table)
// non payés ; selected = Set de clés ('1', '2', … ou 'shared').
export function groupKey(g) {
  return g.client === null ? 'shared' : String(g.client);
}

export default function SplitSelector({ groups, selected, onToggle }) {
  return (
    <div className="split-list">
      {groups.map((g) => {
        const key = groupKey(g);
        const checked = selected.has(key);
        return (
          <label key={key} className={`split-row${checked ? ' is-checked' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(key)}
            />
            <span className="split-name">
              {g.label}
              <small>
                {g.items.map((it) => (it.qty > 1 ? `${it.qty}× ` : '') + it.name).join(', ')}
              </small>
            </span>
            <span className="split-amount">{money(g.total)}</span>
          </label>
        );
      })}
    </div>
  );
}

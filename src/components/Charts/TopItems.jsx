// Top 10 des items : barres horizontales (revenue) + tableau qty/trend.
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList
} from 'recharts';
import { fmtMoneyRound } from '../../api.js';
import { AXIS_TICK, TOOLTIP_STYLE } from './chartTheme.js';

function Trend({ pct }) {
  if (pct == null) return <span className="text-neutral-400">—</span>;
  return (
    <span className="font-semibold" style={{ color: pct >= 0 ? 'var(--up)' : 'var(--down)' }}>
      {pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}%
    </span>
  );
}

export default function TopItems({ items }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={items.length * 34 + 10}>
        <BarChart data={items} layout="vertical" margin={{ left: 8, right: 56, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ ...AXIS_TICK, fill: 'currentColor' }} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [fmtMoneyRound(v), 'Revenue']} />
          <Bar dataKey="revenue" fill="var(--series-1)" radius={[0, 4, 4, 0]} barSize={20}>
            <LabelList dataKey="revenue" position="right" formatter={fmtMoneyRound} style={{ fontSize: 11, fill: '#898781' }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs tracking-wider text-neutral-400 uppercase dark:border-neutral-700">
              <th className="py-2 pr-2">Item</th>
              <th className="py-2 pr-2 text-right">Qté</th>
              <th className="py-2 pr-2 text-right">Revenue</th>
              <th className="py-2 pr-2 text-right">Trend</th>
              <th className="py-2 text-right">% total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.name} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="py-2 pr-2">{it.name}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{it.qty}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{fmtMoneyRound(it.revenue)}</td>
                <td className="py-2 pr-2 text-right"><Trend pct={it.trend_pct} /></td>
                <td className="py-2 text-right tabular-nums">{it.share_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

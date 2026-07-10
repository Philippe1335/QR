// Jours de pointe : revenue par jour de la semaine (lundi → dimanche).
// Les 2 meilleurs jours en pleine teinte, le reste atténué (emphase).
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import { fmtMoneyRound } from '../../api.js';
import { AXIS_TICK, TOOLTIP_STYLE } from './chartTheme.js';

export default function PeakDays({ series }) {
  const top2 = [...series].sort((a, b) => b.revenue - a.revenue).slice(0, 2).map((d) => d.day);
  const data = series.map((d) => ({ ...d, label: d.day.slice(0, 3) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -18, right: 8, top: 18, bottom: 0 }}>
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${v}`)}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v) => [fmtMoneyRound(v), 'Revenue']}
          labelFormatter={(l, payload) => payload?.[0]?.payload?.day || l}
        />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={24}>
          {data.map((d) => (
            <Cell key={d.day} fill="var(--series-1)" fillOpacity={top2.includes(d.day) ? 1 : 0.45} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

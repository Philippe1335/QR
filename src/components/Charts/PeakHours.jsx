// Heures de pointe : transactions par heure de la journée.
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from './chartTheme.js';

export default function PeakHours({ series }) {
  const data = series.map((d) => ({ ...d, label: `${d.hour}h` }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -18, right: 12, top: 10, bottom: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} interval={2} axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v, name) => {
            if (name === 'transactions') return [v, 'Transactions'];
            return [v, name];
          }}
          labelFormatter={(l) => `${l} – ${parseInt(l) + 1}h`}
        />
        <Area
          type="monotone"
          dataKey="transactions"
          stroke="var(--series-1)"
          strokeWidth={2}
          fill="var(--series-1)"
          fillOpacity={0.1}
          activeDot={{ r: 5, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

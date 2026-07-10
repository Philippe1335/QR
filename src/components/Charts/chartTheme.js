// Réglages Recharts partagés, alignés sur la palette data-viz validée.
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)', 'var(--series-6)'];
export const AXIS_TICK = { fontSize: 11, fill: '#898781' };
export const GRID = { stroke: 'currentColor', strokeOpacity: 0.12, vertical: false };

export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid rgba(128,128,128,0.25)',
    background: 'var(--tooltip-bg, #fff)',
    fontSize: 12
  },
  cursor: { fill: 'rgba(128,128,128,0.08)' }
};

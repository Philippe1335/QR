import { Link } from 'react-router-dom';
import { money, resetDemo, tableStatus, tableTotals, useStore } from '../store.js';
import TableCard from '../components/TableCard.jsx';

export default function RestaurantDashboard() {
  const { tables } = useStore();
  const active = tables.filter((t) => tableStatus(t) === 'ACTIVE');
  const revenue = tables.reduce((s, t) => s + tableTotals(t).paidTotal, 0);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>👨‍🍳 Gestion du restaurant</h1>
          <p className="admin-sub">
            {active.length} table{active.length > 1 ? 's' : ''} active
            {active.length > 1 ? 's' : ''} · {money(revenue)} encaissés
          </p>
        </div>
        <div className="admin-header-actions">
          <Link to="/admin/qr" className="btn btn-outline">
            🖨️ QR codes
          </Link>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (confirm('Réinitialiser toutes les données de démo ?')) resetDemo();
            }}
          >
            ↺ Réinitialiser la démo
          </button>
        </div>
      </header>

      <div className="tables-grid">
        {tables.map((t) => (
          <TableCard key={t.id} table={t} />
        ))}
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { money, tableStatus, tableTotals } from '../store.js';

const STATUS = {
  VIDE: { label: 'VIDE', cls: 'status-vide' },
  ACTIVE: { label: 'ACTIVE', cls: 'status-active' },
  FERMEE: { label: 'FERMÉE', cls: 'status-fermee' },
};

export default function TableCard({ table }) {
  const status = tableStatus(table);
  const { total, remainingTotal } = tableTotals(table);
  const s = STATUS[status];

  return (
    <div className={`table-card ${s.cls}`}>
      <div className="table-card-head">
        <h3>Table {table.id}</h3>
        <span className={`status-pill ${s.cls}`}>{s.label}</span>
      </div>

      {status === 'VIDE' ? (
        <p className="table-card-empty">Aucune facture</p>
      ) : (
        <div className="table-card-body">
          <div className="table-card-amount">{money(total)}</div>
          {status === 'ACTIVE' && remainingTotal < total && (
            <div className="table-card-remaining">reste {money(remainingTotal)}</div>
          )}
          <div className="table-card-meta">
            👥 {table.guests} client{table.guests > 1 ? 's' : ''} · {table.items.length}{' '}
            article{table.items.length > 1 ? 's' : ''}
          </div>
        </div>
      )}

      <Link to={`/admin/table/${table.id}`} className="btn btn-dark btn-block">
        Gérer
      </Link>
    </div>
  );
}

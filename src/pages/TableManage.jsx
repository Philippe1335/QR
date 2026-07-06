import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  addItem,
  clearTable,
  clientBreakdown,
  lineTotal,
  money,
  removeItem,
  setGuests,
  tableStatus,
  tableTotals,
  taxesOf,
  useTable,
} from '../store.js';
import { MENU } from '../data/mockData.js';

export default function TableManage() {
  const { id } = useParams();
  const table = useTable(id);

  if (!table) {
    return (
      <div className="admin-page">
        <p>Table introuvable.</p>
        <Link to="/admin" className="btn btn-dark">← Retour aux tables</Link>
      </div>
    );
  }

  const status = tableStatus(table);
  const totals = tableTotals(table);
  const groups = clientBreakdown(table).filter((g) => g.items.length);
  const payUrl = `${window.location.origin}/pay?table=${table.id}`;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <Link to="/admin" className="back-link">← Toutes les tables</Link>
          <h1>
            Table {table.id}{' '}
            <span className={`status-pill status-${status.toLowerCase()}`}>
              {status === 'FERMEE' ? 'FERMÉE' : status}
            </span>
          </h1>
        </div>
        {status !== 'VIDE' && (
          <button
            className="btn btn-success"
            onClick={() => {
              if (confirm(`Fermer la facture de la table ${table.id} et libérer la table ?`)) {
                clearTable(table.id);
              }
            }}
          >
            {status === 'FERMEE' ? '✓ Libérer la table' : '✓ Marquer comme payée'}
          </button>
        )}
      </header>

      <div className="manage-grid">
        <section className="panel">
          <h2>Ajouter un article</h2>
          <AddItemForm table={table} />

          <h2 className="panel-h2-gap">Clients à table</h2>
          <div className="guests-spinner">
            <button
              className="btn btn-outline btn-round"
              onClick={() => setGuests(table.id, table.guests - 1)}
              disabled={table.guests <= 1}
            >
              −
            </button>
            <span className="guests-count">👥 {table.guests}</span>
            <button
              className="btn btn-outline btn-round"
              onClick={() => setGuests(table.id, table.guests + 1)}
              disabled={table.guests >= 12}
            >
              +
            </button>
          </div>

          <h2 className="panel-h2-gap">QR code de la table</h2>
          <div className="manage-qr">
            <QRCodeSVG value={payUrl} size={120} />
            <div>
              <p className="qr-url">{payUrl}</p>
              <a href={payUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                Ouvrir la page client ↗
              </a>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Facture en temps réel</h2>
          {groups.length === 0 ? (
            <p className="facture-empty">Aucun article. Ajoutez-en un à gauche !</p>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.label} className={`facture-group${g.paid ? ' is-paid' : ''}`}>
                  <div className="facture-group-head">
                    <span>
                      {g.label}
                      {g.paid && <span className="paid-badge">✓ payé</span>}
                    </span>
                    <span>{money(g.subtotal)}</span>
                  </div>
                  {g.items.map((it) => (
                    <div key={it.uid} className={`facture-line manage-line${it.paid ? ' is-paid' : ''}`}>
                      <span>
                        {it.qty > 1 ? `${it.qty} × ` : ''}
                        {it.name}
                      </span>
                      <span className="manage-line-right">
                        {money(lineTotal(it))}
                        {!it.paid && (
                          <button
                            className="btn-delete"
                            title="Retirer cet article"
                            onClick={() => removeItem(table.id, it.uid)}
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ))}

              <div className="facture-totals">
                <div className="facture-line">
                  <span>Sous-total</span>
                  <span>{money(totals.subtotal)}</span>
                </div>
                <div className="facture-line muted">
                  <span>TPS + TVQ</span>
                  <span>{money(totals.total - totals.subtotal)}</span>
                </div>
                <div className="facture-line facture-total">
                  <span>TOTAL</span>
                  <span>{money(totals.total)}</span>
                </div>
                {totals.paidTotal > 0 && (
                  <>
                    <div className="facture-line paid-line">
                      <span>Déjà payé</span>
                      <span>− {money(totals.paidTotal)}</span>
                    </div>
                    <div className="facture-line facture-total">
                      <span>RESTE À PAYER</span>
                      <span>{money(totals.remainingTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {table.payments.length > 0 && (
            <>
              <h2 className="panel-h2-gap">Paiements reçus</h2>
              <ul className="payments-list">
                {table.payments.map((p, i) => (
                  <li key={i}>
                    💳 <strong>{money(p.amount)}</strong> — {p.payerName} (
                    {[
                      ...p.clients.map((c) => `Client ${c}`),
                      ...(p.includeShared ? ['partagé'] : []),
                    ].join(', ')}
                    ) · {new Date(p.at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function AddItemForm({ table }) {
  const [menuId, setMenuId] = useState(MENU[0].id);
  const [qty, setQty] = useState(1);
  const [client, setClient] = useState('null');

  const cats = [...new Set(MENU.map((m) => m.cat))];
  const selected = MENU.find((m) => m.id === menuId);

  function submit(e) {
    e.preventDefault();
    addItem(table.id, {
      menuId,
      qty: Number(qty),
      client: client === 'null' ? null : Number(client),
    });
    setQty(1);
  }

  return (
    <form className="add-item-form" onSubmit={submit}>
      <label className="field">
        <span>Article</span>
        <select value={menuId} onChange={(e) => setMenuId(e.target.value)}>
          {cats.map((cat) => (
            <optgroup key={cat} label={cat}>
              {MENU.filter((m) => m.cat === cat).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {money(m.price)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="field-row">
        <label className="field">
          <span>Quantité</span>
          <input
            type="number"
            min="1"
            max="20"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Pour qui ?</span>
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="null">Non assigné (partagé)</option>
            {Array.from({ length: table.guests }, (_, i) => i + 1).map((c) => (
              <option key={c} value={c}>
                Client {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button type="submit" className="btn btn-primary btn-block">
        + Ajouter à la facture{selected ? ` (${money(selected.price * Number(qty || 1))})` : ''}
      </button>
    </form>
  );
}

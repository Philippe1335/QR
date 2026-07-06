import { clientBreakdown, lineTotal, money, subtotalOf, taxesOf } from '../store.js';

// Facture complète d'une table, groupée par client. showPaid : afficher aussi
// les groupes déjà réglés (grisés) — côté client on les masque (« les items
// des clients qui ont payé disparaissent »).
export default function FactureDisplay({ table, showPaid = false }) {
  const groups = clientBreakdown(table).filter(
    (g) => g.items.length && (showPaid || !g.paid)
  );
  const visibleItems = groups.flatMap((g) => g.items.filter((it) => showPaid || !it.paid));
  const subtotal = subtotalOf(visibleItems);
  const { tps, tvq, total } = taxesOf(subtotal);

  if (!groups.length) {
    return <p className="facture-empty">Aucun article sur cette facture.</p>;
  }

  return (
    <div className="facture">
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
            <div key={it.uid} className={`facture-line${it.paid ? ' is-paid' : ''}`}>
              <span>
                {it.qty > 1 ? `${it.qty} × ` : ''}
                {it.name}
              </span>
              <span>{money(lineTotal(it))}</span>
            </div>
          ))}
        </div>
      ))}

      <div className="facture-totals">
        <div className="facture-line">
          <span>Sous-total</span>
          <span>{money(subtotal)}</span>
        </div>
        <div className="facture-line muted">
          <span>TPS (5 %)</span>
          <span>{money(tps)}</span>
        </div>
        <div className="facture-line muted">
          <span>TVQ (9,975 %)</span>
          <span>{money(tvq)}</span>
        </div>
        <div className="facture-line facture-total">
          <span>TOTAL</span>
          <span>{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

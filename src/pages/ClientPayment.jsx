import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  clientBreakdown,
  money,
  recordPayment,
  subtotalOf,
  tableStatus,
  tableTotals,
  taxesOf,
  useTable,
} from '../store.js';
import { TABLE_COUNT } from '../data/mockData.js';
import FactureDisplay from '../components/FactureDisplay.jsx';
import SplitSelector, { groupKey } from '../components/SplitSelector.jsx';
import PaymentForm from '../components/PaymentForm.jsx';

export default function ClientPayment() {
  const [params] = useSearchParams();
  const tableId = Number(params.get('table'));
  const hasTable = tableId >= 1 && tableId <= TABLE_COUNT;

  if (!hasTable) return <TableInput />;
  return <PaymentFlow key={tableId} tableId={tableId} />;
}

// Pas de paramètre ?table= → saisie manuelle du numéro de table.
function TableInput() {
  const navigate = useNavigate();
  const [num, setNum] = useState('');

  function go(e) {
    e.preventDefault();
    const n = Number(num);
    if (n >= 1 && n <= TABLE_COUNT) navigate(`/pay?table=${n}`);
  }

  return (
    <div className="client-page">
      <div className="client-header">
        <h1>📱 Payer ma facture</h1>
      </div>
      <p className="client-intro">
        Scannez le QR code sur votre table, ou entrez votre numéro de table :
      </p>
      <form onSubmit={go} className="table-input-form">
        <input
          type="number"
          min="1"
          max={TABLE_COUNT}
          inputMode="numeric"
          placeholder="N° de table"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-block btn-xl" disabled={!num}>
          Voir ma facture
        </button>
      </form>
    </div>
  );
}

// step : 'view' → 'split' → 'pay' → 'done'
function PaymentFlow({ tableId }) {
  const table = useTable(tableId);
  const [step, setStep] = useState('view');
  const [selected, setSelected] = useState(new Set());
  const [lastPaid, setLastPaid] = useState(null);

  const status = table ? tableStatus(table) : null;
  const unpaidGroups = useMemo(
    () => (table ? clientBreakdown(table).filter((g) => g.items.length && !g.paid) : []),
    [table]
  );

  if (!table) return <ClientMessage emoji="❓" title={`Table ${tableId} introuvable`} />;

  if (step === 'done') {
    const allSettled = status === 'FERMEE';
    return (
      <ClientMessage
        emoji="✓"
        success
        title="Paiement complété — Merci !"
        body={
          <>
            <p className="done-amount">{money(lastPaid ?? 0)}</p>
            {allSettled ? (
              <p>La facture de la table {tableId} est entièrement réglée. 🎉</p>
            ) : (
              <>
                <p>
                  Il reste {money(tableTotals(table).remainingTotal)} à payer sur
                  cette table.
                </p>
                <button
                  className="btn btn-primary btn-block btn-xl"
                  onClick={() => {
                    setSelected(new Set());
                    setStep('view');
                  }}
                >
                  Payer une autre part
                </button>
              </>
            )}
          </>
        }
      />
    );
  }

  if (status === 'VIDE') {
    return (
      <ClientMessage
        emoji="🪑"
        title={`Table ${tableId}`}
        body={<p>Aucune facture active sur cette table pour le moment. Demandez à votre serveur !</p>}
      />
    );
  }

  if (status === 'FERMEE') {
    return (
      <ClientMessage
        emoji="✓"
        success
        title="Facture réglée"
        body={<p>La facture de la table {tableId} est entièrement payée. Merci et à bientôt ! 👋</p>}
      />
    );
  }

  // Montant de la sélection courante (taxes incluses, calculées sur le sous-total sélectionné)
  const selectedGroups = unpaidGroups.filter((g) => selected.has(groupKey(g)));
  const selectedItems = selectedGroups.flatMap((g) => g.items);
  const selectedAmount = taxesOf(subtotalOf(selectedItems)).total;
  const remainingTotal = tableTotals(table).remainingTotal;

  function payEverything() {
    setSelected(new Set(unpaidGroups.map(groupKey)));
    setStep('pay');
  }

  function toggle(key) {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  }

  function onPaid(payerName) {
    const clients = selectedGroups.filter((g) => g.client !== null).map((g) => g.client);
    const includeShared = selectedGroups.some((g) => g.client === null);
    recordPayment(tableId, {
      clients,
      includeShared,
      amount: selectedAmount,
      payerName,
    });
    setLastPaid(selectedAmount);
    setStep('done');
  }

  return (
    <div className="client-page">
      <div className="client-header">
        <h1>Table {tableId}</h1>
        <span className="client-header-total">{money(remainingTotal)} à payer</span>
      </div>

      {step === 'view' && (
        <>
          <FactureDisplay table={table} />
          <div className="client-actions">
            <h2>Comment voulez-vous payer ?</h2>
            <button className="btn btn-primary btn-block btn-xl" onClick={payEverything}>
              Tout ensemble · {money(remainingTotal)}
            </button>
            {unpaidGroups.length > 1 && (
              <button className="btn btn-outline btn-block btn-xl" onClick={() => setStep('split')}>
                Diviser la facture
              </button>
            )}
          </div>
        </>
      )}

      {step === 'split' && (
        <>
          <h2 className="split-title">Qui paie maintenant ?</h2>
          <p className="split-sub">Cochez les personnes qui paient ensemble.</p>
          <SplitSelector groups={unpaidGroups} selected={selected} onToggle={toggle} />

          <div className="split-summary">
            {selected.size > 0 ? (
              <p>
                Vous payez <strong>{money(selectedAmount)}</strong> sur{' '}
                {money(remainingTotal)} au total
              </p>
            ) : (
              <p>Sélectionnez au moins une personne.</p>
            )}
            <button
              className="btn btn-primary btn-block btn-xl"
              disabled={selected.size === 0}
              onClick={() => setStep('pay')}
            >
              Continuer{selected.size > 0 ? ` · ${money(selectedAmount)}` : ''}
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setStep('view')}>
              ← Retour
            </button>
          </div>
        </>
      )}

      {step === 'pay' && (
        <>
          <div className="pay-recap">
            <p>
              Vous payez <strong>{money(selectedAmount)}</strong> sur{' '}
              {money(remainingTotal)} au total
            </p>
            <small>{selectedGroups.map((g) => g.label).join(' + ')}</small>
          </div>
          <PaymentForm
            amount={selectedAmount}
            onSuccess={onPaid}
            onCancel={() => setStep(unpaidGroups.length > 1 ? 'split' : 'view')}
          />
        </>
      )}
    </div>
  );
}

function ClientMessage({ emoji, title, body, success }) {
  return (
    <div className="client-page client-message">
      <div className={`message-emoji${success ? ' is-success' : ''}`}>{emoji}</div>
      <h1>{title}</h1>
      {body}
      <Link to="/pay" className="btn btn-ghost btn-block">
        Changer de table
      </Link>
    </div>
  );
}

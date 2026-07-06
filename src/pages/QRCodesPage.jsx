import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from '../store.js';

// QR codes de toutes les tables, prêts à imprimer (un par table).
export default function QRCodesPage() {
  const { tables } = useStore();
  const origin = window.location.origin;

  return (
    <div className="admin-page">
      <header className="admin-header no-print">
        <div>
          <Link to="/admin" className="back-link">← Toutes les tables</Link>
          <h1>🖨️ QR codes des tables</h1>
          <p className="admin-sub">
            À imprimer et poser sur chaque table. Le scan ouvre la page de
            paiement de la table.
          </p>
        </div>
        <button className="btn btn-dark" onClick={() => window.print()}>
          Imprimer
        </button>
      </header>

      <div className="qr-grid">
        {tables.map((t) => {
          const url = `${origin}/pay?table=${t.id}`;
          return (
            <div key={t.id} className="qr-card">
              <h3>Table {t.id}</h3>
              <QRCodeSVG value={url} size={160} />
              <p className="qr-card-hint">Scannez pour payer votre facture</p>
              <p className="qr-url">{url}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

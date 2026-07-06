import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { TABLE_COUNT } from '../data/mockData.js';

export default function Home() {
  const navigate = useNavigate();
  const [tableNum, setTableNum] = useState('');

  function goToTable(e) {
    e.preventDefault();
    const n = Number(tableNum);
    if (n >= 1 && n <= TABLE_COUNT) navigate(`/pay?table=${n}`);
  }

  return (
    <div className="home">
      <h1 className="home-title">🍽️ QR Restaurant Pay</h1>
      <p className="home-sub">Paiement de facture par QR code sur table</p>

      <div className="home-cards">
        <div className="home-card">
          <div className="home-card-emoji">📱</div>
          <h2>Je suis client</h2>
          <p>
            Scannez le QR code sur votre table, ou entrez votre numéro de table
            ci-dessous.
          </p>
          <form onSubmit={goToTable} className="home-table-form">
            <input
              type="number"
              min="1"
              max={TABLE_COUNT}
              inputMode="numeric"
              placeholder="N° de table"
              value={tableNum}
              onChange={(e) => setTableNum(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!tableNum}>
              Voir ma facture
            </button>
          </form>
        </div>

        <div className="home-card">
          <div className="home-card-emoji">👨‍🍳</div>
          <h2>Je suis le resto</h2>
          <p>Gérer les tables, les factures et imprimer les QR codes.</p>
          <Link to="/admin" className="btn btn-dark btn-block">
            Ouvrir la gestion
          </Link>
        </div>
      </div>

      <p className="home-hint">
        💡 Pour tester le flow complet : ouvrez <code>/admin</code> dans un
        onglet et <code>/pay?table=1</code> dans un autre — un paiement côté
        client met à jour la table côté resto.
      </p>
    </div>
  );
}

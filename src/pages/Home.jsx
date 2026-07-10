// Page d'accueil démo : liens vers les 3 interfaces + affichage du QR de table.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Home() {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState(null);

  async function showQr() {
    try {
      setError(null);
      setQr(await api('/api/demo/facture', { method: 'POST' }));
    } catch (err) {
      setError(err.message);
    }
  }

  const isLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);

  return (
    <main className="mx-auto max-w-xl px-5 py-10 text-neutral-900 dark:text-neutral-100">
      <h1 className="text-2xl font-bold">Payment + Service + Analytics</h1>
      <p className="mt-1 mb-8 text-neutral-600 dark:text-neutral-400">
        Le client scanne, consulte le menu, appelle le serveur, paie — le restaurant reçoit les demandes et les insights.
      </p>

      <div className="space-y-4">
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="font-semibold">📱 Interface client (table 5)</h2>
          <p className="mt-1 mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            L'écran que voit un client après le scan du QR : menu, appel serveur, paiement.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/table?rest_id=rest_demo&table_id=5" className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white">
              Ouvrir l'écran de table →
            </Link>
            <button onClick={showQr} className="rounded-xl border-2 border-blue-600 px-4 py-2.5 font-semibold text-blue-600 dark:border-blue-400 dark:text-blue-400">
              📱 Scanner avec mon téléphone
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {qr && (
            <div className="mt-4 text-center">
              {isLocalhost && (
                <p className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">
                  ⚠️ Page ouverte en localhost : ouvre plutôt l'adresse réseau affichée au démarrage du serveur
                  (http://192.168.x.x:3000), puis re-clique ici.
                </p>
              )}
              <img src={qr.qr_code} alt="QR code de la table" className="mx-auto w-56 rounded-xl bg-white p-2" />
              <p className="mt-2 text-xs break-all text-neutral-500">{qr.checkout_url}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="font-semibold">🔔 Tablette serveur</h2>
          <p className="mt-1 mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            Les demandes des tables en temps réel (eau, addition, assistance…), avec bouton « Traité ».
          </p>
          <Link to="/server-view?rest_id=rest_demo" className="inline-block rounded-xl border-2 border-blue-600 px-4 py-2.5 font-semibold text-blue-600 dark:border-blue-400 dark:text-blue-400">
            Ouvrir la tablette →
          </Link>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="font-semibold">📊 Dashboard analytics</h2>
          <p className="mt-1 mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            60 jours de données : ventes, heures de pointe, demandes serveur, feedback, splits.
          </p>
          <Link to="/dashboard?rest_id=rest_demo&api_key=demo_key_123" className="inline-block rounded-xl border-2 border-blue-600 px-4 py-2.5 font-semibold text-blue-600 dark:border-blue-400 dark:text-blue-400">
            Ouvrir le dashboard →
          </Link>
        </section>
      </div>
    </main>
  );
}

// Écran d'accueil après le scan du QR : 3 grandes options.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useTableParams } from '../api.js';

export default function TableHome() {
  const { restId, tableId, query } = useTableParams();
  const [restaurantName, setRestaurantName] = useState('');

  useEffect(() => {
    api(`/api/v1/menu?rest_id=${encodeURIComponent(restId)}`)
      .then((d) => setRestaurantName(d.restaurant_name))
      .catch(() => setRestaurantName(''));
  }, [restId]);

  const options = [
    { to: `/menu?${query}`, emoji: '📋', label: 'Voir le menu complet', sub: 'Entrées, plats, desserts, boissons' },
    { to: `/call-server?${query}`, emoji: '🔔', label: 'Appeler le serveur', sub: 'Eau, commande, addition…' },
    { to: `/checkout?${query}`, emoji: '💳', label: 'Payer la facture', sub: 'Tout ensemble ou divisé' }
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10 text-neutral-900 dark:text-neutral-100">
      <header className="mb-10 text-center">
        <p className="text-4xl">🍽️</p>
        <h1 className="mt-2 text-2xl font-bold">{restaurantName || 'Bienvenue'}</h1>
        <p className="mt-1 text-lg text-neutral-600 dark:text-neutral-400">Table {tableId}</p>
      </header>

      <div className="space-y-4">
        {options.map((opt) => (
          <Link
            key={opt.to}
            to={opt.to}
            className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm active:scale-[0.99] dark:border-neutral-700 dark:bg-neutral-900"
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span>
              <span className="block text-lg font-semibold">{opt.label}</span>
              <span className="block text-sm text-neutral-500 dark:text-neutral-400">{opt.sub}</span>
            </span>
            <span className="ml-auto text-xl text-neutral-400">›</span>
          </Link>
        ))}
      </div>

      <p className="mt-auto pt-10 text-center text-xs text-neutral-400">
        Pour commander, adressez-vous à votre serveur — ou appuyez sur « Appeler le serveur ».
      </p>
    </main>
  );
}

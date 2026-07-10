// Menu complet du restaurant, en consultation seulement.
import { useEffect, useState } from 'react';
import { api, useTableParams } from '../api.js';
import BackBar from '../components/BackBar.jsx';
import MenuCategory from '../components/MenuCategory.jsx';

export default function MenuView() {
  const { restId, query } = useTableParams();
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/api/v1/menu?rest_id=${encodeURIComponent(restId)}`)
      .then((d) => setMenu(d.menu))
      .catch((err) => setError(err.message));
  }, [restId]);

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-10 text-neutral-900 dark:text-neutral-100">
      <BackBar query={query} title="Menu" />

      {menu && (
        <nav className="sticky top-[61px] z-10 flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white/90 px-4 py-2.5 backdrop-blur dark:border-neutral-700 dark:bg-neutral-950/90">
          {menu.map((cat) => (
            <a
              key={cat.category}
              href={`#cat-${cat.category}`}
              className="shrink-0 rounded-full bg-neutral-100 px-4 py-1.5 text-sm font-semibold dark:bg-neutral-800"
            >
              {cat.category}
            </a>
          ))}
        </nav>
      )}

      <div className="space-y-8 px-4 pt-5">
        {error && <p className="py-20 text-center text-neutral-500">{error}</p>}
        {!menu && !error && <p className="py-20 text-center text-neutral-500">Chargement du menu…</p>}
        {menu?.map((cat) => (
          <MenuCategory key={cat.category} category={cat.category} items={cat.items} />
        ))}
      </div>

      {menu && (
        <p className="mt-8 px-4 text-center text-sm text-neutral-400">
          Pour commander, adressez-vous à votre serveur 🙂
        </p>
      )}
    </main>
  );
}

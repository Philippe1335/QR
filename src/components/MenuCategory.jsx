// Section d'une catégorie du menu : liste d'items avec photo (emoji
// placeholder), description et prix. Lecture seule — pas de commande ici.
import { fmtMoney } from '../api.js';

export default function MenuCategory({ category, items }) {
  return (
    <section id={`cat-${category}`} className="scroll-mt-28">
      <h2 className="mb-3 text-xl font-bold">{category}</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-3xl dark:bg-neutral-800">
              {item.photo}
            </span>
            <div className="min-w-0">
              <p className="font-semibold">{item.name}</p>
              {item.description && (
                <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{item.description}</p>
              )}
            </div>
            <p className="ml-auto shrink-0 font-semibold tabular-nums">{fmtMoney(item.price)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

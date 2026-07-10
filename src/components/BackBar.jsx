// Barre de retour vers l'écran d'accueil de la table — présente sur chaque
// sous-page client pour qu'on ne soit jamais coincé.
import { Link } from 'react-router-dom';

export default function BackBar({ query, title }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-700 dark:bg-neutral-950/90">
      <Link
        to={`/table?${query}`}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-xl dark:bg-neutral-800"
        aria-label="Retour à l'accueil"
      >
        ‹
      </Link>
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}

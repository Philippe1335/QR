// Sélecteur 1-5 étoiles, gros et facile à taper.
export default function RatingStars({ value, onChange }) {
  return (
    <div className="flex justify-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star)}
          aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
          className={`text-5xl transition-transform active:scale-90 ${
            value >= star ? '' : 'opacity-30 grayscale'
          }`}
        >
          ⭐
        </button>
      ))}
    </div>
  );
}

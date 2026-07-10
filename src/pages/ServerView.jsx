// Tablette serveur : demandes des tables en temps réel (polling 3 s),
// notification sonore à chaque nouvelle demande, bouton "Traité".
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import RequestCard from '../components/RequestCard.jsx';

const POLL_MS = 3000;

// Bip discret via WebAudio (aucun fichier audio nécessaire).
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    // Le son est un nice-to-have : jamais bloquant.
  }
}

export default function ServerView() {
  const [sp] = useSearchParams();
  const restId = sp.get('rest_id') || 'rest_demo';
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(true); // le son démarre coupé (autoplay policies)
  const knownIds = useRef(new Set());
  const mutedRef = useRef(true);
  mutedRef.current = muted;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api(`/api/v1/server-requests?rest_id=${encodeURIComponent(restId)}`);
        if (cancelled) return;
        const pendingIds = data.requests.filter((q) => q.status === 'pending').map((q) => q.id);
        const hasNew = pendingIds.some((id) => !knownIds.current.has(id));
        // Premier chargement : on mémorise sans sonner.
        if (knownIds.current.size > 0 && hasNew && !mutedRef.current) beep();
        pendingIds.forEach((id) => knownIds.current.add(id));
        if (knownIds.current.size === 0) knownIds.current.add('_init');
        setRequests(data.requests);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [restId]);

  async function handle(id) {
    // Optimiste : la carte passe en "traité" immédiatement.
    setRequests((prev) => prev.map((q) => (q.id === id ? { ...q, status: 'handled' } : q)));
    try {
      await api(`/api/v1/server-request/${id}`, { method: 'PATCH', body: { status: 'handled' } });
    } catch {
      // Le prochain poll remettra l'état réel.
    }
  }

  const pending = (requests || []).filter((q) => q.status === 'pending');
  // Urgences d'abord (assistance / addition), puis les plus anciennes.
  const urgentTypes = ['assistance', 'bill'];
  pending.sort((a, b) => {
    const ua = urgentTypes.includes(a.request_type) ? 0 : 1;
    const ub = urgentTypes.includes(b.request_type) ? 0 : 1;
    return ua - ub || new Date(a.created_at) - new Date(b.created_at);
  });
  const handled = (requests || []).filter((q) => q.status === 'handled');

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-6 text-neutral-900 dark:text-neutral-100">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🔔 Demandes des tables</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Mise à jour automatique toutes les 3 secondes
          </p>
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          className="rounded-xl border-2 border-neutral-200 px-4 py-2.5 font-semibold dark:border-neutral-700"
        >
          {muted ? '🔇 Son coupé' : '🔊 Son actif'}
        </button>
      </header>

      {error && <p className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {!requests && !error && <p className="py-20 text-center text-neutral-500">Chargement…</p>}

      {requests && pending.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 py-16 text-center dark:border-neutral-700">
          <p className="text-4xl">✨</p>
          <p className="mt-3 text-lg font-semibold">Aucune demande en attente</p>
          <p className="text-sm text-neutral-500">Les nouvelles demandes apparaîtront ici.</p>
        </div>
      )}

      <div className="space-y-3">
        {pending.map((q) => (
          <RequestCard key={q.id} request={q} onHandle={handle} />
        ))}
      </div>

      {handled.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wider text-neutral-400 uppercase">
            Traitées récemment
          </h2>
          <div className="space-y-3">
            {handled.map((q) => (
              <RequestCard key={q.id} request={q} onHandle={handle} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

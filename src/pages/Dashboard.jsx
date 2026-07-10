// Dashboard analytics : 6 widgets alimentés par GET /api/v1/analytics.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, fmtMoney, fmtMoneyRound } from '../api.js';
import StatTile from '../components/StatTile.jsx';
import TopItems from '../components/Charts/TopItems.jsx';
import PeakHours from '../components/Charts/PeakHours.jsx';
import PeakDays from '../components/Charts/PeakDays.jsx';
import RequestTypes from '../components/Charts/RequestTypes.jsx';
import FeedbackScore from '../components/Charts/FeedbackScore.jsx';
import SplitBehavior from '../components/Charts/SplitBehavior.jsx';

const PERIODS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'week', label: '7 jours' },
  { id: 'month', label: '30 jours' },
  { id: 'quarter', label: '90 jours' }
];

function Card({ title, sub, children, className = '' }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900 ${className}`}>
      <h2 className="font-semibold">{title}</h2>
      {sub && <p className="mt-0.5 mb-4 text-sm text-neutral-500 dark:text-neutral-400">{sub}</p>}
      {children}
    </section>
  );
}

export default function Dashboard() {
  const [sp] = useSearchParams();
  const restId = sp.get('rest_id') || 'rest_demo';
  const apiKey = sp.get('api_key') || '';
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api(`/api/v1/analytics?rest_id=${encodeURIComponent(restId)}&api_key=${encodeURIComponent(apiKey)}&period=${period}`)
        .then((d) => { if (!cancelled) { setData(d); setError(null); } })
        .catch((err) => { if (!cancelled) setError(err.message); });
    load();
    const t = setInterval(load, 60000); // les nouveaux paiements apparaissent tout seuls
    return () => { cancelled = true; clearInterval(t); };
  }, [restId, apiKey, period]);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16 text-center text-neutral-600 dark:text-neutral-300">
        Impossible de charger le dashboard : {error}. Vérifie rest_id et api_key dans l'URL.
      </main>
    );
  }
  if (!data) {
    return <main className="mx-auto max-w-6xl px-5 py-16 text-center text-neutral-500">Chargement des insights…</main>;
  }

  const o = data.overview;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 text-neutral-900 sm:px-6 dark:text-neutral-100">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{data.restaurant_name}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {PERIODS.find((p) => p.id === period)?.label} · généré à partir des paiements, demandes et feedbacks collectés
          </p>
        </div>
        <nav className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                period === p.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-neutral-200 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      {/* 1. Overview */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Revenue" value={fmtMoneyRound(o.revenue)} deltaPct={o.revenue_delta_pct} />
        <StatTile label="Transactions" value={o.transactions.toLocaleString('en-US')} deltaPct={o.transactions_delta_pct} />
        <StatTile label="Ticket moyen" value={fmtMoney(o.avg_ticket)} deltaPct={o.avg_ticket_delta_pct} />
        <StatTile label="Tips totaux" value={fmtMoneyRound(o.tips)} deltaPct={o.tips_delta_pct} />
        <StatTile label="Satisfaction" value={o.avg_rating != null ? `${o.avg_rating} ★` : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 2. Top items */}
        <Card title="Top plats" sub="Les 10 items les plus vendus sur la période" className="lg:col-span-2">
          <TopItems items={data.top_items} />
        </Card>

        {/* 3. Peak hours / days */}
        <Card title="Heures de pointe" sub={data.peak_hours.insight || 'Transactions par heure'}>
          <PeakHours series={data.peak_hours.series} />
        </Card>
        <Card title="Jours importants" sub={data.peak_days.insight || 'Revenue par jour de semaine'}>
          <PeakDays series={data.peak_days.series} />
        </Card>

        {/* 4. Demandes serveur */}
        <Card title="Demandes serveur" sub="Répartition des appels et vitesse de réponse du staff">
          <RequestTypes metrics={data.server_requests} />
        </Card>

        {/* 6. Split de facture */}
        <Card title="Split de facture" sub="Comment les tables choisissent de payer">
          <SplitBehavior data={data.split_behavior} />
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 text-sm dark:border-neutral-800">
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Taille de groupe moyenne</p>
              <p className="text-lg font-semibold">{data.customer_metrics.avg_party_size} pers.</p>
            </div>
            <div>
              <p className="text-neutral-500 dark:text-neutral-400">Scan → paiement</p>
              <p className="text-lg font-semibold">
                {data.customer_metrics.avg_time_to_pay_minutes != null ? `${data.customer_metrics.avg_time_to_pay_minutes} min` : '—'}
              </p>
            </div>
          </div>
        </Card>

        {/* 5. Feedback */}
        <Card title="Feedback client" sub="Score post-paiement et commentaires à traiter" className="lg:col-span-2">
          <FeedbackScore feedback={data.feedback} />
        </Card>
      </div>
    </main>
  );
}

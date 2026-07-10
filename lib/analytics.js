// Calcul des insights à partir des factures payées d'un restaurant.
// Tout est dérivé des données de paiement collectées — rien n'est saisi à la main.

const store = require('./store');

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const PERIODS = { today: 1, week: 7, month: 30, quarter: 90 };

function round2(n) {
  return Math.round(n * 100) / 100;
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

function paidBetween(factures, from, to) {
  return factures.filter((f) => {
    if (f.status !== 'paid' || !f.paid_at) return false;
    const t = new Date(f.paid_at).getTime();
    return t >= from && t < to;
  });
}

function sumRevenue(factures) {
  return round2(factures.reduce((s, f) => s + f.total, 0));
}

function sumTips(factures) {
  return round2(factures.reduce((s, f) => s + f.tip, 0));
}

function deltaPct(current, previous) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Agrège quantité / revenue par item sur un ensemble de factures.
function itemTotals(factures) {
  const map = new Map();
  for (const f of factures) {
    for (const it of f.items) {
      const entry = map.get(it.name) || { name: it.name, category: it.category, qty: 0, revenue: 0 };
      entry.qty += it.qty;
      entry.revenue = round2(entry.revenue + it.price * it.qty);
      map.set(it.name, entry);
    }
  }
  return map;
}

function overview(current, previous) {
  const revenue = sumRevenue(current);
  const prevRevenue = sumRevenue(previous);
  const transactions = current.length;
  const avgTicket = transactions > 0 ? round2(revenue / transactions) : 0;
  const prevAvgTicket = previous.length > 0 ? sumRevenue(previous) / previous.length : 0;
  const tips = sumTips(current);
  return {
    revenue,
    revenue_delta_pct: deltaPct(revenue, prevRevenue),
    transactions,
    transactions_delta_pct: deltaPct(transactions, previous.length),
    avg_ticket: avgTicket,
    avg_ticket_delta_pct: deltaPct(avgTicket, prevAvgTicket),
    tips,
    tips_delta_pct: deltaPct(tips, sumTips(previous)),
    tip_rate_pct: revenue > 0 ? pct(tips, revenue) : 0
  };
}

// Revenue par jour (pour la sparkline de l'overview).
function revenueByDate(factures, from, days) {
  const buckets = [];
  for (let i = 0; i < days; i++) {
    const start = from + i * DAY_MS;
    const dayFactures = factures.filter((f) => {
      const t = new Date(f.paid_at).getTime();
      return t >= start && t < start + DAY_MS;
    });
    buckets.push({
      date: new Date(start).toISOString().slice(0, 10),
      revenue: sumRevenue(dayFactures),
      transactions: dayFactures.length
    });
  }
  return buckets;
}

function topItems(current, previous, limit = 10) {
  const now = itemTotals(current);
  const before = itemTotals(previous);
  const totalRevenue = sumRevenue(current);
  return [...now.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((it) => {
      const prev = before.get(it.name);
      return {
        name: it.name,
        category: it.category,
        qty: it.qty,
        revenue: it.revenue,
        trend_pct: prev ? deltaPct(it.qty, prev.qty) : null,
        share_pct: pct(it.revenue, totalRevenue)
      };
    });
}

function peakHours(current) {
  const hours = [];
  for (let h = 0; h < 24; h++) hours.push({ hour: h, transactions: 0, revenue: 0, tips: 0 });
  for (const f of current) {
    const h = new Date(f.paid_at).getHours();
    hours[h].transactions += 1;
    hours[h].revenue = round2(hours[h].revenue + f.total);
    hours[h].tips = round2(hours[h].tips + f.tip);
  }
  const series = hours.map((b) => ({
    hour: b.hour,
    transactions: b.transactions,
    revenue: b.revenue,
    avg_ticket: b.transactions > 0 ? round2(b.revenue / b.transactions) : 0,
    tip_pct: b.revenue > 0 ? pct(b.tips, b.revenue) : 0
  }));

  // Meilleure fenêtre de 2h consécutives en revenue.
  const total = sumRevenue(current);
  let best = { start: 0, revenue: 0 };
  for (let h = 0; h < 23; h++) {
    const rev = hours[h].revenue + hours[h + 1].revenue;
    if (rev > best.revenue) best = { start: h, revenue: rev };
  }
  const insight =
    total > 0
      ? `${best.start}h-${best.start + 2}h = ${pct(best.revenue, total)}% des ventes`
      : null;
  return { series, insight };
}

function peakDays(current) {
  const days = DAY_NAMES.map((name) => ({ day: name, revenue: 0, transactions: 0 }));
  for (const f of current) {
    const d = new Date(f.paid_at).getDay();
    days[d].revenue = round2(days[d].revenue + f.total);
    days[d].transactions += 1;
  }
  // Semaine affichée lundi → dimanche.
  const ordered = [...days.slice(1), days[0]];
  const total = sumRevenue(current);
  const top2 = [...ordered].sort((a, b) => b.revenue - a.revenue).slice(0, 2);
  const insight =
    total > 0
      ? `${top2.map((d) => d.day).join('/')} = ${pct(top2[0].revenue + top2[1].revenue, total)}% de ta semaine`
      : null;
  return { series: ordered, insight };
}

// Tendances sur 30 jours : gagnants, perdants, alertes de non-commande.
function itemTrends(factures, now) {
  const last30 = paidBetween(factures, now - 30 * DAY_MS, now);
  const prev30 = paidBetween(factures, now - 60 * DAY_MS, now - 30 * DAY_MS);
  const cur = itemTotals(last30);
  const before = itemTotals(prev30);

  const moves = [];
  for (const [name, it] of cur) {
    const prev = before.get(name);
    if (!prev || prev.qty < 5) continue; // Trop peu de volume pour une tendance fiable.
    const trend = deltaPct(it.qty, prev.qty);
    if (trend != null) moves.push({ name, category: it.category, qty: it.qty, trend_pct: trend });
  }
  moves.sort((a, b) => b.trend_pct - a.trend_pct);
  const gainers = moves.filter((m) => m.trend_pct > 0).slice(0, 5);
  const losers = moves.filter((m) => m.trend_pct < 0).slice(-5).reverse();

  // Alertes : items vendus dans les 30 derniers jours mais plus commandés depuis N jours.
  const lastSold = new Map();
  for (const f of last30) {
    const t = new Date(f.paid_at).getTime();
    for (const it of f.items) {
      if (!lastSold.has(it.name) || t > lastSold.get(it.name)) lastSold.set(it.name, t);
    }
  }
  const alerts = [];
  for (const [name, t] of lastSold) {
    const daysSince = Math.floor((now - t) / DAY_MS);
    if (daysSince >= 5) {
      alerts.push({ name, days_since: daysSince, message: `${name} n'a pas été commandé depuis ${daysSince} jours` });
    }
  }
  alerts.sort((a, b) => b.days_since - a.days_since);
  return { gainers, losers, alerts: alerts.slice(0, 5) };
}

function customerMetrics(current) {
  const n = current.length;
  if (n === 0) {
    return { avg_ticket: 0, avg_tip_pct: 0, avg_tip: 0, avg_party_size: 0, avg_time_to_pay_minutes: null };
  }
  const revenue = sumRevenue(current);
  const tips = sumTips(current);
  const partySizes = current.map((f) => f.party_size || 1);
  const times = current.map((f) => store.timeToPayMinutes(f)).filter((t) => t != null && t >= 0);
  return {
    avg_ticket: round2(revenue / n),
    avg_tip_pct: revenue > 0 ? pct(tips, revenue) : 0,
    avg_tip: round2(tips / n),
    avg_party_size: Math.round((partySizes.reduce((s, p) => s + p, 0) / n) * 10) / 10,
    avg_time_to_pay_minutes:
      times.length > 0 ? Math.round((times.reduce((s, t) => s + t, 0) / times.length) * 10) / 10 : null
  };
}

// Répartition des demandes serveur + temps de réponse moyen.
function requestMetrics(requests, from, now) {
  const inPeriod = requests.filter((q) => {
    const t = new Date(q.created_at).getTime();
    return t >= from && t < now;
  });
  const counts = {};
  for (const type of store.REQUEST_TYPES) counts[type] = 0;
  let responseSum = 0;
  let responseCount = 0;
  for (const q of inPeriod) {
    counts[q.request_type] = (counts[q.request_type] || 0) + 1;
    if (q.handled_at) {
      responseSum += new Date(q.handled_at) - new Date(q.created_at);
      responseCount += 1;
    }
  }
  const total = inPeriod.length;
  return {
    total,
    pending: inPeriod.filter((q) => q.status === 'pending').length,
    by_type: store.REQUEST_TYPES.map((type) => ({
      type,
      count: counts[type],
      pct: pct(counts[type], total)
    })),
    avg_response_minutes:
      responseCount > 0 ? Math.round((responseSum / responseCount / 60000) * 10) / 10 : null
  };
}

// Feedback client : score moyen, distribution, commentaires négatifs, avis Google.
function feedbackMetrics(feedbacks, from, now) {
  const inPeriod = feedbacks.filter((fb) => {
    const t = new Date(fb.created_at).getTime();
    return t >= from && t < now;
  });
  const total = inPeriod.length;
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = inPeriod.filter((fb) => fb.rating === stars).length;
    return { stars, count, pct: pct(count, total) };
  });
  const negative = inPeriod
    .filter((fb) => fb.rating <= 3 && (fb.comment || fb.issue_type))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map((fb) => ({
      rating: fb.rating,
      comment: fb.comment,
      issue_type: fb.issue_type,
      created_at: fb.created_at
    }));
  return {
    total,
    avg_rating:
      total > 0
        ? Math.round((inPeriod.reduce((s, fb) => s + fb.rating, 0) / total) * 10) / 10
        : null,
    distribution,
    negative_comments: negative,
    google_review_pct: pct(inPeriod.filter((fb) => fb.google_review).length, total)
  };
}

// Comportement de split : comment les tables choisissent de payer.
function splitBehavior(current) {
  const counts = { full: 0, equal: 0, by_item: 0 };
  for (const f of current) {
    const type = f.payments[0]?.split_type || 'full';
    counts[type] = (counts[type] || 0) + 1;
  }
  const total = current.length;
  return [
    { type: 'full', label: 'Tout ensemble', count: counts.full, pct: pct(counts.full, total) },
    { type: 'equal', label: 'Divisé également', count: counts.equal, pct: pct(counts.equal, total) },
    { type: 'by_item', label: 'Divisé par item', count: counts.by_item, pct: pct(counts.by_item, total) }
  ];
}

function categoryBreakdown(current) {
  const map = new Map();
  for (const f of current) {
    for (const it of f.items) {
      const rev = it.price * it.qty;
      map.set(it.category, round2((map.get(it.category) || 0) + rev));
    }
  }
  const total = [...map.values()].reduce((s, v) => s + v, 0);
  return [...map.entries()]
    .map(([name, revenue]) => ({ name, revenue, share_pct: pct(revenue, total) }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Point d'entrée : calcule tous les insights pour une période donnée.
function compute(restaurant_id, { period = 'week', now = Date.now() } = {}) {
  const days = PERIODS[period] || PERIODS.week;
  const factures = store.facturesForRestaurant(restaurant_id);
  const from = now - days * DAY_MS;
  const prevFrom = now - 2 * days * DAY_MS;
  const current = paidBetween(factures, from, now);
  const previous = paidBetween(factures, prevFrom, from);
  const feedbacks = feedbackMetrics(store.feedbacksForRestaurant(restaurant_id), from, now);

  return {
    restaurant_id,
    period,
    period_days: days,
    generated_at: new Date(now).toISOString(),
    overview: { ...overview(current, previous), avg_rating: feedbacks.avg_rating },
    revenue_by_day: revenueByDate(current, from, days),
    top_items: topItems(current, previous),
    peak_hours: peakHours(current),
    peak_days: peakDays(current),
    item_trends: itemTrends(factures, now),
    customer_metrics: customerMetrics(current),
    category_breakdown: categoryBreakdown(current),
    server_requests: requestMetrics(store.requestsForRestaurant(restaurant_id), from, now),
    feedback: feedbacks,
    split_behavior: splitBehavior(current)
  };
}

module.exports = { compute, PERIODS };

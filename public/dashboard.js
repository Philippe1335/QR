// Dashboard analytics — graphiques SVG vanilla (barres, ligne, donut, sparkline)
// avec tooltips au survol. Les données viennent de GET /api/v1/analytics.

(function () {
  const params = new URLSearchParams(location.search);
  const restId = params.get('rest_id');
  const apiKey = params.get('api_key');

  const $ = (id) => document.getElementById(id);
  const tooltip = $('tooltip');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const fmtMoney = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
  const fmtMoney2 = (n) => `$${n.toFixed(2)}`;
  const CAT_COLORS = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];

  let period = 'week';
  const PERIOD_LABELS = { today: "Aujourd'hui", week: '7 derniers jours', month: '30 derniers jours', quarter: '90 derniers jours' };

  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    return node;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function cssVar(name) {
    return getComputedStyle(document.querySelector('.viz-root')).getPropertyValue(name).trim();
  }

  // --- Tooltip partagé ---
  function showTooltip(evt, title, rows) {
    tooltip.textContent = '';
    if (title) tooltip.appendChild(el('div', 't-title', title));
    for (const r of rows) {
      const row = el('div', 't-row');
      if (r.color) {
        const key = el('span', 't-key');
        key.style.background = r.color;
        row.appendChild(key);
      }
      row.appendChild(el('span', 't-val', r.value));
      if (r.name) row.appendChild(el('span', 't-name', r.name));
      tooltip.appendChild(row);
    }
    tooltip.hidden = false;
    moveTooltip(evt);
  }
  function moveTooltip(evt) {
    const pad = 14;
    const rect = tooltip.getBoundingClientRect();
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    if (x + rect.width > innerWidth - 8) x = evt.clientX - rect.width - pad;
    if (y + rect.height > innerHeight - 8) y = evt.clientY - rect.height - pad;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
  function hideTooltip() { tooltip.hidden = true; }

  // --- Sparkline (stat tile) ---
  function sparkline(points, width = 150, height = 34) {
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height });
    if (points.length < 2) return svg;
    const max = Math.max(...points, 1);
    const step = width / (points.length - 1);
    const y = (v) => height - 3 - (v / max) * (height - 6);
    const d = points.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join('');
    svg.appendChild(svgEl('path', { d, fill: 'none', stroke: cssVar('--seq-250'), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const lastX = (points.length - 1) * step;
    svg.appendChild(svgEl('circle', { cx: lastX - 1, cy: y(points[points.length - 1]), r: 4, fill: cssVar('--seq-450'), stroke: cssVar('--surface-1'), 'stroke-width': 2 }));
    return svg;
  }

  // --- Stat tile ---
  function statTile({ label, value, deltaPct, upIsGood = true, spark }) {
    const tile = el('div', 'tile');
    tile.appendChild(el('div', 'label', label));
    tile.appendChild(el('div', 'value', value));
    if (deltaPct != null) {
      const up = deltaPct >= 0;
      const good = up === upIsGood;
      const delta = el('div', `delta ${good ? 'up' : 'down'}`);
      delta.appendChild(document.createTextNode(`${up ? '↑' : '↓'} ${Math.abs(deltaPct)}% `));
      delta.appendChild(el('span', 'vs', 'vs période préc.'));
      tile.appendChild(delta);
    }
    if (spark) tile.appendChild(spark);
    return tile;
  }

  // --- Barres horizontales (top items) ---
  function hBarChart(container, data) {
    container.textContent = '';
    const rowH = 34, labelW = 150, valueW = 64;
    const width = 720, barMax = width - labelW - valueW;
    const height = data.length * rowH;
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
    const max = Math.max(...data.map((d) => d.revenue), 1);

    data.forEach((d, i) => {
      const y = i * rowH;
      const barLen = Math.max(4, (d.revenue / max) * barMax);
      const g = svgEl('g', {});

      const name = svgEl('text', { x: labelW - 10, y: y + rowH / 2 + 4, 'text-anchor': 'end', class: 'cat-name' });
      name.textContent = d.name.length > 22 ? d.name.slice(0, 21) + '…' : d.name;
      g.appendChild(name);

      // Barre : coin arrondi 4px côté données, carré à la baseline.
      const h = 20, ry = 4;
      const barY = y + (rowH - h) / 2;
      const path = `M${labelW},${barY} H${labelW + barLen - ry} a${ry},${ry} 0 0 1 ${ry},${ry} v${h - 2 * ry} a${ry},${ry} 0 0 1 -${ry},${ry} H${labelW} Z`;
      g.appendChild(svgEl('path', { d: path, class: 'seq-bar' }));

      const val = svgEl('text', { x: labelW + barLen + 8, y: y + rowH / 2 + 4, class: 'bar-label' });
      val.textContent = fmtMoney(d.revenue);
      g.appendChild(val);

      // Zone de hit plus grande que la barre.
      const hit = svgEl('rect', { x: 0, y, width, height: rowH, fill: 'transparent' });
      hit.addEventListener('pointermove', (e) => {
        g.querySelector('path').classList.add('hover-lift');
        showTooltip(e, d.name, [
          { value: fmtMoney(d.revenue), name: 'revenue', color: cssVar('--seq-450') },
          { value: `${d.qty}`, name: 'unités vendues' },
          { value: `${d.share_pct}%`, name: 'du total' }
        ]);
      });
      hit.addEventListener('pointerleave', () => { g.querySelector('path').classList.remove('hover-lift'); hideTooltip(); });
      g.appendChild(hit);
      svg.appendChild(g);
    });
    container.appendChild(svg);
  }

  // --- Ligne (heures de pointe) avec crosshair ---
  function lineChart(container, series) {
    container.textContent = '';
    const width = 720, height = 240, padL = 40, padR = 16, padT = 14, padB = 26;
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
    const plotW = width - padL - padR, plotH = height - padT - padB;
    const max = Math.max(...series.map((d) => d.transactions), 1);
    const niceMax = Math.ceil(max / 10) * 10 || 10;
    const x = (i) => padL + (i / (series.length - 1)) * plotW;
    const y = (v) => padT + plotH - (v / niceMax) * plotH;

    // Gridlines + ticks Y (nombres ronds : 4, 5, 3 ou 2 divisions entières)
    const divisions = [4, 5, 3, 2].find((n) => Number.isInteger(niceMax / n)) || 4;
    for (let t = 0; t <= divisions; t++) {
      const v = (niceMax / divisions) * t;
      svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: y(v), y2: y(v), class: t === 0 ? 'axis-line' : 'grid-line' }));
      const tick = svgEl('text', { x: padL - 8, y: y(v) + 4, 'text-anchor': 'end' });
      tick.textContent = v.toLocaleString('en-US');
      svg.appendChild(tick);
    }
    // Ticks X (toutes les 3 heures)
    series.forEach((d, i) => {
      if (d.hour % 3 !== 0) return;
      const tick = svgEl('text', { x: x(i), y: height - 8, 'text-anchor': 'middle' });
      tick.textContent = `${d.hour}h`;
      svg.appendChild(tick);
    });

    // Aire (wash 10%) + ligne 2px
    const lineD = series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.transactions).toFixed(1)}`).join('');
    const areaD = `${lineD}L${x(series.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
    svg.appendChild(svgEl('path', { d: areaD, fill: cssVar('--seq-450'), opacity: 0.1 }));
    svg.appendChild(svgEl('path', { d: lineD, fill: 'none', stroke: cssVar('--seq-450'), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

    // Pic : marqueur + label direct sur l'extrême seulement.
    const peakIdx = series.reduce((best, d, i) => (d.transactions > series[best].transactions ? i : best), 0);
    const peak = series[peakIdx];
    if (peak.transactions > 0) {
      svg.appendChild(svgEl('circle', { cx: x(peakIdx), cy: y(peak.transactions), r: 4.5, fill: cssVar('--seq-450'), stroke: cssVar('--surface-1'), 'stroke-width': 2 }));
      const lbl = svgEl('text', { x: x(peakIdx), y: y(peak.transactions) - 10, 'text-anchor': 'middle', class: 'direct-label' });
      lbl.textContent = `${peak.transactions} à ${peak.hour}h`;
      svg.appendChild(lbl);
    }

    // Crosshair : trouve le X le plus proche du pointeur.
    const cross = svgEl('line', { y1: padT, y2: padT + plotH, class: 'axis-line', visibility: 'hidden' });
    const dot = svgEl('circle', { r: 4.5, fill: cssVar('--seq-450'), stroke: cssVar('--surface-1'), 'stroke-width': 2, visibility: 'hidden' });
    svg.append(cross, dot);
    const hit = svgEl('rect', { x: padL, y: padT, width: plotW, height: plotH, fill: 'transparent' });
    hit.addEventListener('pointermove', (e) => {
      const rect = svg.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * width;
      const i = Math.max(0, Math.min(series.length - 1, Math.round(((px - padL) / plotW) * (series.length - 1))));
      const d = series[i];
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
      cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(d.transactions));
      dot.setAttribute('visibility', 'visible');
      showTooltip(e, `${d.hour}h – ${d.hour + 1}h`, [
        { value: `${d.transactions}`, name: 'transactions', color: cssVar('--seq-450') },
        { value: fmtMoney(d.revenue), name: 'revenue' },
        { value: fmtMoney2(d.avg_ticket), name: 'ticket moyen' },
        { value: `${d.tip_pct}%`, name: 'pourboire' }
      ]);
    });
    hit.addEventListener('pointerleave', () => {
      cross.setAttribute('visibility', 'hidden');
      dot.setAttribute('visibility', 'hidden');
      hideTooltip();
    });
    svg.appendChild(hit);
    container.appendChild(svg);
  }

  // --- Colonnes (jours de la semaine) ---
  function vBarChart(container, data) {
    container.textContent = '';
    const width = 380, height = 230, padL = 8, padR = 8, padT = 22, padB = 24;
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
    const plotW = width - padL - padR, plotH = height - padT - padB;
    const max = Math.max(...data.map((d) => d.revenue), 1);
    const slot = plotW / data.length;
    const barW = Math.min(24, slot - 14);
    const topRevenues = [...data.map((d) => d.revenue)].sort((a, b) => b - a).slice(0, 2);

    svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: padT + plotH, y2: padT + plotH, class: 'axis-line' }));

    data.forEach((d, i) => {
      const h = Math.max(3, (d.revenue / max) * plotH);
      const bx = padL + i * slot + (slot - barW) / 2;
      const by = padT + plotH - h;
      const ry = 4;
      // Sommet arrondi 4px, base carrée. Les 2 meilleurs jours en pleine teinte,
      // le reste atténué (emphase, pas une série par jour).
      const isTop = topRevenues.includes(d.revenue) && d.revenue > 0;
      const path = `M${bx},${padT + plotH} v-${h - ry} a${ry},${ry} 0 0 1 ${ry},-${ry} h${barW - 2 * ry} a${ry},${ry} 0 0 1 ${ry},${ry} v${h - ry} Z`;
      svg.appendChild(svgEl('path', { d: path, class: `seq-bar${isTop ? '' : ' dim'}` }));

      const day = svgEl('text', { x: bx + barW / 2, y: height - 6, 'text-anchor': 'middle' });
      day.textContent = d.day.slice(0, 3);
      svg.appendChild(day);

      if (isTop) {
        const val = svgEl('text', { x: bx + barW / 2, y: by - 6, 'text-anchor': 'middle', class: 'direct-label' });
        val.textContent = fmtMoney(d.revenue);
        svg.appendChild(val);
      }

      const hit = svgEl('rect', { x: padL + i * slot, y: padT, width: slot, height: plotH, fill: 'transparent' });
      hit.addEventListener('pointermove', (e) => showTooltip(e, d.day, [
        { value: fmtMoney(d.revenue), name: 'revenue', color: cssVar('--seq-450') },
        { value: `${d.transactions}`, name: 'transactions' }
      ]));
      hit.addEventListener('pointerleave', hideTooltip);
      svg.appendChild(hit);
    });
    container.appendChild(svg);
  }

  // --- Donut (catégories) ---
  function donutChart(container, legendEl, data) {
    container.textContent = '';
    legendEl.textContent = '';
    const size = 190, cx = size / 2, cy = size / 2, r = 72, inner = 44;
    const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, role: 'img' });
    const total = data.reduce((s, d) => s + d.revenue, 0) || 1;
    let angle = -Math.PI / 2;

    data.forEach((d, i) => {
      const frac = d.revenue / total;
      const a0 = angle, a1 = angle + frac * 2 * Math.PI;
      angle = a1;
      const large = frac > 0.5 ? 1 : 0;
      const p = (a, rad) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
      const dPath = `M${p(a0, r)} A${r},${r} 0 ${large} 1 ${p(a1, r)} L${p(a1, inner)} A${inner},${inner} 0 ${large} 0 ${p(a0, inner)} Z`;
      const color = cssVar(CAT_COLORS[i % CAT_COLORS.length]);
      // Le trait couleur surface fait office d'écart de 2px entre segments.
      const seg = svgEl('path', { d: dPath, fill: color, stroke: cssVar('--surface-1'), 'stroke-width': 2 });
      seg.addEventListener('pointermove', (e) => {
        seg.classList.add('hover-lift');
        showTooltip(e, d.name, [{ value: fmtMoney(d.revenue), name: `${d.share_pct}% du total`, color }]);
      });
      seg.addEventListener('pointerleave', () => { seg.classList.remove('hover-lift'); hideTooltip(); });
      svg.appendChild(seg);

      // Légende avec valeurs : l'identité + les chiffres ne dépendent jamais de la couleur seule.
      const row = el('div', 'row');
      const sw = el('span', 'swatch');
      sw.style.background = color;
      row.append(sw, el('span', 'name', d.name), el('span', 'val', `${fmtMoney(d.revenue)} · ${d.share_pct}%`));
      legendEl.appendChild(row);
    });

    const center = svgEl('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', class: 'direct-label', 'font-size': 15 });
    center.textContent = fmtMoney(total);
    svg.appendChild(center);
    container.appendChild(svg);
  }

  // --- Rendu global ---
  function trendCell(pct) {
    const span = document.createElement('span');
    if (pct == null) { span.className = 'trend-flat'; span.textContent = '—'; return span; }
    span.className = pct >= 0 ? 'trend-up' : 'trend-down';
    span.textContent = `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}%`;
    return span;
  }

  function render(data) {
    $('resto-name').textContent = data.restaurant_name;
    $('period-label').textContent = `${PERIOD_LABELS[period]} · généré à partir des paiements collectés`;

    // 1. Overview
    const kpis = $('kpi-row');
    kpis.textContent = '';
    const o = data.overview;
    kpis.appendChild(statTile({
      label: 'Revenue', value: fmtMoney(o.revenue), deltaPct: o.revenue_delta_pct,
      spark: sparkline(data.revenue_by_day.map((d) => d.revenue))
    }));
    kpis.appendChild(statTile({ label: 'Transactions', value: o.transactions.toLocaleString('en-US'), deltaPct: o.transactions_delta_pct }));
    kpis.appendChild(statTile({ label: 'Ticket moyen', value: fmtMoney2(o.avg_ticket), deltaPct: o.avg_ticket_delta_pct }));
    kpis.appendChild(statTile({ label: 'Tips totaux', value: fmtMoney(o.tips), deltaPct: o.tips_delta_pct }));

    // 2. Top items
    hBarChart($('top-items-chart'), data.top_items);
    const tbody = $('top-items-table').querySelector('tbody');
    tbody.textContent = '';
    for (const it of data.top_items) {
      const tr = document.createElement('tr');
      tr.appendChild(el('td', null, it.name));
      tr.appendChild(el('td', 'num', it.qty.toLocaleString('en-US')));
      tr.appendChild(el('td', 'num', fmtMoney(it.revenue)));
      const tdTrend = el('td', 'num');
      tdTrend.appendChild(trendCell(it.trend_pct));
      tr.appendChild(tdTrend);
      tr.appendChild(el('td', 'num', `${it.share_pct}%`));
      tbody.appendChild(tr);
    }

    // 3. Peak hours
    $('hours-insight').textContent = data.peak_hours.insight || '';
    lineChart($('hours-chart'), data.peak_hours.series);
    const hbody = $('hours-table').querySelector('tbody');
    hbody.textContent = '';
    for (const h of data.peak_hours.series.filter((d) => d.transactions > 0)) {
      const tr = document.createElement('tr');
      tr.appendChild(el('td', null, `${h.hour}h – ${h.hour + 1}h`));
      tr.appendChild(el('td', 'num', String(h.transactions)));
      tr.appendChild(el('td', 'num', fmtMoney2(h.avg_ticket)));
      tr.appendChild(el('td', 'num', `${h.tip_pct}%`));
      hbody.appendChild(tr);
    }

    // 4. Peak days
    $('days-insight').textContent = data.peak_days.insight || '';
    vBarChart($('days-chart'), data.peak_days.series);

    // 5. Item trends
    const fillTrends = (id, list, up) => {
      const ul = $(id);
      ul.textContent = '';
      if (list.length === 0) { ul.appendChild(el('li', 'empty', 'Rien à signaler')); return; }
      for (const m of list) {
        const li = document.createElement('li');
        li.appendChild(el('span', null, m.name));
        li.appendChild(el('span', `pct ${up ? 'up' : 'down'}`, `${up ? '+' : ''}${m.trend_pct}%`));
        ul.appendChild(li);
      }
    };
    fillTrends('gainers', data.item_trends.gainers, true);
    fillTrends('losers', data.item_trends.losers, false);
    const alerts = $('alerts');
    alerts.textContent = '';
    if (data.item_trends.alerts.length === 0) alerts.appendChild(el('li', 'empty', 'Aucune alerte'));
    for (const a of data.item_trends.alerts) alerts.appendChild(el('li', null, `⚠️ ${a.message}`));

    // 6. Customer metrics
    const c = data.customer_metrics;
    const cust = $('customer-kpis');
    cust.textContent = '';
    cust.appendChild(statTile({ label: 'Ticket moyen', value: fmtMoney2(c.avg_ticket) }));
    cust.appendChild(statTile({ label: 'Tip moyen', value: `${c.avg_tip_pct}%` }));
    cust.appendChild(statTile({ label: 'Tip moyen ($)', value: fmtMoney2(c.avg_tip) }));
    cust.appendChild(statTile({ label: 'Taille de groupe', value: `${c.avg_party_size} pers.` }));
    cust.appendChild(statTile({ label: 'Scan → paiement', value: c.avg_time_to_pay_minutes != null ? `${c.avg_time_to_pay_minutes} min` : '—' }));

    // 7. Categories
    donutChart($('category-chart'), $('category-legend'), data.category_breakdown);
  }

  async function loadData() {
    const content = $('content');
    content.style.opacity = content.hidden ? '' : '0.5'; // garde le rendu précédent pendant le refetch
    try {
      const res = await fetch(`/api/v1/analytics?rest_id=${encodeURIComponent(restId)}&api_key=${encodeURIComponent(apiKey)}&period=${period}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de chargement');
      $('loading').hidden = true;
      $('error').hidden = true;
      content.hidden = false;
      render(data);
    } catch (err) {
      $('loading').hidden = true;
      const box = $('error');
      box.hidden = false;
      box.textContent = `Impossible de charger le dashboard : ${err.message}. Vérifiez rest_id et api_key dans l'URL.`;
    } finally {
      content.style.opacity = '';
    }
  }

  // Filtres de période : une rangée au-dessus, tout le dashboard se re-rend sur la même tranche.
  $('filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn || btn.dataset.period === period) return;
    period = btn.dataset.period;
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
    loadData();
  });

  if (!restId || !apiKey) {
    $('loading').hidden = true;
    const box = $('error');
    box.hidden = false;
    box.textContent = 'URL invalide : paramètres rest_id et api_key requis.';
  } else {
    loadData();
    // Rafraîchit régulièrement : les nouveaux paiements apparaissent tout seuls.
    setInterval(loadData, 60000);
  }
})();

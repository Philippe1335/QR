// Page de paiement client : facture, division par client, pourboire,
// paiement simulé (Apple Pay / carte), confirmation.

(function () {
  const params = new URLSearchParams(location.search);
  const factureId = params.get('facture_id');
  const app = document.getElementById('app');

  const state = {
    facture: null,
    mode: 'all', // all | split
    selectedClients: new Set(),
    tipRate: 0.15,
    processing: false
  };

  const fmt = (n) => `$${n.toFixed(2)}`;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clientGroups(items) {
    const groups = new Map();
    for (const it of items) {
      if (!groups.has(it.client_id)) groups.set(it.client_id, []);
      groups.get(it.client_id).push(it);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }

  function itemsTotal(items) {
    return items.reduce((s, it) => s + it.price * it.qty, 0);
  }

  // Montant à payer selon le mode : tout le restant, ou la part des clients cochés
  // (avec la taxe au prorata).
  function amountDue() {
    const f = state.facture;
    if (state.mode === 'all') return f.remaining;
    const groups = clientGroups(f.items);
    let share = 0;
    for (const [clientId, items] of groups) {
      if (state.selectedClients.has(clientId)) share += itemsTotal(items);
    }
    if (share <= 0) return 0;
    const withTax = share * (f.total / (f.subtotal || f.total));
    return Math.min(Math.round(withTax * 100) / 100, f.remaining);
  }

  function tipAmount() {
    return Math.round(amountDue() * state.tipRate * 100) / 100;
  }

  function render() {
    const f = state.facture;
    app.textContent = '';

    if (!f) {
      app.appendChild(el('div', 'error-box', 'Facture introuvable ou expirée. Demandez un nouveau QR code au serveur.'));
      return;
    }
    if (f.status === 'paid') {
      renderSuccess();
      return;
    }

    app.appendChild(el('h1', 'resto-name', f.restaurant_name));
    app.appendChild(el('p', 'table-info', `Table ${f.table_id} · Facture ${f.facture_id.slice(-6)}`));

    // Choix du mode
    const toggle = el('div', 'mode-toggle');
    const btnAll = el('button', `mode-btn${state.mode === 'all' ? ' active' : ''}`, 'Payer tout ensemble');
    const btnSplit = el('button', `mode-btn${state.mode === 'split' ? ' active' : ''}`, 'Diviser par client');
    btnAll.onclick = () => { state.mode = 'all'; render(); };
    btnSplit.onclick = () => {
      state.mode = 'split';
      if (state.selectedClients.size === 0) state.selectedClients.add(clientGroups(f.items)[0][0]);
      render();
    };
    toggle.append(btnAll, btnSplit);
    app.appendChild(toggle);

    // Facture
    const card = el('div', 'card');
    card.appendChild(el('h2', null, 'Votre addition'));
    for (const [clientId, items] of clientGroups(f.items)) {
      const group = el('div', 'client-group');
      const head = el(state.mode === 'split' ? 'label' : 'div', 'client-head');
      if (state.mode === 'split') {
        const check = el('input', 'client-check');
        check.type = 'checkbox';
        check.checked = state.selectedClients.has(clientId);
        check.onchange = () => {
          check.checked ? state.selectedClients.add(clientId) : state.selectedClients.delete(clientId);
          render();
        };
        head.appendChild(check);
      }
      head.appendChild(el('span', null, `Client ${clientId}`));
      head.appendChild(el('span', 'amount', fmt(itemsTotal(items))));
      group.appendChild(head);
      for (const it of items) {
        const row = el('div', 'item-row');
        const name = el('span');
        if (it.qty > 1) name.appendChild(el('span', 'qty', `${it.qty}×`));
        name.appendChild(document.createTextNode(it.name));
        row.append(name, el('span', 'price', fmt(it.price * it.qty)));
        group.appendChild(row);
      }
      card.appendChild(group);
    }

    // Totaux
    const totals = el('div', 'totals');
    const addTotal = (label, value, cls) => {
      const row = el('div', `total-row${cls ? ` ${cls}` : ''}`);
      row.append(el('span', null, label), el('span', 'num', value));
      totals.appendChild(row);
    };
    addTotal('Sous-total', fmt(f.subtotal));
    if (f.tax > 0) addTotal('Taxes', fmt(f.tax));
    addTotal(`Pourboire (${Math.round(state.tipRate * 100)}%)`, fmt(tipAmount()));
    addTotal(state.mode === 'split' ? 'Votre part' : 'Total à payer', fmt(amountDue() + tipAmount()), 'grand');
    if (f.amount_paid > 0) {
      totals.appendChild(el('p', 'paid-note', `✓ ${fmt(f.amount_paid)} déjà payé — reste ${fmt(f.remaining)}`));
    }
    card.appendChild(totals);
    app.appendChild(card);

    // Pourboire
    const tipCard = el('div', 'card');
    tipCard.appendChild(el('h2', null, 'Pourboire'));
    const tipGrid = el('div', 'tip-grid');
    for (const rate of [0, 0.1, 0.15, 0.2]) {
      const btn = el('button', `tip-btn${state.tipRate === rate ? ' active' : ''}`);
      btn.appendChild(document.createTextNode(rate === 0 ? 'Aucun' : `${Math.round(rate * 100)}%`));
      if (rate > 0) btn.appendChild(el('small', null, fmt(amountDue() * rate)));
      btn.onclick = () => { state.tipRate = rate; render(); };
      tipGrid.appendChild(btn);
    }
    tipCard.appendChild(tipGrid);
    app.appendChild(tipCard);

    // Boutons de paiement
    const payArea = el('div', 'pay-area');
    const due = amountDue();
    const disabled = due <= 0 || state.processing;

    const appleBtn = el('button', 'pay-btn apple', ` Payer ${fmt(due + tipAmount())}`);
    appleBtn.disabled = disabled;
    appleBtn.onclick = () => pay('apple_pay');

    const cardBtn = el('button', 'pay-btn card-btn', `💳 Payer par carte ${fmt(due + tipAmount())}`);
    cardBtn.disabled = disabled;
    cardBtn.onclick = () => pay('card');

    payArea.append(appleBtn, cardBtn, el('p', 'pay-note', 'Paiement sécurisé · Démo — aucun montant réel débité'));
    app.appendChild(payArea);
  }

  function renderSuccess(partial) {
    const f = state.facture;
    app.textContent = '';
    const box = el('div', 'success');
    box.appendChild(el('div', 'check', '✓'));
    box.appendChild(el('h1', null, 'Paiement reçu'));
    box.appendChild(el('p', null, partial
      ? `Votre part est réglée. Reste ${fmt(f.remaining)} sur la table.`
      : 'Merci et à bientôt !'));
    box.appendChild(el('p', 'detail', `${f.restaurant_name} · Table ${f.table_id}`));
    if (partial) {
      const btn = el('button', 'pay-btn card-btn', 'Payer une autre part');
      btn.style.marginTop = '28px';
      btn.onclick = () => { state.selectedClients.clear(); render(); };
      box.appendChild(btn);
    }
    app.appendChild(box);
  }

  async function pay(method) {
    if (state.processing) return;
    state.processing = true;

    const overlay = el('div', 'processing-overlay');
    overlay.appendChild(el('div', 'spinner'));
    overlay.appendChild(el('p', null, method === 'apple_pay' ? 'Confirmation Apple Pay…' : 'Traitement du paiement…'));
    document.body.appendChild(overlay);

    // Simule la latence du prestataire de paiement.
    await new Promise((r) => setTimeout(r, 1400));

    try {
      const res = await fetch(`/api/checkout/${factureId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountDue(),
          tip: tipAmount(),
          method,
          client_ids: state.mode === 'split' ? [...state.selectedClients] : []
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Paiement refusé');
      state.facture = data;
      state.facture.status === 'paid' ? renderSuccess(false) : renderSuccess(true);
    } catch (err) {
      alert(err.message);
      render();
    } finally {
      overlay.remove();
      state.processing = false;
    }
  }

  async function init() {
    if (!factureId) {
      app.textContent = '';
      app.appendChild(el('div', 'error-box', 'Lien invalide : facture_id manquant.'));
      return;
    }
    try {
      const res = await fetch(`/api/checkout/${factureId}`);
      if (!res.ok) throw new Error();
      state.facture = await res.json();
    } catch {
      state.facture = null;
    }
    render();
  }

  init();
})();

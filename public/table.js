/* Page client : affiche la facture de la table, permet de partager
   l'addition (1 à 4 parts) et de payer via Apple Pay (Stripe) ou carte. */

const tableId = window.location.pathname.split('/').pop();
const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const eur = (cents) => fmt.format(cents / 100);

const el = (id) => document.getElementById(id);

let config = { demoMode: true };
let bill = null;
let stripe = null;
let cardElement = null;
let paymentRequest = null;
let prButtonMounted = false;

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur réseau');
  return data;
}

function showError(msg) {
  const box = el('error-msg');
  box.textContent = msg;
  box.style.display = msg ? 'block' : 'none';
}

function render() {
  el('table-label').textContent = `Table ${bill.tableId}`;

  const tbody = el('bill-items');
  tbody.innerHTML = '';
  for (const it of bill.items) {
    const tr = document.createElement('tr');
    const qty = document.createElement('td');
    qty.className = 'qty';
    qty.textContent = `${it.qty}×`;
    const name = document.createElement('td');
    name.textContent = it.name;
    const price = document.createElement('td');
    price.className = 'price';
    price.textContent = eur(it.qty * it.unitPrice);
    tr.append(qty, name, price);
    tbody.appendChild(tr);
  }

  el('total').textContent = eur(bill.total);
  el('paid-row').style.display = bill.paid > 0 ? 'flex' : 'none';
  el('paid').textContent = `− ${eur(bill.paid)}`;
  el('remaining-row').style.display = bill.paid > 0 && !bill.settled ? 'flex' : 'none';
  el('remaining').textContent = eur(bill.remaining);

  const list = el('payments-list');
  list.innerHTML = '';
  bill.payments.forEach((p, i) => {
    const div = document.createElement('div');
    div.textContent = `✓ Part ${i + 1} payée — ${eur(p.amount)}`;
    list.appendChild(div);
  });

  document.querySelectorAll('.split-grid button').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.n) === bill.splitCount);
    btn.disabled = bill.settled || Number(btn.dataset.n) < bill.payments.length;
  });

  if (bill.splitCount > 1) {
    const shareNo = bill.payments.length + 1;
    el('split-hint').textContent =
      `Addition partagée en ${bill.splitCount} — chacun paie environ ${eur(Math.round(bill.total / bill.splitCount))}.`;
    el('share-label').textContent = `Part ${Math.min(shareNo, bill.splitCount)} sur ${bill.splitCount}`;
  } else {
    el('split-hint').textContent = 'Choisissez en combien de parts diviser l’addition.';
    el('share-label').textContent = 'À payer maintenant';
  }

  el('share-amount').textContent = eur(bill.nextShareAmount);

  el('split-card').style.display = bill.settled ? 'none' : 'block';
  el('pay-card').style.display = bill.settled ? 'none' : 'block';
  el('settled-card').style.display = bill.settled ? 'block' : 'none';

  if (!bill.settled && paymentRequest) {
    paymentRequest.update({
      total: { label: `Table ${bill.tableId} — addition`, amount: bill.nextShareAmount }
    });
  }
}

async function refreshBill() {
  bill = await api(`/api/table/${tableId}/bill`);
  render();
}

async function setSplit(n) {
  showError('');
  try {
    bill = await api(`/api/table/${tableId}/split`, {
      method: 'POST',
      body: JSON.stringify({ splitCount: n })
    });
    render();
  } catch (err) {
    showError(err.message);
  }
}

/* --- Paiement Stripe (Apple Pay via Payment Request Button + carte) --- */

async function setupStripe() {
  stripe = Stripe(config.publishableKey);

  paymentRequest = stripe.paymentRequest({
    country: 'FR',
    currency: config.currency,
    total: { label: `Table ${bill.tableId} — addition`, amount: bill.nextShareAmount },
    requestPayerName: false,
    requestPayerEmail: false
  });

  const result = await paymentRequest.canMakePayment();
  if (result) {
    const prButton = stripe.elements().create('paymentRequestButton', {
      paymentRequest,
      style: { paymentRequestButton: { type: 'default', theme: 'dark', height: '48px' } }
    });
    prButton.mount('#payment-request-button');
    prButtonMounted = true;

    paymentRequest.on('paymentmethod', async (ev) => {
      try {
        const { clientSecret } = await api(`/api/table/${tableId}/payment-intent`, { method: 'POST' });
        const { error, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );
        if (error) {
          ev.complete('fail');
          showError(error.message);
          return;
        }
        ev.complete('success');
        if (paymentIntent.status === 'requires_action') {
          const r = await stripe.confirmCardPayment(clientSecret);
          if (r.error) return showError(r.error.message);
        }
        await api(`/api/table/${tableId}/confirm`, {
          method: 'POST',
          body: JSON.stringify({ paymentIntentId: paymentIntent.id })
        });
        await refreshBill();
      } catch (err) {
        ev.complete('fail');
        showError(err.message);
      }
    });
  }

  // Repli carte bancaire (Apple Pay indisponible ou en complément).
  el('card-fallback').style.display = 'block';
  cardElement = stripe.elements().create('card');
  cardElement.mount('#card-element');

  el('card-pay-btn').addEventListener('click', async () => {
    showError('');
    el('card-pay-btn').disabled = true;
    try {
      const { clientSecret } = await api(`/api/table/${tableId}/payment-intent`, { method: 'POST' });
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement }
      });
      if (error) throw new Error(error.message);
      await api(`/api/table/${tableId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId: paymentIntent.id })
      });
      cardElement.clear();
      await refreshBill();
    } catch (err) {
      showError(err.message);
    } finally {
      el('card-pay-btn').disabled = false;
    }
  });
}

/* --- Mode démo (sans clés Stripe) --- */

function setupDemo() {
  const btn = el('demo-pay-btn');
  btn.style.display = 'block';
  el('demo-note').style.display = 'block';

  btn.addEventListener('click', async () => {
    showError('');
    btn.disabled = true;
    btn.textContent = 'Paiement en cours…';
    try {
      // Petite pause pour simuler la feuille de paiement Apple Pay.
      await new Promise((r) => setTimeout(r, 900));
      bill = await api(`/api/table/${tableId}/confirm-demo`, { method: 'POST' });
      render();
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = ' Payer avec Apple Pay (démo)';
    }
  });
}

async function init() {
  config = await api('/api/config');
  await refreshBill();

  document.querySelectorAll('.split-grid button').forEach((btn) => {
    btn.addEventListener('click', () => setSplit(Number(btn.dataset.n)));
  });

  if (config.demoMode || !config.publishableKey) {
    setupDemo();
  } else {
    await setupStripe();
  }

  // Rafraîchit la facture régulièrement : utile quand plusieurs convives
  // paient chacun leur part depuis leur propre téléphone.
  setInterval(async () => {
    if (bill && !bill.settled) {
      try { await refreshBill(); } catch { /* réseau : on réessaiera */ }
    }
  }, 5000);
}

init().catch((err) => showError(err.message));

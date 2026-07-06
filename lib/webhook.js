// Envoi du webhook `payment.completed` au POS après paiement complet.
// 3 tentatives avec backoff (2s, 4s), sans bloquer la réponse HTTP.

const store = require('./store');

function buildPayload(facture) {
  const lastPayment = facture.payments[facture.payments.length - 1] || {};
  return {
    event: 'payment.completed',
    facture_id: facture.id,
    restaurant_id: facture.restaurant_id,
    table_id: facture.table_id,
    amount_paid: facture.amount_paid,
    tip: facture.tip,
    payment_method: lastPayment.method || facture.payment_method,
    timestamp_scan: facture.scanned_at,
    timestamp_payment: facture.paid_at,
    time_to_pay_minutes: store.timeToPayMinutes(facture),
    party_size: facture.party_size,
    items: facture.items.map((it) => ({
      name: it.name,
      price: it.price,
      qty: it.qty,
      category: it.category
    }))
  };
}

async function dispatchPaymentCompleted(facture) {
  const restaurant = store.getRestaurant(facture.restaurant_id);
  if (!restaurant || !restaurant.webhook_url) return;

  const payload = buildPayload(facture);
  const delays = [0, 2000, 4000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) await new Promise((r) => setTimeout(r, delays[attempt]));
    try {
      const res = await fetch(restaurant.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) return;
      console.error(`Webhook POS ${restaurant.webhook_url} : HTTP ${res.status} (tentative ${attempt + 1})`);
    } catch (err) {
      console.error(`Webhook POS ${restaurant.webhook_url} : ${err.message} (tentative ${attempt + 1})`);
    }
  }
}

module.exports = { buildPayload, dispatchPaymentCompleted };

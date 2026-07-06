# Payment + Analytics Platform

Plateforme 2-en-1 à intégrer dans les systèmes POS de restaurants :

1. **Payment layer** — le client scanne un QR code sur sa table et paie directement (tout ensemble ou divisé par client, avec pourboire).
2. **Analytics** — chaque paiement est collecté automatiquement et alimente un dashboard d'insights : meilleurs plats, heures de pointe, tendances, alertes.

Le POS reçoit les paiements (webhook) **et** les insights.

## Démarrage

```bash
npm install
npm start
# → http://localhost:3000
```

Au premier lancement, un restaurant de démo (**Chez Philippe**) est créé avec 60 jours de paiements simulés :

- Page d'accueil + démo : `http://localhost:3000/`
- Dashboard : `http://localhost:3000/dashboard?rest_id=rest_demo&api_key=demo_key_123`
- Checkout client : bouton « Créer une facture démo » sur la page d'accueil

Variables d'environnement : `PORT`, `BASE_URL` (URL publique utilisée dans les QR codes), `PLATFORM_KEY` (clé d'onboarding, défaut `platform_key_123`), `SEED_DEMO=0` pour désactiver la démo, `DATA_DIR` (persistance JSON, défaut `./data`).

## Interface client (paiement)

```
GET /checkout?rest_id=REST_ID&table_id=TABLE_ID&facture_id=FACTURE_ID
```

Flux : scan du QR → facture complète → « Payer tout ensemble » ou « Diviser par client » (cases à cocher par client, taxe au prorata) → pourboire (0/10/15/20 %) → paiement Apple Pay / carte **simulé** → « ✓ Paiement reçu ». Mobile-first, gros boutons. Le premier chargement de la page enregistre l'heure de scan (métrique scan → paiement).

## Dashboard analytics

```
GET /dashboard?rest_id=REST_ID&api_key=KEY
```

Périodes : aujourd'hui / 7 / 30 / 90 jours. Sections :

1. **Overview** — revenue, transactions, ticket moyen, tips (avec delta vs période précédente + sparkline)
2. **Top items** — top 10 plats : graphique + tableau (quantité, revenue, trend ↑↓, % du total)
3. **Peak hours** — courbe transactions/heure + tableau (ticket moyen, tip %) + insight auto (« 19h-21h = 34 % des ventes »)
4. **Peak days** — barres lundi→dimanche + insight auto (« Vendredi/Samedi = 46 % de ta semaine »)
5. **Item trends** — 30 jours : top gainers, top losers, alertes (« ⚠️ Steak Frites n'a pas été commandé depuis 5 jours »)
6. **Customer metrics** — ticket moyen, tips moyens (% et $), taille de groupe, temps moyen scan → paiement
7. **Category breakdown** — donut du revenue par catégorie

## API pour le POS

Authentification : header `X-API-Key` (ou `Authorization: Bearer`, ou `?api_key=`).

### Onboarding d'un restaurant

```
POST /api/v1/restaurants           (header X-Platform-Key)
{ "name": "Mon Resto", "webhook_url": "https://pos.example.com/hook" }
→ { restaurant_id, api_key, dashboard_url }
```

### 1. Créer une facture

```
POST /api/v1/factures
{
  "restaurant_id": "rest_123",
  "table_id": "5",
  "items": [{ "name": "Burger", "price": 12.0, "qty": 1, "client_id": "1", "category": "Plats" }],
  "tax": 4.05,
  "party_size": 4
}
→ { facture_id, checkout_url, qr_code }   (qr_code = data URL PNG ; aussi GET /api/v1/factures/:id/qr.png)
```

`subtotal` et `total` sont calculés automatiquement s'ils ne sont pas fournis.

### 2. Vérifier le statut

```
GET /api/v1/factures/:id
→ { facture_id, status: "paid" | "pending" | "partial" | "cancelled", amount_total, amount_paid, tip }
```

### 3. Annuler

```
DELETE /api/v1/factures/:id
```

### 4. Webhook après paiement complet

```
POST https://[POS_WEBHOOK_URL]
{
  "event": "payment.completed",
  "facture_id": "fac_abc123",
  "restaurant_id": "rest_123",
  "table_id": "5",
  "amount_paid": 40.25,
  "tip": 5.00,
  "payment_method": "apple_pay",
  "timestamp_scan": "2024-01-15T19:20:00Z",
  "timestamp_payment": "2024-01-15T19:28:00Z",
  "time_to_pay_minutes": 8,
  "party_size": 4,
  "items": [{ "name": "Burger", "price": 12.00, "qty": 1, "category": "Plats" }]
}
```

3 tentatives avec backoff (0s, 2s, 4s), timeout 10s.

### 5. Analytics en JSON

```
GET /api/v1/analytics?rest_id=REST_ID&period=week   (today | week | month | quarter)
```

Retourne toutes les sections du dashboard (overview, top_items, peak_hours, peak_days, item_trends, customer_metrics, category_breakdown) — le POS peut donc afficher les insights dans sa propre interface.

## Notes d'implémentation

- **Paiement simulé** : `POST /api/checkout/:id/pay` enregistre le paiement directement. En production, brancher un PaymentIntent Stripe confirmé côté serveur à cet endroit (`server.js`).
- **Stockage** : en mémoire + persistance JSON (`data/db.json`). À remplacer par une vraie base de données en production.
- Stack : Node.js ≥ 18, Express, `qrcode`. Frontend en HTML/CSS/JS vanilla, sans framework ni CDN.

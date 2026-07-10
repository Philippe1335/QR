# Payment + Service + Analytics Platform

Plateforme 3-en-1 qui s'ajoute par-dessus le POS existant d'un restaurant :

1. **Service** — le client scanne le QR de sa table → consulte le menu, appelle le serveur, paie.
2. **Payment** — paiement direct par QR avec split flexible (tout / également / par item) + pourboire.
3. **Analytics** — paiements, demandes serveur et feedbacks alimentent automatiquement un dashboard d'insights.

Le POS continue de gérer les commandes normalement ; le menu est en lecture seule pour le client.

## Démarrage

```bash
npm install
npm start       # → http://localhost:3000
```

Le frontend compilé (`dist/`) est inclus dans le repo — `npm run build` n'est nécessaire qu'après avoir modifié `src/`.

Au premier lancement, le restaurant démo **Chez Philippe** est créé : 60 jours de transactions, ~350 demandes serveur, ~300 feedbacks, factures actives sur les tables 3, 5, 8 et 12, et 5 demandes en attente sur la tablette.

| Interface | URL |
|---|---|
| Accueil démo (+ QR à scanner) | `http://localhost:3000/` |
| Écran client d'une table | `/table?rest_id=rest_demo&table_id=5` |
| Tablette serveur | `/server-view?rest_id=rest_demo` |
| Dashboard analytics | `/dashboard?rest_id=rest_demo&api_key=demo_key_123` |

En dev : `npm run dev:server` (API sur :3000) + `npm run dev` (Vite sur :5173 avec proxy `/api`).

### Tester le flow complet

1. Ouvre `/table?rest_id=rest_demo&table_id=5` → 3 options.
2. Consulte le menu complet (onglets par catégorie), reviens.
3. « Appeler le serveur » → « De l'eau » → « ✓ Le serveur a été averti ».
4. Dans un autre onglet, ouvre `/server-view?rest_id=rest_demo` → la demande apparaît (polling 3 s, son activable) → « Traité ».
5. Retour sur `/table` → « Payer la facture » → teste les 3 modes de split.
6. Paie (simulé — Stripe test 4242 4242 4242 4242) → feedback 2 questions (étoiles, puis avis Google ou « quoi améliorer »).
7. Ouvre `/dashboard?rest_id=rest_demo&api_key=demo_key_123` → les métriques incluent ton paiement, ta demande et ton feedback.

### Tester le QR avec un téléphone

`npm start` affiche l'adresse réseau (`http://192.168.x.x:3000`). Ouvre **cette adresse** sur l'ordinateur, clique « 📱 Scanner avec mon téléphone », scanne le QR (même Wi-Fi). Le QR encode `/table?rest_id=…&table_id=…`. Pour un accès hors réseau local : tunnel (`npx cloudflared tunnel --url http://localhost:3000` + `BASE_URL=…`) ou déploiement.

## Interface client (`/table`)

Écran d'accueil à 3 options, mobile-first, gros boutons :

- **📋 Voir le menu complet** — 22 items en 4 catégories (photos emoji placeholder, descriptions, prix). Lecture seule.
- **🔔 Appeler le serveur** — 5 demandes en un tap : 🍽️ prêt à commander, 💧 eau, 🧂 condiments, 🙋 assistance, 🧾 addition. Confirmation « ✓ Le serveur a été averti ».
- **💳 Payer la facture** — facture complète, puis split : **payer tout**, **diviser également** (÷ X personnes) ou **diviser par item** (cases par client, taxe au prorata) ; pourboire 15/18/20 %/autre ; paiement simulé Apple Pay/carte ; puis **feedback 2 questions** : note 1-5 ★, et selon la note → lien avis Google (4-5★) ou « quoi améliorer » (1-3★ : service lent / erreur commande / qualité / autre + commentaire).

## Tablette serveur (`/server-view`)

Demandes en direct, polling 3 s : urgences en premier (🙋 assistance, 🧾 addition — cartes rouges), demandes normales en jaune, traitées en gris (visibles 2 min). Bouton **« Traité »** (optimiste), horodatage vivant (« il y a 30 s »), bip sonore activable pour les nouvelles demandes.

## Dashboard analytics (`/dashboard`)

Périodes : aujourd'hui / 7 / 30 / 90 jours. 6 widgets :

1. **Overview** — revenue, transactions, ticket moyen, tips (deltas vs période précédente) + **score de satisfaction**.
2. **Top items** — top 10 : barres + tableau (qté, revenue, trend ↑↓, % du total).
3. **Peak hours / days** — courbe par heure + barres lundi→dimanche, avec insights auto.
4. **Demandes serveur** — répartition par type (%), volume, temps de réponse moyen du staff, demandes en attente.
5. **Feedback client** — score moyen, distribution 5★→1★, % d'avis Google, commentaires négatifs récents.
6. **Split de facture** — % tout ensemble / divisé également / par item, taille de groupe, temps scan → paiement.

## API

Clé API du restaurant : header `X-API-Key`, `Authorization: Bearer` ou `?api_key=`. Les endpoints côté client (menu, demandes, checkout, feedback) sont publics — connaître l'URL de sa table sert de capacité d'accès.

| Endpoint | Rôle |
|---|---|
| `GET /api/v1/menu?rest_id=X` | Menu complet (catégories, items, prix) |
| `POST /api/v1/server-request` | `{restaurant_id, table_id, request_type: water\|condiments\|assistance\|ready_to_order\|bill}` |
| `PATCH /api/v1/server-request/:id` | `{status: "handled"}` |
| `GET /api/v1/server-requests?rest_id=X` | Demandes en attente + traitées < 2 min (polling tablette) |
| `POST /api/v1/restaurants` | Onboarding (header `X-Platform-Key`) → `{restaurant_id, api_key, dashboard_url}` |
| `POST /api/v1/factures` 🔑 | Créer une facture → `{facture_id, checkout_url, qr_code}` |
| `GET /api/v1/factures/:id` 🔑 | Statut : paid / pending / partial / cancelled, montants, tip |
| `DELETE /api/v1/factures/:id` 🔑 | Annuler |
| `POST /api/v1/payment` | `{facture_id, split_type: full\|equal\|by_item, amount, tip, method}` |
| `POST /api/v1/feedback` | `{facture_id, rating: 1-5, comment, issue_type, google_review}` |
| `GET /api/v1/analytics?rest_id=X&period=week` 🔑 | Toutes les métriques du dashboard en JSON |
| Webhook `payment.completed` | POSTé au POS après paiement complet (3 tentatives, backoff) |

Payload du webhook : `{event, facture_id, restaurant_id, table_id, amount_paid, tip, payment_method, timestamp_scan, timestamp_payment, time_to_pay_minutes, party_size, items[]}`.

## Stack & structure

- **Frontend** : React 18 (Vite), React Router, TailwindCSS 4, Recharts — `src/pages` (TableHome, MenuView, CallServer, Checkout, Feedback, ServerView, Dashboard), `src/components` (SplitSelector, RequestCard, MenuCategory, RatingStars, Charts/…).
- **Backend** : Express + persistance JSON (`data/db.json`) — `server.js`, `lib/` (store, analytics, seed, menu, webhook). Un backend léger remplace le localStorage du MVP pour que téléphone, tablette et dashboard partagent les mêmes données en temps réel (le localStorage n'est pas partagé entre appareils).
- **Temps réel** : polling 3 s (pas de WebSocket nécessaire pour le MVP). Pas d'auth réelle côté client.
- **Paiement simulé** : brancher un PaymentIntent Stripe confirmé côté serveur dans `processPayment` (`server.js`) pour la production.

Variables d'environnement : `PORT`, `BASE_URL`, `PLATFORM_KEY`, `SEED_DEMO=0`, `DATA_DIR`.

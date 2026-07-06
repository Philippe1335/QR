# 🍽️ QR Restaurant Pay

Application web permettant aux clients d'un restaurant de **scanner un QR code
posé sur leur table**, de **consulter leur addition** et de **payer via
Apple Pay** (ou carte bancaire), avec la possibilité de **partager l'addition
en 2, 3 ou 4**.

## Fonctionnement

1. Le restaurateur ouvre la page d'accueil (`/`), qui affiche un **QR code par
   table**, prêt à imprimer.
2. Le client scanne le QR code de sa table → il arrive sur `/table/<n°>` et
   voit le **détail de sa commande et le total**.
3. Il choisit éventuellement de **diviser l'addition** (÷2, ÷3, ÷4) : chaque
   convive paie sa part depuis son propre téléphone (la page se met à jour en
   temps réel au fur et à mesure des paiements, et le dernier payeur règle
   exactement le solde pour gérer les arrondis).
4. Il paie via **Apple Pay** (bouton natif Stripe) ou par **carte bancaire**.
5. Quand toutes les parts sont réglées, la page affiche « Addition réglée » ✅.

## Démarrage rapide (mode démo)

```bash
npm install
npm start
```

Puis ouvrez <http://localhost:3000>. Sans clés Stripe, l'application tourne en
**mode démo** : le bouton « Payer avec Apple Pay (démo) » simule le paiement,
ce qui permet de tester tout le parcours (QR code, facture, partage, parts
payées) sans compte Stripe.

Trois tables d'exemple sont pré-remplies (les données vivent dans
`data/bills.json` — supprimez ce fichier pour réinitialiser la démo).

## Activer les paiements réels (Apple Pay via Stripe)

Apple Pay sur le web passe par un prestataire de paiement ; cette application
utilise **Stripe** et son bouton *Payment Request*, qui affiche automatiquement
Apple Pay sur Safari/iPhone (et Google Pay sur Android).

1. Créez un compte sur [stripe.com](https://stripe.com) et récupérez vos clés.
2. Lancez l'application avec vos clés :

   ```bash
   STRIPE_SECRET_KEY=sk_live_... \
   STRIPE_PUBLISHABLE_KEY=pk_live_... \
   BASE_URL=https://votre-domaine.fr \
   npm start
   ```

3. **Apple Pay exige HTTPS et un domaine vérifié** :
   - Dans le dashboard Stripe → *Settings → Payment methods → Apple Pay*,
     ajoutez votre domaine.
   - Stripe fournit un fichier `apple-developer-merchantid-domain-association` ;
     placez-le dans `public/.well-known/` (le serveur le sert déjà sur
     `/.well-known/...`).
   - Servez l'application en HTTPS (par exemple derrière un reverse proxy
     Nginx/Caddy, ou via un hébergeur type Render/Railway/Fly.io).

Pour tester en local avec les clés de **test** Stripe (`sk_test_`/`pk_test_`),
le paiement par carte fonctionne directement (carte `4242 4242 4242 4242`) ;
Apple Pay, lui, ne s'affiche que sur HTTPS avec domaine vérifié.

### Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (absente → mode démo) | — |
| `STRIPE_PUBLISHABLE_KEY` | Clé publiable Stripe (frontend) | — |
| `BASE_URL` | URL publique encodée dans les QR codes | déduite de la requête |
| `CURRENCY` | Devise des paiements | `eur` |
| `PORT` | Port d'écoute | `3000` |

## Architecture

```
server.js            Serveur Express : pages, QR codes, API, Stripe
lib/store.js         Factures (données de démo, partage, paiements, persistance JSON)
public/admin.html    Page restaurateur : QR codes par table, à imprimer
public/table.html    Page client : facture, partage, paiement
public/table.js      Logique client (Stripe Payment Request / Apple Pay, mode démo)
public/styles.css    Styles
data/bills.json      Données persistées (créé au premier lancement)
```

### API

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/tables` | Liste des tables et l'état de leur addition |
| `GET` | `/api/table/:id/bill` | Facture d'une table |
| `POST` | `/api/table/:id/split` | Définit le partage (`{"splitCount": 1‑4}`) |
| `POST` | `/api/table/:id/payment-intent` | Crée le paiement Stripe de la prochaine part |
| `POST` | `/api/table/:id/confirm` | Vérifie le paiement côté serveur et l'enregistre |
| `POST` | `/api/table/:id/confirm-demo` | Paiement simulé (mode démo uniquement) |
| `GET` | `/qr/:id.png` | QR code de la table (PNG) |

## Limites connues (pistes d'évolution)

- Les additions sont des données de démonstration : en production, brancher
  `lib/store.js` sur la caisse (POS) du restaurant.
- Le partage est en parts égales ; un partage « par article » serait une
  évolution naturelle.
- Stockage JSON sur disque : à remplacer par une base de données pour un
  déploiement multi-instances, et ajouter un webhook Stripe pour fiabiliser
  la confirmation des paiements.

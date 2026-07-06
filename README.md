# 🍽️ QR Restaurant Pay

Application web de **paiement de factures au restaurant via QR code sur table**,
avec **division de l'addition par client**.

Deux interfaces complètement séparées, qui partagent les mêmes données
(localStorage, synchronisées entre onglets) :

| Interface | URL | Pour qui |
|---|---|---|
| 📱 **Client** | `/pay?table=N` (via scan du QR code) | Les clients, sur mobile |
| 👨‍🍳 **Resto** | `/admin` | Le personnel, sur desktop/tablette |

## Démarrage rapide

```bash
npm install
npm run dev
```

Puis ouvrez <http://localhost:5173>.

**Pour tester le flow complet** : ouvrez `/admin` dans un onglet et
`/pay?table=1` dans un autre. Faites un paiement côté client → la table se
met à jour en direct côté resto (synchro via l'événement `storage`).

## Interface client (`/pay`)

1. Le client scanne le QR code de sa table (l'URL contient `?table=N`), ou
   entre son numéro de table à la main.
2. Il voit la **facture complète** : items par client, sous-total,
   TPS (5 %) + TVQ (9,975 %), total.
3. Il choisit **« Tout ensemble »** ou **« Diviser la facture »** :
   il coche les clients qui paient ensemble (ex. : Client 1 + Client 2),
   et voit « Vous payez X $ sur Y $ au total ».
4. **Paiement simulé** (façon Stripe test mode) : nom + carte de test
   `4242 4242 4242 4242`. Toute autre carte est refusée, aucune somme réelle
   n'est débitée.
5. Après paiement : ✓ confirmation, et les items payés **disparaissent** de la
   facture. Les autres convives paient le reste depuis leur propre téléphone.

## Interface resto (`/admin`)

- **Grille des 20 tables** avec statut (🟢 ACTIVE / ⬜ VIDE / ⚫ FERMÉE),
  montant total, reste à payer et nombre de clients.
- **Gérer une table** (`/admin/table/N`) :
  - ajouter un item du menu (quantité + assignation à Client 1, 2, …
    ou « Non assigné / partagé ») ;
  - régler le nombre de clients à table ;
  - voir la **facture en temps réel** groupée par client, retirer un item ;
  - voir les **paiements reçus** (qui a payé quoi, à quelle heure) ;
  - **Marquer comme payée / Libérer la table** → la table redevient VIDE ;
  - QR code de la table avec lien direct vers la page client.
- **QR codes** (`/admin/qr`) : les 20 QR codes prêts à imprimer
  (bouton Imprimer, mise en page print dédiée).

## Données de démo

- 20 tables pré-créées, menu de 16 items (poutine, burger, pizza, bière, vin,
  café, desserts…).
- Tables **1, 3, 8 et 12** ont des factures actives pour tester
  (la table 3 est une table de 4, idéale pour tester le split).
- Tout est persisté dans **localStorage** : un rechargement conserve l'état.
  Le bouton **« Réinitialiser la démo »** (ou la suppression de la clé
  `qr-resto-v2`) restaure les données d'exemple.

## Stack technique

- **React 18 + Vite** — SPA, aucune dépendance serveur
- **React Router** — routes `/`, `/pay`, `/admin`, `/admin/table/:id`, `/admin/qr`
- **qrcode.react** — génération des QR codes (SVG)
- **CSS simple** mobile-first (pas de framework)
- **Store maison** (`src/store.js`) : `useSyncExternalStore` + localStorage +
  événement `storage` pour la synchro temps réel entre onglets

## Structure des fichiers

```
src/
  main.jsx                        Point d'entrée
  App.jsx                         Routes
  store.js                        Store partagé (localStorage) + helpers (taxes, statuts…)
  styles.css                      Styles (mobile-first + print)
  data/mockData.js                Menu + 20 tables + factures d'exemple
  pages/
    Home.jsx                      Accueil : choix client / resto
    ClientPayment.jsx             Flow client : facture → split → paiement → ✓
    RestaurantDashboard.jsx       Grille des tables
    TableManage.jsx               Gestion d'une table (items, clients, paiements)
    QRCodesPage.jsx               QR codes à imprimer
  components/
    TableCard.jsx                 Carte de table (dashboard)
    FactureDisplay.jsx            Facture groupée par client + taxes
    SplitSelector.jsx             Cases à cocher « qui paie ensemble »
    PaymentForm.jsx               Formulaire de paiement simulé (Stripe test)
```

## Limites connues (pistes d'évolution)

- **Paiements simulés** : brancher le vrai Stripe (Payment Element / Apple Pay)
  en remplaçant `PaymentForm.jsx`.
- **Pas d'authentification** sur `/admin` — à ajouter avant toute mise en prod.
- **localStorage** : la synchro ne fonctionne qu'entre onglets du même
  navigateur. Pour un vrai multi-appareils, remplacer `src/store.js` par une
  petite API (les composants n'ont pas besoin de changer).
- **Pas d'intégration POS** : le menu et les factures sont des données mock.

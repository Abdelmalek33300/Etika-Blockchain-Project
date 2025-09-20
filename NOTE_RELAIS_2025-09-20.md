# Étika  Note de relais (20/09/2025)

## Règles dexécution
- **Une seule action à la fois.**
- **Fenêtre 1** = serveur **backend**  **Fenêtre 2** = serveur **frontend**  **Fenêtre 3** = **commandes/outillage**.
- Projet en **ESM** (Node 20). On évite tout mélange CommonJS.

---

## État atteint
- Route **GET `/api/public/auctions/:id/bids`** branchée sur **PostgreSQL** et **publique** (bypass auth).
- **Frontend** affiche les compétiteurs (auto-refresh 10 s, UUID mémorisé).
- **Smoke test** créé (script + tâche planifiée Windows toutes les 15 min).

---

## Stack & versions
- **Backend**: Node.js 20, Express (ESM), pg.
- **Frontend**: Vite + React 19 (proxy `/api`  https://localhost:4443).
- **DB**: PostgreSQL ; table `bids` (schéma réel) :
  - `id` **uuid** (pas de default  généré côté app)
  - `auction_id` **uuid**
  - `bidder` **text**
  - `amount_cents` **bigint**
  - `created_at` **timestamptz** default `now()`

---

## Fichiers ajoutés/modifiés (principaux)

### Backend (ESM)
- `backend/db.js`  **ESM** ; exports:
  - nommé `pool` et **default** `{ pool }`.
- `backend/routes/public-auctions-router.js`  **ESM** ; lit `bids` :
  - SELECT `id, auction_id, bidder, amount_cents, created_at`
  - tri `amount_cents DESC, created_at ASC`
  - JSON renvoyé : `{ id, auctionId, bidder, amountCents, createdAt }`.

### server.js
- Import ajouté : `import publicAuctionsRouter from './routes/public-auctions-router.js';`
- Montage **avant** lauth : `app.use(publicAuctionsRouter);`
- **Stubs inline** de la route **neutralisés** (remplacés par pass-through).

### Scripts utilitaires (ESM)
- `backend/scripts/seed-test-bid.js`  insert bid (args : `<AUCTION_UUID> <AMOUNT_CENTS> "Bidder"`).
- `backend/scripts/inspect-bids.js`  liste colonnes dune table.
- `backend/scripts/inspect-auctions.js`  liste dernières enchères.
- `backend/scripts/smoke-check-bids.js`  GET public route, log dans `backend/.logs/smoke-bids.log`.
- `backend/scripts/run-smoke-bids.ps1`  wrapper PowerShell pour le smoke test.

### Frontend
- `frontend/src/components/AuctionsPanel.jsx`  nouvelle carte Enchères  compétiteurs.
  - Input **Auction UUID** (persisté dans `localStorage`).
  - Polling 10 s, bouton Rafraîchir, format monnaie EUR.

---

## Variables denvironnement (Windows PowerShell)

**Fenêtre 1** (backend, avant `node server.js`) :
```powershell
$Env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/etika"
$Env:PGSSL = "false"


```


**Fenêtre 3** (scripts DB / smoke) :
```powershell
$Env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/etika"
$Env:PGSSL = "false"
```

---

 Fin de note.


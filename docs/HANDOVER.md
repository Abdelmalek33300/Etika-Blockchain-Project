Mémo projet Etika (handover)

API locale
- HTTPS: https://localhost:4443

Public
- GET  /api/health
- GET  /api/auctions?status=all|active|draft|closed|archived&page=&limit=&sort=&order=
- GET  /api/auctions/:id/bids?page=&limit=&sort=amount_cents|created_at&order=
- GET  /api/public/counters  (threshold=100000, total_badges, percent, per_sector)

Admin (JWT)
- GET    /api/admin/auctions
- POST   /api/admin/auctions
- PATCH  /api/admin/auctions/:id/archive
- DELETE /api/admin/auctions/:id  (si 0 bid)

Sécurité & techniques
- Helmet, CORS whitelist, rate-limit /api/auth/login, JWT, express-validator
- ESM unifié, montants en centimes, PostgreSQL
- Smoke public OK

Config (.env)
- LAUNCH_THRESHOLD=100000
- DATABASE_URL=postgres://.../etika
- PGSSLMODE=disable
- JWT_SECRET=...
- ALLOWED_ORIGINS=...

Prochaines étapes
- Badges #1 : migration (tables badges + badge_verifications)
- Endpoints: POST /api/badges/request, POST /api/badges/verify
---

## Badges (V1)  Email flow, rate-limit & secteurs  2025-09-16 21:45

### Nouveaux endpoints (public)
- **POST /api/badges/request-email**  
  Body : { email:string, sector:string }  
  Réponse : 200 { ok, badge, magic_link? } *(en non-prod, magic_link est renvoyé pour test)*  
  **Rate-limit** : 5 requêtes / 10 min / IP  429 { "error":"too_many_requests" }.

- **GET /api/badges/verify-email?token=...**  
  Effet : passe le badge en **verified** et renseigne email_verified_at.  
  Réponse : 200 { ok, badge } ou 400 { error: "invalid_or_expired_token" }.

- (existant, dev) **POST /api/badges/request**  
  Body : { consumer_id:uuid, sector:string, proof?:object }  crée un badge equested.

- (existant, dev) **POST /api/badges/verify**  
  Body : { badge_id:uuid }  force erified *(autorisé si NODE_ENV !== 'production' ou ALLOW_DEV_VERIFY=true)*.

### Endpoints admin (rappel)
- **GET /api/admin/badges** (JWT admin)  filtres status|sector|consumer_id, tri/pagination.
- **PATCH /api/admin/badges/:id/verify** Body : { approved:boolean, note?:string }  erified ou ejected.

### Sécurité / ENV
- JWT_SECRET (obligatoire)  signature JWT (auth & magic links).
- SECTORS_ENFORCE=true  active la **whitelist** des secteurs.
- DATABASE_URL *(ou PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD)*.
- DATABASE_SSL=true *(si DB managée avec SSL)*.
- ALLOW_DEV_VERIFY=true  autorise lendpoint dev /api/badges/verify même en prod (éviter en production).

### Secteurs (liste évolutive)
Fichier : ackend/config/sectors.mjs  
Ajout : étendre SECTORS_RAW avec [ 'slug_machine', 'Libellé humain' ].  
Si SECTORS_ENFORCE=true, seuls les slug présents seront acceptés côté API.

### Migration (contact)
20250916_add_badge_contact_fields.sql a ajouté :  
email, phone, email_verified_at, phone_verified_at à la table adges.

---

## Smokes rapides (2025-09-16 22:59)

### 1) Flow badge par email (dev)
- **Fenêtre 2** (serveur déjà lancé en Fenêtre 1)  
\
ode .\backend\scripts\smoke-badges-email.mjs mobile\

> Attendu : \OK smoke: { sector: 'mobile', ... status: 'verified' }\

### 2) Liste admin des derniers badges vérifiés
- **Fenêtre 2**  
\
ode .\backend\scripts\smoke-admin-badges.mjs\

> Attendu : 5 lignes \id | sector | verified_at\ avec code 200 côté API admin.

### 3) Compteurs publics
- **Fenêtre 2**  
\
ode .\backend\scripts\get-public-counters.mjs\

> Attendu : \HTTP 200\ avec \	otal_badges\ et \per_sector\ cohérents.

_Note rate-limit_: \/api/badges/request-email\ est limité à **5 req / 10 min / IP** (HTTP 429 au-delà).

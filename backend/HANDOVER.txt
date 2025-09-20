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

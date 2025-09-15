\# Cahier des charges — Plateforme d’enchères consommateurs \& Badge pré-NFT



> \*\*Seuil global de déclenchement : 100 000 participants (badges vérifiés).\*\*  

> Une fois atteint, on démarre le \*\*compte à rebours\*\* jusqu’aux premières enchères.



**## 1) Objectif \& contexte**

Créer une plateforme où des \*\*consommateurs s’agrègent\*\* par secteurs (télécom, énergie, banque, etc.) et où des \*\*sponsors\*\* (grands groupes) \*\*enchérissent\*\* pour acheter leur engagement.  

Avant l’ouverture des enchères, une \*\*phase de communication\*\* collecte des participants via un \*\*badge d’engagement (pré-NFT, off-chain)\*\*, qui sera \*\*converti en NFT\*\* au lancement.



**## 2) Parties prenantes**

\- \*\*Consommateur\*\* : obtient un badge, choisit ses secteurs, participe aux enchères.

\- \*\*Sponsor\*\* : candidate par secteur, dépose des offres, sponsorise un groupe.

\- \*\*Admin\*\* : gère enchères, modération/anti-fraude, conformité.



**## 3) Périmètre V1**

\### 3.1 Phase Communication (pré-NFT off-chain)

\- Landing + \*\*compteur public\*\* d’inscrits (global + par secteur).

\- \*\*Badge d’engagement\*\* gratuit, lié à \*\*email et/ou téléphone\*\* (vérifiés).

\- \*\*Avantages\*\* attachés (priorité, tirages, bonus) pour le jour J.

\- \*\*Seuil global : 100 000\*\* (badges vérifiés) ⇒ déclenchement du compte à rebours.



\### 3.2 Lancement des enchères

\- Création d’\*\*enchères par secteur\*\* (statuts : draft/active/closed/archived).

\- \*\*Participation sponsors\*\*, classement des offres, publication résultats.

\- \*\*Conversion des badges → NFT\*\* (mint en lot, custodial au départ).



\### 3.3 POP (preuve d’achat) — après V1

\- \*\*Ancrage Merkle\*\* périodique des preuves sur une L2 publique (éco).

\- \*\*NFT “reçu”\*\* (optionnel, lazy mint) pour les utilisateurs.



**## 4) Parcours utilisateurs**

\*\*Consommateur\*\*

1\. Demande du badge → saisie email/tel → vérification (lien magique / OTP SMS).

2\. Badge actif → tableau de bord (progression vers 100 000, news secteur).

3\. Lancement → accès prioritaire aux enchères, \*\*NFT émis\*\* (puis liaison wallet possible).



\*\*Sponsor\*\*

1\. Accès aux \*\*compteurs\*\* (global + par secteur) et au calendrier.

2\. Back sponsor (modéré) → dépôt d’offres → enchère → sponsoring.



\*\*Admin\*\*

1\. CRUD enchères, \*\*soft-delete (archive)\*\*, statuts, filtres.

2\. Anti-fraude (CAPTCHA, rate-limit, détection doublons).

3\. Tableaux de bord (inscrits, progression, leads sponsor, conversions).



**## 5) Modèle de données (logique)**

\- \*\*badges\*\*(id, email, phone, email\_verified\_at, phone\_verified\_at, sector, status\[active|revoked], created\_at)

\- \*\*badge\_verifications\*\*(id, badge\_id, kind\[email|sms], token\_hash, sent\_to, expires\_at, attempts, status\[pending|verified|expired|invalid], created\_at, verified\_at)

\- \*\*auctions\*\*(id, title, sector, status, archived\_at, created\_at)

\- \*\*bids\*\*(id, auction\_id, amount\_cents, created\_at)

\- (\*plus tard\*) \*\*user\_nfts\*\*, \*\*purchases\*\*, \*\*pop\_commitments\*\*



**## 6) API (macro)**

Public

GET /api/health

GET /api/auctions?status=all|active|draft|closed|archived\&page=\&limit=\&sort=\&order=

GET /api/auctions/:id/bids?page=\&limit=\&sort=amount\_cents|created\_at\&order=

GET /api/public/counters → { threshold: 100000, total\_badges, percent, per\_sector\[] }



Badge / Auth légère (V1.1)

POST /api/badges/request (email OU téléphone)

POST /api/badges/verify (lien magique OU OTP)



Admin

GET /api/admin/auctions

POST /api/admin/auctions

PATCH /api/admin/auctions/:id/archive

DELETE /api/admin/auctions/:id (si 0 bid)

**## 7) Exigences non-fonctionnelles**

\- \*\*Sécurité\*\* : JWT, Helmet (CSP/HSTS prod), CORS whitelist, rate-limit login/OTP, express-validator, CAPTCHA, blocage emails jetables.

\- \*\*RGPD\*\* : minimisation, consentement, droit d’effacement, chiffrement au repos, journaux d’accès.

\- \*\*Scalabilité\*\* : pagination partout, worker queue (emails/SMS, mint), idempotence.

\- \*\*Observabilité\*\* : logs structurés, métriques, smoke tests.



**## 8) KPI \& paliers (communication)**

\- \*\*Seuil global\*\* : \*\*100 000 badges vérifiés\*\* → déclenchement du \*\*compte à rebours\*\*.

\- Conversion « badge demandé → badge vérifié ».

\- Leads sponsors, nb d’offres, panier moyen sponsor.



**## 9) Gouvernance badge/NFT**

\- \*\*Pré-NFT off-chain\*\* (0 friction) durant la communication.

\- Conversion \*\*custodial\*\* en NFT au lancement (gas sponsorisé), option \*\*non-custodial\*\* ensuite.

\- \*\*Lazy mint\*\* pour les NFT “reçus” (si/quand utile).

\- Métadonnées neutres (pas de PII on-chain).



**## 10) Roadmap phasée**

\- \*\*Phase 0\*\* : Landing + compteur + badge off-chain (email/tel vérifiés).

\- \*\*Phase 1\*\* : Endpoints badge (request/verify) + compteur secteur.

\- \*\*Phase 2\*\* : Contrat ERC-721 (testnet) + worker de mint (POC).

\- \*\*Phase 3\*\* : L2 production (Polygon/Base), mint en lot, liaison wallet.

\- \*\*Phase 4\*\* : POP (ancrage Merkle des preuves d’achats).

\- \*\*Phase 5\*\* : App-chain (option) si volume/sponsors.



**## 11) Configuration / environnements**

\- `.env` : `LAUNCH\_THRESHOLD=100000`, `DATABASE\_URL=…`, `PGSSLMODE=disable`, `JWT\_SECRET=…`, `ALLOWED\_ORIGINS=…`

\- Dev : API HTTPS locale (`https://localhost:4443`).

\- Prod : certificats, secrets, monitoring, backups PG.



**## 12) Annexes**

\- Conventions : montants en \*\*centimes\*\*, ESM unifié, statuts d’enchères, alias bids.

\- Snapshots Git : tags jalons (ex. `backend-counters-2025-09-14`).






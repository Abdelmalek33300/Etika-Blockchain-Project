# Addendum au Cahier des charges  Dashboard Étika v1
_Date : 21/09/2025_

## 0) Terminologie clarifiée
- **Participant (consommateur)** : inscrit côté Étika, reçoit un **badge pré-token** (non transférable) en phase 1.
- **Entreprise partenaire ordinaire** : entreprise qui sinscrit pour **renforcer la pression** aux côtés des consommateurs ( sponsor).
- **Candidat sponsor** : grand groupe/organisation candidat aux **enchères** (peut ensuite déposer des offres/bids).
- **Crypto-investisseur** : personne/entité inscrite côté Investir (whitelist/updates confirmées).
- **Pré-token  Token** : conversion ultérieure (conditions/KYC/attestations + calendrier).

## 1) KPIs en tête de dashboard
Afficher 4 cartes avec tooltips :
1. **Participants (consommateurs)** : # comptes rôle `participant` ayant 1 badge **pré-token** actif.  
2. **Entreprises partenaires ordinaires** : # comptes rôle `partenaire_ordinaire` (hors sponsors).  
3. **Candidats sponsors (par secteur)** : total + répartition `{bank, electricity, mobile, vod, telecom, search_engine, ...}`.  
4. **Crypto-investisseurs** : # comptes rôle `investor` (ou inscriptions whitelist confirmées).

Chaque KPI : **valeur**, **variation 7j** (/), **tooltip** dexplication.

## 2) Seuil & compte à rebours (100 000 participants)
- Barre de progression : `participants_total / 100000` avec `%`.
- **Avant seuil** : statut global = En attente  seuil 100 000, pas de chrono sur les enchères.
- **À latteinte du seuil (100 000)** :
  - Statut global = Enchères ouvertes.
  - Chaque enchère passe **PREPARED  OPEN** avec **compte à rebours** (ex. durée 7 jours par défaut).
  - Chrono par enchère : `J:H:M:S` (live).

## 3) Suivi des enchères (panneau principal)
Liste (tableau ou mosaïque), colonnes :
- **Enchère** (titre + secteur)  **Statut** (*PREPARED / OPEN / CLOSED*)  
- **Chrono** (si OPEN) ou **ETA** (si PREPARED, souvrira au seuil)  
- **# Offres**  **Meilleure offre (€)**  **Lien détail** (onglet *Compétiteurs*).
Tri par défaut : OPEN > PREPARED > CLOSED.

## 4) Répartition sponsors par secteur
Graphique/puces : *secteur  # candidats sponsors*. Le clic filtre la liste des enchères.

## 5) Messages pédagogiques
- Niveaux N1/N2/N3 adoptés.  
- **Bandeau permanent** dans lespace perso (E0E4/INV) avec textes validés (pré-token non transférable, conversion plus tard, risques crypto, etc.).

## 6) Contrat de données (MVP, lecture seule)
Un endpoint agrégé suffit pour la page :

**GET `/api/public/overview`**
```json
{
  "kpi": {
    "participants_total": 12840,
    "partenaires_ordinaires_total": 920,
    "sponsors_candidats_total": 37,
    "investisseurs_total": 1140,
    "sponsors_par_secteur": { "bank": 3, "electricity": 5, "mobile": 8, "vod": 2, "telecom": 4, "search_engine": 1 }
  },
  "seuil": { "target": 100000, "percent": 12.84, "reached": false },
  "encheres": [
    { "id": "", "title": "EVT-1 Énergie", "sector": "electricity", "status": "PREPARED", "opens_on_threshold": true, "duration_days": 7, "offers": 0, "top_amount_cents": null },
    { "id": "", "title": "EVT-1 Téléphonie", "sector": "mobile", "status": "OPEN", "ends_at": "2025-10-04T12:00:00Z", "offers": 12, "top_amount_cents": 2225000 }
  ],
  "last_updated": "ISO8601"
}

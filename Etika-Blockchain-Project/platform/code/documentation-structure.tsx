# Documentation du Dashboard d'Administration Étika

## Table des matières

1. [Introduction](#introduction)
2. [Architecture](#architecture)
3. [Installation et configuration](#installation-et-configuration)
4. [Guide des modules](#guide-des-modules)
5. [API Reference](#api-reference)
6. [Guides d'extension](#guides-dextension)
7. [Sécurité](#sécurité)
8. [Troubleshooting](#troubleshooting)
9. [Changelog](#changelog)

## Introduction

### À propos de ce document

Ce document fournit une documentation complète pour le dashboard d'administration de l'écosystème Étika. Il est destiné aux administrateurs système, aux développeurs et aux équipes de support.

### Public cible

- **Administrateurs système**: Informations sur l'installation, la configuration et la maintenance.
- **Développeurs**: Guides sur l'architecture, l'API et l'extension du système.
- **Équipes support**: Procédures de dépannage et référence des fonctionnalités.
- **Administrateurs métier**: Guides d'utilisation des fonctionnalités business.

### Conventions utilisées

- 🔴 Indique une information critique ou une alerte de sécurité
- 🟠 Indique un avertissement ou une précaution
- 🟢 Indique une bonne pratique ou un conseil
- 📝 Indique un exemple ou un cas d'utilisation

## Architecture

### Vue d'ensemble du système

Le dashboard d'administration d'Étika suit une architecture modulaire multicouche:

1. **Couche Core**: Services fondamentaux (authentification, communication, état global)
2. **Couche Fonctionnelle**: Modules métier extensibles
3. **Couche UI**: Composants d'interface utilisateur réutilisables
4. **Couche API**: Adaptateurs pour communication avec les services backend
5. **Système d'Extension**: Framework pour l'ajout de nouvelles fonctionnalités

### Diagrammes techniques

- [Diagramme d'architecture générale](#lien-vers-diagramme)
- [Flux de données](#lien-vers-flux)
- [Interaction entre modules](#lien-vers-interactions)

### Dépendances externes

| Dépendance | Version | Utilisation | Alternatives compatibles |
|------------|---------|-------------|--------------------------|
| React      | 18.2.0  | Framework UI| Preact (en mode compact) |
| Redux      | 4.2.0   | Gestion d'état | Context API (fonctionnalités limitées) |
| Material-UI| 5.11.0  | Composants UI | Tailwind CSS + HeadlessUI |
| Chart.js   | 4.0.0   | Visualisations | D3.js (plus complexe) |

## Installation et configuration

### Prérequis système

- Node.js 16.x ou supérieur
- NPM 8.x ou supérieur
- Au moins 2 Go de RAM disponible
- Navigateurs supportés: Chrome 90+, Firefox 90+, Edge 90+, Safari 15+

### Procédure d'installation

```bash
# Cloner le dépôt
git clone https://github.com/etika-ecosystem/admin-dashboard.git
cd admin-dashboard

# Installer les dépendances
npm install

# Configuration de l'environnement
cp .env.example .env
# Éditer les variables d'environnement selon besoin

# Construire l'application
npm run build

# Lancer en mode production
npm run start:prod
```

### Configuration avancée

#### Variables d'environnement principales

| Variable | Description | Valeur par défaut | Obligatoire |
|----------|-------------|-------------------|-------------|
| `REACT_APP_API_URL` | URL de l'API Étika | `http://localhost:8000/api` | Oui |
| `REACT_APP_AUTH_DOMAIN` | Domaine d'authentification | - | Oui |
| `REACT_APP_JWT_PUBLIC_KEY` | Clé publique pour vérification JWT | - | Oui |
| `REACT_APP_SENTRY_DSN` | URL pour monitoring Sentry | - | Non |
| `REACT_APP_MFA_ENABLED` | Activer l'authentification 2FA | `true` | Non |

#### Fichier de configuration

Pour des paramètres plus complexes, éditer le fichier `config/application.json`:

```json
{
  "theme": {
    "primaryColor": "#3f51b5",
    "secondaryColor": "#f50057",
    "logo": "/assets/logo.svg"
  },
  "security": {
    "sessionTimeout": 1800,
    "maxLoginAttempts": 5,
    "passwordPolicy": {
      "minLength": 12,
      "requireSpecialChars": true,
      "requireNumbers": true,
      "requireUppercase": true
    }
  },
  "monitoring": {
    "refreshInterval": 30,
    "enabledCharts": ["system", "transactions", "tokens", "users"],
    "retentionPeriod": 30
  },
  "api": {
    "timeout": 30000,
    "retryAttempts": 3,
    "batchSize": 100
  }
}
```

## Guide des modules

### Module de monitoring

Le module de monitoring permet la surveillance en temps réel de l'écosystème Étika.

#### Configuration du monitoring

1. Accéder à la section "Monitoring" du dashboard
2. Cliquer sur "Configuration" dans le menu contextuel
3. Ajuster les paramètres selon les besoins:
   - Fréquence de rafraîchissement
   - Métriques à afficher
   - Seuils d'alerte

#### Personnalisation du dashboard

Le dashboard principal peut être personnalisé en ajoutant/supprimant des widgets:

1. Cliquer sur "Personnaliser" en haut à droite
2. Glisser-déposer les widgets souhaités
3. Configurer chaque widget selon les besoins
4. Cliquer sur "Enregistrer la configuration"

#### Création d'alertes

🟠 **Important**: La configuration incorrecte des alertes peut générer du bruit ou manquer des incidents critiques.

1. Accéder à "Monitoring > Alertes"
2. Cliquer sur "Nouvelle alerte"
3. Configurer:
   - Métrique à surveiller
   - Condition de déclenchement
   - Seuil
   - Destinataires
   - Canal de notification (email, SMS, webhook)

### Module de gestion des utilisateurs

Le module de gestion des utilisateurs permet l'administration des comptes, rôles et permissions.

#### Création d'un administrateur

🔴 **Critique**: La création d'un compte administrateur doit suivre le principe du moindre privilège.

1. Accéder à "Utilisateurs > Administrateurs"
2. Cliquer sur "Nouvel administrateur"
3. Remplir le formulaire avec les informations requises
4. Attribuer les rôles appropriés
5. Configurer l'authentification 2FA (obligatoire pour les administrateurs)
6. Envoyer l'invitation

#### Gestion des rôles

1. Accéder à "Utilisateurs > Rôles"
2. Pour créer un nouveau rôle:
   - Cliquer sur "Nouveau rôle"
   - Nommer le rôle
   - Sélectionner les permissions
   - Définir les contraintes (IP, horaires, etc.)
3. Pour modifier un rôle existant:
   - Sélectionner le rôle dans la liste
   - Modifier ses attributs
   - Sauvegarder les changements

## API Reference

### Authentification

#### Endpoint: `/api/auth/login`

**Méthode**: POST  
**Description**: Authentifie un utilisateur et génère des tokens JWT.

**Paramètres**:
```json
{
  "username": "string",
  "password": "string",
  "mfaCode": "string" // Optionnel, requis si 2FA activé
}
```

**Réponse**:
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "expiresAt": "number",
  "user": {
    "id": "string",
    "username": "string",
    "email": "string",
    "roles": ["string"],
    "permissions": ["string"]
  }
}
```

**Codes d'erreur**:
- `401`: Authentification échouée
- `403`: Compte bloqué après tentatives multiples
- `428`: MFA requis (avec `mfaChallengeToken` dans la réponse)

### Monitoring

#### Endpoint: `/api/monitoring/dashboard`

**Méthode**: GET  
**Description**: Récupère les données consolidées pour le dashboard principal.

**Paramètres Query**:
- `period`: Période des données (default: "day", options: "hour", "day", "week", "month")

**Headers requis**:
- `Authorization`: Bearer {token}

**Réponse**:
```json
{
  "systemStatus": {
    "health": "number", // 0-100
    "activeNodes": "number",
    "apiLatency": "number", // ms
    "lastUpdate": "string" // ISO date
  },
  "transactions": {
    "count": "number",
    "volume": "number",
    "trend": "number", // % change
    "distribution": [
      { "hour": "string", "count": "number" }
    ]
  },
  "tokens": {
    "distributed": "number",
    "active": "number",
    "burned": "number",
    "distribution": [
      { "type": "string", "value": "number" }
    ]
  },
  "users": {
    "active": "number",
    "new": "number",
    "totalConsumers": "number",
    "totalMerchants": "number"
  }
}
```

## Guides d'extension

### Création d'un nouveau module

Le dashboard d'administration supporte l'ajout de modules personnalisés via le système de plugins.

#### Structure de fichiers

```
my-custom-module/
├── manifest.json           # Métadonnées du module
├── index.ts                # Point d'entrée
├── components/             # Composants React
│   ├── MainView.tsx
│   └── SettingsPanel.tsx
├── api/                    # Adaptateurs API
│   └── myModuleApi.ts
├── store/                  # État Redux
│   ├── actions.ts
│   ├── reducer.ts
│   └── selectors.ts
└── assets/                 # Ressources statiques
    ├── icon.svg
    └── styles.css
```

#### Manifest du module

Le fichier `manifest.json` définit les métadonnées du module:

```json
{
  "name": "my-custom-module",
  "displayName": "Mon Module Personnalisé",
  "version": "1.0.0",
  "description": "Description du module",
  "author": "Votre Nom",
  "license": "MIT",
  "entry": "./index.ts",
  "icon": "./assets/icon.svg",
  "permissions": [
    "users:read",
    "settings:write"
  ],
  "dependencies": {
    "etika-core": "^1.0.0"
  },
  "hooks": {
    "navigation": true,
    "dashboard": true,
    "settings": true
  }
}
```

#### Point d'entrée du module

Le fichier `index.ts` expose les exports requis:

```typescript
import { registerModule } from '@etika/admin-framework';
import MainView from './components/MainView';
import SettingsPanel from './components/SettingsPanel';
import { reducer } from './store/reducer';
import { moduleApiSlice } from './api/myModuleApi';

// Configuration du module
const config = {
  // Routes du module
  routes: [
    {
      path: '/my-module',
      component: MainView,
      exact: true,
      permissions: ['users:read']
    },
    {
      path: '/my-module/settings',
      component: SettingsPanel,
      exact: true,
      permissions: ['settings:write']
    }
  ],
  
  // Élément à ajouter dans la navigation
  navigation: {
    title: 'Mon Module',
    icon: 'CustomIcon',
    path: '/my-module',
    order: 50 // Position dans le menu
  },
  
  // Widget pour le dashboard principal (optionnel)
  dashboardWidgets: [
    {
      id: 'my-module-widget',
      title: 'Mon Widget',
      size: 'medium', // small, medium, large
      component: MyWidget
    }
  ],
  
  // Réduction Redux
  reducer: {
    name: 'myModule',
    reducer
  },
  
  // API du module
  api: moduleApiSlice
};

// Enregistrement du module
registerModule('my-custom-module', config);

// Exports publics pour d'autres modules
export { someUtilityFunction } from './utils';
```

## Sécurité

### Modèle de permissions

Le dashboard utilise un système de contrôle d'accès basé sur les rôles (RBAC) avec permissions granulaires:

```
[resource]:[action]
```

Examples:
- `users:create` - Peut créer des utilisateurs
- `tokens:manage` - Peut gérer tous les aspects des tokens
- `system:read` - Peut consulter les données système
- `system:admin` - A des droits administratifs complets sur le système

### Audit de sécurité

Toutes les actions administratives sont journalisées dans le système d'audit:

- **Qui**: Identité de l'administrateur
- **Quoi**: Action effectuée
- **Quand**: Horodatage précis
- **Où**: Adresse IP et user-agent
- **Comment**: Contexte détaillé de l'action
- **Résultat**: Succès ou échec

Ces journaux sont:
- Non modifiables
- Exportables (formats CSV, JSON)
- Conservés selon la politique de rétention (par défaut: 1 an)

### Bonnes pratiques de sécurité

🔴 **Critique**: Suivez ces pratiques pour maintenir la sécurité du dashboard:

1. **Utilisation de MFA**: Obligatoire pour tous les administrateurs
2. **Rotation des mots de passe**: Au moins tous les 90 jours
3. **Restriction d'IP**: Limiter l'accès à des plages d'IP spécifiques
4. **Session timeout**: Déconnexion après 30 minutes d'inactivité
5. **Alertes de sécurité**: Configuration d'alertes pour les actions sensibles
6. **Revue d'accès**: Vérification trimestrielle des droits d'accès

## Troubleshooting

### Problèmes courants

#### L'authentification échoue malgré des identifiants corrects

**Symptômes**: Message d'erreur "Authentification échouée" même avec identifiants valides.

**Causes possibles**:
1. Token JWT expiré dans le stockage local
2. Problème de connexion à l'API d'authentification
3. Compte verrouillé après multiples tentatives

**Solutions**:
1. Effacer le stockage local du navigateur (localStorage et sessionStorage)
2. Vérifier la connectivité au serveur d'authentification
3. Utiliser la fonction "Mot de passe oublié" pour réinitialiser l'accès

#### Graphiques de monitoring non mis à jour

**Symptômes**: Les données des graphiques semblent figées ou obsolètes.

**Causes possibles**:
1. Problème de connectivité avec l'API de monitoring
2. Erreur dans l'actualisation automatique
3. Cache navigateur

**Solutions**:
1. Vérifier les logs côté client pour erreurs d'API
2. Cliquer sur "Rafraîchir" pour forcer une mise à jour manuelle
3. Vérifier l'état du service de monitoring dans la section "État système"

## Changelog

### Version 1.0.0 (01/03/2025)

**Nouvelles fonctionnalités**:
- Mise en place du dashboard d'administration
- Interface de monitoring en temps réel
- Gestion des utilisateurs et des rôles
- Configuration des paramètres système
- Système d'alertes et notifications

**Améliorations**:
- Aucune (version initiale)

**Corrections de bugs**:
- Aucune (version initiale)

### Version 1.1.0 (Planifiée - 15/04/2025)

**Fonctionnalités prévues**:
- Système de plugins pour modules personnalisés
- Tableau de bord analytique avancé
- Export des données en plusieurs formats
- Améliorations de sécurité

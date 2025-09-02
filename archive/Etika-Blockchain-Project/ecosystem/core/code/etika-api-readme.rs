# API Centrale Étika

Cette API REST sert de ciment entre tous les modules de l'écosystème Étika.

## Architecture

L'API est organisée en couches :

1. **Contrôleurs** : Gèrent les requêtes HTTP et les réponses
2. **Services** : Contiennent la logique métier
3. **Intégration avec les modules** : Interfaçage avec etika-token-system, etika-pop-consensus, etc.

## Modules principaux

- **Auth** : Gestion de l'authentification et des autorisations
- **Token System** : Interface avec le système de tokens
- **PoP Consensus** : Interface avec le mécanisme de consensus PoP
- **User Management** : Gestion des utilisateurs
- **Admin** : Fonctionnalités d'administration

## Prérequis

- Rust 1.67+
- PostgreSQL 14+

## Installation

1. Cloner le dépôt
```bash
git clone https://github.com/etika/etika-platform-api.git
cd etika-platform-api
```

2. Créer un fichier `.env` basé sur `.env.example`
```bash
cp .env.example .env
# Éditer .env avec vos paramètres
```

3. Compiler et exécuter
```bash
cargo run
```

## Développement

### Structure du projet

```
etika-platform-api/
├── src/
│   ├── main.rs             # Point d'entrée
│   ├── config.rs           # Configuration
│   ├── error.rs            # Gestion des erreurs
│   ├── models.rs           # Modèles de données
│   ├── auth.rs             # Authentification
│   ├── token_system.rs     # Interface avec etika-token-system
│   ├── pop_consensus.rs    # Interface avec etika-pop-consensus
│   ├── user_management.rs  # Gestion des utilisateurs
│   └── admin.rs            # Fonctionnalités d'administration
├── Cargo.toml              # Définition du package
├── .env.example            # Exemple de configuration
└── README.md               # Documentation
```

### Tests

```bash
cargo test
```

## Documentation de l'API

Une spécification OpenAPI (Swagger) est disponible à l'adresse `/api/docs` une fois le serveur démarré.

Principaux endpoints :

- `/api/v1/auth` : Authentification
- `/api/v1/tokens` : Gestion des tokens
- `/api/v1/pop` : Consensus PoP
- `/api/v1/users` : Gestion des utilisateurs
- `/api/v1/admin` : Administration

## Intégration avec les autres modules

Cette API s'intègre avec les modules suivants de l'écosystème Étika :

- `etika-token-system` : Gestion des tokens
- `etika-pop-consensus` : Mécanisme de consensus PoP
- `etika-blockchain-core` : Cœur de la blockchain Étika
- `etika-consumer-fund` : Gestion de l'épargne des consommateurs
- `etika-factoring-system` : Système d'affacturage
- `etika-auction-system` : Système d'enchères
- `etika-marketplace` : Place de marché

## Sécurité

- Authentification par JWT
- Hachage des mots de passe avec Argon2
- Contrôle d'accès basé sur les rôles
- Validation rigoureuse des entrées

## Déploiement

### Production

```bash
cargo build --release
./target/release/etika-platform-api
```

### Docker

```bash
docker build -t etika-platform-api .
docker run -p 8080:8080 --env-file .env etika-platform-api
```

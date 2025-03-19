# Architecture de l'Application Mobile Étika - Consommateur

## 1. Vue d'ensemble

L'application mobile Étika pour les consommateurs est conçue comme une interface intuitive permettant aux utilisateurs d'interagir avec l'écosystème financier Étika. Cette application sera développée avec Flutter pour garantir une expérience native sur iOS et Android tout en maintenant une base de code unique.

## 2. Architecture technique

### 2.1 Architecture globale

Nous adoptons une architecture **Clean Architecture** avec le modèle **BLoC (Business Logic Component)** pour la gestion d'état, structurée en couches :

```
etika-mobile-app/
├── lib/
│   ├── core/                 # Fonctionnalités communes et utilitaires
│   ├── data/                 # Sources de données et repositories
│   ├── domain/               # Entités et cas d'utilisation (logique métier)
│   ├── presentation/         # Interface utilisateur et BLoCs
│   ├── config/               # Configuration de l'application
│   └── main.dart             # Point d'entrée de l'application
```

### 2.2 Couches détaillées

#### 2.2.1 Couche Core
Contient les utilitaires, constantes, et ressources partagées :
- `core/error/` - Gestion des exceptions
- `core/network/` - Client HTTP et intercepteurs
- `core/utils/` - Utilitaires communs
- `core/theme/` - Thème de l'application
- `core/localization/` - Internationalisation
- `core/security/` - Utilitaires de cryptographie et sécurité

#### 2.2.2 Couche Data
Gère l'accès aux données et leur persistance :
- `data/repositories/` - Implémentations des repositories
- `data/datasources/` - Sources de données (locales et distantes)
- `data/models/` - Modèles de données et convertisseurs

#### 2.2.3 Couche Domain
Contient la logique métier indépendante des détails d'implémentation :
- `domain/entities/` - Modèles métier
- `domain/repositories/` - Interfaces des repositories
- `domain/usecases/` - Cas d'utilisation métier

#### 2.2.4 Couche Presentation
Gère l'interface utilisateur et les interactions :
- `presentation/bloc/` - BLoCs pour la gestion d'état
- `presentation/pages/` - Écrans de l'application
- `presentation/widgets/` - Composants d'interface réutilisables
- `presentation/navigation/` - Gestion de la navigation

### 2.3 Gestion de l'état

Nous utiliserons le pattern BLoC avec les packages flutter_bloc :
- Séparation claire entre UI et logique métier
- Gestion réactive des états de l'application
- Support du mode offline avec synchronisation différée
- Traçabilité des changements d'état (utile pour le débogage)

### 2.4 Sécurité

#### 2.4.1 Stockage sécurisé des clés
- Utilisation de Flutter Secure Storage pour stocker les clés privées
- Intégration avec les mécanismes de sécurité natifs (Keychain iOS, Keystore Android)
- Chiffrement des données sensibles au repos

#### 2.4.2 Authentication et autorisation
- Support biométrique (empreinte digitale, Face ID)
- Authentification à deux facteurs
- Gestion de session avec tokens JWT
- Verrouillage automatique après période d'inactivité

### 2.5 Mode Offline

- Utilisation de Hive ou SQLite pour la persistance locale
- File d'attente de synchronisation pour les transactions effectuées hors ligne
- Détection automatique de la connectivité et synchronisation en arrière-plan
- Cache intelligent des données fréquemment consultées

### 2.6 Technologies et bibliothèques

- **Flutter SDK**: Framework d'interface utilisateur
- **Dio**: Client HTTP
- **flutter_bloc**: Gestion d'état
- **get_it**: Injection de dépendances
- **flutter_secure_storage**: Stockage sécurisé
- **hive**: Base de données NoSQL locale
- **qr_code_scanner**: Scan des codes QR
- **web3dart**: Interaction avec la blockchain
- **intl**: Internationalisation
- **flutter_config**: Gestion des variables d'environnement

## 3. Flux de Navigation et Écrans

### 3.1 Flux utilisateur principal

```
Onboarding → Inscription/Connexion → Accueil → Transaction → Confirmation
```

### 3.2 Structure de navigation

- Navigation par onglets pour les fonctionnalités principales
- Navigation par pile pour les flux spécifiques (transaction, gestion de compte)
- Tiroir latéral pour les fonctionnalités secondaires et les paramètres

### 3.3 Description des écrans principaux

#### 3.3.1 Onboarding
- Présentation des fonctionnalités clés de l'application
- Explication du système Étika et des avantages pour le consommateur
- Demande des permissions nécessaires (caméra, notifications)

#### 3.3.2 Inscription/Connexion
- Inscription simplifiée (numéro de téléphone + vérification)
- Options de connexion (code PIN, biométrie)
- Création/récupération du portefeuille blockchain

#### 3.3.3 Écran d'accueil
- Solde de tokens (actifs et en latence)
- Résumé de l'épargne (division 80/20)
- Historique des transactions récentes
- Notifications et alertes

#### 3.3.4 Écran de transaction
- Scanner de QR code pour validation PoP
- Saisie manuelle du numéro de commerçant (alternative)
- Confirmation des détails d'achat
- Visualisation des tokens activés/gagnés

#### 3.3.5 Gestion de l'épargne
- Visualisation des fonds (long terme et projets personnels)
- Projections et croissance
- Options d'allocation pour la partie projets personnels (20%)
- Statistiques d'utilisation et comparaison anonymisée

#### 3.3.6 Marketplace
- Accès aux offres des commerçants partenaires
- Opportunités d'utilisation des tokens
- Badges et avantages selon l'ancienneté

#### 3.3.7 Paramètres
- Gestion du profil
- Préférences de sécurité
- Options de notification
- Paramètres d'affichage
- Exportation de données

## 4. Intégration avec l'API de la Plateforme

### 4.1 Architecture d'intégration

```
App Mobile → Repository → API Service → etika-platform-api
```

### 4.2 Points d'intégration principaux

#### 4.2.1 Authentication API
- Inscription et connexion
- Refresh tokens
- Gestion de profil

#### 4.2.2 Wallet API
- Création et récupération de portefeuille
- Solde des tokens
- Historique des transactions

#### 4.2.3 Transaction API
- Validation PoP (Proof of Purchase)
- Activation des tokens
- Transfert entre utilisateurs

#### 4.2.4 Consumer Fund API
- État de l'épargne
- Projections et croissance
- Options de gestion (partie 20%)

### 4.3 Stratégie de communication

- API REST pour les opérations standards
- WebSockets pour les notifications en temps réel
- GraphQL pour les requêtes complexes et personnalisées

### 4.4 Gestion de la synchronisation

- Prioritisation des transactions en file d'attente
- Mécanisme de retry avec backoff exponentiel
- Résolution des conflits en mode offline

### 4.5 Sécurité des API

- JWT pour l'authentification
- HTTPS pour toutes les communications
- Certificate pinning pour prévenir les attaques MitM
- Validation côté client des réponses API

## 5. Système de Scan QR

### 5.1 Fonctionnement général

Le système de scan QR est au cœur du mécanisme de consensus PoP :

1. Le commerçant génère un QR code contenant :
   - Identifiant unique de transaction
   - Identifiant du commerçant
   - Horodatage
   - Montant de la transaction
   - Hash de vérification

2. Le consommateur scanne ce code via l'application

3. L'application vérifie l'authenticité du QR code et affiche les détails

4. Le consommateur confirme la transaction, activant ses tokens

### 5.2 Implémentation technique

- Utilisation de la bibliothèque `qr_code_scanner` pour la lecture
- Décodage et vérification du contenu
- Interface utilisateur intuitive avec cadre de scan et guide visuel
- Mode alternatif pour saisie manuelle en cas de problème de scan

### 5.3 Sécurité du système QR

- Vérification cryptographique des codes QR
- Invalidation des codes après expiration (time-based)
- Protection contre la réutilisation des codes
- Analyse des QR codes suspects ou malformés

## 6. Exigences de performance et optimisation

### 6.1 Objectifs de performance

- Temps de démarrage < 2 secondes
- Temps de réponse pour scan QR < 1 seconde
- Synchronisation en arrière-plan sans impact sur l'expérience
- Utilisation mémoire optimisée (< 100 MB en utilisation normale)

### 6.2 Stratégies d'optimisation

- Lazy loading des ressources
- Mise en cache intelligente
- Compression des données
- Utilisation de Flutter DevTools pour analyser les performances

## 7. Plan de déploiement

### 7.1 Environnements

- Développement
- Test
- Staging
- Production

### 7.2 Configuration par environnement

Utilisation de flutter_config pour gérer les variables d'environnement :
- URLs des APIs
- Clés d'API
- Niveaux de logging
- Feature flags

### 7.3 Stratégie de tests

- Tests unitaires pour la logique métier
- Tests d'intégration pour les repositories
- Tests de widget pour l'interface utilisateur
- Tests end-to-end pour les principaux flux utilisateur

### 7.4 CI/CD

- GitHub Actions pour l'intégration continue
- Fastlane pour l'automatisation du déploiement
- Firebase App Distribution pour les tests bêta

## 8. Annexes

### 8.1 Glossaire

- **BLoC**: Business Logic Component, pattern de gestion d'état
- **PoP**: Proof of Purchase, mécanisme de consensus d'Étika
- **Token en latence**: Token distribué mais non activé
- **Clean Architecture**: Architecture en couches avec séparation des responsabilités

### 8.2 Références

- Documentation Flutter: https://flutter.dev/docs
- Documentation BLoC Pattern: https://bloclibrary.dev
- Documentation d'API Étika: [Lien à définir]

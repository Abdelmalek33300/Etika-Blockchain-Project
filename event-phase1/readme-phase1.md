# Projet Étika - Application Mobile

## À propos du projet

Étika est une application mobile qui permet aux utilisateurs de soutenir des projets à impact social et environnemental via un système de certificats numériques (NFT) et d'enchères.

## Structure du projet

Ce dépôt est organisé en deux phases de développement :

### Phase 1 - Version d'essai (branche `phase1-test`)

La Phase 1 représente une version allégée de l'application, conçue pour les tests publics initiaux. Cette version inclut :

- **Authentification sécurisée** : Inscription et connexion des utilisateurs
- **Gestion des certificats** : Visualisation et acquisition des certificats numériques
- **Système d'enchères** : Participation à des enchères pour des certificats exclusifs
- **Sécurité renforcée** : Stockage sécurisé des données sensibles et gestion robuste des erreurs

#### Améliorations de sécurité Phase 1

- Remplacement d'AsyncStorage par des solutions sécurisées (SecureStore/EncryptedStorage)
- Gestion optimisée des WebSockets avec reconnexion automatique
- Système complet de capture et traitement des erreurs
- Validation des entrées utilisateur pour les certificats
- Gestion sécurisée des clés privées pour les transactions blockchain

### Phase 2 - Version complète (branche `main`)

La Phase 2 représente la version complète de l'application avec toutes les fonctionnalités prévues, notamment :

- Toutes les fonctionnalités de la Phase 1
- **Système de parrainage** : Recommandation et récompenses
- **Intégration avancée blockchain** : Plus de fonctionnalités blockchain
- **Espace ONG** : Section dédiée aux organisations partenaires
- **Analytiques avancées** : Tableaux de bord et statistiques

## Installation

### Prérequis

- Node.js >= 14.x
- React Native CLI ou Expo CLI
- Android Studio (pour Android) ou Xcode (pour iOS)

### Étapes d'installation

1. Cloner le dépôt :
   ```
   git clone https://github.com/votre-organisation/etika.git
   ```

2. Installer les dépendances :
   ```
   cd etika
   npm install
   ```

3. Configurer les variables d'environnement :
   - Créer un fichier `.env` basé sur `.env.example`
   - Remplir les variables d'environnement requises

4. Lancer l'application :
   ```
   npm start
   ```

## Documentation

Pour plus d'informations sur l'architecture et les fonctionnalités, consultez le dossier `docs/`.

## Sécurité

L'application Étika a été conçue avec un focus particulier sur la sécurité :

- **Stockage sécurisé** : Utilisation de SecureStore (iOS) et EncryptedStorage (Android) pour les données sensibles
- **Protection des clés privées** : Chiffrement AES-256-GCM pour les clés blockchain
- **Gestion robuste des erreurs** : Capture et journalisation des erreurs pour éviter les crashs
- **Validation des données** : Vérification des entrées utilisateurs avant traitement
- **Sécurisation des communications** : Gestion optimisée des sockets avec reconnexion sécurisée

## Contribution au projet

### Pour la Phase 1

1. Cloner la branche `phase1-test` :
   ```
   git clone -b phase1-test https://github.com/votre-organisation/etika.git
   ```

2. Créer une branche pour votre fonctionnalité :
   ```
   git checkout -b feature/ma-fonctionnalite
   ```

3. Soumettre une Pull Request vers la branche `phase1-test`

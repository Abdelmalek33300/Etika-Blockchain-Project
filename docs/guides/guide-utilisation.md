# Guide d'Utilisation du Portail Commerçant Étika

## Introduction

Bienvenue sur le portail commerçant de l'écosystème Étika ! Cette interface vous permet de gérer vos transactions, vos relations avec les fournisseurs et d'interagir avec le système d'affacturage innovant basé sur la blockchain Étika.

Ce guide vous accompagnera dans la prise en main des différentes fonctionnalités du portail.

## Table des matières

1. [Accès et authentification](#1-accès-et-authentification)
2. [Tableau de bord](#2-tableau-de-bord)
3. [Gestion des transactions](#3-gestion-des-transactions)
   - [Créer une nouvelle transaction](#31-créer-une-nouvelle-transaction)
   - [Générer et utiliser un QR code PoP](#32-générer-et-utiliser-un-qr-code-pop)
   - [Consulter l'historique des transactions](#33-consulter-lhistorique-des-transactions)
4. [Relations avec les fournisseurs](#4-relations-avec-les-fournisseurs)
   - [Établir une nouvelle relation](#41-établir-une-nouvelle-relation)
   - [Gérer les conditions d'affacturage](#42-gérer-les-conditions-daffacturage)
   - [Suspendre ou terminer une relation](#43-suspendre-ou-terminer-une-relation)
5. [Système d'affacturage](#5-système-daffacturage)
   - [Principe du "c'est vendu c'est payé"](#51-principe-du-cest-vendu-cest-payé)
   - [Suivi des paiements d'affacturage](#52-suivi-des-paiements-daffacturage)
6. [Profil et paramètres](#6-profil-et-paramètres)
7. [Support et assistance](#7-support-et-assistance)

## 1. Accès et authentification

Pour accéder au portail commerçant Étika :

1. Rendez-vous sur la page de connexion : https://merchant.etika.io
2. Saisissez votre identifiant (généralement votre adresse e-mail)
3. Entrez votre mot de passe
4. Cliquez sur "Se connecter"

Pour des raisons de sécurité, une authentification à deux facteurs (2FA) peut être activée. Dans ce cas, un code vous sera envoyé par SMS ou via une application d'authentification.

> **Note de sécurité** : Ne partagez jamais vos identifiants de connexion. Utilisez un mot de passe fort et unique pour votre compte Étika.

## 2. Tableau de bord

Le tableau de bord est votre page d'accueil et offre une vue d'ensemble de votre activité :

![Tableau de bord](https://docs.etika.io/images/merchant-dashboard.png)

Vous y trouverez :
- **Cartes métriques** : Affichage rapide des indicateurs clés (tokens disponibles, ventes du mois, etc.)
- **Transactions récentes** : Liste des dernières transactions effectuées
- **Aperçu de l'affacturage** : État des liquidités et des paiements
- **Tokens Étika** : Solde et statut de vos tokens
- **Fournisseurs actifs** : Liste des partenaires avec lesquels vous avez une relation commerciale active
- **Activité récente** : Notifications et événements importants

Utilisez les boutons d'action rapide pour créer de nouvelles transactions ou accéder aux fonctionnalités principales.

## 3. Gestion des transactions

### 3.1 Créer une nouvelle transaction

Pour enregistrer une nouvelle transaction dans le système Étika :

1. Cliquez sur le bouton "Nouvelle transaction" depuis le tableau de bord ou la page Transactions
2. Remplissez le formulaire avec les informations requises :
   - **Consommateur** : Sélectionnez le client concerné
   - **Montant** : Entrez le montant total de la transaction en euros
   - **Tokens échangés** : Indiquez le nombre de tokens Étika échangés (un montant suggéré est calculé automatiquement)
   - **Fournisseurs** : Sélectionnez le(s) fournisseur(s) impliqué(s) dans la transaction (pour l'affacturage)
   - **Numéro de ticket** : Facultatif, pour référence
   - **Notes** : Informations complémentaires sur la transaction
3. Cliquez sur "Suivant" pour générer le QR code PoP

Le système calculera automatiquement l'épargne générée pour le consommateur (environ 5% du montant de la transaction).

### 3.2 Générer et utiliser un QR code PoP

Le mécanisme PoP (Proof of Purchase) est au cœur du système Étika. Après avoir créé une transaction :

1. Un QR code sera généré automatiquement
2. Présentez ce QR code au consommateur pour qu'il puisse le scanner avec son application Étika
3. Si des fournisseurs sont impliqués, ils devront également scanner le QR code pour validation
4. Suivez l'état de validation en temps réel sur l'écran
5. Une fois toutes les validations reçues, la transaction est confirmée sur la blockchain

Vous pouvez également :
- Imprimer le QR code
- Le partager par e-mail ou message
- Actualiser le statut manuellement
- Ajuster la taille du QR code pour une meilleure lisibilité

> **Important** : Une transaction n'est finalisée qu'après validation par toutes les parties concernées. Le statut passera alors de "En attente" à "Validé".

### 3.3 Consulter l'historique des transactions

Pour consulter vos transactions passées :

1. Accédez à la section "Transactions" via le menu principal
2. Utilisez les filtres pour affiner votre recherche par date, montant, statut, etc.
3. Cliquez sur l'icône "Détails" pour voir les informations complètes d'une transaction

Vous pouvez également exporter vos transactions au format CSV ou PDF pour une utilisation externe.

## 4. Relations avec les fournisseurs

### 4.1 Établir une nouvelle relation

Pour enregistrer un nouveau fournisseur dans le système d'affacturage :

1. Accédez à la section "Fournisseurs" via le menu principal
2. Cliquez sur "Nouvelle relation"
3. Sélectionnez le fournisseur dans la liste
4. Choisissez la catégorie de produits/services
5. Définissez les conditions d'affacturage :
   - **Pourcentage de paiement immédiat** : Part du montant payée immédiatement au fournisseur (minimum 50%)
   - **Délai de paiement restant** : Nombre de jours avant le paiement du solde
   - **Taux d'intérêt** : Taux appliqué au montant restant
6. Cliquez sur "Créer la relation"

Une fois créée, la relation devra être confirmée par le fournisseur avant d'être active.

### 4.2 Gérer les conditions d'affacturage

Pour modifier les conditions d'une relation existante :

1. Accédez à la section "Fournisseurs"
2. Trouvez le fournisseur concerné et cliquez sur l'icône "Modifier"
3. Ajustez les paramètres selon vos besoins
4. Cliquez sur "Mettre à jour"

Les nouvelles conditions s'appliqueront aux futures transactions uniquement.

### 4.3 Suspendre ou terminer une relation

Si vous souhaitez interrompre temporairement ou définitivement une relation :

1. Accédez à la section "Fournisseurs"
2. Trouvez le fournisseur concerné et cliquez sur l'icône appropriée
3. Choisissez entre :
   - **Suspendre temporairement** : Mise en pause qui peut être annulée ultérieurement
   - **Mettre fin définitivement** : Arrêt complet de la relation

La suspension arrête les paiements d'affacturage mais conserve l'historique et les paramètres.

## 5. Système d'affacturage

### 5.1 Principe du "c'est vendu c'est payé"

Le système d'affacturage Étika repose sur le principe innovant "c'est vendu c'est payé" :

1. Lorsqu'une vente est validée (via le mécanisme PoP), le fournisseur reçoit immédiatement un pourcentage du montant (défini dans les conditions d'affacturage)
2. Le reste du paiement est planifié selon le délai convenu
3. Des intérêts peuvent s'appliquer sur le montant restant
4. Le commerçant bénéficie d'un délai de paiement tout en maintenant de bonnes relations avec ses fournisseurs

Ce système permet d'optimiser la trésorerie de tous les acteurs de la chaîne commerciale.

### 5.2 Suivi des paiements d'affacturage

Pour suivre l'état des paiements d'affacturage :

1. Accédez à la section "Affacturage" via le menu principal
2. Consultez le tableau de bord d'affacturage qui présente :
   - Les paiements immédiats effectués
   - Les paiements restants programmés
   - L'historique des transactions par fournisseur
3. Utilisez les filtres pour affiner votre recherche

Vous pouvez également consulter l'historique des paiements pour chaque relation fournisseur depuis la section "Fournisseurs".

## 6. Profil et paramètres

Pour gérer votre profil et les paramètres du compte :

1. Cliquez sur votre nom d'utilisateur en haut à droite
2. Sélectionnez "Profil" ou "Paramètres"

Vous pourrez y modifier :
- Vos informations personnelles
- Les préférences de notification
- La sécurité du compte (mot de passe, 2FA)
- Les paramètres d'affichage

## 7. Support et assistance

Si vous rencontrez des difficultés ou avez des questions :

1. Consultez la section "Aide" accessible depuis le menu principal
2. Utilisez la fonction de recherche pour trouver des réponses
3. Contactez le support Étika via :
   - Le chat en direct (disponible aux heures d'ouverture)
   - Le formulaire de contact
   - L'e-mail support@etika.io
   - Le téléphone : +33 (0)1 XX XX XX XX

L'équipe Étika est à votre disposition pour vous aider à tirer le meilleur parti de votre portail commerçant.

---

© 2025 Étika - Tous droits réservés  
Version 1.0 du guide - Dernière mise à jour : 28 février 2025

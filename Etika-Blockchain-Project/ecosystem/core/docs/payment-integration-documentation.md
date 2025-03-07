# Documentation d'intégration des cartes de paiement - Étika

## 1. Introduction

Le module `etika-payment-integration` permet l'intégration du système Étika avec les réseaux de cartes de paiement traditionnels. Il facilite la double transaction simultanée (financière standard + blockchain PoP) requise par le consensus de preuve d'achat (PoP) d'Étika.

Cette documentation explique comment intégrer ce module avec les différents composants de l'écosystème Étika et comment les partenaires peuvent s'interfacer avec lui.

## 2. Architecture

### 2.1 Vue d'ensemble

L'architecture du module se compose de plusieurs composants clés :

- **API Gateway de Paiement** : Interface unifiée pour les applications
- **Connecteurs de paiement** : Adaptateurs spécifiques pour chaque réseau de paiement
- **Gestionnaire de transactions** : Synchronisation entre transaction standard et PoP
- **Système de fallback** : Gestion des situations d'échec ou de dégradation
- **Module de sécurité** : Conformité PCI-DSS et protection des données

### 2.2 Diagramme d'architecture

Voir le diagramme SVG fourni pour une représentation visuelle de l'architecture.

### 2.3 Dépendances

Le module dépend des composants suivants de l'écosystème Étika :

- **etika-pop-consensus** : Pour la validation des transactions via PoP
- **etika-token-system** : Pour l'activation des tokens après validation
- **etika-platform-api** : Pour l'interface avec les applications Étika

## 3. Intégration pour les partenaires

### 3.1 Prérequis

Pour intégrer le système de paiement Étika, un partenaire doit :

1. S'inscrire sur la plateforme Étika
2. Obtenir des clés API pour l'environnement de test
3. Implémenter le protocole de double transaction
4. Passer la certification d'intégration

### 3.2 Flux de transaction

1. **Initiation** : Le consommateur effectue un achat chez un commerçant partenaire
2. **Authentification** : Vérification de l'identité du consommateur
3. **Autorisation** : Vérification des fonds et des tokens disponibles
4. **Double transaction** : Exécution simultanée de la transaction financière et blockchain
5. **Confirmation** : Validation par les validateurs PoP
6. **Activation des tokens** : Les tokens sont activés pour le consommateur
7. **Notification** : Confirmation de la transaction aux parties prenantes

### 3.3 Diagramme de séquence

```
┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ┌────────────────┐  ┌────────────┐
│ Application │  │ etika-plat. │  │ etika-payment-  │  │ Réseaux cartes │  │ etika-pop- │
│ Client      │  │ -api        │  │ integration     │  │ de paiement    │  │ consensus  │
└──────┬──────┘  └──────┬──────┘  └────────┬────────┘  └───────┬────────┘  └──────┬─────┘
       │                 │                  │                   │                  │
       │ Demande d'achat │                  │                   │                  │
       │────────────────>│                  │                   │                  │
       │                 │                  │                   │                  │
       │                 │ Requête paiement │                   │                  │
       │                 │─────────────────>│                   │                  │
       │                 │                  │                   │                  │
       │                 │                  │ Transaction carte │                  │
       │                 │                  │──────────────────>│                  │
       │                 │                  │                   │                  │
       │                 │                  │ Autorisation      │                  │
       │                 │                  │<──────────────────│                  │
       │                 │                  │                   │                  │
       │                 │                  │ Initie validation │                  │
       │                 │                  │────────────────────────────────────>│
       │                 │                  │                   │                  │
       │                 │                  │                   │                  │
       │                 │                  │ Statut validation │                  │
       │                 │                  │<────────────────────────────────────│
       │                 │                  │                   │                  │
       │                 │ Réponse paiement │                   │                  │
       │                 │<─────────────────│                   │                  │
       │                 │                  │                   │                  │
       │ Confirmation    │                  │                   │                  │
       │<────────────────│                  │                   │                  │
       │                 │                  │                   │                  │
```

## 4. API REST

### 4.1 Endpoint de paiement

#### Requête

```
POST /api/v1/payments
```

**Corps de la requête**:

```json
{
  "merchant_id": "MERCHANT123",
  "consumer_id": "CONSUMER456",
  "amount": {
    "value": 2500,
    "currency": "EUR"
  },
  "card_token": "tok_visa_4242424242424242",
  "card_type": "visa",
  "card_expiry_month": 12,
  "card_expiry_year": 2025,
  "receipt_data": "BASE64_ENCODED_RECEIPT_DATA",
  "supplier_ids": ["SUPPLIER789", "SUPPLIER101"],
  "token_refs": ["TOKEN_REF_123", "TOKEN_REF_456"]
}
```

#### Réponse

```json
{
  "success": true,
  "data": {
    "transaction_id": "TX_12345678",
    "status": "Completed",
    "transaction_time": "2025-02-28T15:30:45Z",
    "error": null
  }
}
```

### 4.2 Endpoint de statut

#### Requête

```
GET /api/v1/payments/{transaction_id}
```

#### Réponse

```json
{
  "success": true,
  "data": {
    "transaction_id": "TX_12345678",
    "status": "Completed",
    "transaction_time": "2025-02-28T15:30:45Z",
    "error": null
  }
}
```

## 5. Sécurité et conformité

### 5.1 Conformité PCI-DSS

Le module est conçu pour respecter les exigences PCI-DSS niveau 1 :

- **Tokenisation** des données de carte
- **Chiffrement** de bout en bout
- **Journalisation** sécurisée
- **Compartimentage** des données sensibles

### 5.2 Authentification et autorisation

- Authentification basée sur les clés API
- Autorisation par rôles et permissions
- Sessions sécurisées et expiration automatique
- Limitation de débit pour prévenir les attaques

### 5.3 Protection contre les fraudes

- Détection des comportements anormaux
- Vérification de l'adresse (AVS)
- Validation du code de sécurité (CVV/CVC)
- Authentification 3D Secure 2.0

## 6. Gestion des erreurs et fallback

### 6.1 Types d'erreurs

| Code | Description | Action recommandée |
|------|-------------|-------------------|
| E001 | Carte refusée | Vérifier les fonds, ou essayer une autre carte |
| E002 | Erreur de validation PoP | Réessayer avec données de ticket correctes |
| E003 | Timeout | Réessayer après quelques instants |
| E004 | Tokens insuffisants | Vérifier le solde de tokens |
| E005 | Erreur système | Contacter le support Étika |

### 6.2 Mécanismes de fallback

Le système dispose de plusieurs mécanismes de récupération :

1. **Retry automatique** pour les erreurs transitoires
2. **Fil d'attente** pour les transactions en échec
3. **Réconciliation différée** pour les incohérences
4. **Mode dégradé** pour les pannes partielles

## 7. Tests et certification

### 7.1 Environnement de test

Un environnement sandbox est disponible pour tester l'intégration :

```
https://sandbox.etika.io/payment-api
```

### 7.2 Cartes de test

| Numéro de carte | Réseau | Scénario |
|-----------------|--------|----------|
| 4242 4242 4242 4242 | Visa | Succès |
| 4000 0000 0000 0002 | Visa | Refusée |
| 4000 0000 0000 0036 | Visa | Timeout |
| 5555 5555 5555 4444 | Mastercard | Succès |
| 5105 1051 0510 5100 | Mastercard | Refusée |

### 7.3 Process de certification

1. Implémentation de l'intégration
2. Exécution de la suite de tests automatisés
3. Soumission des logs de test
4. Revue de code par l'équipe Étika
5. Tests en environnement de préproduction
6. Certification finale

## 8. Considérations de performance

### 8.1 Latence

Le système est conçu pour respecter une latence maximale de 2 secondes pour la double transaction, avec les caractéristiques suivantes :

- Temps moyen : 800ms
- 95ème percentile : 1.5s
- 99ème percentile : 1.8s

### 8.2 Capacité

- Capacité de traitement : 1000 TPS
- Mise à l'échelle horizontale automatique
- Gestion des pics de charge saisonniers

### 8.3 Disponibilité

- SLA : 99.99% de disponibilité
- Redondance multi-régions
- Basculement automatique en cas de panne

## 9. Support et contacts

Pour toute question ou problème concernant l'intégration :

- **Support technique** : support@etika.io
- **Urgences** : hotline +33 1 XX XX XX XX
- **Documentation** : https://docs.etika.io/payment-integration

## 10. Glossaire

- **PoP (Proof of Purchase)** : Mécanisme de consensus basé sur la preuve d'achat
- **Double transaction** : Transaction financière standard + transaction blockchain
- **Token** : Unité de valeur dans l'écosystème Étika
- **Tokenisation** : Remplacement des données de carte par des identifiants sécurisés
- **3DS** : 3D Secure, protocole de sécurité pour les paiements en ligne

## Annexes

### A. Exemples de code

#### Exemple d'intégration en JavaScript

```javascript
const etika = require('etika-payment-sdk');

// Initialiser le client
const client = new etika.PaymentClient({
  apiKey: 'YOUR_API_KEY',
  environment: 'sandbox'
});

// Effectuer un paiement
async function processPayment() {
  try {
    const response = await client.createPayment({
      merchant_id: 'MERCHANT123',
      consumer_id: 'CONSUMER456',
      amount: {
        value: 2500,
        currency: 'EUR'
      },
      card_token: 'tok_visa_4242424242424242',
      card_type: 'visa',
      card_expiry_month: 12,
      card_expiry_year: 2025,
      receipt_data: 'BASE64_ENCODED_RECEIPT_DATA',
      supplier_ids: ['SUPPLIER789', 'SUPPLIER101'],
      token_refs: ['TOKEN_REF_123', 'TOKEN_REF_456']
    });
    
    console.log('Transaction créée:', response.data.transaction_id);
    return response.data;
  } catch (error) {
    console.error('Erreur de paiement:', error);
    throw error;
  }
}
```

### B. Checklist d'intégration

- [ ] Inscription sur la plateforme Étika
- [ ] Obtention des clés API sandbox
- [ ] Implémentation de l'API de paiement
- [ ] Tests avec les cartes de test
- [ ] Implémentation de la gestion des erreurs
- [ ] Tests de bout en bout
- [ ] Soumission pour certification
- [ ] Migration vers l'environnement de production
- [ ] Surveillance et maintenance

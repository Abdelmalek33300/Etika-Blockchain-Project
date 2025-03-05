# Guide d'Application: Construire sur Étika

Ce guide explique comment construire des applications concrètes sur l'écosystème Étika, en utilisant les différents modules que nous avons développés. Il s'adresse aux développeurs qui souhaitent créer des interfaces utilisateur ou des services qui interagissent avec la blockchain Étika.

## 1. Introduction

L'écosystème Étika fournit une infrastructure blockchain complète pour un circuit financier autonome. Construire des applications sur cette infrastructure vous permet de:

- Créer des interfaces utilisateur pour les consommateurs, commerçants, fournisseurs et autres acteurs
- Développer des services qui facilitent les interactions avec le système
- Intégrer des fonctionnalités spécifiques à votre secteur d'activité
- Participer à l'écosystème en tant que nœud hébergeur

## 2. Architecture d'une Application Étika

Une application typique sur Étika comprend les composants suivants:

```
┌─────────────────────────────────────────────────────┐
│                  Interface Utilisateur               │
│  (Web, Mobile, Terminal de Paiement, Application)    │
└───────────────────────────┬─────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────┐
│             Couche de Services Applicatifs           │
│   (Authentification, Cache, Logique Métier, etc.)    │
└───────────────────────────┬─────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────┐
│          API Client Étika / SDK Intégration          │
└───────────────────────────┬─────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │ Blockchain    │
                    │    Étika      │
                    └───────────────┘
```

## 3. Intégration avec la Blockchain Étika

### 3.1 Méthodes d'Intégration

Vous pouvez intégrer votre application avec la blockchain Étika de plusieurs façons:

1. **API RPC**: Utiliser les points d'accès RPC exposés par les nœuds Étika pour interagir avec la blockchain.
2. **Bibliothèques clientes**: Utiliser des bibliothèques spécifiques pour Étika qui simplifient l'interaction avec la blockchain.
3. **SDK Étika**: Une suite d'outils de développement qui facilite l'intégration avec tous les aspects de l'écosystème.
4. **Événements de blockchain**: S'abonner aux événements émis par les différents modules pour réagir aux changements d'état.

### 3.2 Authentification et Identité

Chaque acteur de l'écosystème Étika (consommateur, commerçant, fournisseur, etc.) possède:

1. **Une paire de clés cryptographiques**: Pour la signature des transactions.
2. **Un identifiant de compte**: Utilisé dans toutes les opérations sur la blockchain.
3. **Un profil associé**: Contenant les informations spécifiques à son type d'acteur.

Votre application doit implémenter:

- Un système sécurisé de gestion des clés
- Un processus d'enregistrement et de vérification des utilisateurs
- Des mécanismes de signature des transactions

### 3.3 Interagir avec les Modules Étika

#### 3.3.1 Module Token System

Pour interagir avec les tokens Étika:

```javascript
// Exemple d'API client JavaScript
// Vérifier le solde de tokens latents et actifs
async function checkTokenBalances(accountId) {
  const latentBalance = await etikaClient.query.tokenSystem.latentTokenBalances(accountId);
  const activeBalance = await etikaClient.query.tokenSystem.activeTokenBalances(accountId);
  
  return {
    latent: latentBalance.toNumber(),
    active: activeBalance.toNumber()
  };
}

// Activer des tokens
async function activateTokens(accountId, amount) {
  const tx = etikaClient.tx.tokenSystem.activateTokens(amount);
  return await tx.signAndSend(accountId);
}

// Transférer des tokens
async function transferTokens(fromAccount, toAccount, amount) {
  const tx = etikaClient.tx.tokenSystem.transferTokens(toAccount, amount);
  return await tx.signAndSend(fromAccount);
}
```

#### 3.3.2 Module PoP Consensus

Pour créer et valider des transactions avec preuve d'achat:

```javascript
// Créer une transaction PoP
async function createPopTransaction(creatorAccount, consumer, merchant, suppliers, amount, tokensExchanged, receiptHash) {
  const tx = etikaClient.tx.popConsensus.createPopTransaction(
    consumer,
    merchant,
    suppliers,
    amount,
    tokensExchanged,
    receiptHash
  );
  return await tx.signAndSend(creatorAccount);
}

// Valider une transaction PoP
async function validatePopTransaction(validatorAccount, transactionId) {
  const tx = etikaClient.tx.popConsensus.validatePopTransaction(transactionId);
  return await tx.signAndSend(validatorAccount);
}

// Vérifier l'état d'une transaction PoP
async function checkPopTransactionStatus(transactionId) {
  const pendingTx = await etikaClient.query.popConsensus.pendingTransactions(transactionId);
  
  if (!pendingTx.isEmpty) {
    return {
      status: "pending",
      signatures: pendingTx.signatures.length,
      requiredSignatures: pendingTx.suppliers.length + 2
    };
  }
  
  const validatedTx = await etikaClient.query.popConsensus.validatedTransactions(transactionId);
  
  if (!validatedTx.isEmpty) {
    return {
      status: "validated",
      savingsGenerated: validatedTx.savingsGenerated.toNumber()
    };
  }
  
  return { status: "not_found" };
}
```

#### 3.3.3 Module Consumer Fund

Pour gérer l'épargne des consommateurs:

```javascript
// Vérifier l'épargne d'un consommateur
async function checkConsumerSavings(consumerId) {
  const savings = await etikaClient.query.consumerFund.consumerSavingsAccounts(consumerId);
  
  return {
    longTermSavings: savings.longTermSavings.toNumber(),
    personalProjectsSavings: savings.personalProjectsSavings.toNumber(),
    creditRate: savings.currentCreditRate.toNumber() / 100 // Convertir en pourcentage
  };
}

// Retirer des fonds de l'épargne projets personnels
async function withdrawFromPersonalProjects(consumerAccount, amount) {
  const tx = etikaClient.tx.consumerFund.withdrawFromPersonalProjects(amount);
  return await tx.signAndSend(consumerAccount);
}

// Vérifier le niveau de fidélité
async function checkLoyaltyTier(consumerId) {
  return await etikaClient.query.consumerFund.consumerLoyaltyTiers(consumerId);
}
```

#### 3.3.4 Module Auction System

Pour participer aux enchères:

```javascript
// Créer une enchère
async function createAuction(adminAccount, category, startingPrice, duration) {
  const tx = etikaClient.tx.auctionSystem.createAuction(
    category,
    startingPrice,
    duration
  );
  return await tx.signAndSend(adminAccount);
}

// Placer une offre
async function placeBid(bidderAccount, auctionId, bidAmount) {
  const tx = etikaClient.tx.auctionSystem.placeBid(auctionId, bidAmount);
  return await tx.signAndSend(bidderAccount);
}

// Vérifier les enchères actives
async function getActiveAuctions() {
  const activeAuctions = await etikaClient.query.auctionSystem.activeAuctions.entries();
  
  return activeAuctions.map(([key, auction]) => {
    const auctionId = key.args[0].toHex();
    return {
      id: auctionId,
      category: auction.category.toUtf8(),
      startingPrice: auction.startingPrice.toNumber(),
      highestBid: auction.bidHistory.length > 0 
        ? auction.bidHistory[auction.bidHistory.length - 1].amount.toNumber() 
        : 0,
      endTime: auction.endTime.toNumber()
    };
  });
}
```

#### 3.3.5 Module Factoring System

Pour gérer les relations commerciales et l'affacturage:

```javascript
// Enregistrer une relation commerciale
async function registerRelationship(initiatorAccount, merchant, supplier, category, immediatePaymentPercent, remainingPaymentDelay, interestRate) {
  const tx = etikaClient.tx.factoringSystem.registerRelationship(
    merchant,
    supplier,
    category,
    immediatePaymentPercent,
    remainingPaymentDelay,
    interestRate
  );
  return await tx.signAndSend(initiatorAccount);
}

// Confirmer une relation commerciale
async function confirmRelationship(confirmerAccount, merchant, supplier) {
  const tx = etikaClient.tx.factoringSystem.confirmRelationship(merchant, supplier);
  return await tx.signAndSend(confirmerAccount);
}

// Vérifier les relations commerciales d'un commerçant
async function getMerchantRelationships(merchantId) {
  const suppliers = await etikaClient.query.factoringSystem.merchantRelationships(merchantId);
  
  const relationships = [];
  for (const supplierId of suppliers) {
    const relationship = await etikaClient.query.factoringSystem.commercialRelationships([merchantId, supplierId]);
    relationships.push({
      supplier: supplierId.toString(),
      category: relationship.category.toUtf8(),
      immediatePaymentPercent: relationship.factoringConditions.immediatePaymentPercent,
      status: relationship.status.toString()
    });
  }
  
  return relationships;
}
```

## 4. Cas d'Utilisation Concrets

### 4.1 Application Mobile pour Consommateurs

Une application mobile pour les consommateurs pourrait inclure:

- **Inscription et gestion de profil**: Création de compte, vérification, paramètres.
- **Portefeuille de tokens**: Affichage des soldes, activation, transfert.
- **Suivi de l'épargne**: Visualisation de l'épargne long terme et projets personnels.
- **Scan de QR code**: Pour valider les transactions lors des achats.
- **Historique des transactions**: Suivi des achats et des validations.
- **Niveau de fidélité**: Affichage du niveau actuel et des avantages.
- **Simulateur de crédit**: Calcul du taux personnalisé selon l'ancienneté.

### 4.2 Système de Caisse pour Commerçants

Un système de caisse intégré pourrait inclure:

- **Gestion des ventes**: Enregistrement des transactions, génération de tickets.
- **Intégration PoP**: Création automatique des transactions PoP à chaque vente.
- **Gestion des fournisseurs**: Configuration des relations commerciales.
- **Suivi des tokens**: Gestion des tokens collectés.
- **Tableau de bord d'affacturage**: Suivi des paiements aux fournisseurs.
- **Analytics**: Analyse des ventes, fidélité client, impacts financiers.

### 4.3 Portail pour Fournisseurs

Un portail pour les fournisseurs pourrait inclure:

- **Tableau de bord**: Aperçu des relations commerciales et paiements.
- **Gestion de l'affacturage**: Suivi des paiements immédiats et restants.
- **Validation des transactions**: Interface pour valider les transactions PoP.
- **Gestion des tokens**: Suivi et utilisation des tokens collectés.
- **Rapports financiers**: Analyse de la trésorerie et des flux financiers.

### 4.4 Interface pour les ONG

Une interface pour les ONG partenaires pourrait inclure:

- **Suivi des donations**: Tokens reçus via le mécanisme de répartition.
- **Place de marché**: Interface pour vendre les tokens accumulés.
- **Gestion du nœud**: Outils pour participer à l'hébergement de la blockchain.
- **Rapports d'impact**: Analyse des fonds reçus et leur utilisation.

## 5. Bonnes Pratiques et Optimisations

### 5.1 Performance

- **Mise en cache**: Mettre en cache les données fréquemment consultées pour réduire les appels à la blockchain.
- **Traitement par lots**: Regrouper les opérations similaires lorsque possible.
- **Requêtes optimisées**: N'extraire que les données nécessaires de la blockchain.

```javascript
// Exemple de mise en cache avec expiration
class EtikaCacheService {
  constructor(ttlSeconds = 60) {
    this.cache = new Map();
    this.ttlSeconds = ttlSeconds;
  }
  
  set(key, value) {
    const expiry = Date.now() + this.ttlSeconds * 1000;
    this.cache.set(key, { value, expiry });
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
  
  async getOrFetch(key, fetchFn) {
    const cachedValue = this.get(key);
    if (cachedValue) return cachedValue;
    
    const freshValue = await fetchFn();
    this.set(key, freshValue);
    return freshValue;
  }
}

// Utilisation
const cache = new EtikaCacheService(300); // 5 minutes TTL

async function getConsumerProfile(consumerId) {
  return await cache.getOrFetch(
    `consumer_profile_${consumerId}`,
    async () => {
      // Requête à la blockchain
      return await etikaClient.query.getConsumerProfile(consumerId);
    }
  );
}
```

### 5.2 Sécurité

- **Gestion sécurisée des clés**: Ne jamais stocker les clés privées en clair.
- **Validation côté client**: Valider les données avant de les envoyer à la blockchain.
- **Monitoring**: Surveiller les activités suspectes et les tentatives d'attaque.
- **Tests de sécurité**: Réaliser des audits et des tests de pénétration réguliers.

```javascript
// Exemple de validation côté client
function validatePopTransaction(transaction) {
  const errors = [];
  
  if (!transaction.consumer) {
    errors.push("Consumer is required");
  }
  
  if (!transaction.merchant) {
    errors.push("Merchant is required");
  }
  
  if (transaction.amount <= 0) {
    errors.push("Amount must be positive");
  }
  
  if (transaction.tokensExchanged < 0) {
    errors.push("Tokens exchanged cannot be negative");
  }
  
  if (!transaction.receiptHash || transaction.receiptHash.length !== 64) {
    errors.push("Valid receipt hash is required");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### 5.3 Expérience Utilisateur

- **Rétroaction en temps réel**: Informer les utilisateurs de l'état des transactions.
- **Mode hors-ligne**: Permettre certaines fonctionnalités sans connexion réseau.
- **Opérations progressives**: Montrer l'avancement des opérations longues.
- **Notifications**: Alerter les utilisateurs des événements importants.

```javascript
// Exemple de suivi de transaction
async function trackTransactionProgress(txHash, callbacks) {
  const { onStart, onProgress, onFinalize, onError } = callbacks;
  
  try {
    onStart && onStart();
    
    // S'abonner aux mises à jour de la transaction
    const unsubscribe = await etikaClient.rpc.chain.subscribeFinalizedHeads(async (header) => {
      try {
        // Vérifier si la transaction est incluse dans un bloc
        const blockHash = header.hash.toHex();
        const block = await etikaClient.rpc.chain.getBlock(blockHash);
        
        // Chercher la transaction dans le bloc
        const txFound = block.block.extrinsics.some(ext => ext.hash.toHex() === txHash);
        
        if (txFound) {
          // Vérifier le statut de la transaction
          const events = await etikaClient.query.system.events.at(blockHash);
          const success = events.some(({ event }) => 
            event.section === 'system' && 
            event.method === 'ExtrinsicSuccess' &&
            event.data[0].hash.toHex() === txHash
          );
          
          if (success) {
            onFinalize && onFinalize(true);
            unsubscribe();
          } else {
            onError && onError("Transaction failed");
            unsubscribe();
          }
        } else {
          // Mise à jour de la progression
          onProgress && onProgress(header.number.toNumber());
        }
      } catch (err) {
        onError && onError(err.message);
        unsubscribe();
      }
    });
  } catch (err) {
    onError && onError(err.message);
  }
}

// Utilisation
createPopTransaction(account, consumer, merchant, suppliers, amount, tokens, receiptHash)
  .then(result => {
    const txHash = result.txHash;
    
    trackTransactionProgress(txHash, {
      onStart: () => updateUI({ status: 'Processing', progress: 0 }),
      onProgress: (blockNumber) => updateUI({ status: 'Processing', progress: blockNumber }),
      onFinalize: () => updateUI({ status: 'Completed', progress: 100 }),
      onError: (message) => updateUI({ status: 'Failed', error: message })
    });
  })
  .catch(error => updateUI({ status: 'Failed', error: error.message }));
```

## 6. Déploiement et Maintenance

### 6.1 Environnements

Il est recommandé de travailler avec plusieurs environnements:

- **Développement**: Pour le développement et les tests initiaux.
- **Staging**: Pour les tests d'intégration et de charge.
- **Production**: Pour les utilisateurs finaux.

### 6.2 Surveillance et Maintenance

- **Logging**: Implémenter un système de journalisation détaillé.
- **Monitoring**: Surveiller les performances et la santé du système.
- **Mises à jour**: Maintenir les bibliothèques et le code à jour.
- **Backup**: Sauvegarder régulièrement les données critiques.

```javascript
// Exemple de système de logging
class EtikaLogger {
  constructor(level = 'info', outputs = ['console']) {
    this.level = level;
    this.outputs = outputs;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }
  
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }
  
  formatMessage(level, message, context) {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(context) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${contextStr}`;
  }
  
  log(level, message, context) {
    if (!this.shouldLog(level)) return;
    
    const formattedMessage = this.formatMessage(level, message, context);
    
    if (this.outputs.includes('console')) {
      console[level](formattedMessage);
    }
    
    if (this.outputs.includes('server') && typeof window !== 'undefined') {
      // Envoyer les logs à un serveur centralisé
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, context, timestamp: Date.now() })
      }).catch(err => console.error('Failed to send log to server', err));
    }
  }
  
  error(message, context) { this.log('error', message, context); }
  warn(message, context) { this.log('warn', message, context); }
  info(message, context) { this.log('info', message, context); }
  debug(message, context) { this.log('debug', message, context); }
}

// Utilisation
const logger = new EtikaLogger('debug', ['console', 'server']);

try {
  // Code qui peut échouer
  const result = await etikaClient.tx.someRiskyOperation();
  logger.info('Operation successful', { result });
} catch (error) {
  logger.error('Operation failed', { error: error.message, stack: error.stack });
}
```

## 7. Ressources et Support

### 7.1 Documentation

- Documentation officielle d'Étika
- API Reference
- Guides et tutoriels
- Exemples de code

### 7.2 Communauté et Support

- Forum de la communauté
- Canaux Discord/Matrix
- Support technique
- Programmes de formation

### 7.3 Outils de Développement

- SDK Étika
- Environnements de test
- Outils de débogage
- Templates d'application

## Conclusion

Construire sur l'écosystème Étika ouvre de nombreuses possibilités pour créer des applications financières innovantes, transparentes et éthiques. En suivant les bonnes pratiques d'intégration et en tirant parti des différents modules disponibles, vous pouvez développer des solutions qui améliorent l'expérience des utilisateurs tout en contribuant à un système économique plus équitable.

Ce guide est conçu comme un point de départ et sera mis à jour régulièrement avec de nouveaux exemples, bonnes pratiques et cas d'utilisation au fur et à mesure que l'écosystème Étika évolue.
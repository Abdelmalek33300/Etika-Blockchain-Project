# Nouvelles améliorations pour le projet Étika

## 1. Système d'enchères adaptatif avec segmentation des utilisateurs

```javascript
// Ajout dans auction-system.js

/**
 * Gestionnaire d'expérience utilisateur adaptative pour les enchères
 */
class AdaptiveAuctionExperience {
  constructor(userService, metricsService) {
    this.userService = userService;
    this.metricsService = metricsService;
    this.userSegments = {
      NOVICE: 'novice',
      REGULAR: 'regular',
      POWER: 'power',
      VIP: 'vip'
    };
  }
  
  /**
   * Détermine le segment d'un utilisateur basé sur son historique
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<string>} - Segment de l'utilisateur
   */
  async determineUserSegment(userId) {
    try {
      const userStats = await this.userService.getUserAuctionStats(userId);
      
      if (!userStats || userStats.totalBids < 5) {
        return this.userSegments.NOVICE;
      } else if (userStats.totalBids < 20) {
        return this.userSegments.REGULAR;
      } else if (userStats.totalBids < 100 || userStats.winRatio < 0.1) {
        return this.userSegments.POWER;
      } else {
        return this.userSegments.VIP;
      }
    } catch (error) {
      console.error('Error determining user segment:', error);
      return this.userSegments.REGULAR; // Par défaut
    }
  }
  
  /**
   * Adapte l'interface utilisateur selon le segment
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} auctionUI - Interface utilisateur
   * @returns {Promise<Object>} - Interface utilisateur adaptée
   */
  async adaptUserInterface(userId, auctionUI) {
    const segment = await this.determineUserSegment(userId);
    
    switch (segment) {
      case this.userSegments.NOVICE:
        return {
          ...auctionUI,
          showGuidedTutorial: true,
          simplifiedControls: true,
          showDetailedHelp: true,
          automaticBidSuggestions: true
        };
        
      case this.userSegments.REGULAR:
        return {
          ...auctionUI,
          showGuidedTutorial: false,
          simplifiedControls: false,
          showDetailedHelp: true,
          automaticBidSuggestions: true
        };
        
      case this.userSegments.POWER:
        return {
          ...auctionUI,
          showGuidedTutorial: false,
          simplifiedControls: false,
          showDetailedHelp: false,
          automaticBidSuggestions: true,
          showAdvancedStats: true,
          enableBidShortcuts: true
        };
        
      case this.userSegments.VIP:
        return {
          ...auctionUI,
          showGuidedTutorial: false,
          simplifiedControls: false,
          showDetailedHelp: false,
          automaticBidSuggestions: false,
          showAdvancedStats: true,
          enableBidShortcuts: true,
          showMarketInsights: true,
          enableAutoBidding: true
        };
        
      default:
        return auctionUI;
    }
  }
  
  /**
   * Adapte les limites de transactions selon le segment
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} - Limites adaptées
   */
  async adaptTransactionLimits(userId) {
    const segment = await this.determineUserSegment(userId);
    
    switch (segment) {
      case this.userSegments.NOVICE:
        return {
          maxBidAmount: 1000,
          dailyBidLimit: 5,
          requiresExtraVerification: true,
          cooldownPeriod: 300 // 5 minutes entre enchères
        };
        
      case this.userSegments.REGULAR:
        return {
          maxBidAmount: 5000,
          dailyBidLimit: 15,
          requiresExtraVerification: true,
          cooldownPeriod: 60 // 1 minute entre enchères
        };
        
      case this.userSegments.POWER:
        return {
          maxBidAmount: 20000,
          dailyBidLimit: 40,
          requiresExtraVerification: false,
          cooldownPeriod: 10 // 10 secondes entre enchères
        };
        
      case this.userSegments.VIP:
        return {
          maxBidAmount: 50000,
          dailyBidLimit: 100,
          requiresExtraVerification: false,
          cooldownPeriod: 0 // Pas de limite
        };
        
      default:
        return {
          maxBidAmount: 5000,
          dailyBidLimit: 15,
          requiresExtraVerification: true,
          cooldownPeriod: 60
        };
    }
  }
}
```

## 2. Système de prédiction et prévention des fraudes par analyse de comportement

```javascript
// Ajout dans un nouveau fichier fraud-detection-service.js

/**
 * Service de détection des fraudes basé sur l'analyse comportementale
 */
class FraudDetectionService {
  constructor(db, blockchainService, notificationService) {
    this.db = db;
    this.blockchainService = blockchainService;
    this.notificationService = notificationService;
    
    // Paramètres de détection
    this.anomalyThresholds = {
      velocityMultiplier: 3,       // 3x la vitesse normale
      deviationThreshold: 2.5,     // 2.5 écarts-types
      transactionCountThreshold: 5 // Minimum 5 transactions pour l'analyse
    };
    
    // Patterns de fraude connus
    this.knownPatterns = [
      {
        name: 'sniping_pattern',
        description: 'Enchères massives dans les dernières secondes d\'une vente',
        detect: this.detectSnipingPattern.bind(this)
      },
      {
        name: 'collusion_pattern',
        description: 'Utilisateurs qui semblent coordonner leurs enchères',
        detect: this.detectCollusionPattern.bind(this)
      },
      {
        name: 'wash_trading',
        description: 'Même personne qui achète et vend pour manipuler les prix',
        detect: this.detectWashTrading.bind(this)
      }
    ];
  }
  
  /**
   * Analyse une transaction pour détecter des activités suspectes
   * @param {Object} transaction - Transaction à analyser
   * @returns {Promise<Object>} - Résultat de l'analyse
   */
  async analyzeTransaction(transaction) {
    // Données de base de la transaction
    const { userId, type, amount, tokenId, timestamp } = transaction;
    
    const analysisResult = {
      userId,
      transactionId: transaction.id,
      timestamp: new Date(),
      anomalies: [],
      riskScore: 0,
      recommendation: 'approve'
    };
    
    // 1. Vérifier la vélocité des transactions de l'utilisateur
    const velocityAnomaly = await this.checkTransactionVelocity(userId, type, timestamp);
    if (velocityAnomaly) {
      analysisResult.anomalies.push(velocityAnomaly);
    }
    
    // 2. Vérifier les patterns de montant inhabituels
    const amountAnomaly = await this.checkAmountPatterns(userId, type, amount);
    if (amountAnomaly) {
      analysisResult.anomalies.push(amountAnomaly);
    }
    
    // 3. Vérifier les patterns de fraude connus
    for (const pattern of this.knownPatterns) {
      const patternMatch = await pattern.detect(transaction);
      if (patternMatch.detected) {
        analysisResult.anomalies.push({
          type: pattern.name,
          confidence: patternMatch.confidence,
          details: patternMatch.details
        });
      }
    }
    
    // 4. Analyse du réseau social pour détecter la collusion
    if (type === 'bid') {
      const networkAnomaly = await this.analyzeSocialNetwork(userId, transaction.auctionId);
      if (networkAnomaly) {
        analysisResult.anomalies.push(networkAnomaly);
      }
    }
    
    // 5. Vérifier les adresses blockchain suspectes
    if (transaction.walletAddress) {
      const blockchainAnomaly = await this.checkBlockchainAddress(transaction.walletAddress);
      if (blockchainAnomaly) {
        analysisResult.anomalies.push(blockchainAnomaly);
      }
    }
    
    // Calculer le score de risque final
    analysisResult.riskScore = this.calculateRiskScore(analysisResult.anomalies);
    
    // Déterminer la recommandation
    if (analysisResult.riskScore > 80) {
      analysisResult.recommendation = 'block';
    } else if (analysisResult.riskScore > 50) {
      analysisResult.recommendation = 'manual_review';
    } else if (analysisResult.riskScore > 30) {
      analysisResult.recommendation = 'add_verification';
    }
    
    // Enregistrer l'analyse
    await this.db.fraudAnalyses.insert(analysisResult);
    
    // Émettre une alerte si nécessaire
    if (analysisResult.recommendation !== 'approve') {
      this.emitFraudAlert(analysisResult);
    }
    
    return analysisResult;
  }
  
  /**
   * Vérifie la vélocité des transactions d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} type - Type de transaction
   * @param {number} timestamp - Horodatage de la transaction
   * @returns {Object|null} - Anomalie de vélocité ou null
   */
  async checkTransactionVelocity(userId, type, timestamp) {
    const oneHourAgo = timestamp - 3600000;
    
    // Récupérer les transactions récentes de l'utilisateur
    const recentTransactions = await this.db.transactions.find({
      userId,
      type,
      timestamp: { $gte: oneHourAgo, $lt: timestamp }
    }).sort({ timestamp: 1 }).toArray();
    
    if (recentTransactions.length < this.anomalyThresholds.transactionCountThreshold) {
      return null; // Pas assez de données pour l'analyse
    }
    
    // Calculer les intervalles entre transactions
    const intervals = [];
    for (let i = 1; i < recentTransactions.length; i++) {
      intervals.push(recentTransactions[i].timestamp - recentTransactions[i-1].timestamp);
    }
    
    // Calculer les statistiques
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const stdDev = Math.sqrt(
      intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length
    );
    
    // Calculer l'intervalle le plus récent
    const latestInterval = timestamp - recentTransactions[recentTransactions.length - 1].timestamp;
    
    // Vérifier si l'intervalle est anormalement court
    if (avgInterval > 0 && latestInterval < avgInterval / this.anomalyThresholds.velocityMultiplier) {
      return {
        type: 'high_velocity',
        details: {
          currentInterval: latestInterval,
          averageInterval: avgInterval,
          deviation: (avgInterval - latestInterval) / (stdDev || 1)
        },
        confidence: 0.7
      };
    }
    
    return null;
  }
  
  /**
   * Vérifie si le montant de la transaction est inhabituel
   * @param {string} userId - ID de l'utilisateur
   * @param {string} type - Type de transaction
   * @param {number} amount - Montant de la transaction
   * @returns {Object|null} - Anomalie de montant ou null
   */
  async checkAmountPatterns(userId, type, amount) {
    // Récupérer l'historique des transactions de l'utilisateur
    const userHistory = await this.db.transactions.find({
      userId,
      type
    }).sort({ timestamp: -1 }).limit(30).toArray();
    
    if (userHistory.length < this.anomalyThresholds.transactionCountThreshold) {
      return null; // Pas assez de données pour l'analyse
    }
    
    // Calculer les statistiques
    const amounts = userHistory.map(tx => tx.amount);
    const avgAmount = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, val) => sum + Math.pow(val - avgAmount, 2), 0) / amounts.length
    );
    
    // Calculer l'écart normalisé
    const deviation = (amount - avgAmount) / (stdDev || 1);
    
    // Vérifier si le montant est anormalement élevé
    if (deviation > this.anomalyThresholds.deviationThreshold) {
      return {
        type: 'unusual_amount',
        details: {
          currentAmount: amount,
          averageAmount: avgAmount,
          standardDeviation: stdDev,
          deviationScore: deviation
        },
        confidence: Math.min(0.4 + (deviation / 10), 0.9) // Confiance proportionnelle à l'écart
      };
    }
    
    return null;
  }
  
  /**
   * Détecte les patterns de "sniping" (enchères à la dernière seconde)
   * @param {Object} transaction - Transaction à analyser
   * @returns {Object} - Résultat de détection
   */
  async detectSnipingPattern(transaction) {
    const result = {
      detected: false,
      confidence: 0,
      details: {}
    };
    
    // Vérifier si c'est une enchère
    if (transaction.type !== 'bid') {
      return result;
    }
    
    // Récupérer l'enchère
    const auction = await this.db.auctions.findOne({ id: transaction.auctionId });
    if (!auction) {
      return result;
    }
    
    // Calculer le temps restant au moment de l'enchère
    const timeRemaining = auction.endTime - transaction.timestamp;
    
    // Si moins de 10 secondes restantes
    if (timeRemaining < 10000) {
      // Récupérer les enchères récentes de cet utilisateur
      const userBids = await this.db.bids.find({
        auctionId: transaction.auctionId,
        bidderId: transaction.userId,
        timestamp: { $gte: auction.endTime - 300000 } // 5 dernières minutes
      }).toArray();
      
      // Si c'est la première enchère de l'utilisateur dans les 5 dernières minutes
      if (userBids.length === 1) {
        result.detected = true;
        result.confidence = Math.min(0.5 + ((10000 - timeRemaining) / 10000), 0.95);
        result.details = {
          timeRemaining,
          patternType: 'last_second_bid',
          previousUserBids: 0
        };
      }
    }
    
    return result;
  }
  
  /**
   * Détecte les patterns de collusion entre utilisateurs
   * @param {Object} transaction - Transaction à analyser
   * @returns {Object} - Résultat de détection
   */
  async detectCollusionPattern(transaction) {
    const result = {
      detected: false,
      confidence: 0,
      details: {}
    };
    
    // Vérifier si c'est une enchère
    if (transaction.type !== 'bid') {
      return result;
    }
    
    // Récupérer les enchères récentes pour cette vente
    const recentBids = await this.db.bids.find({
      auctionId: transaction.auctionId
    }).sort({ timestamp: -1 }).limit(20).toArray();
    
    // Grouper par utilisateur
    const bidderGroups = {};
    recentBids.forEach(bid => {
      if (!bidderGroups[bid.bidderId]) {
        bidderGroups[bid.bidderId] = [];
      }
      bidderGroups[bid.bidderId].push(bid);
    });
    
    // Rechercher des patterns d'alternance entre deux utilisateurs
    const bidders = Object.keys(bidderGroups);
    if (bidders.length >= 2) {
      // Vérifier les paires de bidders qui alternent leurs enchères
      for (let i = 0; i < bidders.length; i++) {
        for (let j = i + 1; j < bidders.length; j++) {
          const bidder1 = bidders[i];
          const bidder2 = bidders[j];
          
          // Vérifier si ces deux utilisateurs alternent leurs enchères
          let alternatingCount = 0;
          for (let k = 0; k < recentBids.length - 1; k++) {
            if (
              (recentBids[k].bidderId === bidder1 && recentBids[k+1].bidderId === bidder2) ||
              (recentBids[k].bidderId === bidder2 && recentBids[k+1].bidderId === bidder1)
            ) {
              alternatingCount++;
            }
          }
          
          // Si un pattern d'alternance est détecté
          if (alternatingCount >= 3) {
            result.detected = true;
            result.confidence = Math.min(0.4 + (alternatingCount * 0.1), 0.9);
            result.details = {
              patternType: 'bid_alternation',
              bidders: [bidder1, bidder2],
              alternatingCount
            };
            return result;
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Détecte les wash trading (même personne qui achète et vend)
   * @param {Object} transaction - Transaction à analyser
   * @returns {Object} - Résultat de détection
   */
  async detectWashTrading(transaction) {
    const result = {
      detected: false,
      confidence: 0,
      details: {}
    };
    
    // Vérifier si c'est une transaction de type achat ou vente
    if (transaction.type !== 'nft_purchase' && transaction.type !== 'nft_sale') {
      return result;
    }
    
    // Récupérer l'historique récent du NFT
    const nftHistory = await this.db.nftTransactions.find({
      tokenId: transaction.tokenId
    }).sort({ timestamp: -1 }).limit(10).toArray();
    
    if (nftHistory.length < 2) {
      return result;
    }
    
    // Rechercher les situations où le même utilisateur achète et vend rapidement
    const lastOwners = new Set();
    let rapidTrading = false;
    let tradingUsers = [];
    
    for (const tx of nftHistory) {
      if (tx.sellerId) lastOwners.add(tx.sellerId);
      if (tx.buyerId) lastOwners.add(tx.buyerId);
      
      // Vérifier si c'est le même utilisateur qui achète et vend
      if (tx.type === 'nft_sale' && transaction.type === 'nft_purchase' &&
          tx.sellerId === transaction.userId) {
        rapidTrading = true;
        tradingUsers.push(tx.sellerId);
      }
    }
    
    // Détecter les transferts en boucle entre 2-3 utilisateurs
    if (lastOwners.size <= 3 && nftHistory.length >= 4) {
      result.detected = true;
      result.confidence = 0.7;
      result.details = {
        patternType: 'circular_trading',
        involvedUsers: Array.from(lastOwners),
        transactionCount: nftHistory.length
      };
    } 
    // Détecter la revente rapide (moins de 24h)
    else if (rapidTrading) {
      result.detected = true;
      result.confidence = 0.6;
      result.details = {
        patternType: 'rapid_resale',
        seller: transaction.userId,
        timeBetweenTransactions: transaction.timestamp - nftHistory[0].timestamp
      };
    }
    
    return result;
  }
  
  /**
   * Analyse le réseau social pour détecter la collusion
   * @param {string} userId - ID de l'utilisateur
   * @param {string} auctionId - ID de l'enchère
   * @returns {Object|null} - Anomalie de réseau social ou null
   */
  async analyzeSocialNetwork(userId, auctionId) {
    // Récupérer tous les enchérisseurs pour cette enchère
    const bidders = await this.db.bids.find({ auctionId })
      .distinct('bidderId');
    
    if (bidders.length < 2) {
      return null;
    }
    
    // Récupérer les connexions entre ces utilisateurs
    const connections = await this.db.userConnections.find({
      $or: [
        { userId1: userId, userId2: { $in: bidders } },
        { userId2: userId, userId1: { $in: bidders } }
      ]
    }).toArray();
    
    // Si des connexions sont trouvées
    if (connections.length > 0) {
      const connectedUsers = new Set();
      
      connections.forEach(conn => {
        connectedUsers.add(conn.userId1 === userId ? conn.userId2 : conn.userId1);
      });
      
      return {
        type: 'social_network_connection',
        details: {
          connectedBidders: Array.from(connectedUsers),
          connectionCount: connections.length
        },
        confidence: Math.min(0.5 + (connections.length * 0.1), 0.9)
      };
    }
    
    return null;
  }
  
  /**
   * Vérifie si une adresse blockchain est suspecte
   * @param {string} address - Adresse blockchain
   * @returns {Object|null} - Anomalie d'adresse ou null
   */
  async checkBlockchainAddress(address) {
    try {
      // Vérifier dans la liste des adresses connues
      const knownAddress = await this.db.suspiciousAddresses.findOne({ address });
      
      if (knownAddress) {
        return {
          type: 'suspicious_address',
          details: {
            reason: knownAddress.reason,
            flaggedSince: knownAddress.flaggedAt
          },
          confidence: 0.9
        };
      }
      
      // Vérifier l'âge de l'adresse
      const addressInfo = await this.blockchainService.getAddressInfo(address);
      
      if (addressInfo.firstSeen) {
        const addressAge = Date.now() - addressInfo.firstSeen;
        const ageInDays = addressAge / (1000 * 60 * 60 * 24);
        
        // Adresse de moins de 24h
        if (ageInDays < 1) {
          return {
            type: 'new_address',
            details: {
              addressAge: ageInDays,
              firstSeen: addressInfo.firstSeen
            },
            confidence: 0.6
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error checking blockchain address:', error);
      return null;
    }
  }
  
  /**
   * Calcule un score de risque global
   * @param {Array} anomalies - Liste des anomalies détectées
   * @returns {number} - Score de risque (0-100)
   */
  calculateRiskScore(anomalies) {
    if (anomalies.length === 0) {
      return 0;
    }
    
    // Poids pour chaque type d'anomalie
    const weights = {
      high_velocity: 15,
      unusual_amount: 20,
      suspicious_address: 30,
      social_network_connection: 25,
      new_address: 15,
      sniping_pattern: 10,
      collusion_pattern: 35,
      wash_trading: 40
    };
    
    // Calculer le score pondéré
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    anomalies.forEach(anomaly => {
      const weight = weights[anomaly.type] || 10;
      totalScore += weight * anomaly.confidence;
      maxPossibleScore += weight;
    });
    
    // Normaliser entre 0 et 100
    return Math.min(100, (totalScore / maxPossibleScore) * 100);
  }
  
  /**
   * Émet une alerte de fraude
   * @param {Object} analysisResult - Résultat de l'analyse
   */
  async emitFraudAlert(analysisResult) {
    const alertLevel = analysisResult.riskScore > 70 ? 'high' : 
                      analysisResult.riskScore > 40 ? 'medium' : 'low';
    
    const alert = {
      type: 'fraud_detection',
      level: alertLevel,
      userId: analysisResult.userId,
      transactionId: analysisResult.transactionId,
      riskScore: analysisResult.riskScore,
      anomalies: analysisResult.anomalies,
      recommendation: analysisResult.recommendation,
      timestamp: new Date()
    };
    
    await this.notificationService.sendAlert(alert);
    
    // Journaliser
    console.log(`[FRAUD ALERT] ${alertLevel.toUpperCase()} risk transaction detected:`, {
      userId: analysisResult.userId,
      transactionId: analysisResult.transactionId,
      riskScore: analysisResult.riskScore
    });
  }
}
```

## 3. Système de récupération progressive (Circuit Breaker) pour la protection du système

```javascript
// Ajout dans un nouveau fichier circuit-breaker.js

/**
 * Circuit Breaker pour protéger les services critiques contre les défaillances en cascade
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.services = new Map();
    this.options = {
      failureThreshold: options.failureThreshold || 5,   // Nombre d'échecs avant de déclencher le circuit
      resetTimeout: options.resetTimeout || 30000,       // Délai avant de tester à nouveau (ms)
      halfOpenSuccessThreshold: options.halfOpenSuccessThreshold || 3, // Succès requis avant de fermer
      monitorInterval: options.monitorInterval || 10000, // Intervalle de surveillance (ms)
      timeWindow: options.timeWindow || 60000           // Fenêtre de temps pour le comptage des échecs (ms)
    };
    
    this.monitoringInterval = null;
    this.startMonitoring();
  }
  
  /**
   * Enregistre un service à protéger
   * @param {string} serviceId - Identifiant du service
   * @param {Object} options - Options spécifiques au service
   * @returns {CircuitBreaker} - L'instance pour chaînage
   */
  registerService(serviceId, options = {}) {
    const serviceOptions = { ...this.options, ...options };
    
    this.services.set(serviceId, {
      state: 'closed',        // closed, open, half-open
      failures: 0,
      successes: 0,
      lastFailure: null,
      lastSuccess: null,
      openSince: null,
      failureHistory: [],
      totalRequests: 0,
      failedRequests: 0,
      options: serviceOptions
    });
    
    return this;
  }
  
  /**
   * Exécute une fonction en la protégeant avec le circuit breaker
   * @param {string} serviceId - Identifiant du service
   * @param {Function} fn - Fonction à exécuter
   * @param {boolean} forceClosed - Force l'exécution même si le circuit est ouvert
   * @returns {Promise<*>} - Résultat de la fonction
   */
  async execute(serviceId, fn, forceClosed = false) {
    if (!this.services.has(serviceId)) {
      throw new Error(`Service ${serviceId} not registered with circuit breaker`);
    }
    
    const service = this.services.get(serviceId);
    service.totalRequests++;
    
    // Vérifier si le circuit est ouvert
    if (service.state === 'open' && !forceClosed) {
      const openFor = Date.now() - service.openSince;
      
      // Si le délai de réinitialisation est écoulé, passer en half-open
      if (openFor >= service.options.resetTimeout) {
        this.transitionToHalfOpen(serviceId);
      } else {
        // Le circuit est ouvert, rejeter immédiatement
        service.failedRequests++;
        throw new CircuitOpenError(
          `Circuit is open for service ${serviceId}. Try again in ${Math.ceil((service.options.resetTimeout - openFor) / 1000)} seconds.`
        );
      }
    }
    
    try {
      // Exécuter la fonction
      const result = await fn();
      
      // Succès
      this.recordSuccess(serviceId);
      return result;
    } catch (error) {
      // Échec
      this.recordFailure(serviceId, error);
      throw error;
    }
  }
  
  /**
   * Enregistre un succès
   * @param {string} serviceId - Identifiant du service
   */
  recordSuccess(serviceId) {
    const service = this.services.get(serviceId);
    service.lastSuccess = Date.now();
    
    // Réinitialiser les échecs si le circuit est fermé
    if (service.state === 'closed') {
      service.failures = 0;
      service.failureHistory = [];
    }
    
    // Si le circuit est half-open, vérifier si nous pouvons le fermer
    if (service.state === 'half-open') {
      service.successes++;
      
      if (service.successes >= service.options.halfOpenSuccessThreshold) {
        this.transitionToClosed(serviceId);
      }
    }
  }
  
  /**
   * Enregistre un échec
   * @param {string} serviceId - Identifiant du service
   * @param {Error} error - Erreur survenue
   */
  recordFailure(serviceId, error) {
    const service = this.services.get(serviceId);
    service.failedRequests++;
    service.lastFailure = Date.now();
    
    // Ajouter l'échec à l'historique
    service.failureHistory.push({
      timestamp: Date.now(),
      error: error.message || String(error)
    });
    
    // Nettoyer l'historique (garder uniquement les échecs dans la fenêtre de temps)
    const timeWindow = service.options.timeWindow;
    const cutoff = Date.now() - timeWindow;
    service.failureHistory = service.failureHistory.filter(
      failure => failure.timestamp >= cutoff
    );
    
    // Mettre à jour le compteur d'échecs (dans la fenêtre de temps)
    service.failures = service.failureHistory.length;
    
    // Vérifier si nous devons ouvrir le circuit
    if (service.state === 'closed' && service.failures >= service.options.failureThreshold) {
      this.transitionToOpen(serviceId);
    }
    
    // Si le circuit est half-open, le rouvrir immédiatement
    if (service.state === 'half-open') {
      this.transitionToOpen(serviceId);
    }
  }
  
  /**
   * Transition vers l'état ouvert
   * @param {string} serviceId - Identifiant du service
   */
  transitionToOpen(serviceId) {
    const service = this.services.get(serviceId);
    
    if (service.state !== 'open') {
      console.log(`Circuit for service ${serviceId} transitioning from ${service.state} to open`);
      
      service.state = 'open';
      service.openSince = Date.now();
      service.successes = 0;
      
      // Émettre un événement
      this.emitEvent(serviceId, 'open', {
        failures: service.failures,
        failureHistory: service.failureHistory
      });
    }
  }
  
  /**
   * Transition vers l'état half-open
   * @param {string} serviceId - Identifiant du service
   */
  transitionToHalfOpen(serviceId) {
    const service = this.services.get(serviceId);
    
    if (service.state !== 'half-open') {
      console.log(`Circuit for service ${serviceId} transitioning from ${service.state} to half-open`);
      
      service.state = 'half-open';
      service.successes = 0;
      
      // Émettre un événement
      this.emitEvent(serviceId, 'half-open', {
        openDuration: Date.now() - service.openSince
      });
    }
  }
  
  /**
   * Transition vers l'état fermé
   * @param {string} serviceId - Identifiant du service
   */
  transitionToClosed(serviceId) {
    const service = this.services.get(serviceId);
    
    if (service.state !== 'closed') {
      console.log(`Circuit for service ${serviceId} transitioning from ${service.state} to closed`);
      
      service.state = 'closed';
      service.failures = 0;
      service.successes = 0;
      service.openSince = null;
      
      // Émettre un événement
      this.emitEvent(serviceId, 'closed', {
        previousState: service.state
      });
    }
  }
  
  /**
   * Force la réinitialisation d'un circuit
   * @param {string} serviceId - Identifiant du service
   */
  resetCircuit(serviceId) {
    if (!this.services.has(serviceId)) {
      throw new Error(`Service ${serviceId} not registered with circuit breaker`);
    }
    
    const service = this.services.get(serviceId);
    service.failures = 0;
    service.successes = 0;
    service.failureHistory = [];
    
    this.transitionToClosed(serviceId);
  }
  
  /**
   * Récupère les statistiques d'un service
   * @param {string} serviceId - Identifiant du service
   * @returns {Object} - Statistiques du service
   */
  getServiceStats(serviceId) {
    if (!this.services.has(serviceId)) {
      throw new Error(`Service ${serviceId} not registered with circuit breaker`);
    }
    
    const service = this.services.get(serviceId);
    
    return {
      serviceId,
      state: service.state,
      failures: service.failures,
      successes: service.successes,
      totalRequests: service.totalRequests,
      failedRequests: service.failedRequests,
      failureRate: service.totalRequests > 0 
        ? (service.failedRequests / service.totalRequests) * 100 
        : 0,
      lastFailure: service.lastFailure,
      lastSuccess: service.lastSuccess,
      openSince: service.openSince,
      failureThreshold: service.options.failureThreshold,
      resetTimeout: service.options.resetTimeout,
      halfOpenSuccessThreshold: service.options.halfOpenSuccessThreshold
    };
  }
  
  /**
   * Récupère les statistiques de tous les services
   * @returns {Object} - Statistiques de tous les services
   */
  getAllServiceStats() {
    const stats = {};
    
    for (const [serviceId, _] of this.services.entries()) {
      stats[serviceId] = this.getServiceStats(serviceId);
    }
    
    return stats;
  }
  
  /**
   * Démarre la surveillance
   */
  startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(() => {
      this.monitorCircuits();
    }, this.options.monitorInterval);
  }
  
  /**
   * Surveille les circuits
   */
  monitorCircuits() {
    for (const [serviceId, service] of this.services.entries()) {
      // Vérifier si un circuit ouvert peut passer en half-open
      if (service.state === 'open') {
        const openFor = Date.now() - service.openSince;
        
        if (openFor >= service.options.resetTimeout) {
          this.transitionToHalfOpen(serviceId);
        }
      }
      
      // Nettoyer l'historique des échecs
      const timeWindow = service.options.timeWindow;
      const cutoff = Date.now() - timeWindow;
      const oldFailureCount = service.failureHistory.length;
      
      service.failureHistory = service.failureHistory.filter(
        failure => failure.timestamp >= cutoff
      );
      
      // Mettre à jour le compteur d'échecs
      if (service.failureHistory.length !== oldFailureCount) {
        service.failures = service.failureHistory.length;
      }
    }
  }
  
  /**
   * Arrête la surveillance
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
  
  /**
   * Émet un événement
   * @param {string} serviceId - Identifiant du service
   * @param {string} eventType - Type d'événement
   * @param {Object} data - Données de l'événement
   */
  emitEvent(serviceId, eventType, data) {
    // Cette méthode pourrait être étendue pour intégrer
    // un mécanisme d'événements complet (EventEmitter, etc.)
    console.log(`[CircuitBreaker][${serviceId}] Event: ${eventType}`, data);
    
    // Exemple d'intégration avec un système d'événements
    if (global.eventEmitter) {
      global.eventEmitter.emit(`circuit_breaker_${eventType}`, {
        serviceId,
        ...data,
        timestamp: Date.now()
      });
    }
  }
}

/**
 * Erreur spécifique lorsque le circuit est ouvert
 */
class CircuitOpenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitOpenError';
    this.code = 'CIRCUIT_OPEN';
  }
}

// Exemple d'utilisation :

// 1. Créer une instance du circuit breaker
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 15000
});

// 2. Enregistrer les services
circuitBreaker.registerService('blockchain', {
  failureThreshold: 5,   // Plus tolérant pour blockchain
  resetTimeout: 60000    // Plus long délai pour blockchain
});

circuitBreaker.registerService('database', {
  failureThreshold: 3,
  resetTimeout: 10000
});

// 3. Utiliser dans les services

// Exemple: Wrapper blockchain service
async function sendBlockchainTransaction(txData) {
  return circuitBreaker.execute('blockchain', async () => {
    // Envoyer la transaction blockchain
    const result = await blockchainService.sendTransaction(txData);
    return result;
  });
}

// Exemple: Wrapper database service
async function saveToDatabase(data) {
  return circuitBreaker.execute('database', async () => {
    // Sauvegarder dans la base de données
    const result = await db.save(data);
    return result;
  });
}
```

## 4. Système de gestion en lots pour optimiser les transactions blockchain

```javascript
// Ajout dans un nouveau fichier blockchain-batch-service.js

/**
 * Service de traitement par lots des transactions blockchain pour optimisation
 */
class BlockchainBatchService {
  constructor(blockchainService, options = {}) {
    this.blockchainService = blockchainService;
    
    this.options = {
      maxBatchSize: options.maxBatchSize || 50,         // Nombre maximum de transactions par lot
      batchInterval: options.batchInterval || 30000,    // Intervalle de traitement par défaut (ms)
      priorityLevels: options.priorityLevels || ['high', 'medium', 'low'],
      priorityIntervals: options.priorityIntervals || {
        high: 10000,    // 10 secondes
        medium: 30000,  // 30 secondes
        low: 60000      // 1 minute
      },
      gasMultiplier: options.gasMultiplier || 1.1,      // Multiplicateur de gas pour les transactions prioritaires
      maxRetries: options.maxRetries || 3
    };
    
    // Files d'attente par priorité
    this.queues = {};
    this.options.priorityLevels.forEach(level => {
      this.queues[level] = [];
    });
    
    // État des lots
    this.batchTimers = {};
    this.options.priorityLevels.forEach(level => {
      this.batchTimers[level] = null;
    });
    
    // Métriques
    this.metrics = {
      totalProcessed: 0,
      totalSubmitted: 0,
      successRate: 0,
      batchesProcessed: 0,
      averageBatchSize: 0,
      processingTimes: []
    };
    
    // Démarrer le traitement par lots
    this.startBatchProcessing();
  }
  
  /**
   * Démarre le traitement par lots pour toutes les priorités
   */
  startBatchProcessing() {
    this.options.priorityLevels.forEach(level => {
      this.scheduleNextBatch(level);
    });
  }
  
  /**
   * Planifie le prochain lot pour une priorité donnée
   * @param {string} priority - Niveau de priorité
   */
  scheduleNextBatch(priority) {
    // Annuler le timer existant si présent
    if (this.batchTimers[priority]) {
      clearTimeout(this.batchTimers[priority]);
    }
    
    // Planifier le prochain traitement par lot
    const interval = this.options.priorityIntervals[priority] || this.options.batchInterval;
    
    this.batchTimers[priority] = setTimeout(() => {
      this.processBatch(priority)
        .catch(error => console.error(`Error processing ${priority} batch:`, error))
        .finally(() => {
          this.scheduleNextBatch(priority);
        });
    }, interval);
  }
  
  /**
   * Traite un lot de transactions pour une priorité donnée
   * @param {string} priority - Niveau de priorité
   * @returns {Promise<Array>} - Résultats du traitement
   */
  async processBatch(priority) {
    const queue = this.queues[priority];
    
    if (queue.length === 0) {
      return []; // Rien à traiter
    }
    
    const batchSize = Math.min(queue.length, this.options.maxBatchSize);
    const batch = queue.splice(0, batchSize);
    
    console.log(`Processing ${batch.length} transactions in ${priority} batch`);
    
    const startTime = Date.now();
    const batchResults = [];
    
    // Traiter le lot de transactions
    try {
      // Pour les transactions qui peuvent être regroupées (comme mintBatch, transferBatch, etc.)
      const batchableTransactions = this.groupBatchableTransactions(batch);
      
      // Traiter les transactions regroupables
      for (const [type, transactions] of Object.entries(batchableTransactions)) {
        if (transactions.length > 0) {
          const result = await this.processBatchableTransactions(type, transactions, priority);
          batchResults.push(...result);
        }
      }
      
      // Traiter les transactions individuelles restantes
      const individualTransactions = batch.filter(tx => 
        !batchableTransactions[tx.type] || !batchableTransactions[tx.type].includes(tx)
      );
      
      // Traitement parallèle des transactions individuelles (avec limite de concurrence)
      const concurrencyLimit = 5;
      for (let i = 0; i < individualTransactions.length; i += concurrencyLimit) {
        const chunk = individualTransactions.slice(i, i + concurrencyLimit);
        const results = await Promise.all(
          chunk.map(tx => this.processIndividualTransaction(tx, priority))
        );
        batchResults.push(...results);
      }
      
      // Mettre à jour les métriques
      const endTime = Date.now();
      this.updateMetrics(batch.length, batchResults, endTime - startTime);
      
      return batchResults;
    } catch (error) {
      console.error(`Error processing ${priority} batch:`, error);
      
      // En cas d'erreur, remettre les transactions dans la file
      this.requeueFailedTransactions(batch);
      
      throw error;
    }
  }
  
  /**
   * Regroupe les transactions qui peuvent être traitées en lot
   * @param {Array} transactions - Transactions à regrouper
   * @returns {Object} - Transactions regroupées par type
   */
  groupBatchableTransactions(transactions) {
    const batchable = {};
    
    // Types de transactions supportant le traitement par lots
    const batchableTypes = ['mint', 'transfer', 'approve'];
    
    // Regrouper par type
    for (const tx of transactions) {
      if (batchableTypes.includes(tx.type)) {
        if (!batchable[tx.type]) {
          batchable[tx.type] = [];
        }
        batchable[tx.type].push(tx);
      }
    }
    
    return batchable;
  }
  
  /**
   * Traite un groupe de transactions batchables
   * @param {string} type - Type de transaction
   * @param {Array} transactions - Transactions à traiter
   * @param {string} priority - Niveau de priorité
   * @returns {Promise<Array>} - Résultats du traitement
   */
  async processBatchableTransactions(type, transactions, priority) {
    try {
      console.log(`Processing ${transactions.length} ${type} transactions as batch`);
      
      let result;
      
      // Appeler la méthode appropriée selon le type
      switch (type) {
        case 'mint':
          result = await this.blockchainService.batchMintNFT(
            transactions.map(tx => ({
              to: tx.data.to,
              tokenURI: tx.data.tokenURI,
              tokenId: tx.data.tokenId
            })),
            this.getTransactionOptions(priority)
          );
          break;
          
        case 'transfer':
          result = await this.blockchainService.batchTransferNFT(
            transactions.map(tx => ({
              from: tx.data.from,
              to: tx.data.to,
              tokenId: tx.data.tokenId
            })),
            this.getTransactionOptions(priority)
          );
          break;
          
        case 'approve':
          result = await this.blockchainService.batchApprove(
            transactions.map(tx => ({
              spender: tx.data.spender,
              tokenId: tx.data.tokenId
            })),
            this.getTransactionOptions(priority)
          );
          break;
          
        default:
          throw new Error(`Unsupported batch transaction type: ${type}`);
      }
      
      // Créer un résultat pour chaque transaction
      return transactions.map((tx, index) => ({
        txId: tx.id,
        success: true,
        result: {
          txHash: result.txHash,
          batchIndex: index,
          events: result.events?.filter(e => e.tokenId === tx.data.tokenId) || []
        }
      }));
    } catch (error) {
      console.error(`Error processing batch ${type} transactions:`, error);
      
      // En cas d'erreur, marquer toutes les transactions comme échouées
      return transactions.map(tx => ({
        txId: tx.id,
        success: false,
        error: {
          message: error.message,
          code: error.code || 'BATCH_ERROR'
        }
      }));
    }
  }
  
  /**
   * Traite une transaction individuelle
   * @param {Object} transaction - Transaction à traiter
   * @param {string} priority - Niveau de priorité
   * @returns {Promise<Object>} - Résultat du traitement
   */
  async processIndividualTransaction(transaction, priority) {
    try {
      let result;
      
      // Appeler la méthode appropriée selon le type
      switch (transaction.type) {
        case 'mint':
          result = await this.blockchainService.mintNFT(
            transaction.data.to,
            transaction.data.tokenURI,
            transaction.data.tokenId,
            this.getTransactionOptions(priority)
          );
          break;
          
        case 'transfer':
          result = await this.blockchainService.transferNFT(
            transaction.data.from,
            transaction.data.to,
            transaction.data.tokenId,
            this.getTransactionOptions(priority)
          );
          break;
          
        case 'approve':
          result = await this.blockchainService.approve(
            transaction.data.spender,
            transaction.data.tokenId,
            this.getTransactionOptions(priority)
          );
          break;
          
        default:
          // Pour les types non reconnus, essayer d'appeler dynamiquement la méthode
          const methodName = transaction.type.charAt(0).toLowerCase() + transaction.type.slice(1);
          if (typeof this.blockchainService[methodName] === 'function') {
            result = await this.blockchainService[methodName](
              ...Object.values(transaction.data),
              this.getTransactionOptions(priority)
            );
          } else {
            throw new Error(`Unsupported transaction type: ${transaction.type}`);
          }
      }
      
      return {
        txId: transaction.id,
        success: true,
        result
      };
    } catch (error) {
      console.error(`Error processing transaction ${transaction.id}:`, error);
      
      return {
        txId: transaction.id,
        success: false,
        error: {
          message: error.message,
          code: error.code || 'TRANSACTION_ERROR'
        }
      };
    }
  }
  
  /**
   * Remet en file d'attente les transactions échouées
   * @param {Array} transactions - Transactions à remettre en file
   */
  requeueFailedTransactions(transactions) {
    for (const tx of transactions) {
      if (tx.retryCount === undefined) {
        tx.retryCount = 0;
      }
      
      tx.retryCount++;
      
      if (tx.retryCount <= this.options.maxRetries) {
        // Remettre en file avec la même priorité
        this.queueTransaction(tx, tx.priority, true);
      } else {
        // Trop de tentatives, notifier l'échec
        console.error(`Transaction ${tx.id} failed after ${tx.retryCount} attempts`);
        
        // Notifier l'échec à un callback si défini
        if (tx.onFailure && typeof tx.onFailure === 'function') {
          try {
            tx.onFailure({
              txId: tx.id,
              error: new Error(`Maximum retry attempts (${this.options.maxRetries}) exceeded`),
              attemptsMade: tx.retryCount
            });
          } catch (e) {
            console.error('Error calling failure callback:', e);
          }
        }
      }
    }
  }
  
  /**
   * Met à jour les métriques après le traitement d'un lot
   * @param {number} batchSize - Taille du lot
   * @param {Array} results - Résultats du traitement
   * @param {number} processingTime - Temps de traitement (ms)
   */
  updateMetrics(batchSize, results, processingTime) {
    const successful = results.filter(r => r.success).length;
    
    this.metrics.totalProcessed += batchSize;
    this.metrics.totalSubmitted += successful;
    this.metrics.successRate = this.metrics.totalProcessed > 0 
      ? (this.metrics.totalSubmitted / this.metrics.totalProcessed) * 100 
      : 0;
    this.metrics.batchesProcessed++;
    this.metrics.averageBatchSize = this.metrics.totalProcessed / this.metrics.batchesProcessed;
    
    // Garder les 10 derniers temps de traitement pour la moyenne mobile
    this.metrics.processingTimes.push(processingTime);
    if (this.metrics.processingTimes.length > 10) {
      this.metrics.processingTimes.shift();
    }
  }
  
  /**
   * Récupère les options de transaction en fonction de la priorité
   * @param {string} priority - Niveau de priorité
   * @returns {Object} - Options de transaction
   */
  getTransactionOptions(priority) {
    const baseOptions = {
      nonce: undefined, // Sera déterminé par le service blockchain
      gasLimit: undefined // Sera estimé par le service blockchain
    };
    
    // Appliquer des multiplicateurs de gas selon la priorité
    switch (priority) {
      case 'high':
        return {
          ...baseOptions,
          gasMultiplier: this.options.gasMultiplier * 1.5
        };
        
      case 'medium':
        return {
          ...baseOptions,
          gasMultiplier: this.options.gasMultiplier * 1.2
        };
        
      case 'low':
      default:
        return {
          ...baseOptions,
          gasMultiplier: this.options.gasMultiplier
        };
    }
  }
  
  /**
   * Ajoute une transaction à la file d'attente
   * @param {Object} transaction - Transaction à ajouter
   * @param {string} priority - Niveau de priorité (high, medium, low)
   * @param {boolean} isRetry - Si c'est une retentative
   * @returns {Promise<Object>} - Information sur la mise en file
   */
  queueTransaction(transaction, priority = 'medium', isRetry = false) {
    // Vérifier que la priorité est valide
    if (!this.options.priorityLevels.includes(priority)) {
      priority = 'medium'; // Priorité par défaut si invalide
    }
    
    // Assigner un ID unique si pas déjà présent
    if (!transaction.id) {
      transaction.id = this.generateTransactionId();
    }
    
    // Assigner la priorité et timestamp
    transaction.priority = priority;
    
    if (!isRetry) {
      transaction.queuedAt = Date.now();
      transaction.retryCount = 0;
    }
    
    // Ajouter à la file appropriée
    this.queues[priority].push(transaction);
    
    // Si le lot est suffisamment grand et que la priorité est élevée, traiter immédiatement
    if (priority === 'high' && this.queues[priority].length >= Math.ceil(this.options.maxBatchSize / 2)) {
      clearTimeout(this.batchTimers[priority]);
      this.batchTimers[priority] = setTimeout(() => {
        this.processBatch(priority)
          .catch(error => console.error(`Error processing priority batch:`, error))
          .finally(() => {
            this.scheduleNextBatch(priority);
          });
      }, 1000); // Traiter rapidement (1 seconde)
    }
    
    return {
      txId: transaction.id,
      priority,
      queuedAt: transaction.queuedAt,
      positionInQueue: this.queues[priority].length,
      estimatedProcessingTime: this.getEstimatedProcessingTime(priority)
    };
  }
  
  /**
   * Estime le temps de traitement pour une priorité donnée
   * @param {string} priority - Niveau de priorité
   * @returns {number} - Temps estimé en ms
   */
  getEstimatedProcessingTime(priority) {
    const queueLength = this.queues[priority].length;
    const batchSize = this.options.maxBatchSize;
    const interval = this.options.priorityIntervals[priority];
    
    // Nombre de lots nécessaires
    const batchesNeeded = Math.ceil(queueLength / batchSize);
    
    // Si aucun traitement précédent, utiliser l'intervalle comme estimation
    if (this.metrics.processingTimes.length === 0) {
      return interval * batchesNeeded;
    }
    
    // Calculer le temps moyen de traitement
    const avgProcessingTime = this.metrics.processingTimes.reduce((sum, time) => sum + time, 0) / 
      this.metrics.processingTimes.length;
    
    return (interval + avgProcessingTime) * batchesNeeded;
  }
  
  /**
   * Génère un ID unique pour une transaction
   * @returns {string} - ID de transaction
   */
  generateTransactionId() {
    return `tx-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }
  
  /**
   * Récupère les statistiques de la file d'attente
   * @returns {Object} - Statistiques
   */
  getQueueStats() {
    const queueStats = {};
    
    this.options.priorityLevels.forEach(level => {
      queueStats[level] = {
        queueLength: this.queues[level].length,
        oldestTransaction: this.queues[level].length > 0 
          ? this.queues[level][0].queuedAt 
          : null,
        estimatedProcessingTime: this.getEstimatedProcessingTime(level)
      };
    });
    
    return {
      queues: queueStats,
      metrics: { ...this.metrics },
      averageProcessingTime: this.metrics.processingTimes.length > 0
        ? this.metrics.processingTimes.reduce((sum, time) => sum + time, 0) / this.metrics.processingTimes.length
        : null
    };
  }
  
  /**
   * Force le traitement immédiat d'une file d'attente
   * @param {string} priority - Niveau de priorité
   * @returns {Promise<Array>} - Résultats du traitement
   */
  async forceProcessQueue(priority) {
    if (!this.options.priorityLevels.includes(priority)) {
      throw new Error(`Invalid priority level: ${priority}`);
    }
    
    // Annuler le timer existant
    if (this.batchTimers[priority]) {
      clearTimeout(this.batchTimers[priority]);
      this.batchTimers[priority] = null;
    }
    
    // Traiter la file immédiatement
    const results = await this.processBatch(priority);
    
    // Reprogrammer le prochain traitement
    this.scheduleNextBatch(priority);
    
    return results;
  }
  
  /**
   * Arrête le service de traitement par lots
   */
  stop() {
    // Annuler tous les timers
    this.options.priorityLevels.forEach(level => {
      if (this.batchTimers[level]) {
        clearTimeout(this.batchTimers[level]);
        this.batchTimers[level] = null;
      }
    });
    
    console.log('Blockchain Batch Service stopped');
  }
}

// Exemple d'utilisation

// Initialiser le service
const batchService = new BlockchainBatchService(blockchainService, {
  maxBatchSize: 50,
  priorityIntervals: {
    high: 5000,    // 5 secondes
    medium: 20000,  // 20 secondes
    low: 60000      // 1 minute
  }
});

// Ajouter des transactions
batchService.queueTransaction({
  type: 'mint',
  data: {
    to: '0x123...',
    tokenURI: 'ipfs://...',
    tokenId: 'token-123'
  },
  onSuccess: (result) => console.log('Transaction succeeded:', result),
  onFailure: (error) => console.error('Transaction failed:', error)
}, 'high');
```

## 5. Synchronisation multi-niveaux pour la cohérence des données

```javascript
// Ajout dans un nouveau fichier data-synchronization-service.js

/**
 * Service de synchronisation des données entre blockchain et base de données
 */
class DataSynchronizationService {
  constructor(blockchainService, databaseService, options = {}) {
    this.blockchainService = blockchainService;
    this.databaseService = databaseService;
    
    this.options = {
      syncInterval: options.syncInterval || 300000,        // 5 minutes par défaut
      maxRetries: options.maxRetries || 3,                 // Nombre maximum de tentatives
      batchSize: options.batchSize || 100,                 // Taille des lots pour la synchronisation
      conflictResolutionStrategy: options.conflictResolutionStrategy || 'blockchain', // blockchain ou database
      entityTypes: options.entityTypes || ['nft', 'auction', 'treasury', 'user'],
      logLevel: options.logLevel || 'info'                 // debug, info, warn, error
    };
    
    // État de la synchronisation
    this.syncState = {
      lastSync: {},
      inProgress: {},
      stats: {},
      errors: {}
    };
    
    // Initialiser l'état pour chaque type d'entité
    this.options.entityTypes.forEach(type => {
      this.syncState.lastSync[type] = null;
      this.syncState.inProgress[type] = false;
      this.syncState.stats[type] = {
        totalSynced: 0,
        totalConflicts: 0,
        totalErrors: 0,
        lastSyncDuration: 0
      };
      this.syncState.errors[type] = [];
    });
    
    // Files d'attente pour les opérations de synchronisation
    this.syncQueues = {};
    this.options.entityTypes.forEach(type => {
      this.syncQueues[type] = [];
    });
    
    // Programmateur
    this.syncTimers = {};
  }
  
  /**
   * Démarre le service de synchronisation
   */
  start() {
    this.log('info', 'Starting data synchronization service');
    
    // Démarrer les synchronisations périodiques pour chaque type d'entité
    this.options.entityTypes.forEach(type => {
      this.scheduleNextSync(type);
    });
    
    // Synchronisation initiale
    this.performInitialSync();
  }
  
  /**
   * Effectue une synchronisation initiale
   */
  async performInitialSync() {
    this.log('info', 'Performing initial synchronization');
    
    try {
      // Synchroniser les entités critiques en premier (dans l'ordre)
      for (const type of ['treasury', 'nft', 'auction', 'user']) {
        if (this.options.entityTypes.includes(type)) {
          await this.syncEntityType(type, true);
        }
      }
      
      this.log('info', 'Initial synchronization completed');
    } catch (error) {
      this.log('error', 'Error during initial synchronization:', error);
    }
  }
  
  /**
   * Planifie la prochaine synchronisation pour un type d'entité
   * @param {string} entityType - Type d'entité à synchroniser
   */
  scheduleNextSync(entityType) {
    if (this.syncTimers[entityType]) {
      clearTimeout(this.syncTimers[entityType]);
    }
    
    this.syncTimers[entityType] = setTimeout(() => {
      this.syncEntityType(entityType)
        .catch(error => this.log('error', `Error synchronizing ${entityType}:`, error))
        .finally(() => {
          this.scheduleNextSync(entityType);
        });
    }, this.options.syncInterval);
    
    this.log('debug', `Next ${entityType} sync scheduled in ${this.options.syncInterval}ms`);
  }
  
  /**
   * Synchronise un type d'entité spécifique
   * @param {string} entityType - Type d'entité à synchroniser
   * @param {boolean} isInitial - Si c'est une synchronisation initiale
   * @returns {Promise<Object>} - Résultats de la synchronisation
   */
  async syncEntityType(entityType, isInitial = false) {
    // Vérifier si une synchronisation est déjà en cours
    if (this.syncState.inProgress[entityType]) {
      this.log('debug', `Synchronization already in progress for ${entityType}`);
      return { success: false, reason: 'sync_in_progress' };
    }
    
    this.syncState.inProgress[entityType] = true;
    const startTime = Date.now();
    
    try {
      this.log('info', `Starting ${isInitial ? 'initial ' : ''}synchronization for ${entityType}`);
      
      // Récupérer la dernière mise à jour connue
      const lastUpdate = this.syncState.lastSync[entityType];
      
      // Synchroniser selon le type d'entité
      let syncResult;
      
      switch (entityType) {
        case 'nft':
          syncResult = await this.syncNFTs(lastUpdate, isInitial);
          break;
          
        case 'auction':
          syncResult = await this.syncAuctions(lastUpdate, isInitial);
          break;
          
        case 'treasury':
          syncResult = await this.syncTreasury(lastUpdate, isInitial);
          break;
          
        case 'user':
          syncResult = await this.syncUsers(lastUpdate, isInitial);
          break;
          
        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }
      
      // Mettre à jour les statistiques
      const endTime = Date.now();
      this.updateSyncStats(entityType, syncResult, endTime - startTime);
      
      // Mettre à jour la dernière synchronisation
      this.syncState.lastSync[entityType] = new Date();
      
      return syncResult;
    } catch (error) {
      this.log('error', `Error during ${entityType} synchronization:`, error);
      
      // Ajouter l'erreur à l'historique
      this.syncState.errors[entityType].push({
        timestamp: new Date(),
        error: error.message,
        stack: error.stack
      });
      
      // Limiter la taille de l'historique d'erreurs
      if (this.syncState.errors[entityType].length > 10) {
        this.syncState.errors[entityType].shift();
      }
      
      // Mettre à jour les statistiques
      this.syncState.stats[entityType].totalErrors++;
      
      throw error;
    } finally {
      this.syncState.inProgress[entityType] = false;
    }
  }
  
  /**
   * Synchronise les NFTs entre la blockchain et la base de données
   * @param {Date} lastUpdate - Dernière mise à jour
   * @param {boolean} isInitial - Si c'est une synchronisation initiale
   * @returns {Promise<Object>} - Résultats de la synchronisation
   */
  async syncNFTs(lastUpdate, isInitial) {
    const result = {
      synced: 0,
      conflicts: 0,
      errors: 0,
      newItems: 0,
      updatedItems: 0,
      details: []
    };
    
    try {
      // Étape 1: Récupérer les NFTs depuis la blockchain
      let blockchainNFTs = [];
      let continuation = null;
      
      do {
        const response = await this.blockchainService.getNFTs(
          this.options.batchSize,
          continuation,
          lastUpdate
        );
        
        blockchainNFTs = blockchainNFTs.concat(response.items);
        continuation = response.continuation;
        
        // Si c'est une synchronisation initiale et qu'il y a beaucoup de NFTs,
        // traiter par lots pour éviter de surcharger la mémoire
        if (isInitial && blockchainNFTs.length >= this.options.batchSize) {
          await this.processNFTBatch(blockchainNFTs, result);
          blockchainNFTs = []; // Vider le tableau après traitement
        }
      } while (continuation);
      
      // Traiter les NFTs restants
      if (blockchainNFTs.length > 0) {
        await this.processNFTBatch(blockchainNFTs, result);
      }
      
      // Étape 2: Si ce n'est pas une synchronisation initiale, vérifier les NFTs en base de données
      // qui pourraient ne plus exister sur la blockchain
      if (!isInitial) {
        const databaseOnlyNFTs = await this.findDatabaseOnlyNFTs(blockchainNFTs.map(nft => nft.tokenId));
        
        for (const nft of databaseOnlyNFTs) {
          try {
            // Vérifier si le NFT existe vraiment sur la blockchain
            const exists = await this.blockchainService.nftExists(nft.tokenId);
            
            if (!exists) {
              // Le NFT n'existe plus sur la blockchain
              await this.databaseService.markNFTAsDeleted(nft.tokenId);
              result.synced++;
              result.details.push({
                tokenId: nft.tokenId,
                action: 'marked_deleted',
                success: true
              });
            }
          } catch (error) {
            result.errors++;
            result.details.push({
              tokenId: nft.tokenId,
              action: 'check_existence',
              success: false,
              error: error.message
            });
          }
        }
      }
      
      return result;
    } catch (error) {
      this.log('error', 'Error synchronizing NFTs:', error);
      throw error;
    }
  }
  
  /**
   * Traite un lot de NFTs pour synchronisation
   * @param {Array} nfts - Liste de NFTs à traiter
   * @param {Object} result - Résultat cumulatif
   */
  async processNFTBatch(nfts, result) {
    for (const nft of nfts) {
      try {
        // Vérifier si le NFT existe déjà en base de données
        const existingNFT = await this.databaseService.getNFT(nft.tokenId);
        
        if (!existingNFT) {
          // Nouveau NFT, l'ajouter à la base de données
          await this.databaseService.saveNFT(nft);
          result.synced++;
          result.newItems++;
          result.details.push({
            tokenId: nft.tokenId,
            action: 'created',
            success: true
          });
        } else {
          // NFT existant, vérifier s'il y a des différences
          if (this.hasNFTChanges(existingNFT, nft)) {
            // Différences détectées, résoudre le conflit
            await this.resolveNFTConflict(existingNFT, nft);
            result.synced++;
            result.updatedItems++;
            result.conflicts++;
            result.details.push({
              tokenId: nft.tokenId,
              action: 'updated',
              success: true,
              hadConflict: true
            });
          }
        }
      } catch (error) {
        result.errors++;
        result.details.push({
          tokenId: nft.tokenId || 'unknown',
          action: 'sync',
          success: false,
          error: error.message
        });
      }
    }
  }
  
  /**
   * Vérifie si un NFT a des changements entre la base de données et la blockchain
   * @param {Object} dbNFT - NFT en base de données
   * @param {Object} blockchainNFT - NFT sur la blockchain
   * @returns {boolean} - Vrai s'il y a des différences
   */
  hasNFTChanges(dbNFT, blockchainNFT) {
    // Comparer les champs pertinents
    return dbNFT.owner !== blockchainNFT.owner ||
           dbNFT.tokenURI !== blockchainNFT.tokenURI ||
           dbNFT.isApproved !== blockchainNFT.isApproved ||
           dbNFT.metadataHash !== blockchainNFT.metadataHash;
  }
  
  /**
   * Résout un conflit entre un NFT en base de données et sur la blockchain
   * @param {Object} dbNFT - NFT en base de données
   * @param {Object} blockchainNFT - NFT sur la blockchain
   */
  async resolveNFTConflict(dbNFT, blockchainNFT) {
    if (this.options.conflictResolutionStrategy === 'blockchain') {
      // La blockchain est la source de vérité
      await this.databaseService.updateNFT(blockchainNFT.tokenId, blockchainNFT);
    } else {
      // La base de données est la source de vérité, mettre à jour la blockchain
      // Note: Cela nécessite des opérations blockchain qui peuvent échouer
      // Il est généralement plus sûr de considérer la blockchain comme source de vérité
      
      // Vérifier les différences et mettre à jour la blockchain si nécessaire
      if (dbNFT.owner !== blockchainNFT.owner) {
        await this.blockchainService.transferNFT(
          blockchainNFT.owner,
          dbNFT.owner,
          blockchainNFT.tokenId
        );
      }
      
      // D'autres mises à jour selon les besoins...
    }
  }
  
  /**
   * Trouve les NFTs qui existent uniquement dans la base de données
   * @param {Array} blockchainTokenIds - Liste des IDs de tokens sur la blockchain
   * @returns {Promise<Array>} - NFTs uniquement en base de données
   */
  async findDatabaseOnlyNFTs(blockchainTokenIds) {
    // Créer un ensemble pour une recherche plus rapide
    const blockchainTokenIdSet = new Set(blockchainTokenIds);
    
    // Récupérer tous les NFTs de la base de données
    const allDBNFTs = await this.databaseService.getAllNFTs();
    
    // Filtrer ceux qui n'existent pas dans la liste de la blockchain
    return allDBNFTs.filter(nft => !blockchainTokenIdSet.has(nft.tokenId));
  }
  
  /**
   * Synchronise les enchères entre la blockchain et la base de données
   * @param {Date} lastUpdate - Dernière mise à jour
   * @param {boolean} isInitial - Si c'est une synchronisation initiale
   * @returns {Promise<Object>} - Résultats de la synchronisation
   */
  async syncAuctions(lastUpdate, isInitial) {
    // Similaire à syncNFTs mais adapté pour les enchères
    // Implémentation spécifique pour les enchères...
    
    return {
      synced: 0,
      conflicts: 0,
      errors: 0,
      newItems: 0,
      updatedItems: 0,
      details: []
    };
  }
  
  /**
   * Synchronise les données de trésorerie entre la blockchain et la base de données
   * @param {Date} lastUpdate - Dernière mise à jour
   * @param {boolean} isInitial - Si c'est une synchronisation initiale
   * @returns {Promise<Object>} - Résultats de la synchronisation
   */
  async syncTreasury(lastUpdate, isInitial) {
    // Implémentation spécifique pour la trésorerie...
    
    return {
      synced: 0,
      conflicts: 0,
      errors: 0,
      newItems: 0,
      updatedItems: 0,
      details: []
    };
  }
  
  /**
   * Synchronise les données utilisateurs entre la blockchain et la base de données
   * @param {Date} lastUpdate - Dernière mise à jour
   * @param {boolean} isInitial - Si c'est une synchronisation initiale
   * @returns {Promise<Object>} - Résultats de la synchronisation
   */
  async syncUsers(lastUpdate, isInitial) {
    // Implémentation spécifique pour les utilisateurs...
    
    return {
      synced: 0,
      conflicts: 0,
      errors: 0,
      newItems: 0,
      updatedItems: 0,
      details: []
    };
  }
  
  /**
   * Met à jour les statistiques de synchronisation
   * @param {string} entityType - Type d'entité
   * @param {Object} result - Résultat de la synchronisation
   * @param {number} duration - Durée de la synchronisation en ms
   */
  updateSyncStats(entityType, result, duration) {
    const stats = this.syncState.stats[entityType];
    
    stats.totalSynced += result.synced;
    stats.totalConflicts += result.conflicts;
    stats.totalErrors += result.errors;
    stats.lastSyncDuration = duration;
    
    this.log('info', `Synchronization stats for ${entityType}: Synced=${result.synced}, Conflicts=${result.conflicts}, Errors=${result.errors}, Duration=${duration}ms`);
  }
  
  /**
   * Récupère l'état de synchronisation actuel
   * @returns {Object} - État de synchronisation
   */
  getSyncState() {
    return {
      lastSync: { ...this.syncState.lastSync },
      inProgress: { ...this.syncState.inProgress },
      stats: JSON.parse(JSON.stringify(this.syncState.stats)),
      errors: JSON.parse(JSON.stringify(this.syncState.errors))
    };
  }
  
  /**
   * Force une synchronisation immédiate pour un type d'entité
   * @param {string} entityType - Type d'entité
   * @returns {Promise<Object>} - Résultat de la synchronisation
   */
  async forceSyncEntityType(entityType) {
    if (!this.options.entityTypes.includes(entityType)) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    return this.syncEntityType(entityType);
  }
  
  /**
   * Journalise un message avec un niveau spécifique
   * @param {string} level - Niveau de log (debug, info, warn, error)
   * @param {string} message - Message à journaliser
   * @param {*} data - Données supplémentaires
   */
  log(level, message, data) {
    if (['debug', 'info', 'warn', 'error'].indexOf(level) < ['debug', 'info', 'warn', 'error'].indexOf(this.options.logLevel)) {
      return; // Ne pas journaliser si le niveau est inférieur au niveau configuré
    }
    
    const timestamp = new Date().toISOString();
    
    if (data) {
      console[level](`[DataSync][${timestamp}] ${message}`, data);
    } else {
      console[level](`[DataSync][${timestamp}] ${message}`);
    }
  }
  
  /**
   * Arrête le service de synchronisation
   */
  stop() {
    // Annuler tous les timers
    Object.values(this.syncTimers).forEach(timer => {
      if (timer) {
        clearTimeout(timer);
      }
    });
    
    this.syncTimers = {};
    
    this.log('info', 'Data synchronization service stopped');
  }
}
```

## Intégration et déploiement de ces améliorations

Pour intégrer ces améliorations au système Étika existant, je recommande l'approche suivante:

### 1. Planification des dépendances

Certaines améliorations ont des dépendances entre elles. Voici un ordre logique d'implémentation:

1. **Circuit Breaker** - Cette amélioration est fondamentale et devrait être intégrée en premier pour protéger le système pendant l'implémentation des autres améliorations.
2. **DataSynchronizationService** - La synchronisation devrait être mise en place tôt pour assurer la cohérence des données.
3. **BlockchainBatchService** - L'optimisation des transactions blockchain est importante avant d'implémenter les fonctionnalités avancées.
4. **AdaptiveAuctionExperience** et **FraudDetectionService** - Ces services peuvent être implémentés en parallèle après les fondations.

### 2. Tests progressifs

Pour chaque amélioration:

1. Créer une branche dédiée
2. Implémenter la fonctionnalité
3. Développer des tests unitaires et d'intégration
4. Effectuer des tests de charge pour mesurer l'impact sur les performances
5. Merger progressivement dans la branche principale

### 3. Documentation technique

Pour chaque nouvelle amélioration, il convient de documenter:

- Les interfaces et méthodes publiques
- Les configurations disponibles
- Les événements émis par le service
- Les métriques et statistiques exposées
- Les cas d'utilisation typiques

### 4. Métriques de surveillance

Chaque nouveau service devrait exposer des métriques permettant de:

- Mesurer le taux de succès des opérations
- Surveiller les performances
- Détecter les anomalies
- Optimiser les configurations

Ces métriques devraient être intégrées à un tableau de bord global pour le projet.

## Bénéfices attendus

L'implémentation de ces améliorations devrait apporter les bénéfices suivants:

1. **Robustesse accrue** - Le Circuit Breaker et les mécanismes de reprise protègent contre les défaillances en cascade.
2. **Meilleure expérience utilisateur** - L'AdaptiveAuctionExperience adapte l'interface selon le profil de l'utilisateur.
3. **Protection contre la fraude** - Le FraudDetectionService identifie et prévient les comportements suspects.
4. **Optimisation des performances** - Le BlockchainBatchService réduit les coûts et améliore le débit des transactions.
5. **Cohérence des données** - Le DataSynchronizationService assure l'intégrité entre la blockchain et la base de données.

Ces améliorations s'inscrivent naturellement dans l'architecture existante tout en apportant des fonctionnalités avancées qui renforceront considérablement la plateforme Étika.
// auction-system.js
// Système d'enchères pour la phase événementielle d'Étika

const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');

/**
 * Classe principale pour gérer les enchères Étika
 */
class EtikaAuctionSystem {
  constructor(dbProvider, blockchainProvider, adminService) {
    this.db = dbProvider;
    this.blockchain = blockchainProvider;
    this.adminService = adminService;
    this.activeAuctions = new Map();
  }

  /**
   * Crée une nouvelle salle d'enchères
   * @param {Object} auctionData - Données de base pour l'enchère
   * @returns {String} - ID de l'enchère créée
   */
  async createAuction(auctionData) {
    try {
      const auctionId = uuidv4();
      
      const newAuction = {
        id: auctionId,
        category: auctionData.category,
        title: auctionData.title,
        description: auctionData.description,
        startTime: auctionData.startTime,
        endTime: auctionData.endTime,
        startingPrice: auctionData.startingPrice,
        minBidIncrement: auctionData.minBidIncrement || 100,
        status: 'pending', // pending, active, completed, cancelled
        bids: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        adminValidation: false,
        participants: [],
        winningBid: null,
      };
      
      // Vérification et validation des données
      this._validateAuctionData(newAuction);
      
      // Enregistrer dans la base de données
      await this.db.auctions.insert(newAuction);
      
      // Si l'enchère commence immédiatement, l'activer
      if (newAuction.startTime <= Date.now()) {
        await this.activateAuction(auctionId);
      } else {
        // Planifier l'activation automatique
        this._scheduleAuctionActivation(auctionId, newAuction.startTime);
      }
      
      // Notifier les administrateurs pour validation si nécessaire
      await this.adminService.notifyNewAuction(auctionId);
      
      return auctionId;
    } catch (error) {
      console.error("Erreur lors de la création de l'enchère:", error);
      throw new Error(`Échec de création de l'enchère: ${error.message}`);
    }
  }
  
  /**
   * Active une enchère en attente
   * @param {String} auctionId - ID de l'enchère
   */
  async activateAuction(auctionId) {
    const auction = await this.db.auctions.findOne({ id: auctionId });
    if (!auction) throw new Error("Enchère non trouvée");
    
    if (auction.status !== 'pending') {
      throw new Error(`L'enchère ne peut pas être activée depuis l'état: ${auction.status}`);
    }
    
    // Mettre à jour le statut
    await this.db.auctions.update(
      { id: auctionId },
      { $set: { status: 'active', updatedAt: Date.now() } }
    );
    
    // Enregistrer l'enchère active en mémoire pour une gestion rapide
    this.activeAuctions.set(auctionId, {
      ...auction,
      status: 'active',
      updatedAt: Date.now()
    });
    
    // Planifier la finalisation automatique
    this._scheduleAuctionFinalization(auctionId, auction.endTime);
    
    // Émettre un événement
    this._emitAuctionEvent('auction_activated', auctionId);
    
    return true;
  }
  
  /**
   * Soumet une enchère
   * @param {String} auctionId - ID de l'enchère
   * @param {String} bidderId - ID de l'enchérisseur
   * @param {Number} amount - Montant de l'enchère
   * @returns {Object} - Détails de l'enchère placée
   */
  async placeBid(auctionId, bidderId, amount) {
    const auction = await this._getActiveAuction(auctionId);
    
    // Vérifier que l'enchère est active
    if (auction.status !== 'active') {
      throw new Error("Impossible de placer une enchère: l'enchère n'est pas active");
    }
    
    // Vérifier que l'enchère n'est pas terminée
    if (auction.endTime <= Date.now()) {
      throw new Error("Impossible de placer une enchère: l'enchère est terminée");
    }
    
    // Vérifier que le montant est valide
    const highestBid = this._getHighestBid(auction);
    const minimumBid = highestBid 
      ? highestBid.amount + auction.minBidIncrement
      : auction.startingPrice;
    
    if (amount < minimumBid) {
      throw new Error(`L'enchère doit être d'au moins ${minimumBid}`);
    }
    
    // Vérifier la solvabilité de l'enchérisseur
    await this._verifyBidderSolvency(bidderId, amount);
    
    // Créer l'objet d'enchère
    const bid = {
      id: uuidv4(),
      auctionId,
      bidderId,
      amount,
      timestamp: Date.now(),
      status: 'active' // active, cancelled, winning
    };
    
    // Ajouter l'enchère à la base de données
    await this.db.bids.insert(bid);
    
    // Mettre à jour l'enchère
    await this.db.auctions.update(
      { id: auctionId },
      { 
        $push: { bids: bid.id },
        $addToSet: { participants: bidderId },
        $set: { updatedAt: Date.now() }
      }
    );
    
    // Mettre à jour l'enchère en mémoire
    const updatedAuction = await this.db.auctions.findOne({ id: auctionId });
    this.activeAuctions.set(auctionId, updatedAuction);
    
    // Prolonger l'enchère si nécessaire (anti-sniping)
    if (auction.endTime - Date.now() < 300000) { // moins de 5 minutes restantes
      const newEndTime = Date.now() + 300000; // + 5 minutes
      await this._extendAuctionTime(auctionId, newEndTime);
    }
    
    // Émettre un événement
    this._emitAuctionEvent('new_bid', auctionId, { bid });
    
    return bid;
  }
  
  /**
   * Finalise une enchère
   * @param {String} auctionId - ID de l'enchère
   * @returns {Object} - Résultat de la finalisation
   */
  async finalizeAuction(auctionId) {
    const auction = await this._getAuction(auctionId);
    
    if (auction.status !== 'active') {
      throw new Error(`L'enchère ne peut pas être finalisée depuis l'état: ${auction.status}`);
    }
    
    // Trouver l'enchère gagnante
    const allBids = await this._getAllAuctionBids(auctionId);
    const winningBid = allBids.length > 0 
      ? allBids.reduce((highest, current) => 
          current.amount > highest.amount ? current : highest
        )
      : null;
    
    let finalStatus;
    
    if (winningBid) {
      // Marquer l'enchère comme gagnante
      await this.db.bids.update(
        { id: winningBid.id },
        { $set: { status: 'winning' } }
      );
      
      // Transférer les fonds (via smart contract ou système de paiement)
      try {
        await this._processBidPayment(winningBid);
        finalStatus = 'completed';
      } catch (error) {
        console.error("Erreur lors du traitement du paiement:", error);
        finalStatus = 'payment_pending';
      }
    } else {
      finalStatus = 'failed'; // Aucune enchère placée
    }
    
    // Mettre à jour l'enchère
    await this.db.auctions.update(
      { id: auctionId },
      { 
        $set: { 
          status: finalStatus, 
          updatedAt: Date.now(),
          winningBid: winningBid ? winningBid.id : null,
          finalizedAt: Date.now()
        } 
      }
    );
    
    // Retirer l'enchère de la mémoire active
    this.activeAuctions.delete(auctionId);
    
    // Émettre un événement
    this._emitAuctionEvent('auction_finalized', auctionId, {
      finalStatus,
      winningBid: winningBid || null
    });
    
    return {
      auctionId,
      finalStatus,
      winningBid: winningBid || null
    };
  }
  
  /**
   * Récupère les détails d'une enchère
   * @param {String} auctionId - ID de l'enchère
   * @returns {Object} - Détails complets de l'enchère
   */
  async getAuctionDetails(auctionId) {
    const auction = await this._getAuction(auctionId);
    const bids = await this._getAllAuctionBids(auctionId);
    
    const enrichedAuction = {
      ...auction,
      bids: bids.sort((a, b) => b.timestamp - a.timestamp),
      currentHighestBid: bids.length > 0 
        ? bids.reduce((highest, current) => 
            current.amount > highest.amount ? current : highest
          )
        : null,
      timeRemaining: auction.status === 'active' 
        ? Math.max(0, auction.endTime - Date.now()) 
        : 0,
      participantCount: auction.participants.length
    };
    
    return enrichedAuction;
  }
  
  // Méthodes privées d'aide
  
  /**
   * Valide les données d'une enchère
   * @private
   */
  _validateAuctionData(auction) {
    if (!auction.category) throw new Error("La catégorie est requise");
    if (!auction.title) throw new Error("Le titre est requis");
    if (!auction.startTime || !auction.endTime) throw new Error("Les horaires sont requis");
    if (auction.startTime >= auction.endTime) throw new Error("La date de fin doit être ultérieure à la date de début");
    if (auction.startingPrice <= 0) throw new Error("Le prix de départ doit être positif");
    
    // Vérifier que la durée est raisonnable (entre 1h et 30 jours)
    const durationMs = auction.endTime - auction.startTime;
    if (durationMs < 3600000 || durationMs > 2592000000) {
      throw new Error("La durée de l'enchère doit être entre 1 heure et 30 jours");
    }
  }
  
  /**
   * Planifie l'activation automatique d'une enchère
   * @private
   */
  _scheduleAuctionActivation(auctionId, startTime) {
    const delayMs = Math.max(0, startTime - Date.now());
    setTimeout(() => {
      this.activateAuction(auctionId).catch(err => {
        console.error(`Erreur lors de l'activation automatique de l'enchère ${auctionId}:`, err);
      });
    }, delayMs);
  }
  
  /**
   * Planifie la finalisation automatique d'une enchère
   * @private
   */
  _scheduleAuctionFinalization(auctionId, endTime) {
    const delayMs = Math.max(0, endTime - Date.now());
    setTimeout(() => {
      this.finalizeAuction(auctionId).catch(err => {
        console.error(`Erreur lors de la finalisation automatique de l'enchère ${auctionId}:`, err);
      });
    }, delayMs);
  }
  
  /**
   * Récupère une enchère active de la mémoire ou de la base de données
   * @private
   */
  async _getActiveAuction(auctionId) {
    // Essayer d'abord la mémoire pour la performance
    if (this.activeAuctions.has(auctionId)) {
      return this.activeAuctions.get(auctionId);
    }
    
    // Sinon chercher dans la base de données
    const auction = await this.db.auctions.findOne({ id: auctionId });
    if (!auction) throw new Error("Enchère non trouvée");
    
    // Si l'enchère est active, la mettre en cache
    if (auction.status === 'active') {
      this.activeAuctions.set(auctionId, auction);
    }
    
    return auction;
  }
  
  /**
   * Récupère une enchère depuis la base de données
   * @private
   */
  async _getAuction(auctionId) {
    const auction = await this.db.auctions.findOne({ id: auctionId });
    if (!auction) throw new Error("Enchère non trouvée");
    return auction;
  }
  
  /**
   * Récupère toutes les enchères d'une catégorie
   * @private
   */
  async _getAuctionsByCategory(category, status = null) {
    const query = { category };
    if (status) query.status = status;
    return await this.db.auctions.find(query);
  }
  
  /**
   * Récupère l'enchère la plus élevée
   * @private
   */
  _getHighestBid(auction) {
    if (!auction.bids || auction.bids.length === 0) return null;
    
    // Trouve l'ID de l'enchère la plus élevée
    const highestBidId = auction.bids.reduce((highest, current) => {
      return current.amount > highest.amount ? current : highest;
    }).id;
    
    return highestBidId;
  }
  
  /**
   * Récupère toutes les enchères pour une vente aux enchères
   * @private
   */
  async _getAllAuctionBids(auctionId) {
    return await this.db.bids.find({ auctionId });
  }
  
  /**
   * Vérifie la solvabilité d'un enchérisseur
   * @private
   */
  async _verifyBidderSolvency(bidderId, amount) {
    // Implémentation dépendant du système de paiement intégré
    // Peut être une vérification de disponibilité de fonds, de crédit, etc.
    return true; // Simplification pour l'exemple
  }
  
  /**
   * Traite le paiement d'une enchère gagnante
   * @private
   */
  async _processBidPayment(bid) {
    // Implémentation dépendant du système de paiement
    // Pourrait utiliser un smart contract ou un système de paiement traditionnel
    
    // Exemple simplifié avec blockchain
    const paymentTx = await this.blockchain.submitTransaction({
      type: 'payment',
      from: bid.bidderId,
      amount: bid.amount,
      metadata: {
        auctionId: bid.auctionId,
        bidId: bid.id,
        timestamp: Date.now()
      }
    });
    
    return paymentTx;
  }
  
  /**
   * Prolonge la durée d'une enchère
   * @private
   */
  async _extendAuctionTime(auctionId, newEndTime) {
    await this.db.auctions.update(
      { id: auctionId },
      { $set: { endTime: newEndTime, updatedAt: Date.now() } }
    );
    
    // Mettre à jour l'enchère en mémoire
    if (this.activeAuctions.has(auctionId)) {
      const auction = this.activeAuctions.get(auctionId);
      auction.endTime = newEndTime;
      auction.updatedAt = Date.now();
      this.activeAuctions.set(auctionId, auction);
    }
    
    // Replanifier la finalisation
    this._scheduleAuctionFinalization(auctionId, newEndTime);
    
    // Émettre un événement
    this._emitAuctionEvent('auction_extended', auctionId, { newEndTime });
  }
  
  /**
   * Émet un événement d'enchère
   * @private
   */
  _emitAuctionEvent(eventType, auctionId, data = {}) {
    // Implémentation dépendant du système d'événements utilisé
    // Pourrait utiliser WebSockets, Server-Sent Events, etc.
    
    console.log(`[ÉVÉNEMENT] ${eventType} pour l'enchère ${auctionId}:`, data);
  }
}

module.exports = EtikaAuctionSystem;

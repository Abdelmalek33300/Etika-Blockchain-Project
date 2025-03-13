// services/sponsorSelectionService.js
// Service pour gérer la sélection des sponsors par les utilisateurs

const treasuryService = require('./treasuryService');
const { unifiedLoyaltyService } = require('./unifiedLoyaltyService');
const { logError } = require('../utils/errorTracking');
const { Sector } = require('../models/Sector');
const { Company } = require('../models/Company');
const { User } = require('../models/User');
const { TransactionHistory } = require('../models/TransactionHistory');

class SponsorSelectionService {
  /**
   * Récupère la liste des sponsors disponibles pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} - Liste des sponsors disponibles
   */
  async getAvailableSponsors(userId) {
    try {
      // Récupérer les secteurs sponsorisés depuis la caisse commune
      const sponsoredSectors = await treasuryService.getSponsoredSectors();
      
      // Récupérer les préférences de l'utilisateur (historique, favoris, etc.)
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Récupérer l'historique des transactions de l'utilisateur
      const transactions = await TransactionHistory.find({
        userId: userId
      }).sort({ timestamp: -1 }).limit(50);
      
      // Compter les interactions par sponsor
      const sponsorInteractions = {};
      
      for (const transaction of transactions) {
        if (transaction.sponsorId) {
          sponsorInteractions[transaction.sponsorId] = 
            (sponsorInteractions[transaction.sponsorId] || 0) + 1;
        }
      }
      
      // Enrichir les informations des sponsors avec l'historique d'interaction
      const enrichedSponsors = await Promise.all(
        sponsoredSectors.map(async (sector) => {
          // Si pas de sponsor actif, ignorer
          if (!sector.sponsor.active || !sector.sponsor.company) {
            return null;
          }
          
          // Récupérer l'entreprise complète
          const company = await Company.findById(sector.sponsor.company.id);
          
          if (!company) {
            return null;
          }
          
          // Récupérer les détails des offres pour ce sponsor
          const offers = await this._getSponsorOffers(company._id);
          
          return {
            sectorId: sector.sectorId,
            sectorName: sector.name,
            sponsor: {
              id: company._id,
              name: company.name,
              logo: company.logo || null,
              description: company.description || null,
              industry: company.industry || null,
              interactionCount: sponsorInteractions[company._id.toString()] || 0,
              isFavorite: user.favoriteSponsors?.includes(company._id.toString()) || false,
              remainingFunds: sector.sponsor.remainingFunds,
              offers: offers
            }
          };
        })
      );
      
      // Filtrer les secteurs sans sponsor et trier par pertinence
      return enrichedSponsors
        .filter(s => s !== null)
        .sort((a, b) => {
          // Favoris en premier
          if (a.sponsor.isFavorite && !b.sponsor.isFavorite) return -1;
          if (!a.sponsor.isFavorite && b.sponsor.isFavorite) return 1;
          
          // Ensuite, trier par nombre d'interactions
          return b.sponsor.interactionCount - a.sponsor.interactionCount;
        });
    } catch (error) {
      logError('Error getting available sponsors', error);
      throw new Error(`Failed to get available sponsors: ${error.message}`);
    }
  }
  
  /**
   * Récupère les offres disponibles pour un sponsor
   * @param {string} sponsorId - ID du sponsor
   * @returns {Promise<Array>} - Liste des offres
   */
  async _getSponsorOffers(sponsorId) {
    try {
      // Dans une implémentation complète, on récupérerait les offres depuis une base de données
      // Pour l'instant, on renvoie des offres factices
      return [
        {
          id: `offer-${sponsorId}-1`,
          title: "Réduction 10%",
          description: "10% de réduction sur votre prochain achat",
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 jours
        },
        {
          id: `offer-${sponsorId}-2`,
          title: "Livraison gratuite",
          description: "Livraison gratuite sur votre prochaine commande",
          validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // +15 jours
        }
      ];
    } catch (error) {
      logError(`Error getting offers for sponsor ${sponsorId}`, error);
      return [];
    }
  }
  
  /**
   * Utilise les avoirs d'un utilisateur chez un sponsor sélectionné
   * @param {string} userId - ID de l'utilisateur
   * @param {string} userTokenId - ID du token NFT de l'utilisateur
   * @param {string} sectorId - ID du secteur
   * @param {string} sponsorId - ID du sponsor
   * @param {number} amount - Montant à utiliser
   * @param {string} description - Description de la transaction
   * @returns {Promise<Object>} - Résultat de la transaction
   */
  async spendTokenWithSponsor(userId, userTokenId, sectorId, sponsorId, amount, description) {
    try {
      // Vérifier que le secteur existe
      const sector = await Sector.findById(sectorId);
      if (!sector) {
        throw new Error(`Sector ${sectorId} not found`);
      }
      
      // Vérifier que le sponsor existe et est actif pour ce secteur
      const sponsorInfo = await treasuryService.getSponsorInfo(sectorId);
      
      if (!sponsorInfo || !sponsorInfo.active) {
        throw new Error(`No active sponsor for sector ${sectorId}`);
      }
      
      // Vérifier que le sponsor correspond
      const company = await Company.findById(sponsorId);
      
      if (!company || company.walletAddress !== sponsorInfo.sponsorAddress) {
        throw new Error(`Sponsor ${sponsorId} is not the active sponsor for sector ${sectorId}`);
      }
      
      // Vérifier que l'utilisateur a suffisamment d'avoirs
      const tokenDetails = await unifiedLoyaltyService.getCardDetails(userTokenId);
      
      if (!tokenDetails) {
        throw new Error(`Token ${userTokenId} not found`);
      }
      
      const sectorBalance = tokenDetails.balances[sectorId]?.balance || 0;
      
      if (sectorBalance < amount) {
        throw new Error(`Insufficient balance for sector ${sectorId}: ${sectorBalance} < ${amount}`);
      }
      
      // Dépenser les avoirs
      const spendResult = await unifiedLoyaltyService.spendBalance(
        userTokenId,
        sectorId,
        amount,
        company.walletAddress
      );
      
      if (!spendResult.success) {
        throw new Error('Failed to spend balance');
      }
      
      // Enregistrer la transaction dans l'historique
      const transaction = new TransactionHistory({
        userId: userId,
        tokenId: userTokenId,
        sectorId: sectorId,
        sponsorId: sponsorId,
        amount: -amount, // Négatif car c'est une dépense
        description: description || 'Utilisation d\'avoirs',
        transactionType: 'spend',
        timestamp: new Date(),
        txHash: spendResult.txHash
      });
      
      await transaction.save();
      
      return {
        success: true,
        transactionId: transaction._id,
        amount: amount,
        newBalance: sectorBalance - amount,
        txHash: spendResult.txHash
      };
    } catch (error) {
      logError('Error spending token with sponsor', error);
      throw new Error(`Failed to spend token: ${error.message}`);
    }
  }
  
  /**
   * Ajoute un sponsor aux favoris d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} sponsorId - ID du sponsor
   * @returns {Promise<boolean>} - Résultat de l'opération
   */
  async addSponsorToFavorites(userId, sponsorId) {
    try {
      // Vérifier que l'utilisateur existe
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Vérifier que le sponsor existe
      const company = await Company.findById(sponsorId);
      if (!company) {
        throw new Error(`Sponsor ${sponsorId} not found`);
      }
      
      // Initialiser le tableau des favoris si nécessaire
      if (!user.favoriteSponsors) {
        user.favoriteSponsors = [];
      }
      
      // Vérifier si le sponsor est déjà dans les favoris
      if (!user.favoriteSponsors.includes(sponsorId)) {
        user.favoriteSponsors.push(sponsorId);
        await user.save();
      }
      
      return true;
    } catch (error) {
      logError('Error adding sponsor to favorites', error);
      return false;
    }
  }
  
  /**
   * Retire un sponsor des favoris d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} sponsorId - ID du sponsor
   * @returns {Promise<boolean>} - Résultat de l'opération
   */
  async removeSponsorFromFavorites(userId, sponsorId) {
    try {
      // Vérifier que l'utilisateur existe
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Vérifier que le sponsor existe dans les favoris
      if (user.favoriteSponsors && user.favoriteSponsors.includes(sponsorId)) {
        user.favoriteSponsors = user.favoriteSponsors.filter(id => id !== sponsorId);
        await user.save();
      }
      
      return true;
    } catch (error) {
      logError('Error removing sponsor from favorites', error);
      return false;
    }
  }
  
  /**
   * Récupère l'historique des transactions d'un utilisateur avec un sponsor
   * @param {string} userId - ID de l'utilisateur
   * @param {string} sponsorId - ID du sponsor (optionnel)
   * @returns {Promise<Array>} - Historique des transactions
   */
  async getUserSponsorTransactions(userId, sponsorId = null) {
    try {
      // Construire la requête
      const query = { userId: userId };
      
      if (sponsorId) {
        query.sponsorId = sponsorId;
      }
      
      // Récupérer les transactions
      const transactions = await TransactionHistory.find(query)
        .sort({ timestamp: -1 })
        .limit(100);
      
      // Enrichir les transactions avec les noms des sponsors
      const enrichedTransactions = await Promise.all(
        transactions.map(async (tx) => {
          let sponsorName = null;
          
          if (tx.sponsorId) {
            const company = await Company.findById(tx.sponsorId);
            if (company) {
              sponsorName = company.name;
            }
          }
          
          return {
            id: tx._id,
            amount: tx.amount,
            description: tx.description,
            timestamp: tx.timestamp,
            txHash: tx.txHash,
            sponsorId: tx.sponsorId,
            sponsorName: sponsorName,
            sectorId: tx.sectorId,
            transactionType: tx.transactionType
          };
        })
      );
      
      return enrichedTransactions;
    } catch (error) {
      logError('Error getting user-sponsor transactions', error);
      return [];
    }
  }
  
  /**
   * Distribue des avoirs à un utilisateur depuis un sponsor spécifique
   * @param {string} userId - ID de l'utilisateur
   * @param {string} userTokenId - ID du token NFT de l'utilisateur
   * @param {string} sectorId - ID du secteur
   * @param {string} sponsorId - ID du sponsor
   * @param {number} amount - Montant à distribuer
   * @param {string} description - Description de la transaction
   * @returns {Promise<Object>} - Résultat de la transaction
   */
  async distributeAvoirsFromSponsor(userId, userTokenId, sectorId, sponsorId, amount, description) {
    try {
      // Vérifier que le secteur existe
      const sector = await Sector.findById(sectorId);
      if (!sector) {
        throw new Error(`Sector ${sectorId} not found`);
      }
      
      // Vérifier que le sponsor existe et est actif pour ce secteur
      const sponsorInfo = await treasuryService.getSponsorInfo(sectorId);
      
      if (!sponsorInfo || !sponsorInfo.active) {
        throw new Error(`No active sponsor for sector ${sectorId}`);
      }
      
      // Vérifier que le sponsor correspond
      const company = await Company.findById(sponsorId);
      
      if (!company || company.walletAddress !== sponsorInfo.sponsorAddress) {
        throw new Error(`Sponsor ${sponsorId} is not the active sponsor for sector ${sectorId}`);
      }
      
      // Vérifier que la caisse commune a suffisamment de fonds pour ce secteur
      const sectorBalance = await treasuryService.getSectorBalance(sectorId);
      
      if (sectorBalance < amount) {
        throw new Error(`Insufficient treasury balance for sector ${sectorId}: ${sectorBalance} < ${amount}`);
      }
      
      // Distribuer les avoirs
      const distributeResult = await treasuryService.distributeAvoirs(
        sectorId,
        userTokenId,
        amount,
        company.walletAddress
      );
      
      if (!distributeResult.success) {
        throw new Error('Failed to distribute avoirs');
      }
      
      // Enregistrer la transaction dans l'historique
      const transaction = new TransactionHistory({
        userId: userId,
        tokenId: userTokenId,
        sectorId: sectorId,
        sponsorId: sponsorId,
        amount: amount, // Positif car c'est un crédit
        description: description || 'Distribution d\'avoirs',
        transactionType: 'distribute',
        timestamp: new Date(),
        txHash: distributeResult.txHash
      });
      
      await transaction.save();
      
      return {
        success: true,
        transactionId: transaction._id,
        amount: amount,
        txHash: distributeResult.txHash
      };
    } catch (error) {
      logError('Error distributing avoirs from sponsor', error);
      throw new Error(`Failed to distribute avoirs: ${error.message}`);
    }
  }
}

// Exporter une instance unique du service
module.exports = new SponsorSelectionService();

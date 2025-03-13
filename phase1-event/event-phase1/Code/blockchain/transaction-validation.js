// services/transactionValidationService.js
// Service pour valider et sécuriser les transactions liées aux NFT et avoirs

const { ethers } = require('ethers');
const { logError } = require('../utils/errorTracking');
const { getSecureItem } = require('../utils/secureStorage');
const { unifiedLoyaltyService } = require('./unifiedLoyaltyService');
const treasuryService = require('./treasuryService');
const config = require('../config');
const { TransactionHistory } = require('../models/TransactionHistory');
const { User } = require('../models/User');

class TransactionValidationService {
  /**
   * Valide une transaction de dépense d'avoirs
   * @param {string} userId - ID de l'utilisateur
   * @param {string} tokenId - ID du token NFT
   * @param {string} sectorId - ID du secteur
   * @param {string} sponsorAddress - Adresse du sponsor
   * @param {number} amount - Montant de la transaction
   * @returns {Promise<Object>} - Résultat de la validation
   */
  async validateSpendingTransaction(userId, tokenId, sectorId, sponsorAddress, amount) {
    try {
      const validationResults = {
        valid: true,
        errors: []
      };
      
      // 1. Vérifier que l'utilisateur existe
      const user = await User.findById(userId);
      if (!user) {
        validationResults.valid = false;
        validationResults.errors.push('User not found');
        return validationResults;
      }
      
      // 2. Vérifier que le token appartient à l'utilisateur
      const tokenDetails = await unifiedLoyaltyService.getCardDetails(tokenId);
      if (!tokenDetails) {
        validationResults.valid = false;
        validationResults.errors.push('Token not found');
        return validationResults;
      }
      
      if (tokenDetails.owner !== user.walletAddress) {
        validationResults.valid = false;
        validationResults.errors.push('Token does not belong to this user');
        return validationResults;
      }
      
      // 3. Vérifier que le token n'est pas expiré
      if (tokenDetails.expiresAt && new Date(tokenDetails.expiresAt) < new Date()) {
        validationResults.valid = false;
        validationResults.errors.push('Token has expired');
        return validationResults;
      }
      
      // 4. Vérifier que le solde est suffisant
      const sectorBalance = tokenDetails.balances[sectorId]?.balance || 0;
      if (sectorBalance < amount) {
        validationResults.valid = false;
        validationResults.errors.push(`Insufficient balance: ${sectorBalance} < ${amount}`);
        return validationResults;
      }
      
      // 5. Vérifier que le sponsor est actif pour ce secteur
      const sponsorInfo = await treasuryService.getSponsorInfo(sectorId);
      if (!sponsorInfo || !sponsorInfo.active) {
        validationResults.valid = false;
        validationResults.errors.push('No active sponsor for this sector');
        return validationResults;
      }
      
      if (sponsorInfo.sponsorAddress !== sponsorAddress) {
        validationResults.valid = false;
        validationResults.errors.push('Invalid sponsor address for this sector');
        return validationResults;
      }
      
      // 6. Vérifier les limites quotidiennes (si applicables)
      if (tokenDetails.dailySpending) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todaySpending = await TransactionHistory.aggregate([
          {
            $match: {
              userId: userId,
              timestamp: { $gte: today },
              amount: { $lt: 0 } // Seulement les dépenses (valeurs négatives)
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $abs: '$amount' } }
            }
          }
        ]);
        
        const dailyTotal = todaySpending.length > 0 ? todaySpending[0].total : 0;
        
        if (tokenDetails.dailyLimit && dailyTotal + amount > tokenDetails.dailyLimit) {
          validationResults.valid = false;
          validationResults.errors.push(`Daily spending limit exceeded: ${dailyTotal} + ${amount} > ${tokenDetails.dailyLimit}`);
          return validationResults;
        }
      }
      
      return validationResults;
    } catch (error) {
      logError('Error validating spending transaction', error);
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }
  
  /**
   * Valide une transaction de distribution d'avoirs
   * @param {string} sectorId - ID du secteur
   * @param {string} sponsorAddress - Adresse du sponsor
   * @param {number} amount - Montant de la transaction
   * @returns {Promise<Object>} - Résultat de la validation
   */
  async validateDistributionTransaction(sectorId, sponsorAddress, amount) {
    try {
      const validationResults = {
        valid: true,
        errors: []
      };
      
      // 1. Vérifier que le secteur existe et a un sponsor actif
      const sponsorInfo = await treasuryService.getSponsorInfo(sectorId);
      if (!sponsorInfo || !sponsorInfo.active) {
        validationResults.valid = false;
        validationResults.errors.push('No active sponsor for this sector');
        return validationResults;
      }
      
      // 2. Vérifier que l'adresse du sponsor correspond
      if (sponsorInfo.sponsorAddress !== sponsorAddress) {
        validationResults.valid = false;
        validationResults.errors.push('Invalid sponsor address for this sector');
        return validationResults;
      }
      
      // 3. Vérifier que la caisse commune a suffisamment de fonds
      const sectorBalance = await treasuryService.getSectorBalance(sectorId);
      if (sectorBalance < amount) {
        validationResults.valid = false;
        validationResults.errors.push(`Insufficient sector balance: ${sectorBalance} < ${amount}`);
        return validationResults;
      }
      
      // 4. Vérifier que le contrat de sponsoring n'est pas expiré
      if (sponsorInfo.endTime < new Date()) {
        validationResults.valid = false;
        validationResults.errors.push('Sponsorship period has ended');
        return validationResults;
      }
      
      return validationResults;
    } catch (error) {
      logError('Error validating distribution transaction', error);
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }
  
  /**
   * Vérifie la signature d'une transaction
   * @param {Object} transaction - Données de la transaction
   * @param {string} signature - Signature à vérifier
   * @param {string} expectedSigner - Adresse attendue du signataire
   * @returns {boolean} - true si la signature est valide
   */
  verifySignature(transaction, signature, expectedSigner) {
    try {
      // Créer un hachage des données de la transaction
      const transactionString = JSON.stringify(transaction);
      const messageHash = ethers.utils.hashMessage(transactionString);
      
      // Récupérer l'adresse du signataire à partir de la signature
      const recoveredAddress = ethers.utils.recoverAddress(messageHash, signature);
      
      // Vérifier que l'adresse récupérée correspond à l'adresse attendue
      return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
    } catch (error) {
      logError('Error verifying signature', error);
      return false;
    }
  }
  
  /**
   * Signe une transaction avec la clé privée du service
   * @param {Object} transaction - Données de la transaction
   * @returns {Promise<string>} - Signature générée
   */
  async signServiceTransaction(transaction) {
    try {
      // Récupérer la clé privée du service
      const privateKey = await getSecureItem('ETIKA_SERVICE_PRIVATE_KEY');
      
      if (!privateKey) {
        throw new Error('Service private key not found');
      }
      
      // Créer un wallet avec la clé privée
      const wallet = new ethers.Wallet(privateKey);
      
      // Signer le message
      const transactionString = JSON.stringify(transaction);
      const signature = await wallet.signMessage(transactionString);
      
      return signature;
    } catch (error) {
      logError('Error signing service transaction', error);
      throw new Error(`Failed to sign transaction: ${error.message}`);
    }
  }
  
  /**
   * Vérifie et valide une transaction blockchain après son exécution
   * @param {string} txHash - Hash de la transaction
   * @param {string} expectedType - Type de transaction attendu
   * @param {Object} expectedData - Données attendues dans la transaction
   * @returns {Promise<boolean>} - true si la transaction est valide
   */
  async verifyBlockchainTransaction(txHash, expectedType, expectedData) {
    try {
      // Créer un fournisseur pour accéder à la blockchain
      const provider = new ethers.providers.JsonRpcProvider(config.POLYGON_RPC_URL);
      
      // Récupérer les détails de la transaction
      const transaction = await provider.getTransaction(txHash);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      // Récupérer le reçu de la transaction
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }
      
      // Vérifier que la transaction a réussi
      if (receipt.status !== 1) {
        throw new Error('Transaction failed');
      }
      
      // Vérifier le destinataire en fonction du type de transaction
      switch (expectedType) {
        case 'spendBalance':
          // Vérifier que la transaction est bien adressée au contrat de loyauté
          if (transaction.to.toLowerCase() !== config.ENHANCED_LOYALTY_NFT_CONTRACT_ADDRESS.toLowerCase()) {
            throw new Error('Invalid transaction recipient for spendBalance');
          }
          break;
          
        case 'distributeAvoirs':
          // Vérifier que la transaction est bien adressée au contrat de trésorerie
          if (transaction.to.toLowerCase() !== config.SPONSOR_TREASURY_CONTRACT_ADDRESS.toLowerCase()) {
            throw new Error('Invalid transaction recipient for distributeAvoirs');
          }
          break;
          
        default:
          throw new Error(`Unknown transaction type: ${expectedType}`);
      }
      
      // Pour une vérification plus approfondie, on pourrait :
      // 1. Décoder les données de la transaction pour extraire les paramètres
      // 2. Comparer ces paramètres avec expectedData
      // 3. Vérifier les événements émis par la transaction
      
      // Cette partie nécessiterait l'ABI des contrats et une analyse plus poussée
      
      return true;
    } catch (error) {
      logError(`Error verifying blockchain transaction ${txHash}`, error);
      return false;
    }
  }
  
  /**
   * Crée et valide un nonce unique pour les transactions
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<string>} - Nonce généré
   */
  async createTransactionNonce(userId) {
    try {
      // Générer un nonce aléatoire
      const randomPart = Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now().toString(36);
      const nonce = `${userId}-${timestamp}-${randomPart}`;
      
      // Stocker le nonce en base de données pour vérification ultérieure
      // (Ceci serait implémenté dans une version complète)
      
      return nonce;
    } catch (error) {
      logError('Error creating transaction nonce', error);
      throw new Error(`Failed to create nonce: ${error.message}`);
    }
  }
  
  /**
   * Vérifie si un nonce a déjà été utilisé
   * @param {string} nonce - Nonce à vérifier
   * @returns {Promise<boolean>} - true si le nonce est déjà utilisé
   */
  async isNonceUsed(nonce) {
    try {
      // Vérifier si le nonce existe en base de données
      // (Ceci serait implémenté dans une version complète)
      
      // Pour l'instant, on renvoie toujours false
      return false;
    } catch (error) {
      logError('Error checking nonce usage', error);
      return true; // Par sécurité, considérer comme utilisé en cas d'erreur
    }
  }
}

// Exporter une instance unique du service
module.exports = new TransactionValidationService();

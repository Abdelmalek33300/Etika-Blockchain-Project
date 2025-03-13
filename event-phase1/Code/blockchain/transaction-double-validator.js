// services/transactionDoubleValidator.js
// Service pour la double validation cryptographique des transactions d'avoirs NFT

const { ethers } = require('ethers');
const { logError } = require('../utils/errorTracking');
const { getSecureItem } = require('../utils/secureStorage');
const { TransactionHistory } = require('../models/TransactionHistory');
const transactionValidationService = require('./transactionValidationService');
const config = require('../config');

class TransactionDoubleValidator {
  constructor() {
    this.provider = null;
    this.initialized = false;
    this.initializePromise = null;
    this.transactionAudit = {};
  }
  
  /**
   * Initialise le service de double validation
   */
  async initialize() {
    if (this.initialized) return;
    
    // Si une initialisation est déjà en cours, attendre qu'elle se termine
    if (this.initializePromise) {
      return this.initializePromise;
    }
    
    this.initializePromise = (async () => {
      try {
        // Créer un fournisseur pour accéder à la blockchain
        this.provider = new ethers.providers.JsonRpcProvider(config.POLYGON_RPC_URL);
        
        // Charger la clé privée du validateur
        const privateKey = await getSecureItem('ETIKA_VALIDATOR_PRIVATE_KEY');
        
        if (privateKey) {
          // Créer un wallet pour le validateur
          this.validatorWallet = new ethers.Wallet(privateKey, this.provider);
          this.validatorAddress = this.validatorWallet.address;
        } else {
          console.warn('No validator private key found, validation will be limited');
          this.validatorWallet = null;
          this.validatorAddress = null;
        }
        
        this.initialized = true;
        console.log('TransactionDoubleValidator initialized successfully');
      } catch (error) {
        logError('Failed to initialize TransactionDoubleValidator', error);
        throw new Error(`Initialization failed: ${error.message}`);
      } finally {
        this.initializePromise = null;
      }
    })();
    
    return this.initializePromise;
  }
  
  /**
   * Pré-valide une transaction avant son exécution (première validation)
   * @param {Object} transaction - Données de la transaction
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Object>} - Résultat de la pré-validation avec un nonce unique
   */
  async preValidateTransaction(transaction, userId) {
    await this.initialize();
    
    try {
      // Générer un nonce unique pour cette transaction
      const nonce = await transactionValidationService.createTransactionNonce(userId);
      
      // Créer un hash unique pour cette transaction
      const transactionWithNonce = {
        ...transaction,
        nonce,
        timestamp: Date.now()
      };
      
      // Hacher la transaction
      const transactionHash = ethers.utils.id(JSON.stringify(transactionWithNonce));
      
      // Signer le hash avec la clé du validateur
      let validatorSignature = null;
      if (this.validatorWallet) {
        validatorSignature = await this.validatorWallet.signMessage(transactionHash);
      }
      
      // Stocker les détails de validation pour vérification ultérieure
      this.transactionAudit[nonce] = {
        transactionHash,
        timestamp: Date.now(),
        validated: true,
        userId
      };
      
      return {
        success: true,
        nonce,
        transactionHash,
        validatorSignature,
        validatorAddress: this.validatorAddress,
        timestamp: Date.now()
      };
    } catch (error) {
      logError('Error pre-validating transaction', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Post-valide une transaction après son exécution (seconde validation)
   * @param {string} nonce - Nonce unique de la transaction
   * @param {string} txHash - Hash de la transaction blockchain
   * @returns {Promise<Object>} - Résultat de la post-validation
   */
  async postValidateTransaction(nonce, txHash) {
    await this.initialize();
    
    try {
      // Vérifier que la transaction a été pré-validée
      if (!this.transactionAudit[nonce]) {
        throw new Error('Transaction was not pre-validated');
      }
      
      // Vérifier que la transaction existe sur la blockchain
      const transaction = await this.provider.getTransaction(txHash);
      
      if (!transaction) {
        throw new Error('Transaction not found on blockchain');
      }
      
      // Récupérer le reçu de la transaction
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }
      
      // Vérifier que la transaction a réussi
      if (receipt.status !== 1) {
        throw new Error('Transaction failed on blockchain');
      }
      
      // Mettre à jour l'audit
      this.transactionAudit[nonce].onChainVerified = true;
      this.transactionAudit[nonce].txHash = txHash;
      this.transactionAudit[nonce].blockNumber = receipt.blockNumber;
      this.transactionAudit[nonce].postValidationTimestamp = Date.now();
      
      // Enregistrer cette validation dans l'historique des transactions
      await this.recordValidation(nonce, txHash);
      
      return {
        success: true,
        nonce,
        txHash,
        blockNumber: receipt.blockNumber,
        validatorAddress: this.validatorAddress
      };
    } catch (error) {
      logError(`Error post-validating transaction with nonce ${nonce}`, error);
      
      // En cas d'échec, enregistrer l'erreur dans l'audit
      if (this.transactionAudit[nonce]) {
        this.transactionAudit[nonce].onChainVerified = false;
        this.transactionAudit[nonce].error = error.message;
        this.transactionAudit[nonce].postValidationTimestamp = Date.now();
      }
      
      // Enregistrer l'échec
      try {
        await this.recordValidationFailure(nonce, error.message);
      } catch (recordError) {
        // Ignorer les erreurs d'enregistrement
      }
      
      return {
        success: false,
        nonce,
        error: error.message
      };
    }
  }
  
  /**
   * Enregistre une validation réussie
   * @param {string} nonce - Nonce unique de la transaction
   * @param {string} txHash - Hash de la transaction blockchain
   */
  async recordValidation(nonce, txHash) {
    try {
      // Récupérer les informations d'audit
      const auditInfo = this.transactionAudit[nonce];
      
      if (!auditInfo) {
        return;
      }
      
      // Rechercher la transaction dans l'historique
      const transactions = await TransactionHistory.find({
        nonce,
        status: { $in: ['pending', 'completed'] }
      });
      
      if (transactions.length === 0) {
        // La transaction n'a pas encore été enregistrée dans l'historique
        return;
      }
      
      // Mettre à jour chaque transaction
      for (const transaction of transactions) {
        transaction.status = 'completed';
        transaction.txHash = txHash;
        transaction.validatedAt = new Date();
        transaction.validatedBy = this.validatorAddress;
        
        await transaction.save();
      }
    } catch (error) {
      logError(`Error recording validation for nonce ${nonce}`, error);
    }
  }
  
  /**
   * Enregistre un échec de validation
   * @param {string} nonce - Nonce unique de la transaction
   * @param {string} errorMessage - Message d'erreur
   */
  async recordValidationFailure(nonce, errorMessage) {
    try {
      // Récupérer les informations d'audit
      const auditInfo = this.transactionAudit[nonce];
      
      if (!auditInfo) {
        return;
      }
      
      // Rechercher la transaction dans l'historique
      const transactions = await TransactionHistory.find({
        nonce,
        status: { $in: ['pending', 'completed'] }
      });
      
      if (transactions.length === 0) {
        // La transaction n'a pas encore été enregistrée dans l'historique
        return;
      }
      
      // Mettre à jour chaque transaction
      for (const transaction of transactions) {
        transaction.status = 'failed';
        transaction.errorMessage = errorMessage;
        transaction.validatedAt = new Date();
        transaction.validatedBy = this.validatorAddress;
        
        await transaction.save();
      }
    } catch (error) {
      logError(`Error recording validation failure for nonce ${nonce}`, error);
    }
  }
  
  /**
   * Génère un rapport d'audit des transactions récentes
   * @param {number} limit - Nombre maximum de transactions à inclure
   * @returns {Array} - Rapport d'audit
   */
  getTransactionAudit(limit = 100) {
    // Convertir l'objet d'audit en tableau
    const auditEntries = Object.entries(this.transactionAudit)
      .map(([nonce, data]) => ({
        nonce,
        ...data
      }))
      // Trier par timestamp décroissant
      .sort((a, b) => b.timestamp - a.timestamp)
      // Limiter le nombre d'entrées
      .slice(0, limit);
    
    return auditEntries;
  }
  
  /**
   * Valide une signature de transaction
   * @param {string} message - Message signé
   * @param {string} signature - Signature à vérifier
   * @param {string} expectedAddress - Adresse attendue du signataire
   * @returns {boolean} - true si la signature est valide
   */
  verifySignature(message, signature, expectedAddress) {
    try {
      // Récupérer l'adresse du signataire à partir de la signature
      const recoveredAddress = ethers.utils.verifyMessage(message, signature);
      
      // Vérifier que l'adresse récupérée correspond à l'adresse attendue
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      logError('Error verifying signature', error);
      return false;
    }
  }
  
  /**
   * Nettoie les entrées d'audit anciennes (plus de 24h)
   */
  cleanupOldAuditEntries() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    Object.entries(this.transactionAudit).forEach(([nonce, data]) => {
      if (data.timestamp < oneDayAgo) {
        delete this.transactionAudit[nonce];
      }
    });
  }
  
  /**
   * Planifie le nettoyage régulier des entrées d'audit
   */
  scheduleCleanup() {
    // Nettoyer les entrées d'audit toutes les 6 heures
    setInterval(() => {
      this.cleanupOldAuditEntries();
    }, 6 * 60 * 60 * 1000);
  }
}

// Exporter une instance unique du service
const transactionDoubleValidator = new TransactionDoubleValidator();

// Planifier le nettoyage régulier
transactionDoubleValidator.scheduleCleanup();

module.exports = transactionDoubleValidator;

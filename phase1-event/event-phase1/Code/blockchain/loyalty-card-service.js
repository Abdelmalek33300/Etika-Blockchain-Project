// services/loyaltyCardService.js
// Service pour gérer les cartes de fidélité NFT dans l'application

const Web3 = require('web3');
const { logError } = require('../utils/errorTracking');
const { getSecureItem } = require('../utils/secureStorage');
const LoyaltyNFTABI = require('../contracts/LoyaltyNFTABI.json');
const config = require('../config');

class LoyaltyCardService {
  constructor() {
    this.web3 = null;
    this.contract = null;
    this.initialized = false;
    this.initializePromise = null;
  }
  
  /**
   * Initialise le service et la connexion au contrat blockchain
   */
  async initialize() {
    if (this.initialized) return;
    
    // Si une initialisation est déjà en cours, attendre qu'elle se termine
    if (this.initializePromise) {
      return this.initializePromise;
    }
    
    this.initializePromise = (async () => {
      try {
        // Créer une instance Web3 connectée au réseau Polygon
        this.web3 = new Web3(config.POLYGON_RPC_URL);
        
        // Charger la clé privée pour les transactions (utiliser le service sécurisé)
        const privateKey = await getSecureItem('ETIKA_OPERATOR_PRIVATE_KEY');
        
        if (privateKey) {
          // Ajouter le compte à l'instance Web3
          const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
          this.web3.eth.accounts.wallet.add(account);
          this.operatorAddress = account.address;
        } else {
          console.warn('No operator private key found, read-only mode enabled');
          this.operatorAddress = null;
        }
        
        // Créer une instance du contrat
        this.contract = new this.web3.eth.Contract(
          LoyaltyNFTABI,
          config.LOYALTY_NFT_CONTRACT_ADDRESS
        );
        
        this.initialized = true;
        console.log('LoyaltyCardService initialized successfully');
      } catch (error) {
        logError('Failed to initialize LoyaltyCardService', error);
        throw new Error(`Initialization failed: ${error.message}`);
      } finally {
        this.initializePromise = null;
      }
    })();
    
    return this.initializePromise;
  }
  
  /**
   * Émet une nouvelle carte de fidélité pour un utilisateur
   * @param {string} userAddress - Adresse blockchain de l'utilisateur
   * @param {Object} userData - Données de l'utilisateur pour les métadonnées
   * @returns {Promise<Object>} - Informations sur la carte créée
   */
  async issueCard(userAddress, userData) {
    await this.initialize();
    
    try {
      // Vérifier si l'utilisateur a déjà une carte
      const hasCard = await this.contract.methods.hasLoyaltyCard(userAddress).call();
      
      if (hasCard) {
        throw new Error('User already has a loyalty card');
      }
      
      // Générer les métadonnées
      const metadata = this._generateMetadata(userData);
      
      // Stocker les métadonnées (IPFS ou autre service)
      const metadataUri = await this._storeMetadata(metadata);
      
      // Émettre la carte via le contrat
      const tx = await this.contract.methods.issueCard(userAddress, metadataUri).send({
        from: this.operatorAddress,
        gas: 500000
      });
      
      // Récupérer l'ID du token à partir de l'événement émis
      const cardIssuedEvent = tx.events.CardIssued;
      const tokenId = cardIssuedEvent ? cardIssuedEvent.returnValues.tokenId : null;
      
      return {
        success: true,
        tokenId,
        txHash: tx.transactionHash,
        metadataUri
      };
    } catch (error) {
      logError('Error issuing loyalty card', error);
      throw new Error(`Failed to issue loyalty card: ${error.message}`);
    }
  }
  
  /**
   * Ajoute des avoirs à une carte de fidélité
   * @param {string} tokenId - ID du token NFT
   * @param {string} sectorId - ID du secteur
   * @param {number} amount - Montant à ajouter
   * @returns {Promise<Object>} - Résultat de la transaction
   */
  async addBalance(tokenId, sectorId, amount) {
    await this.initialize();
    
    try {
      // Vérifier que le token existe
      const exists = await this._tokenExists(tokenId);
      if (!exists) {
        throw new Error('Token does not exist');
      }
      
      // Ajouter le solde via le contrat
      const tx = await this.contract.methods.addBalance(tokenId, sectorId, amount).send({
        from: this.operatorAddress,
        gas: 200000
      });
      
      return {
        success: true,
        txHash: tx.transactionHash,
        tokenId,
        sectorId,
        amount
      };
    } catch (error) {
      logError('Error adding balance to loyalty card', error);
      throw new Error(`Failed to add balance: ${error.message}`);
    }
  }
  
  /**
   * Utilise des avoirs d'une carte de fidélité
   * @param {string} tokenId - ID du token NFT
   * @param {string} sectorId - ID du secteur
   * @param {number} amount - Montant à dépenser
   * @param {string} sponsorAddress - Adresse du sponsor (option)
   * @returns {Promise<Object>} - Résultat de la transaction
   */
  async spendBalance(tokenId, sectorId, amount, sponsorAddress = null) {
    await this.initialize();
    
    try {
      // Vérifier que le token existe
      const exists = await this._tokenExists(tokenId);
      if (!exists) {
        throw new Error('Token does not exist');
      }
      
      // Vérifier que le solde est suffisant
      const balance = await this.getSectorBalance(tokenId, sectorId);
      if (balance < amount) {
        throw new Error('Insufficient balance');
      }
      
      // Adresse à utiliser pour la transaction
      const fromAddress = sponsorAddress || this.operatorAddress;
      
      // Dépenser le solde via le contrat
      const tx = await this.contract.methods.spendBalance(tokenId, sectorId, amount).send({
        from: fromAddress,
        gas: 200000
      });
      
      return {
        success: true,
        txHash: tx.transactionHash,
        tokenId,
        sectorId,
        amount
      };
    } catch (error) {
      logError('Error spending balance from loyalty card', error);
      throw new Error(`Failed to spend balance: ${error.message}`);
    }
  }
  
  /**
   * Récupère le solde d'un secteur pour une carte
   * @param {string} tokenId - ID du token NFT
   * @param {string} sectorId - ID du secteur
   * @returns {Promise<number>} - Solde disponible
   */
  async getSectorBalance(tokenId, sectorId) {
    await this.initialize();
    
    try {
      const result = await this.contract.methods.getSectorBalance(tokenId, sectorId).call();
      return parseInt(result.balance || 0);
    } catch (error) {
      logError('Error getting sector balance', error);
      return 0;
    }
  }
  
  /**
   * Récupère les détails complets d'une carte de fidélité
   * @param {string} tokenId - ID du token NFT
   * @returns {Promise<Object>} - Détails de la carte
   */
  async getCardDetails(tokenId) {
    await this.initialize();
    
    try {
      // Vérifier que le token existe
      const exists = await this._tokenExists(tokenId);
      if (!exists) {
        throw new Error('Token does not exist');
      }
      
      // Récupérer le propriétaire
      const owner = await this.contract.methods.ownerOf(tokenId).call();
      
      // Récupérer l'URI des métadonnées
      const metadataUri = await this.contract.methods.tokenURI(tokenId).call();
      
      // Récupérer les métadonnées
      const metadata = await this._fetchMetadata(metadataUri);
      
      // Récupérer les secteurs actifs
      const activeSectors = await this.contract.methods.getActiveSectors().call();
      
      // Récupérer les soldes pour chaque secteur
      const balances = {};
      
      for (const sectorId of activeSectors) {
        const sectorBalance = await this.contract.methods.getSectorBalance(tokenId, sectorId).call();
        const sectorInfo = await this.contract.methods.getSectorInfo(sectorId).call();
        
        balances[sectorId] = {
          sectorId,
          name: sectorInfo.name,
          balance: parseInt(sectorBalance.balance),
          totalSpent: parseInt(sectorBalance.totalSpent),
          lastActivity: new Date(parseInt(sectorBalance.lastActivity) * 1000)
        };
      }
      
      return {
        tokenId,
        owner,
        metadataUri,
        metadata,
        balances
      };
    } catch (error) {
      logError('Error getting card details', error);
      throw new Error(`Failed to get card details: ${error.message}`);
    }
  }
  
  /**
   * Récupère l'ID du token pour un utilisateur
   * @param {string} userAddress - Adresse de l'utilisateur
   * @returns {Promise<string|null>} - ID du token ou null
   */
  async getTokenIdForUser(userAddress) {
    await this.initialize();
    
    try {
      const tokenId = await this.contract.methods.getTokenIdForOwner(userAddress).call();
      return tokenId > 0 ? tokenId : null;
    } catch (error) {
      logError('Error getting token ID for user', error);
      return null;
    }
  }
  
  /**
   * Vérifie si un token existe
   * @param {string} tokenId - ID du token
   * @returns {Promise<boolean>}
   */
  async _tokenExists(tokenId) {
    try {
      await this.contract.methods.ownerOf(tokenId).call();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Génère les métadonnées pour une carte de fidélité
   * @param {Object} userData - Données de l'utilisateur
   * @returns {Object} - Métadonnées formatées
   */
  _generateMetadata(userData) {
    return {
      name: "Étika Loyalty Card",
      description: "Carte de fidélité Étika pour les consommateurs participants",
      image: `${config.API_URL}/images/loyalty-card.png`,
      external_url: `${config.APP_URL}/card`,
      attributes: [
        {
          trait_type: "Card Type",
          value: "Consumer"
        },
        {
          trait_type: "Issued Date",
          value: new Date().toISOString().split('T')[0]
        },
        {
          trait_type: "User ID",
          value: userData.userId || ""
        },
        {
          trait_type: "User Level",
          value: userData.level || "Standard"
        }
      ]
    };
  }
  
  /**
   * Stocke les métadonnées (sur IPFS ou autre service)
   * @param {Object} metadata - Métadonnées à stocker
   * @returns {Promise<string>} - URI des métadonnées
   */
  async _storeMetadata(metadata) {
    try {
      // Cette implémentation stockerait normalement les métadonnées sur IPFS
      // Pour la version de test, on stocke dans notre propre API
      const response = await fetch(`${config.API_URL}/api/metadata/store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getSecureItem('API_TOKEN')}`
        },
        body: JSON.stringify(metadata)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to store metadata');
      }
      
      return data.metadataUri;
    } catch (error) {
      logError('Error storing metadata', error);
      throw new Error(`Failed to store metadata: ${error.message}`);
    }
  }
  
  /**
   * Récupère les métadonnées depuis leur URI
   * @param {string} uri - URI des métadonnées
   * @returns {Promise<Object>} - Métadonnées
   */
  async _fetchMetadata(uri) {
    try {
      // Si l'URI est une URL HTTP, faire une requête
      if (uri.startsWith('http')) {
        const response = await fetch(uri);
        return await response.json();
      }
      
      // Si c'est une URI IPFS, utiliser une passerelle IPFS
      if (uri.startsWith('ipfs://')) {
        const ipfsHash = uri.replace('ipfs://', '');
        const gatewayUrl = `${config.IPFS_GATEWAY}/${ipfsHash}`;
        const response = await fetch(gatewayUrl);
        return await response.json();
      }
      
      // Si c'est stocké localement, récupérer depuis notre API
      if (uri.startsWith('etika://')) {
        const metadataId = uri.replace('etika://', '');
        const response = await fetch(`${config.API_URL}/api/metadata/${metadataId}`);
        return await response.json();
      }
      
      throw new Error(`Unsupported metadata URI: ${uri}`);
    } catch (error) {
      logError('Error fetching metadata', error);
      return {};
    }
  }
}

// Exporter une instance unique du service
module.exports = new LoyaltyCardService();

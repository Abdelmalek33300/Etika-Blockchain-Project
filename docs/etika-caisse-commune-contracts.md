    // Mapping pour les NFT blacklistés
    mapping(uint256 => bool) private _blacklistedTokens;
    
    // Mapping pour garder trace du nombre d'enchères par participant
    mapping(uint256 => uint256) private _auctionParticipationCount;
    
    // Mapping pour l'historique des secteurs (limité aux 5 derniers pour économiser le gaz)
    mapping(uint256 => bytes32[5]) private _recentSectors;
    
    // Mapping pour les dernières enchères (timestamp, id)
    mapping(uint256 => LastAuction) private _lastAuction;
    
    // Structure pour stocker les informations de la dernière enchère
    struct LastAuction {
        uint256 timestamp;
        string auctionId;
    }
    
    // Événements
    event PassportMinted(address indexed to, uint256 indexed tokenId);
    event ParticipationRecorded(uint256 indexed tokenId, bytes32 sector, string auctionId);
    event PassportBlacklisted(uint256 indexed tokenId, bool status);
    event TokenURIUpdated(uint256 indexed tokenId, string newURI);
    
    /**
     * @dev Constructeur
     */
    constructor() ERC721("Etika Passport", "ETIPASS") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Crée un nouveau passeport NFT pour un utilisateur
     * @param to L'adresse du bénéficiaire
     * @param initialURI L'URI initiale des métadonnées du NFT
     * @return Le tokenId du nouveau passeport
     */
    function mintPassport(address to, string memory initialURI) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenNotPaused 
        returns (uint256) 
    {
        require(_userTokens[to] == 0, "User already has a passport");
        
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        _mint(to, tokenId);
        _setTokenURI(tokenId, initialURI);
        
        _userTokens[to] = tokenId;
        _auctionParticipationCount[tokenId] = 0;
        
        emit PassportMinted(to, tokenId);
        
        return tokenId;
    }
    
    /**
     * @dev Enregistre une participation à une enchère
     * @param tokenId L'ID du token passeport
     * @param sector Le secteur de l'enchère
     * @param auctionId L'ID de l'enchère
     */
    function recordParticipation(uint256 tokenId, bytes32 sector, string calldata auctionId) 
        external 
        onlyRole(AUCTION_ROLE) 
        whenNotPaused 
    {
        require(_exists(tokenId), "Token does not exist");
        require(!_blacklistedTokens[tokenId], "Passport is blacklisted");
        
        // Incrémenter le compteur de participations
        _auctionParticipationCount[tokenId]++;
        
        // Mettre à jour la dernière enchère
        _lastAuction[tokenId] = LastAuction({
            timestamp: block.timestamp,
            auctionId: auctionId
        });
        
        // Mettre à jour l'historique des secteurs (FIFO: First In, First Out)
        for (uint i = 4; i > 0; i--) {
            _recentSectors[tokenId][i] = _recentSectors[tokenId][i-1];
        }
        _recentSectors[tokenId][0] = sector;
        
        emit ParticipationRecorded(tokenId, sector, auctionId);
    }
    
    /**
     * @dev Met à jour l'URI des métadonnées du token
     * @param tokenId L'ID du token à mettre à jour
     * @param newURI La nouvelle URI des métadonnées
     */
    function updateTokenURI(uint256 tokenId, string calldata newURI) 
        external 
        onlyRole(UPDATER_ROLE) 
        whenNotPaused 
    {
        require(_exists(tokenId), "Token does not exist");
        
        _setTokenURI(tokenId, newURI);
        
        emit TokenURIUpdated(tokenId, newURI);
    }
    
    /**
     * @dev Change le statut de blacklist d'un passeport
     * @param tokenId L'ID du token à blacklister/déblacklister
     * @param blacklisted Le nouveau statut (true = blacklisté)
     */
    function setBlacklistStatus(uint256 tokenId, bool blacklisted) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(_exists(tokenId), "Token does not exist");
        
        _blacklistedTokens[tokenId] = blacklisted;
        
        emit PassportBlacklisted(tokenId, blacklisted);
    }
    
    /**
     * @dev Vérifie si un utilisateur possède un passeport valide
     * @param user L'adresse de l'utilisateur à vérifier
     * @return validPassport Vrai si l'utilisateur a un passeport valide
     */
    function hasValidPassport(address user) 
        external 
        view 
        returns (bool validPassport) 
    {
        uint256 tokenId = _userTokens[user];
        return tokenId != 0 && !_blacklistedTokens[tokenId];
    }
    
    /**
     * @dev Récupère le token ID du passeport d'un utilisateur
     * @param user L'adresse de l'utilisateur
     * @return tokenId L'ID du token du passeport (0 si aucun)
     */
    function getPassportId(address user) 
        external 
        view 
        returns (uint256) 
    {
        return _userTokens[user];
    }
    
    /**
     * @dev Récupère les données on-chain du passeport
     * @param tokenId L'ID du token du passeport
     * @return participationCount Nombre total de participations aux enchères
     * @return lastAuctionTime Timestamp de la dernière enchère
     * @return lastAuctionId ID de la dernière enchère
     * @return sectors Tableau des 5 derniers secteurs d'enchères
     */
    function getPassportData(uint256 tokenId) 
        external 
        view 
        returns (
            uint256 participationCount,
            uint256 lastAuctionTime,
            string memory lastAuctionId,
            bytes32[5] memory sectors
        ) 
    {
        require(_exists(tokenId), "Token does not exist");
        
        return (
            _auctionParticipationCount[tokenId],
            _lastAuction[tokenId].timestamp,
            _lastAuction[tokenId].auctionId,
            _recentSectors[tokenId]
        );
    }
    
    /**
     * @dev Vérifie si un passeport est blacklisté
     * @param tokenId L'ID du token du passeport
     * @return Vrai si le passeport est blacklisté
     */
    function isBlacklisted(uint256 tokenId) 
        external 
        view 
        returns (bool) 
    {
        require(_exists(tokenId), "Token does not exist");
        return _blacklistedTokens[tokenId];
    }
    
    /**
     * @dev Empêche le transfert des passeports (ils sont liés à l'identité de l'utilisateur)
     */
    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override
        whenNotPaused
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Si c'est un mint ou un burn, c'est autorisé
        if (from == address(0) || to == address(0)) {
            return;
        }
        
        // Sinon, interdire le transfert
        revert("Passport NFTs cannot be transferred");
    }
    
    /**
     * @dev Fonction de pause du contrat
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Fonction de reprise du contrat
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Interdire l'approbation des passeports
     */
    function approve(address to, uint256 tokenId) public override {
        revert("Passport NFTs cannot be approved for transfer");
    }
    
    /**
     * @dev Interdire l'approbation de tous les passeports
     */
    function setApprovalForAll(address operator, bool approved) public override {
        revert("Passport NFTs cannot be approved for transfer");
    }
    
    /**
     * @dev Fonction obligatoire pour la compatibilité avec AccessControl
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

## 4. Service de Distribution aux Consommateurs

```javascript
// services/distribution-service.js

const { ethers } = require('ethers');
const mongoose = require('mongoose');
const redis = require('redis');

/**
 * Service de gestion de la distribution des fonds aux consommateurs
 */
class ConsumerDistributionService {
  constructor(treasuryContract, configService, dbService, cacheService) {
    this.treasuryContract = treasuryContract;
    this.configService = configService;
    this.dbService = dbService;
    this.cache = cacheService;
    
    // Initialiser la période de distribution
    this.distributionPeriod = 24 * 60 * 60 * 1000; // 24h en ms
  }
  
  /**
   * Planifie les distributions régulières
   */
  scheduleDistributions() {
    // Vérifier les distributions toutes les 6 heures
    setInterval(() => {
      this.processScheduledDistributions()
        .catch(error => console.error('Error processing scheduled distributions:', error));
    }, 6 * 60 * 60 * 1000);
  }
  
  /**
   * Traite les distributions planifiées
   */
  async processScheduledDistributions() {
    // Récupérer tous les secteurs
    const sectors = await this.getAllSectors();
    
    for (const sector of sectors) {
      // Vérifier si une distribution est nécessaire pour ce secteur
      const shouldDistribute = await this.shouldProcessDistribution(sector);
      
      if (shouldDistribute) {
        try {
          await this.processDistributionForSector(sector);
        } catch (error) {
          console.error(`Error processing distribution for sector ${sector}:`, error);
        }
      }
    }
  }
  
  /**
   * Vérifie si une distribution doit être traitée pour un secteur
   */
  async shouldProcessDistribution(sector) {
    try {
      // Récupérer les statistiques du secteur
      const stats = await this.treasuryContract.getSectorStats(sector);
      
      // S'il n'y a pas de fonds disponibles, pas besoin de distribution
      if (stats.availableForDistribution == 0) {
        return false;
      }
      
      // Vérifier le temps écoulé depuis la dernière distribution
      const lastDistributionTime = stats.lastDistributionTime.toNumber() * 1000;
      const now = Date.now();
      
      // Si aucune distribution n'a encore eu lieu ou si le délai est écoulé
      if (lastDistributionTime === 0 || now - lastDistributionTime >= this.distributionPeriod) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error checking distribution need for sector ${sector}:`, error);
      return false;
    }
  }
  
  /**
   * Traite la distribution pour un secteur
   */
  async processDistributionForSector(sector) {
    try {
      // Obtenir les statistiques du secteur
      const stats = await this.treasuryContract.getSectorStats(sector);
      
      // Récupérer les consommateurs éligibles pour ce secteur
      const eligibleConsumers = await this.getEligibleConsumers(sector);
      
      if (eligibleConsumers.length === 0) {
        console.log(`No eligible consumers for sector ${sector}`);
        return;
      }
      
      const totalAvailable = ethers.BigNumber.from(stats.availableForDistribution);
      
      // Calculer le montant par consommateur
      // Dans la Phase 1, tous les consommateurs reçoivent une part égale
      const amountPerConsumer = totalAvailable.div(eligibleConsumers.length);
      
      if (amountPerConsumer.lte(0)) {
        console.log(`Amount per consumer too small for sector ${sector}`);
        return;
      }
      
      // Préparer les données pour le contrat et la base de données
      const distributionData = {
        sector,
        amount: totalAvailable.toString(),
        recipients: eligibleConsumers.length,
        recipientAddresses: eligibleConsumers.map(c => c.address),
        individualAmount: amountPerConsumer.toString(),
        timestamp: Date.now()
      };
      
      // Enregistrer la distribution dans la base de données
      const distributionRecord = await this.dbService.createDistribution(distributionData);
      
      // Encoder les données des destinataires pour l'événement blockchain
      const encodedData = ethers.utils.defaultAbiCoder.encode(
        ['address[]', 'uint256[]'],
        [
          distributionData.recipientAddresses,
          Array(distributionData.recipientAddresses.length).fill(amountPerConsumer.toString())
        ]
      );
      
      // Exécuter la transaction de distribution
      const tx = await this.treasuryContract.distributeToConsumers(
        sector,
        totalAvailable,
        eligibleConsumers.length,
        encodedData
      );
      
      // Attendre la confirmation
      const receipt = await tx.wait(2);
      
      // Mettre à jour l'enregistrement avec le hash de transaction
      await this.dbService.updateDistribution(
        distributionRecord._id,
        {
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          status: 'confirmed'
        }
      );
      
      // Créer les enregistrements de récompenses pour chaque consommateur
      await this.createRewardRecords(distributionRecord._id, eligibleConsumers, amountPerConsumer.toString());
      
      return {
        success: true,
        distributionId: distributionRecord._id,
        txHash: receipt.transactionHash
      };
    } catch (error) {
      console.error(`Error processing distribution for sector ${sector}:`, error);
      throw error;
    }
  }
  
  /**
   * Récupère les consommateurs éligibles pour un secteur
   */
  async getEligibleConsumers(sector) {
    try {
      // Récupérer tous les utilisateurs ayant participé à une enchère dans ce secteur
      // Dans la Phase 1, tous les consommateurs actifs sont éligibles
      const participants = await this.dbService.getActiveConsumers(sector);
      
      // Filtrer ceux qui ont un portefeuille configuré
      return participants.filter(p => p.walletAddress && p.walletAddress !== '');
    } catch (error) {
      console.error(`Error getting eligible consumers for sector ${sector}:`, error);
      throw error;
    }
  }
  
  /**
   * Crée les enregistrements de récompenses pour les consommateurs
   */
  async createRewardRecords(distributionId, consumers, amount) {
    try {
      // Créer les enregistrements de récompenses en batch
      const rewardRecords = consumers.map(consumer => ({
        distributionId,
        userId: consumer._id,
        userAddress: consumer.walletAddress,
        amount,
        status: 'pending',
        createdAt: new Date()
      }));
      
      await this.dbService.createRewards(rewardRecords);
      
      // Traiter les récompenses (ce serait fait par un autre service en production)
      await this.processRewards(distributionId);
    } catch (error) {
      console.error(`Error creating reward records for distribution ${distributionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Traite les récompenses (envoi des fonds aux consommateurs)
   */
  async processRewards(distributionId) {
    try {
      // En production, cette fonction enverrait réellement les tokens aux utilisateurs
      // Pour la Phase 1, nous simulons l'envoi et mettons à jour le statut
      
      const pendingRewards = await this.dbService.getPendingRewards(distributionId);
      
      for (const reward of pendingRewards) {
        try {
          // Simuler le transfert des fonds
          // En production, cela serait fait via une transaction blockchain
          
          // Mettre à jour le statut de la récompense
          await this.dbService.updateReward(reward._id, {
            status: 'completed',
            processedAt: new Date(),
            // txHash: '0x...' // En production, on stockerait le hash de la transaction
          });
          
          // Envoyer une notification à l'utilisateur
          await this.notifyUser(reward.userId, reward.amount);
        } catch (error) {
          console.error(`Error processing reward ${reward._id}:`, error);
          
          // Marquer comme échoué
          await this.dbService.updateReward(reward._id, {
            status: 'failed',
            error: error.message
          });
        }
      }
    } catch (error) {
      console.error(`Error processing rewards for distribution ${distributionId}:`, error);
      throw error;
    }
  }
  
  /**
   * Notifie un utilisateur de sa récompense
   */
  async notifyUser(userId, amount) {
    // En production, cela enverrait une notification push, un email, etc.
    console.log(`Notifying user ${userId} about reward of ${amount}`);
  }
  
  /**
   * Récupère tous les secteurs
   */
  async getAllSectors() {
    try {
      // Essayer d'abord depuis le cache
      const cachedSectors = await this.cache.get('treasury-sectors');
      if (cachedSectors) {
        return JSON.parse(cachedSectors);
      }
      
      // Si pas en cache, récupérer depuis la blockchain
      const sectors = await this.treasuryContract.getAllSectors();
      
      // Mettre en cache pour 1 heure
      await this.cache.set('treasury-sectors', JSON.stringify(sectors), 3600);
      
      return sectors;
    } catch (error) {
      console.error('Error fetching sectors:', error);
      throw error;
    }
  }
}

module.exports = ConsumerDistributionService;
```

## 5. Tableau de Bord Public pour la Transparence des Fonds

```javascript
// dashboard-service.js

const { ethers } = require('ethers');

/**
 * Service pour le tableau de bord public des fonds
 */
class TreasuryDashboardService {
  constructor(treasuryContract, auctionContract, dbService, cacheService) {
    this.treasuryContract = treasuryContract;
    this.auctionContract = auctionContract;
    this.dbService = dbService;
    this.cache = cacheService;
    
    // Durée du cache (5 minutes)
    this.CACHE_TTL = 300;
  }
  
  /**
   * Récupère les statistiques globales de la caisse commune
   */
  async getGlobalStats() {
    try {
      // Essayer d'abord depuis le cache
      const cachedStats = await this.cache.get('treasury-global-stats');
      if (cachedStats) {
        return JSON.parse(cachedStats);
      }
      
      // Récupérer le solde total
      const totalBalance = await this.treasuryContract.getTotalBalance();
      
      // Récupérer tous les secteurs
      const sectors = await this.treasuryContract.getAllSectors();
      
      // Récupérer les statistiques pour chaque secteur
      let totalCollected = ethers.BigNumber.from(0);
      let totalDistributed = ethers.BigNumber.from(0);
      let totalAvailable = ethers.BigNumber.from(0);
      let totalPlatformFees = ethers.BigNumber.from(0);
      
      for (const sector of sectors) {
        const stats = await this.treasuryContract.getSectorStats(sector);
        totalCollected = totalCollected.add(stats.totalCollected);
        totalDistributed = totalDistributed.add(stats.distributed);
        totalAvailable = totalAvailable.add(stats.availableForDistribution);
        totalPlatformFees = totalPlatformFees.add(stats.platformFees);
      }
      
      // Récupérer le pourcentage de frais de plateforme
      const platformFeePercentage = await this.treasuryContract.platformFeePercentage();
      
      // Construire l'objet de statistiques
      const stats = {
        totalBalance: totalBalance.toString(),
        totalCollected: totalCollected.toString(),
        totalDistributed: totalDistributed.toString(),
        totalAvailable: totalAvailable.toString(),
        totalPlatformFees: totalPlatformFees.toString(),
        sectorCount: sectors.length,
        platformFeePercentage: (platformFeePercentage.toNumber() / 100).toString(),
        lastUpdated: Date.now()
      };
      
      // Mettre en cache pour 5 minutes
      await this.cache.set('treasury-global-stats', JSON.stringify(stats), this.CACHE_TTL);
      
      return stats;
    } catch (error) {
      console.error('Error fetching global treasury stats:', error);
      throw error;
    }
  }
  
  /**
   * Récupère les statistiques par secteur
   */
  async getSectorStats(sector) {
    try {
      // Essayer d'abord depuis le cache
      const cacheKey = `treasury-sector-stats-${sector}`;
      const cachedStats = await this.cache.get(cacheKey);
      if (cachedStats) {
        return JSON.parse(cachedStats);
      }
      
      // Récupérer les statistiques pour ce secteur
      const stats = await this.treasuryContract.getSectorStats(sector);
      
      // Récupérer les enchères de ce secteur
      const auctionIds = await this.auctionContract.getAllAuctionIds();
      const sectorAuctions = [];
      
      for (const auctionId of auctionIds) {
        const auctionDetails = await this.auctionContract.getAuctionDetails(auctionId);
        
        if (auctionDetails.sector === sector) {
          sectorAuctions.push({
            id: auctionId,
            startTime: auctionDetails.startTime.toNumber(),
            endTime: auctionDetails.endTime.toNumber(),
            highestBid: auctionDetails.highestBid.toString(),
            finalized: auctionDetails.finalized,
            fundsTransferred: auctionDetails.fundsTransferred
          });
        }
      }
      
      // Récupérer les distributions de ce secteur
      const distributions = await this.dbService.getDistributionsBySector(sector);
      
      // Construire l'objet de statistiques
      const sectorStats = {
        sector,
        totalCollected: stats.totalCollected.toString(),
        availableForDistribution: stats.availableForDistribution.toString(),
        distributed: stats.distributed.toString(),
        platformFees: stats.platformFees.toString(),
        lastDistributionTime: stats.lastDistributionTime.toNumber(),
        auctionCount: sectorAuctions.length,
        distributionCount: distributions.length,
        auctions: sectorAuctions,
        distributions: distributions.map(d => ({
          id: d._id.toString(),
          amount: d.amount,
          recipients: d.recipients,
          timestamp: d.timestamp,
          txHash: d.txHash
        })),
        lastUpdated: Date.now()
      };
      
      // Mettre en cache pour 5 minutes
      await this.cache.set(cacheKey, JSON.stringify(sectorStats), this.CACHE_TTL);
      
      return sectorStats;
    } catch (error) {
      console.error(`Error fetching stats for sector ${sector}:`, error);
      throw error;
    }
  }
  
  /**
   * Récupère l'historique des contributions
   */
  async getContributionHistory(page = 1, limit = 20) {
    try {
      // Essayer d'abord depuis le cache
      const cacheKey = `treasury-contributions-${page}-${limit}`;
      const cachedData = await this.cache.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      // Récupérer les contributions depuis la base de données
      const contributions = await this.dbService.getContributions(page, limit);
      
      // Mettre en cache pour 5 minutes
      await this.cache.set(cacheKey, JSON.stringify(contributions), this.CACHE_TTL);
      
      return contributions;
    } catch (error) {
      console.error('Error fetching contribution history:', error);
      throw error;
    }
  }
  
  /**
   * Récupère l'historique des distributions
   */
  async getDistributionHistory(page = 1, limit = 20) {
    try {
      // Essayer d'abord depuis le cache
      const cacheKey = `treasury-distributions-${page}-${limit}`;
      const cachedData = await this.cache.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      // Récupérer les distributions depuis la base de données
      const distributions = await this.dbService.getDistributions(page, limit);
      
      // Mettre en cache pour 5 minutes
      await this.cache.set(cacheKey, JSON.stringify(distributions), this.CACHE_TTL);
      
      return distributions;
    } catch (error) {
      console.error('Error fetching distribution history:', error);
      throw error;
    }
  }
  
  /**
   * Récupère les données pour le graphique d'évolution de la caisse commune
   */
  async getTreasuryGrowthChart(days = 30) {
    try {
      // Essayer d'abord depuis le cache
      const cacheKey = `treasury-growth-chart-${days}`;
      const cachedData = await this.cache.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      // Calculer la date de début
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Récupérer les données historiques depuis la base de données
      const contributionData = await this.dbService.getContributionsByDay(startDate);
      const distributionData = await this.dbService.getDistributionsByDay(startDate);
      
      // Fusionner les données
      const dataByDay = {};
      
      // Initialiser toutes les dates
      for (let i = 0; i <= days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        dataByDay[dateStr] = {
          date: dateStr,
          contributions: 0,
          distributions: 0,
          platformFees: 0,
          netGrowth: 0
        };
      }
      
      // Ajouter les contributions
      contributionData.forEach(item => {
        const dateStr = new Date(item.date).toISOString().split('T')[0];
        if (dataByDay[dateStr]) {
          dataByDay[dateStr].contributions = item.amount;
          dataByDay[dateStr].platformFees = item.platformFees;
        }
      });
      
      // Ajouter les distributions
      distributionData.forEach(item => {
        const dateStr = new Date(item.date).toISOString().split('T')[0];
        if (dataByDay[dateStr]) {
          dataByDay[dateStr].distributions = item.amount;
        }
      });
      
      // Calculer la croissance nette
      Object.values(dataByDay).forEach(item => {
        item.netGrowth = item.contributions - item.distributions - item.platformFees;
      });
      
      // Convertir en tableau pour le graphique
      const chartData = Object.values(dataByDay);
      
      // Mettre en cache pour 1 heure
      await this.cache.set(cacheKey, JSON.stringify(chartData), 3600);
      
      return chartData;
    } catch (error) {
      console.error('Error fetching treasury growth chart data:', error);
      throw error;
    }
  }
}

module.exports = TreasuryDashboardService;
```

## 6. API pour le tableau de bord public

```javascript
// routes/treasury-dashboard.js

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');

module.exports = function(treasuryDashboardService) {
  /**
   * Récupère les statistiques globales de la caisse commune
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = await treasuryDashboardService.getGlobalStats();
      res.json({ success: true, stats });
    } catch (error) {
      console.error('Error fetching treasury stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch treasury statistics' });
    }
  });
  
  /**
   * Récupère les statistiques d'un secteur spécifique
   */
  router.get('/sector/:sector', async (req, res) => {
    try {
      const sector = req.params.sector;
      
      // Vérifier que le secteur est spécifié
      if (!sector) {
        return res.status(400).json({ success: false, error: 'Sector is required' });
      }
      
      const stats = await treasuryDashboardService.getSectorStats(sector);
      res.json({ success: true, stats });
    } catch (error) {
      console.error(`Error fetching sector stats for ${req.params.sector}:`, error);
      res.status(500).json({ success: false, error: 'Failed to fetch sector statistics' });
    }
  });
  
  /**
   * Récupère l'historique des contributions
   */
  router.get('/contributions', 
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 20;
        
        const contributions = await treasuryDashboardService.getContributionHistory(page, limit);
        res.json({ success: true, contributions });
      } catch (error) {
        console.error('Error fetching contribution history:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch contribution history' });
      }
    }
  );
  
  /**
   * Récupère l'historique des distributions
   */
  router.get('/distributions', 
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 20;
        
        const distributions = await treasuryDashboardService.getDistributionHistory(page, limit);
        res.json({ success: true, distributions });
      } catch (error) {
        console.error('Error fetching distribution history:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch distribution history' });
      }
    }
  );
  
  /**
   * Récupère les données pour le graphique de croissance de la caisse commune
   */
  router.get('/growth-chart', 
    query('days').optional().isInt({ min: 1, max: 365 }).toInt(),
    async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
      
      try {
        const days = req.query.days || 30;
        
        const chartData = await treasuryDashboardService.getTreasuryGrowthChart(days);
        res.json({ success: true, chartData });
      } catch (error) {
        console.error('Error fetching treasury growth chart data:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch treasury growth chart data' });
      }
    }
  );
  
  return router;
};
```

## 7. Modèles de Données pour la Base de Données

```javascript
// models/distribution.js
const mongoose = require('mongoose');

const distributionSchema = new mongoose.Schema({
  sector: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: String,
    required: true
  },
  recipients: {
    type: Number,
    required: true
  },
  recipientAddresses: [{
    type: String
  }],
  individualAmount: {
    type: String,
    required: true
  },
  txHash: {
    type: String,
    sparse: true,
    index: true
  },
  blockNumber: {
    type: Number
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending'
  },
  error: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  processedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Distribution', distributionSchema);

// models/reward.js
const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
  distributionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distribution',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userAddress: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: String,
    required: true
  },
  txHash: {
    type: String,
    sparse: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  error: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  processedAt: {
    type: Date
  }
});

module.exports = mongoose.model('Reward', rewardSchema);

// models/contribution.js
const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
  contributor: {
    type: String,
    required: true,
    index: true
  },
  sector: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: String,
    required: true
  },
  platformFee: {
    type: String,
    required: true
  },
  auctionId: {
    type: String,
    required: true,
    index: true
  },
  txHash: {
    type: String,
    required: true,
    unique: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('Contribution', contributionSchema);
```

## 8. Script de Déploiement des Smart Contracts

```javascript
// scripts/deploy-treasury.js
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Étika Treasury and associated contracts...");

  // Récupérer les signers
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Déployer NFTPassport
  const NFTPassport = await ethers.getContractFactory("NFTPassport");
  const nftPassport = await NFTPassport.deploy();
  await nftPassport.deployed();
  console.log("NFTPassport deployed to:", nftPassport.address);

  // 2. Déployer EtikaTreasury
  const EtikaTreasury = await ethers.getContractFactory("EtikaTreasury");
  // Utiliser l'adresse du multisig pour la production, ou l'adresse du déployeur pour les tests
  const platformWallet = process.env.PLATFORM_WALLET || deployer.address;
  const treasury = await EtikaTreasury.deploy(platformWallet);
  await treasury.deployed();
  console.log("EtikaTreasury deployed to:", treasury.address);

  // 3. Déployer AuctionSystem
  const AuctionSystem = await ethers.getContractFactory("AuctionSystem");
  const auctionSystem = await AuctionSystem.deploy(treasury.address, nftPassport.address);
  await auctionSystem.deployed();
  console.log("AuctionSystem deployed to:", auctionSystem.address);

  // 4. Configurer les rôles
  // Donner le rôle AUCTION_ROLE au système d'enchères
  const AUCTION_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("AUCTION_ROLE"));
  await treasury.grantRole(AUCTION_ROLE, auctionSystem.address);
  console.log("Granted AUCTION_ROLE to AuctionSystem");

  // Donner le rôle UPDATER_ROLE au système d'enchères
  const UPDATER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("UPDATER_ROLE"));
  await nftPassport.grantRole(UPDATER_ROLE, deployer.address);
  console.log("Granted UPDATER_ROLE to deployer");

  // Donner le rôle AUCTION_ROLE au système d'enchères
  await nftPassport.grantRole(AUCTION_ROLE, auctionSystem.address);
  console.log("Granted AUCTION_ROLE to AuctionSystem");

  // 5. Ajouter des secteurs initiaux
  const sectors = [
    ethers.utils.formatBytes32String("telecom"),
    ethers.utils.formatBytes32String("energy"),
    ethers.utils.formatBytes32String("banking"),
    ethers.utils.formatBytes32String("insurance")
  ];

  for (const sector of sectors) {
    await treasury.addSector(sector);
    console.log(`Added sector: ${ethers.utils.parseBytes32String(sector)}`);
  }

  console.log("Deployment and initial configuration completed");
  
  // Afficher un résumé des adresses déployées
  console.log("\nDeployment Summary:");
  console.log("====================");
  console.log(`NFTPassport:   ${nftPassport.address}`);
  console.log(`EtikaTreasury: ${treasury.address}`);
  console.log(`AuctionSystem: ${auctionSystem.address}`);
  console.log(`Platform Wallet: ${platformWallet}`);
  console.log("\nInitial Sectors:");
  for (const sector of sectors) {
    console.log(`- ${ethers.utils.parseBytes32String(sector)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## 9. Interface Utilisateur du Tableau de Bord Public

```jsx
// TreasuryDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, Grid, Typography, Box, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatEther } from 'ethers/lib/utils';
import axios from 'axios';

function TreasuryDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [globalStats, setGlobalStats] = useState(null);
  const [selectedSector, setSelectedSector] = useState('');
  const [sectorStats, setSectorStats] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [contributions, setContributions] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [growthChartData, setGrowthChartData] = useState([]);
  const [sectors, setSectors] = useState([]);

  // Formater les montants en ETH avec 4 décimales
  const formatAmount = (amountWei) => {
    return parseFloat(formatEther(amountWei)).toFixed(4);
  };

  // Formater les dates
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  // Charger les statistiques globales
  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/treasury/stats');
        
        if (response.data.success) {
          setGlobalStats(response.data.stats);
          
          // Extraire les secteurs depuis les données
          if (response.data.stats.sectors) {
            setSectors(response.data.stats.sectors);
            
            // Sélectionner le premier secteur par défaut
            if (response.data.stats.sectors.length > 0 && !selectedSector) {
              setSelectedSector(response.data.stats.sectors[0]);
            }
          }
        } else {
          setError('Failed to fetch treasury statistics');
        }
      } catch (err) {
        setError('Error fetching treasury data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalStats();
  }, []);

  // Charger les données du secteur sélectionné
  useEffect(() => {
    if (selectedSector) {
      const fetchSectorStats = async () => {
        try {
          setLoading(true);
          const response = await axios.get(`/api/treasury/sector/${selectedSector}`);
          
          if (response.data.success) {
            setSectorStats(response.data.stats);
          } else {
            setError('Failed to fetch sector statistics');
          }
        } catch (err) {
          setError('Error fetching sector data: ' + err.message);
        } finally {
          setLoading(false);
        }
      };

      fetchSectorStats();
    }
  }, [selectedSector]);

  // Charger les contributions
  useEffect(() => {
    const fetchContributions = async () => {
      try {
        const response = await axios.get('/api/treasury/contributions');
        
        if (response.data.success) {
          setContributions(response.data.contributions);
        }
      } catch (err) {
        console.error('Error fetching contributions:', err);
      }
    };

    fetchContributions();
  }, []);

  // Charger les distributions
  useEffect(() => {
    const fetchDistributions = async () => {
      try {
        const response = await axios.get('/api/treasury/distributions');
        
        if (response.data.success) {
          setDistributions(response.data.distributions);
        }
      } catch (err) {
        console.error('Error fetching distributions:', err);
      }
    };

    fetchDistributions();
  }, []);

  // Charger les données du graphique de croissance
  useEffect(() => {
    const fetchGrowthChart = async () => {
      try {
        const response = await axios.get('/api/treasury/growth-chart');
        
        if (response.data.success) {
          setGrowthChartData(response.data.chartData);
        }
      } catch (err) {
        console.error('Error fetching growth chart data:', err);
      }
    };

    fetchGrowthChart();
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSectorChange = (sector) => {
    setSelectedSector(sector);
  };

  if (loading && !globalStats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error" variant="h6">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Étika - Tableau de Bord de la Caisse Commune
      </Typography>
      
      <Typography variant="subtitle1" gutterBottom>
        Ce tableau de bord présente les statistiques en temps réel de la caisse commune Étika. Tous les fonds sont redistribués aux consommateurs.
      </Typography>
      
      {globalStats && (
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <CardHeader title="Total Collecté" />
              <CardContent>
                <Typography variant="h4">{formatAmount(globalStats.totalCollected)} ETH</Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <CardHeader title="Distribué aux Consommateurs" />
              <CardContent>
                <Typography variant="h4">{formatAmount(globalStats.totalDistributed)} ETH</Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <CardHeader title="Disponible pour Distribution" />
              <CardContent>
                <Typography variant="h4">{formatAmount(globalStats.totalAvailable)} ETH</Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <CardHeader title="Frais de Plateforme" />
              <CardContent>
                <Typography variant="h4">{formatAmount(globalStats.totalPlatformFees)} ETH</Typography>
                <Typography variant="body2">({globalStats.platformFeePercentage}%)</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>Évolution de la Caisse Commune</Typography>
        
        <Paper sx={{ p: 2, height: 400 }}>
          {growthChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatAmount(value) + " ETH"} />
                <Legend />
                <Line type="monotone" dataKey="contributions" name="Contributions" stroke="#8884d8" />
                <Line type="monotone" dataKey="distributions" name="Distributions" stroke="#82ca9d" />
                <Line type="monotone" dataKey="netGrowth" name="Croissance Nette" stroke="#ff7300" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          )}
        </Paper>
      </Box>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>Détails par Secteur</Typography>
        
        <Box sx={{ mb: 2 }}>
          <Tabs value={sectors.indexOf(selectedSector)} onChange={(e, value) => handleSectorChange(sectors[value])}>
            {sectors.map((sector, index) => (
              <Tab key={index} label={sector} />
            ))}
          </Tabs>
        </Box>
        
        {sectorStats ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Statistiques du Secteur" />
                <CardContent>
                  <Typography variant="body1">Total collecté: {formatAmount(sectorStats.totalCollected)} ETH</Typography>
                  <Typography variant="body1">Distribué: {formatAmount(sectorStats.distributed)} ETH</Typography>
                  <Typography variant="body1">Disponible: {formatAmount(sectorStats.availableForDistribution)} ETH</Typography>
                  <Typography variant="body1">Nombre d'enchères: {sectorStats.auctionCount}</Typography>
                  <Typography variant="body1">Nombre de distributions: {sectorStats.distributionCount}</Typography>
                  <Typography variant="body1">Dernière distribution: {sectorStats.lastDistributionTime ? formatDate(sectorStats.lastDistributionTime * 1000) : 'Aucune'}</Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Dernières Enchères" />
                <CardContent>
                  {sectorStats.auctions && sectorStats.auctions.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Montant</TableCell>
                            <TableCell>État</TableCell>
                            <TableCell>Date</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sectorStats.auctions.slice(0, 5).map((auction, index) => (
                            <TableRow key={index}>
                              <TableCell>{auction.id.substring(0, 8)}...</TableCell>
                              <TableCell>{formatAmount(auction.highestBid)} ETH</TableCell>
                              <TableCell>{auction.finalized ? (auction.fundsTransferred ? 'Complétée' : 'Finalisée') : 'En cours'}</TableCell>
                              <TableCell>{formatDate(auction.endTime * 1000)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2">Aucune enchère pour ce secteur</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}
      </Box>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" gutterBottom>Historique des Transactions</Typography>
        
        <Box>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Contributions" />
            <Tab label="Distributions" />
          </Tabs>
          
          <Box sx={{ mt: 2 }}>
            {tabValue === 0 && (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Contributeur</TableCell>
                      <TableCell>Secteur</TableCell>
                      <TableCell>Montant</TableCell>
                      <TableCell>Enchère</TableCell>
                      <TableCell>Transaction</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {contributions.map((contribution, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(contribution.timestamp)}</TableCell>
                        <TableCell>{contribution.contributor.substring(0, 6)}...{contribution.contributor.substring(38)}</TableCell>
                        <TableCell>{contribution.sector}</TableCell>
                        <TableCell>{formatAmount(contribution.amount)} ETH</TableCell>
                        <TableCell>{contribution.auctionId.substring(0, 8)}...</TableCell>
                        <TableCell>
                          <a href={`https://mumbai.polygonscan.com/tx/${contribution.txHash}`} target="_blank" rel="noopener noreferrer">
                            {contribution.txHash.substring(0, 6)}...
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            
            {tabValue === 1 && (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Secteur</TableCell>
                      <TableCell>Montant Total</TableCell>
                      <TableCell>Bénéficiaires</TableCell>
                      <TableCell>Montant par Bénéficiaire</TableCell>
                      <TableCell>Transaction</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {distributions.map((distribution, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(distribution.timestamp)}</TableCell>
                        <TableCell>{distribution.sector}</TableCell>
                        <TableCell>{formatAmount(distribution.amount)} ETH</TableCell>
                        <TableCell>{distribution.recipients}</TableCell>
                        <TableCell>{formatAmount(distribution.individualAmount)} ETH</TableCell>
                        <TableCell>
                          {distribution.txHash && (
                            <a href={`https://mumbai.polygonscan.com/tx/${distribution.txHash}`} target="_blank" rel="noopener noreferrer">
                              {distribution.txHash.substring(0, 6)}...
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default TreasuryDashboard;
```

## Récapitulatif et Recommandations

L'implémentation proposée pour la Caisse Commune d'Étika en Phase 1 assure une gestion transparente et sécurisée des fonds collectés, avec 100% des contributions (après frais de plateforme) redistribuées aux consommateurs. Voici un récapitulatif des points clés :

### Points Forts de l'Architecture

1. **Transparence totale** :
   - Toutes les transactions sont enregistrées on-chain
   - Tableau de bord public montrant en temps réel les entrées et sorties
   - Historique complet des contributions et distributions

2. **Sécurité des fonds** :
   - Smart contracts avec contrôle d'accès strict (rôles)
   - Protection contre la réentrance et autres vulnérabilités
   - Possibilité d'ajouter une multi-signature pour les opérations critiques

3. **Flexibilité pour la Phase 2** :
   - Architecture modulaire permettant l'évolution vers un système de financement de projets
   - Possibilité d'ajouter une gouvernance participative ultérieurement

4. **Intégration avec les autres composants** :
   - Connexion avec le système d'enchères
   - Lien avec les NFT passeport pour la vérification des participations

### Prochaines Étapes Recommandées

1. **Audit des smart contracts** avant déploiement sur le testnet
2. **Tests de charge** du système de distribution
3. **Mise en place d'un système de monitoring** des transactions
4. **Finalisation de l'interface utilisateur** du tableau de bord public

Avec cette implémentation, la Caisse Commune respecte les exigences de la Phase 1, offrant une redistribution intégrale aux consommateurs tout en assurant la rémunération de la plateforme via un pourcentage configurable de frais.
# Implémentation de la Caisse Commune Étika - Phase 1

## Architecture proposée

Pour respecter les exigences de la Phase 1 concernant la Caisse Commune, j'ai conçu une architecture qui garantit la transparence des fonds et leur redistribution aux consommateurs, tout en permettant la rémunération de la plateforme.

### Vue d'ensemble

![Architecture de la Caisse Commune](https://mermaid.ink/img/pako:eNqlVMtu2zAQ_BViTimQtm2BOKdAaYveEuTApGubUB62Ntv0j-8uKVmKHLuPIJJA7c7OcnYXfFe1LbAA76qO7OeWq9UDZmDDTnS7Hcn--W0FtcHKVQ35TpRb8A3xyiS4pn79BGzGJsHSoXtxhavQS7Z5uNtArbdYgUUh0DyL5Bwq4yfsbVLvJv8JVhm6tLXdvuR5bwp0qbeqiirspZePbBxqJ1HB0jGzH7QrQlG74XQA96L09sDO4ULGf9kNrpGM8k6zrzGZoSfpjuM73nluODV_BRd4Rk55p33wJ_QDXAplU5d6gZlb4YODFYrCJVjKvd_BKnFwxm0hD0IbIWFXkUZRO01wNmEUFr8wlUj6eK5I4lk9IHCKTALrG64p6GmUOyvMW80HqOHh-tyJTkwpcfBucSP65n3jm0i6jcGNJpcdGmzrwDNv4Ay8VsY3Oo58_bpxZ7jRVpEvLAVpySfvx5Egur6FMo21aZz7PxdK-jEy7fQZqqwFPDLB4sCNd5UqJAWnU6A8LJMRSU_9STf8_mM2NrQ0jmBWO5dZcxKQUVNIMXolVkXQc3LL9hJvuG8VGypB_iL4L0TfYmOcRWZ80oVYYPDCGJoJzm5YY9p4EotE9ZxbXaBMmrFJCrG3-hMFbtoXWYlECVuNIj6L-aB9pbxb_gZ66BhZ)

L'architecture comprend :

1. **Smart Contracts principaux** :
   - `EtikaTreasury`: Gestion de la caisse commune
   - `AuctionSystem`: Système d'enchères
   - `NFTPassport`: Gestion des NFT passeports

2. **Services backend** :
   - Service de gestion des transactions
   - Service de tableau de bord
   - Service de vérification

3. **Interfaces utilisateur** :
   - Dashboard public
   - Interface de gestion des enchères
   - Page de suivi des récompenses

## Smart Contracts

### 1. EtikaTreasury Contract

Ce contrat gère la caisse commune, collecte les fonds et gère les distributions.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title EtikaTreasury
 * @dev Contrat de gestion de la caisse commune d'Étika
 */
contract EtikaTreasury is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant AUCTION_ROLE = keccak256("AUCTION_ROLE");
    
    // Pourcentage pour la rémunération de la plateforme (en points de base, 100 = 1%)
    uint256 public platformFeePercentage = 500; // 5% par défaut
    
    // Adresse du wallet de la plateforme
    address public platformWallet;
    
    // Structure pour suivre les contributions par secteur
    struct SectorBalance {
        uint256 totalCollected;
        uint256 availableForDistribution;
        uint256 distributed;
        uint256 platformFees;
        uint256 lastDistributionTime;
    }
    
    // Mapping des soldes par secteur
    mapping(bytes32 => SectorBalance) public sectorBalances;
    
    // Liste des secteurs
    bytes32[] public sectors;
    
    // Structure pour les événements de contribution
    struct ContributionEvent {
        address contributor;
        bytes32 sector;
        uint256 amount;
        uint256 timestamp;
        string auctionId;
    }
    
    // Structure pour les événements de distribution
    struct DistributionEvent {
        bytes32 sector;
        uint256 amount;
        uint256 recipients;
        uint256 timestamp;
    }
    
    // Structure pour les événements de frais de plateforme
    struct PlatformFeeEvent {
        bytes32 sector;
        uint256 amount;
        uint256 timestamp;
    }
    
    // Événements
    event ContributionReceived(address indexed contributor, bytes32 indexed sector, uint256 amount, string auctionId);
    event DistributionProcessed(bytes32 indexed sector, uint256 amount, uint256 recipients);
    event PlatformFeePaid(bytes32 indexed sector, uint256 amount);
    event PlatformFeePercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event PlatformWalletUpdated(address oldWallet, address newWallet);
    event SectorAdded(bytes32 sector);
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    
    // Historique des événements (optionnel, pour transparence additionnelle on-chain)
    ContributionEvent[] public contributionHistory;
    DistributionEvent[] public distributionHistory;
    PlatformFeeEvent[] public platformFeeHistory;
    
    /**
     * @dev Constructeur
     * @param _platformWallet Adresse du wallet de la plateforme
     */
    constructor(address _platformWallet) {
        require(_platformWallet != address(0), "Zero address not allowed");
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        
        platformWallet = _platformWallet;
    }
    
    /**
     * @dev Ajoute un nouveau secteur
     * @param sector Identifiant du secteur
     */
    function addSector(bytes32 sector) external onlyRole(ADMIN_ROLE) {
        require(sectorBalances[sector].totalCollected == 0, "Sector already exists");
        
        sectorBalances[sector] = SectorBalance({
            totalCollected: 0,
            availableForDistribution: 0,
            distributed: 0,
            platformFees: 0,
            lastDistributionTime: 0
        });
        
        sectors.push(sector);
        
        emit SectorAdded(sector);
    }
    
    /**
     * @dev Reçoit une contribution d'un sponsor (appelé par le système d'enchères)
     * @param sector Secteur concerné
     * @param amount Montant de la contribution
     * @param auctionId ID de l'enchère associée
     */
    function receiveContribution(bytes32 sector, uint256 amount, string calldata auctionId) 
        external 
        payable 
        onlyRole(AUCTION_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(sectorBalances[sector].totalCollected > 0 || amount > 0, "Sector does not exist");
        require(amount > 0, "Amount must be greater than 0");
        require(msg.value == amount, "Sent value does not match amount");
        
        // Calculer les frais de plateforme
        uint256 platformFee = (amount * platformFeePercentage) / 10000;
        uint256 netAmount = amount - platformFee;
        
        // Mettre à jour les soldes
        sectorBalances[sector].totalCollected += amount;
        sectorBalances[sector].availableForDistribution += netAmount;
        sectorBalances[sector].platformFees += platformFee;
        
        // Enregistrer la contribution dans l'historique
        contributionHistory.push(ContributionEvent({
            contributor: tx.origin,
            sector: sector,
            amount: amount,
            timestamp: block.timestamp,
            auctionId: auctionId
        }));
        
        emit ContributionReceived(tx.origin, sector, amount, auctionId);
    }
    
    /**
     * @dev Distribue les fonds aux consommateurs
     * @param sector Secteur concerné
     * @param amount Montant à distribuer
     * @param recipients Nombre de destinataires
     * @param recipientData Données encodées des destinataires (pour l'émission d'événements)
     */
    function distributeToConsumers(bytes32 sector, uint256 amount, uint256 recipients, bytes calldata recipientData) 
        external 
        onlyRole(OPERATOR_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(sectorBalances[sector].availableForDistribution >= amount, "Insufficient funds available for distribution");
        require(amount > 0, "Amount must be greater than 0");
        require(recipients > 0, "Must have at least one recipient");
        
        // Mettre à jour les soldes
        sectorBalances[sector].availableForDistribution -= amount;
        sectorBalances[sector].distributed += amount;
        sectorBalances[sector].lastDistributionTime = block.timestamp;
        
        // Enregistrer la distribution dans l'historique
        distributionHistory.push(DistributionEvent({
            sector: sector,
            amount: amount,
            recipients: recipients,
            timestamp: block.timestamp
        }));
        
        emit DistributionProcessed(sector, amount, recipients);
        
        // Note: La distribution réelle est gérée hors chaîne pour l'efficacité du gaz
        // Le recipientData est utilisé pour l'émission d'événements et la transparence
    }
    
    /**
     * @dev Collecte les frais de plateforme
     * @param sector Secteur concerné
     */
    function collectPlatformFees(bytes32 sector) 
        external 
        onlyRole(ADMIN_ROLE) 
        nonReentrant 
    {
        uint256 fees = sectorBalances[sector].platformFees;
        require(fees > 0, "No fees to collect");
        
        // Réinitialiser avant le transfert (pattern Checks-Effects-Interactions)
        sectorBalances[sector].platformFees = 0;
        
        // Enregistrer dans l'historique
        platformFeeHistory.push(PlatformFeeEvent({
            sector: sector,
            amount: fees,
            timestamp: block.timestamp
        }));
        
        emit PlatformFeePaid(sector, fees);
        
        // Transférer les frais au wallet de la plateforme
        (bool success, ) = platformWallet.call{value: fees}("");
        require(success, "Fee transfer failed");
    }
    
    /**
     * @dev Met à jour le pourcentage des frais de plateforme
     * @param newPercentage Nouveau pourcentage (en points de base, 100 = 1%)
     */
    function updatePlatformFeePercentage(uint256 newPercentage) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(newPercentage <= 2000, "Fee cannot exceed 20%");
        
        uint256 oldPercentage = platformFeePercentage;
        platformFeePercentage = newPercentage;
        
        emit PlatformFeePercentageUpdated(oldPercentage, newPercentage);
    }
    
    /**
     * @dev Met à jour l'adresse du wallet de la plateforme
     * @param newWallet Nouvelle adresse
     */
    function updatePlatformWallet(address newWallet) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(newWallet != address(0), "Zero address not allowed");
        
        address oldWallet = platformWallet;
        platformWallet = newWallet;
        
        emit PlatformWalletUpdated(oldWallet, newWallet);
    }
    
    /**
     * @dev Retrait d'urgence en cas de problème critique
     * @param to Adresse de destination
     * @param amount Montant à retirer
     */
    function emergencyWithdraw(address to, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        nonReentrant 
    {
        require(to != address(0), "Cannot withdraw to zero address");
        require(amount <= address(this).balance, "Insufficient balance");
        
        emit EmergencyWithdrawal(to, amount);
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Met en pause le contrat
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Reprend le contrat
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Obtient la liste complète des secteurs
     * @return Liste des secteurs
     */
    function getAllSectors() external view returns (bytes32[] memory) {
        return sectors;
    }
    
    /**
     * @dev Obtient les statistiques d'un secteur
     * @param sector Identifiant du secteur
     * @return totalCollected Montant total collecté
     * @return availableForDistribution Montant disponible pour distribution
     * @return distributed Montant déjà distribué
     * @return platformFees Frais de plateforme accumulés
     * @return lastDistributionTime Timestamp de la dernière distribution
     */
    function getSectorStats(bytes32 sector) 
        external 
        view 
        returns (
            uint256 totalCollected,
            uint256 availableForDistribution,
            uint256 distributed,
            uint256 platformFees,
            uint256 lastDistributionTime
        ) 
    {
        SectorBalance memory balance = sectorBalances[sector];
        
        return (
            balance.totalCollected,
            balance.availableForDistribution,
            balance.distributed,
            balance.platformFees,
            balance.lastDistributionTime
        );
    }
    
    /**
     * @dev Obtient le solde total du contrat
     * @return Solde en wei
     */
    function getTotalBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Gère la réception de fonds (fallback)
     */
    receive() external payable {
        // Les fonds reçus directement sont considérés comme des contributions non attribuées
        // Ils seront réattribués manuellement par l'admin
    }
}
```

### 2. Modification d'AuctionSystem pour l'intégration avec la caisse commune

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./EtikaTreasury.sol";
import "./NFTPassport.sol";

/**
 * @title AuctionSystem
 * @dev Système d'enchères Étika avec intégration à la caisse commune
 */
contract AuctionSystem is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Référence au contrat de la caisse commune
    EtikaTreasury public treasury;
    
    // Référence au contrat des NFT passeports
    NFTPassport public nftPassport;
    
    // Structure pour les enchères
    struct Auction {
        string id;            // ID unique de l'enchère
        address creator;      // Créateur de l'enchère (admin)
        bytes32 sector;       // Secteur de l'enchère
        uint256 startingPrice;// Prix de départ
        uint256 minBidIncrement; // Incrément minimum entre les offres
        uint256 startTime;    // Timestamp de début
        uint256 endTime;      // Timestamp de fin
        address highestBidder;// Adresse du plus offrant
        uint256 highestBid;   // Montant de l'offre la plus élevée
        bool finalized;       // Si l'enchère a été finalisée
        bool fundsTransferred;// Si les fonds ont été transférés à la caisse commune
        string metadata;      // Métadonnées de l'enchère (IPFS URI ou JSON)
    }
    
    // Structure pour les offres
    struct Bid {
        address bidder;       // Adresse de l'enchérisseur
        uint256 amount;       // Montant de l'offre
        uint256 timestamp;    // Timestamp de l'offre
    }
    
    // Mapping des enchères
    mapping(string => Auction) public auctions;
    
    // Mapping des offres par enchère
    mapping(string => Bid[]) public auctionBids;
    
    // Liste des IDs d'enchères
    string[] public auctionIds;
    
    // Événements
    event AuctionCreated(string indexed auctionId, bytes32 indexed sector, uint256 startingPrice, uint256 startTime, uint256 endTime);
    event BidPlaced(string indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionFinalized(string indexed auctionId, address indexed winner, uint256 winningBid);
    event FundsTransferred(string indexed auctionId, bytes32 indexed sector, uint256 amount);
    
    /**
     * @dev Constructeur
     * @param _treasuryAddress Adresse du contrat de la caisse commune
     * @param _nftPassportAddress Adresse du contrat des NFT passeports
     */
    constructor(address _treasuryAddress, address _nftPassportAddress) {
        require(_treasuryAddress != address(0), "Treasury address cannot be zero");
        require(_nftPassportAddress != address(0), "NFT Passport address cannot be zero");
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(OPERATOR_ROLE, msg.sender);
        
        treasury = EtikaTreasury(_treasuryAddress);
        nftPassport = NFTPassport(_nftPassportAddress);
    }
    
    /**
     * @dev Crée une nouvelle enchère
     * @param auctionId ID unique de l'enchère
     * @param sector Secteur de l'enchère
     * @param startingPrice Prix de départ
     * @param minBidIncrement Incrément minimum entre les offres
     * @param startTime Timestamp de début
     * @param endTime Timestamp de fin
     * @param metadata Métadonnées de l'enchère
     */
    function createAuction(
        string calldata auctionId,
        bytes32 sector,
        uint256 startingPrice,
        uint256 minBidIncrement,
        uint256 startTime,
        uint256 endTime,
        string calldata metadata
    ) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenNotPaused 
    {
        require(bytes(auctionId).length > 0, "Auction ID cannot be empty");
        require(auctions[auctionId].creator == address(0), "Auction ID already exists");
        require(endTime > startTime, "End time must be after start time");
        require(startTime >= block.timestamp, "Start time must be in the future");
        
        Auction memory newAuction = Auction({
            id: auctionId,
            creator: msg.sender,
            sector: sector,
            startingPrice: startingPrice,
            minBidIncrement: minBidIncrement,
            startTime: startTime,
            endTime: endTime,
            highestBidder: address(0),
            highestBid: 0,
            finalized: false,
            fundsTransferred: false,
            metadata: metadata
        });
        
        auctions[auctionId] = newAuction;
        auctionIds.push(auctionId);
        
        emit AuctionCreated(auctionId, sector, startingPrice, startTime, endTime);
    }
    
    /**
     * @dev Place une offre sur une enchère
     * @param auctionId ID de l'enchère
     */
    function placeBid(string calldata auctionId) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
    {
        Auction storage auction = auctions[auctionId];
        
        require(bytes(auction.id).length > 0, "Auction does not exist");
        require(block.timestamp >= auction.startTime, "Auction has not started yet");
        require(block.timestamp < auction.endTime, "Auction has ended");
        require(!auction.finalized, "Auction has been finalized");
        
        // Vérifier que l'enchérisseur a un passeport NFT valide
        require(nftPassport.hasValidPassport(msg.sender), "Bidder does not have a valid passport");
        
        // Vérifier le montant de l'enchère
        uint256 minBid = auction.highestBid > 0 
            ? auction.highestBid + auction.minBidIncrement 
            : auction.startingPrice;
            
        require(msg.value >= minBid, "Bid amount too low");
        
        // Rembourser l'enchérisseur précédent
        if (auction.highestBidder != address(0)) {
            (bool refundSuccess, ) = auction.highestBidder.call{value: auction.highestBid}("");
            require(refundSuccess, "Failed to refund previous bidder");
        }
        
        // Mettre à jour l'enchère
        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;
        
        // Enregistrer l'enchère
        auctionBids[auctionId].push(Bid({
            bidder: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));
        
        // Enregistrer la participation au NFT passeport
        nftPassport.recordParticipation(
            nftPassport.getPassportId(msg.sender),
            auction.sector,
            auctionId
        );
        
        emit BidPlaced(auctionId, msg.sender, msg.value);
    }
    
    /**
     * @dev Finalise une enchère terminée
     * @param auctionId ID de l'enchère
     */
    function finalizeAuction(string calldata auctionId) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
    {
        Auction storage auction = auctions[auctionId];
        
        require(bytes(auction.id).length > 0, "Auction does not exist");
        require(block.timestamp >= auction.endTime, "Auction is still ongoing");
        require(!auction.finalized, "Auction already finalized");
        
        auction.finalized = true;
        
        // Si aucune enchère n'a été placée, aucune action n'est nécessaire
        if (auction.highestBidder == address(0)) {
            emit AuctionFinalized(auctionId, address(0), 0);
            return;
        }
        
        emit AuctionFinalized(auctionId, auction.highestBidder, auction.highestBid);
    }
    
    /**
     * @dev Transfère les fonds de l'enchère à la caisse commune
     * @param auctionId ID de l'enchère
     */
    function transferFundsToTreasury(string calldata auctionId) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
    {
        Auction storage auction = auctions[auctionId];
        
        require(bytes(auction.id).length > 0, "Auction does not exist");
        require(auction.finalized, "Auction not finalized yet");
        require(!auction.fundsTransferred, "Funds already transferred");
        require(auction.highestBidder != address(0), "No winning bid");
        
        auction.fundsTransferred = true;
        
        // Transférer les fonds à la caisse commune
        treasury.receiveContribution{value: auction.highestBid}(
            auction.sector,
            auction.highestBid,
            auction.id
        );
        
        emit FundsTransferred(auctionId, auction.sector, auction.highestBid);
    }
    
    /**
     * @dev Obtient les détails d'une enchère
     * @param auctionId ID de l'enchère
     */
    function getAuctionDetails(string calldata auctionId) 
        external 
        view 
        returns (
            address creator,
            bytes32 sector,
            uint256 startingPrice,
            uint256 minBidIncrement,
            uint256 startTime,
            uint256 endTime,
            address highestBidder,
            uint256 highestBid,
            bool finalized,
            bool fundsTransferred,
            string memory metadata
        ) 
    {
        Auction memory auction = auctions[auctionId];
        require(bytes(auction.id).length > 0, "Auction does not exist");
        
        return (
            auction.creator,
            auction.sector,
            auction.startingPrice,
            auction.minBidIncrement,
            auction.startTime,
            auction.endTime,
            auction.highestBidder,
            auction.highestBid,
            auction.finalized,
            auction.fundsTransferred,
            auction.metadata
        );
    }
    
    /**
     * @dev Obtient toutes les offres pour une enchère
     * @param auctionId ID de l'enchère
     */
    function getAuctionBids(string calldata auctionId) 
        external 
        view 
        returns (Bid[] memory) 
    {
        return auctionBids[auctionId];
    }
    
    /**
     * @dev Obtient tous les IDs d'enchères
     */
    function getAllAuctionIds() external view returns (string[] memory) {
        return auctionIds;
    }
    
    /**
     * @dev Retrait d'urgence en cas de problème critique
     * @param to Adresse de destination
     * @param amount Montant à retirer
     */
    function emergencyWithdraw(address to, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        nonReentrant 
    {
        require(to != address(0), "Cannot withdraw to zero address");
        require(amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Met en pause le contrat
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Reprend le contrat
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
```

### 3. Ajustements au NFTPassport pour l'intégration

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Importations OpenZeppelin
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title NFTPassport
 * @dev NFT unique par participant permettant d'accéder aux enchères et de suivre les participations
 */
contract NFTPassport is ERC721URIStorage, AccessControl, Pausable {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;
    
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    bytes32 public constant AUCTION_ROLE = keccak256("AUCTION_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    Counters.Counter private _tokenIdCounter;
    
    // Mapping depuis l'adresse de l'utilisateur vers son tokenId
    mapping(address => uint256) private _userTokens;
    
    // Mapping pour les NFT blacklistés
    mapping(uint256 => bool) private _blacklistedTokens;
    
    // Mapping pour garder trace du nombre d'enchères par participant
    mapping(uint256 => uint256) private _auctionParticipationCount;
    
    // Mapping pour
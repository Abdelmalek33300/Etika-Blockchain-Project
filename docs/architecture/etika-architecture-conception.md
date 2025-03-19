# Architecture Optimisée pour la Plateforme Étika

## Architecture Globale

Je recommande une architecture moderne, scalable et modulaire qui répond aux besoins immédiats tout en permettant une évolution future. Voici l'architecture proposée :

![Architecture Étika](https://mermaid.ink/img/pako:eNqlVMtu2zAQ_BViTm2Bvm0DQbkUaBv01OTAyGuZqB6MqJDboP_eJSnZih-N26IAA1CzM7uaWdIvRtqKiYlZ4PvkVoLyuF_cLK4vl4v7X7C8C5rXjmCDtUeBGgv7fL7A3Vq8nS9urm5vl1_mi2t5sXoBhiQokhpMC2D4DtFj4DQb9T59k2LKO2N986R1R9Ix3G5ksFC7SoqjC7kBX1cQEGwF2h9EaZw0JrYxgKfbDysFMhFZSKwxRLXvXN2mELFznYeH5OvdK7gYGCpP-uCz6NNoLqyxTaxeGxuDXynvHPh3rBMVGwJqlIYygjGdv7y5mJWCKIrjd3I0FdTTJQ3IH-_mC-RsdkhP4WD6XZa2yiIyK8iGZCMRhwqUF06CrXn0YIUNsLMXJUmzZHdPXv7ycHEa1GdJ2-hSxcxqZBekCj0kD-Yx5FfCvGQTp0a1wsFRatDcPLfhpfkQG1Dg_nzaVKNcVPRLvwKXe6ebLnH0CnLT1PQM6-UQJgQ4IHVGRUVUgdsZGe-JRkDcK2CG1VFllBFtgRVYnxWE8Txo4xXQFQkVkEqdlYIvNhfkv87TXZrDzoxXTpfA3LQdBf9RbeMb5lQoqEilE1T8G4iSNY-_idEjzqDpRc2Rw7EF2Fj9IWIQ7VnDokRtYmRQYxwZHeXCnuEwqtAjk5ymlk2URUeDJDkLqjVGcUz0RDMZGa_CJlZHNk7HKSp9FPPKW5NE2dMJkVEf24qPJmDTomvq_hzqTCdtgWe0D1YqbNnkUKfKVe8yQ9G4fBDjzlWaxvZ7tC5dI1VBewJGfnBCZ_iKQzRTaS2bHTY6lc-mxG0-wB6MZpPnvf0LeKQrLw)

### 1. Frontend (Client)
- **Framework** : React.js avec TypeScript
- **State Management** : Redux ou Context API
- **UI Components** : Material-UI ou Tailwind CSS
- **Web3 Interaction** : ethers.js

### 2. API Layer
- **Framework** : Node.js avec Express ou NestJS
- **Authentication** : JWT avec refresh tokens
- **Documentation** : OpenAPI (Swagger)
- **Rate Limiting** : Pour prévenir les abus

### 3. Backend Services (Microservices)
- **User Service** : Gestion des utilisateurs et authentification
- **Auction Service** : Logique des enchères et gestion des offres
- **NFT Passport Service** : Gestion des passeports NFT
- **Cache Service** : Redis pour les mises en cache
- **Queue Service** : RabbitMQ pour la gestion des tâches asynchrones

### 4. Blockchain Integration
- **Smart Contracts** : Solidity sur Polygon (testnet Mumbai)
- **Contract Interaction** : Web3.js ou ethers.js
- **Transaction Monitoring** : Service dédié pour suivre l'état des transactions

### 5. Data Storage
- **Primary Database** : PostgreSQL
- **Metadata Storage** : IPFS via Pinata ou nft.storage
- **Cache Layer** : Redis
- **Analytics Storage** : TimescaleDB ou InfluxDB pour les métriques de performance

### 6. Infrastructure
- **Hosting** : AWS, Google Cloud ou Azure
- **CI/CD** : GitHub Actions ou GitLab CI
- **Containers** : Docker avec orchestration Kubernetes
- **Monitoring** : Prometheus + Grafana

## Intégration des Corrections et Améliorations

### 1. Résilience des Transactions de Mint des NFT

**Implémentation** :

```javascript
// Dans NFTPassportService.js

class NFTPassportService {
  constructor(blockchainService, queueService, configService, dbService) {
    this.blockchainService = blockchainService;
    this.queueService = queueService;
    this.configService = configService;
    this.dbService = dbService;
    
    // Initialiser la file d'attente de mint
    this.mintQueue = this.queueService.createQueue('nft-passport-mint', {
      attempts: 5,  // Nombre max de tentatives
      backoff: {
        type: 'exponential',
        delay: 5000  // Délai initial entre les tentatives (5 secondes)
      }
    });
    
    // Écouter les événements blockchain
    this.setupEventListeners();
  }
  
  /**
   * Crée un NFT passeport pour un utilisateur
   */
  async createPassport(userId, userAddress) {
    try {
      // Vérifier si l'utilisateur a déjà un passeport en cours de mint
      const pendingMint = await this.dbService.findOne('pendingMints', { userAddress });
      
      if (pendingMint) {
        // Si le mint est en attente depuis plus de 30 minutes, le considérer comme échoué
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        if (pendingMint.createdAt < thirtyMinutesAgo) {
          // Marquer comme expiré
          await this.dbService.updateOne('pendingMints', 
            { userAddress }, 
            { $set: { status: 'expired', updatedAt: new Date() } }
          );
        } else {
          // Mint encore en cours
          return {
            success: false,
            status: 'pending',
            message: 'Passport creation already in progress'
          };
        }
      }
      
      // Vérifier si l'utilisateur a déjà un passeport
      const existingPassport = await this.getPassportByUser(userAddress);
      
      if (existingPassport) {
        return {
          success: true,
          status: 'exists',
          passport: existingPassport,
          message: 'User already has a passport'
        };
      }
      
      // Créer une entrée pour le mint en attente
      const pendingMintRecord = {
        userId,
        userAddress,
        status: 'pending',
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.dbService.insertOne('pendingMints', pendingMintRecord);
      
      // Ajouter à la file d'attente
      await this.mintQueue.add('mint-passport', {
        userId,
        userAddress,
        initialMetadata: this._generateInitialMetadata(userAddress)
      });
      
      return {
        success: true,
        status: 'queued',
        message: 'Passport creation has been queued'
      };
    } catch (error) {
      console.error('Error creating passport:', error);
      return {
        success: false,
        status: 'error',
        message: error.message || 'Unknown error occurred'
      };
    }
  }
  
  /**
   * Configuration des écouteurs d'événements blockchain
   */
  setupEventListeners() {
    // Écouter les événements PassportMinted
    this.blockchainService.listenToEvent('PassportMinted', async (event) => {
      const { to: userAddress, tokenId } = event.args;
      
      // Mettre à jour la base de données
      await this.dbService.updateOne('pendingMints', 
        { userAddress, status: 'pending' }, 
        { 
          $set: { 
            status: 'completed', 
            tokenId: tokenId.toString(), 
            completedAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
      
      // Créer l'enregistrement du passeport
      await this.dbService.insertOne('passports', {
        tokenId: tokenId.toString(),
        userAddress,
        status: 'active',
        participationCount: 0,
        sectors: [],
        createdAt: new Date()
      });
      
      console.log(`Passport #${tokenId} minted successfully for ${userAddress}`);
    });
  }
  
  /**
   * Vérifie et récupère les mints échoués
   */
  async recoverFailedMints() {
    // Trouver les mints en attente depuis trop longtemps
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const failedMints = await this.dbService.find('pendingMints', {
      status: 'pending',
      createdAt: { $lt: twoHoursAgo },
      attempts: { $lt: 5 }
    });
    
    console.log(`Found ${failedMints.length} failed mints to recover`);
    
    // Remettre en file d'attente
    for (const mint of failedMints) {
      await this.dbService.updateOne('pendingMints', 
        { _id: mint._id }, 
        { 
          $inc: { attempts: 1 }, 
          $set: { updatedAt: new Date() } 
        }
      );
      
      await this.mintQueue.add('mint-passport', {
        userId: mint.userId,
        userAddress: mint.userAddress,
        initialMetadata: this._generateInitialMetadata(mint.userAddress),
        isRecovery: true,
        previousAttempts: mint.attempts
      }, {
        priority: 10  // Priorité plus élevée pour les récupérations
      });
      
      console.log(`Requeued mint for ${mint.userAddress}, attempt ${mint.attempts + 1}`);
    }
    
    return {
      success: true,
      recoveredCount: failedMints.length
    };
  }
  
  /**
   * Génère les métadonnées initiales pour un passeport
   */
  _generateInitialMetadata(userAddress) {
    return {
      name: `NFT Étika - Passeport Enchères`,
      description: `Ce NFT permet de participer à toutes les enchères sur la plateforme Étika.`,
      image: `${this.configService.get('BASE_IMAGE_URL')}/passport-image/initial`,
      attributes: [
        { trait_type: "Participant", value: userAddress },
        { trait_type: "Total Enchères Participées", value: 0 },
        { trait_type: "Dernière Enchère", value: "Aucune enchère" },
        { trait_type: "Historique des Enchères", value: [] }
      ]
    };
  }
}
```

**Implémentation du worker de file d'attente** :

```javascript
// Dans workers/nft-passport-worker.js

const { Worker } = require('bullmq');
const { ethers } = require('ethers');
const ipfsClient = require('./ipfs-client');

class NFTPassportWorker {
  constructor(blockchainService, dbService) {
    this.blockchainService = blockchainService;
    this.dbService = dbService;
    
    this.worker = new Worker('nft-passport-mint', this.processJob.bind(this), {
      connection: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      },
      concurrency: 5 // Traiter 5 mints simultanément
    });
    
    this.worker.on('completed', this.onJobCompleted.bind(this));
    this.worker.on('failed', this.onJobFailed.bind(this));
  }
  
  /**
   * Traite un job de mint
   */
  async processJob(job) {
    const { userId, userAddress, initialMetadata, isRecovery, previousAttempts } = job.data;
    
    console.log(`Processing mint job for ${userAddress}${isRecovery ? ' (recovery)' : ''}`);
    
    try {
      // Vérifier à nouveau si l'utilisateur a déjà un passeport (double-check)
      const existingPassport = await this.blockchainService.getPassportId(userAddress);
      
      if (existingPassport && existingPassport.tokenId !== '0') {
        console.log(`User ${userAddress} already has passport #${existingPassport.tokenId}, skipping mint`);
        
        // Mettre à jour l'enregistrement
        await this.dbService.updateOne('pendingMints', 
          { userAddress, status: 'pending' }, 
          { 
            $set: { 
              status: 'completed', 
              tokenId: existingPassport.tokenId, 
              completedAt: new Date(),
              updatedAt: new Date(),
              note: 'Passport already exists on-chain'
            } 
          }
        );
        
        return { success: true, status: 'exists', tokenId: existingPassport.tokenId };
      }
      
      // Téléverser les métadonnées sur IPFS
      const metadataHash = await ipfsClient.add(JSON.stringify(initialMetadata));
      const metadataUri = `ipfs://${metadataHash}`;
      
      // Effectuer le mint
      const tx = await this.blockchainService.mintPassport(userAddress, metadataUri);
      
      // Attendre la confirmation
      const receipt = await tx.wait(2); // Attendre 2 confirmations
      
      // Le reste du traitement est géré par l'écouteur d'événements PassportMinted
      
      return { 
        success: true, 
        txHash: receipt.transactionHash 
      };
    } catch (error) {
      console.error(`Error minting passport for ${userAddress}:`, error);
      
      // Mettre à jour les tentatives
      const attempts = (previousAttempts || 0) + 1;
      await this.dbService.updateOne('pendingMints', 
        { userAddress, status: 'pending' }, 
        { 
          $set: { 
            attempts,
            lastError: error.message,
            updatedAt: new Date()
          } 
        }
      );
      
      // Si nous avons atteint le nombre maximum de tentatives
      if (attempts >= 5) {
        await this.dbService.updateOne('pendingMints', 
          { userAddress, status: 'pending' }, 
          { $set: { status: 'failed', updatedAt: new Date() } }
        );
        
        // Notifier l'administrateur
        // ...
      }
      
      throw error;
    }
  }
  
  /**
   * Appelé lorsqu'un job est complété avec succès
   */
  onJobCompleted(job, result) {
    console.log(`Mint job completed for user: ${job.data.userAddress}`, result);
  }
  
  /**
   * Appelé lorsqu'un job échoue
   */
  onJobFailed(job, error) {
    console.error(`Mint job failed for user: ${job.data.userAddress}`, error);
  }
}

module.exports = NFTPassportWorker;
```

### 2. Protection contre les Mises à Jour Simultanées des NFT

**Implémentation de la file d'attente de mise à jour des métadonnées** :

```javascript
// Dans NFTMetadataService.js

class NFTMetadataService {
  constructor(queueService, ipfsClient, blockchainService, dbService) {
    this.queueService = queueService;
    this.ipfsClient = ipfsClient;
    this.blockchainService = blockchainService;
    this.dbService = dbService;
    
    // File d'attente pour les mises à jour de métadonnées
    this.updateQueue = this.queueService.createQueue('nft-metadata-update', {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });
    
    // Maps pour suivre les mises à jour en cours
    this.processingUpdates = new Map();
  }
  
  /**
   * Planifie une mise à jour de métadonnées
   * @param {string} tokenId - ID du token à mettre à jour
   * @param {string} userAddress - Adresse du propriétaire
   * @param {Object} updateData - Données de mise à jour (enchère, secteur, etc.)
   */
  async scheduleMetadataUpdate(tokenId, userAddress, updateData) {
    // Vérifier si une mise à jour est déjà en cours pour ce token
    const lockKey = `metadata-update-${tokenId}`;
    
    if (this.processingUpdates.has(lockKey)) {
      console.log(`Update already in progress for token ${tokenId}, updating data`);
      
      // Mettre à jour les données pour la mise à jour en cours
      const currentJob = this.processingUpdates.get(lockKey);
      currentJob.data = { ...currentJob.data, ...updateData };
      
      return {
        success: true,
        status: 'merged',
        message: 'Update merged with existing job'
      };
    }
    
    // Créer un objet de lock
    const lock = {
      tokenId,
      userAddress,
      data: updateData,
      createdAt: Date.now()
    };
    
    this.processingUpdates.set(lockKey, lock);
    
    // Ajouter à la file d'attente
    const job = await this.updateQueue.add('update-metadata', {
      tokenId,
      userAddress,
      updateData
    });
    
    return {
      success: true,
      status: 'queued',
      jobId: job.id,
      message: 'Metadata update queued'
    };
  }
  
  /**
   * Traite la mise à jour des métadonnées
   */
  async processMetadataUpdate(tokenId, userAddress, updateData) {
    const lockKey = `metadata-update-${tokenId}`;
    
    try {
      // 1. Récupérer les métadonnées actuelles
      const currentMetadata = await this.getCurrentMetadata(tokenId);
      
      // 2. Fusionner avec les mises à jour
      const updatedMetadata = this.mergeMetadata(currentMetadata, updateData);
      
      // 3. Téléverser sur IPFS
      const { cid } = await this.ipfsClient.add(JSON.stringify(updatedMetadata));
      const newUri = `ipfs://${cid}`;
      
      // 4. Mettre à jour le token URI sur la blockchain
      const tx = await this.blockchainService.updateTokenURI(tokenId, newUri);
      await tx.wait(1);
      
      // 5. Enregistrer la mise à jour dans la base de données
      await this.dbService.insertOne('metadataUpdates', {
        tokenId,
        ipfsUri: newUri,
        ipfsHash: cid,
        previousUri: currentMetadata.uri,
        updateData,
        txHash: tx.hash,
        createdAt: new Date()
      });
      
      // 6. Mettre à jour le passeport dans la base de données
      await this.updatePassportRecord(tokenId, updateData);
      
      return {
        success: true,
        ipfsUri: newUri,
        txHash: tx.hash
      };
    } catch (error) {
      console.error(`Error updating metadata for token ${tokenId}:`, error);
      throw error;
    } finally {
      // Supprimer le lock même en cas d'erreur
      this.processingUpdates.delete(lockKey);
    }
  }
  
  /**
   * Récupère les métadonnées actuelles d'un token
   */
  async getCurrentMetadata(tokenId) {
    // D'abord, essayer de récupérer depuis la base de données
    const latestUpdate = await this.dbService.findOne('metadataUpdates', 
      { tokenId }, 
      { sort: { createdAt: -1 } }
    );
    
    if (latestUpdate) {
      try {
        // Récupérer depuis IPFS
        const content = await this.ipfsClient.get(latestUpdate.ipfsHash);
        return {
          ...JSON.parse(content),
          uri: latestUpdate.ipfsUri
        };
      } catch (error) {
        console.warn(`Failed to fetch metadata from IPFS: ${error.message}`);
        // Continuer avec la récupération depuis la blockchain
      }
    }
    
    // Récupérer l'URI depuis la blockchain
    const uri = await this.blockchainService.getTokenURI(tokenId);
    
    // Récupérer les métadonnées depuis l'URI
    if (uri.startsWith('ipfs://')) {
      const ipfsHash = uri.replace('ipfs://', '');
      const content = await this.ipfsClient.get(ipfsHash);
      return {
        ...JSON.parse(content),
        uri
      };
    } else {
      // URI HTTP standard
      const response = await fetch(uri);
      const data = await response.json();
      return {
        ...data,
        uri
      };
    }
  }
  
  /**
   * Fusionne les métadonnées actuelles avec les nouvelles données
   */
  mergeMetadata(currentMetadata, updateData) {
    const { auction, sector } = updateData;
    
    // Copier les métadonnées actuelles
    const newMetadata = { ...currentMetadata };
    
    // Mettre à jour les attributs
    if (!newMetadata.attributes) {
      newMetadata.attributes = [];
    }
    
    // Trouver et mettre à jour les attributs existants
    let participationCount = 0;
    let sectors = [];
    
    newMetadata.attributes = newMetadata.attributes.map(attr => {
      if (attr.trait_type === "Total Enchères Participées") {
        participationCount = (attr.value || 0) + 1;
        return { ...attr, value: participationCount };
      }
      
      if (attr.trait_type === "Dernière Enchère" && auction) {
        const date = new Date().toISOString().split('T')[0];
        return { ...attr, value: `${auction.title} - ${date}` };
      }
      
      if (attr.trait_type === "Historique des Enchères") {
        sectors = Array.isArray(attr.value) ? [...attr.value] : [];
        if (sector && !sectors.includes(sector)) {
          sectors.unshift(sector); // Ajouter au début
          // Limiter à 10 secteurs pour éviter des métadonnées trop grandes
          if (sectors.length > 10) {
            sectors = sectors.slice(0, 10);
          }
        }
        return { ...attr, value: sectors };
      }
      
      return attr;
    });
    
    return newMetadata;
  }
  
  /**
   * Met à jour l'enregistrement du passeport dans la base de données
   */
  async updatePassportRecord(tokenId, updateData) {
    const { auction, sector } = updateData;
    
    const update = {
      $inc: { participationCount: 1 },
      $set: { updatedAt: new Date() }
    };
    
    if (auction) {
      update.$set.lastAuction = {
        id: auction.id,
        title: auction.title,
        timestamp: new Date()
      };
    }
    
    if (sector && sector.trim()) {
      update.$addToSet = { sectors: sector };
    }
    
    await this.dbService.updateOne('passports', { tokenId }, update);
  }
}

module.exports = NFTMetadataService;
```

### 3. Sécurité et Protection Contre les Fraudes

**Amélioration du smart contract pour bloquer les approbations** :

```solidity
// Dans EtikaPassportNFT.sol

// Override des méthodes d'approbation pour les bloquer
function approve(address to, uint256 tokenId) public override {
    require(!_isPassport(tokenId), "Passport approval not allowed");
    super.approve(to, tokenId);
}

function setApprovalForAll(address operator, bool approved) public override {
    require(!approved || _userTokens[_msgSender()] == 0, "Passport approval not allowed");
    super.setApprovalForAll(operator, approved);
}

/**
 * @dev Vérifie si un token est un passeport
 */
function _isPassport(uint256 tokenId) internal view returns (bool) {
    // Si le token appartient à quelqu'un dans le mapping _userTokens, c'est un passeport
    address currentOwner = ownerOf(tokenId);
    return _userTokens[currentOwner] == tokenId;
}
```

### 4. Optimisation des Performances et Scalabilité

**Implémentation de Batch Processing** :

```solidity
// Dans EtikaPassportNFT.sol

/**
 * @dev Enregistre plusieurs participations en une seule transaction
 * @param tokenIds Liste des IDs de token passeport
 * @param sectors Liste des secteurs (en bytes32)
 * @param auctionNames Liste des noms d'enchères
 */
function batchRecordParticipation(
    uint256[] calldata tokenIds,
    bytes32[] calldata sectors,
    string[] calldata auctionNames
) 
    external 
    onlyRole(UPDATER_ROLE) 
    whenNotPaused 
{
    require(
        tokenIds.length == sectors.length && sectors.length == auctionNames.length,
        "Arrays must have same length"
    );
    
    for (uint i = 0; i < tokenIds.length; i++) {
        uint256 tokenId = tokenIds[i];
        bytes32 sector = sectors[i];
        string memory auctionName = auctionNames[i];
        
        require(_exists(tokenId), "Token does not exist");
        require(!_blacklistedTokens[tokenId], "Passport is blacklisted");
        
        // Incrémenter le compteur de participations
        _auctionParticipationCount[tokenId]++;
        
        // Mettre à jour la dernière enchère
        _lastAuction[tokenId] = LastAuction({
            timestamp: block.timestamp,
            name: auctionName
        });
        
        // Mettre à jour l'historique des secteurs (FIFO: First In, First Out)
        for (uint j = 4; j > 0; j--) {
            _recentSectors[tokenId][j] = _recentSectors[tokenId][j-1];
        }
        _recentSectors[tokenId][0] = sector;
        
        emit ParticipationRecorded(tokenId, sector, auctionName);
    }
}
```

**Implémentation du système de cache côté serveur** :

```javascript
// Dans PassportVerificationService.js

class PassportVerificationService {
  constructor(blockchainService, cacheService, dbService) {
    this.blockchainService = blockchainService;
    this.cache = cacheService;
    this.dbService = dbService;
    
    // Durée du cache: 5 minutes
    this.CACHE_TTL = 300;
  }
  
  /**
   * Vérifie si un utilisateur a un passeport valide (mise en cache)
   */
  async hasValidPassport(userAddress) {
    const cacheKey = `valid-passport-${userAddress}`;
    
    // Vérifier d'abord le cache
    const cachedResult = await this.cache.get(cacheKey);
    if (cachedResult !== null) {
      return JSON.parse(cachedResult);
    }
    
    // Vérifier en base de données
    const passport = await this.dbService.findOne('passports', {
      userAddress,
      status: 'active'
    });
    
    if (passport) {
      // Double-vérification sur la blockchain seulement occasionnellement
      const shouldVerifyOnChain = Math.random() < 0.05; // 5% de chance
      
      if (!shouldVerifyOnChain) {
        // Mettre en cache et retourner
        await this.cache.set(cacheKey, JSON.stringify(true), this.CACHE_TTL);
        return true;
      }
    }
    
    // Si pas en cache ou vérification blockchain nécessaire
    try {
      const isValid = await this.blockchainService.hasValidPassport(userAddress);
      
      // Mettre à jour la base de données si nécessaire
      if (isValid && !passport) {
        // Le passeport existe sur la blockchain mais pas en BDD
        const tokenId = await this.blockchainService.getPassportId(userAddress);
        
        if (tokenId != 0) {
          await this.dbService.insertOne('passports', {
            tokenId: tokenId.toString(),
            userAddress,
            status: 'active',
            participationCount: 0,
            sectors: [],
            createdAt: new Date(),
            note: 'Auto-recovered from blockchain'
          });
        }
      } else if (!isValid && passport) {
        // Le passeport n'est plus valide sur la blockchain
        await this.dbService.updateOne('passports', 
          { _id: passport._id }, 
          { $set: { status: 'invalid', updatedAt: new Date() } }
        );
      }
      
      // Mettre en cache et retourner
      await this.cache.set(cacheKey, JSON.stringify(isValid), this.CACHE_TTL);
      return isValid;
    } catch (error) {
      console.error(`Error checking passport validity for ${userAddress}:`, error);
      
      // En cas d'erreur, on se fie à la base de données
      if (passport) {
        await this.cache.set(cacheKey, JSON.stringify(true), this.CACHE_TTL / 2); // Durée de cache réduite
        return true;
      }
      
      // Sans passeport en BDD, on considère qu'il n'y a pas de passeport valide
      await this.cache.set(cacheKey, JSON.stringify(false), this.CACHE_TTL / 2);
      return false;
    }
  }
  
  /**
   * Invalide le cache pour un utilisateur spécifique
   */
  async invalidateCache(userAddress) {
    const cacheKey = `valid-passport-${userAddress}`;
    await this.cache.del(cacheKey);
  }
  
  /**
   * Récupère les détails d'un passeport (avec cache)
   */
  async getPassportDetails(tokenId) {
    const cacheKey = `passport-details-${tokenId}`;
    
    // Vérifier d'abord le cache
    const cachedDetails = await this.cache.get(cacheKey);
    if (cachedDetails !== null) {
      return JSON.parse(cachedDetails);
    }
    
    // Récupérer depuis la base de données
    const passport = await this.dbService.findOne('passports', { tokenId });
    
    if (passport) {
      // Récupérer les données on-chain seulement occasionnellement
      const shouldFetchOnChain = Math.random() < 0.1; // 10% de chance
      
      if (!shouldFetchOnChain) {
        // Mettre en cache et retourner
        await this.cache.set(cacheKey, JSON.stringify(passport), this.CACHE_TTL);
        return passport;
      }
    }
    
    // Si pas en cache ou mise à jour blockchain nécessaire
    try {
      const onChainData = await this.blockchainService.getPassportData(tokenId);
      
      let result;
      
      if (passport) {
        // Fusionner les données blockchain avec celles de la BDD
        result = {
          ...passport,
          participationCount: onChainData.participationCount.toNumber(),
          lastOnChainUpdate: new Date(onChainData.lastAuctionTime.toNumber() * 1000)
        };
        
        // Mettre à jour la BDD si nécessaire
        if (passport.participationCount !== onChainData.participationCount.toNumber()) {
          await this.dbService.updateOne('passports', 
            { _id: passport._id }, 
            { 
              $set: { 
                participationCount: onChainData.participationCount.toNumber(),
                updatedAt: new Date()
              }
            }
          );
        }
      } else {
        // Créer un nouvel enregistrement
        result = {
          tokenId,
          participationCount: onChainData.participationCount.toNumber(),
          lastAuction: onChainData.lastAuctionName,
          lastAuctionTime: new Date(onChainData.lastAuctionTime.toNumber() * 1000),
          sectors: [],
          createdAt: new Date(),
          status: 'active'
        };
        
        await this.dbService.insertOne('passports', result);
      }
      
      // Mettre en cache
      await this.cache.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
      return result;
    } catch (error) {
      console.error(`Error fetching passport details for ${tokenId}:`, error);
      
      if (passport) {
        // Retourner les données de la BDD en cas d'échec
        return passport;
      }
      
      throw error;
    }
  }
}
```

### 5. Intégration avec le Système d'Enchères

```javascript
// Dans AuctionService.js

class AuctionService {
  constructor(
    dbService, 
    blockchainService, 
    passportVerificationService,
    nftMetadataService,
    cacheService
  ) {
    this.dbService = dbService;
    this.blockchainService = blockchainService;
    this.passportVerificationService = passportVerificationService;
    this.nftMetadataService = nftMetadataService;
    this.cache = cacheService;
  }
  
  /**
   * Place une enchère sur une vente aux enchères
   */
  async placeBid(auctionId, userId, amount) {
    try {
      // Récupérer l'utilisateur
      const user = await this.dbService.findOne('users', { _id: userId });
      
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      // Vérifier si l'utilisateur a un passeport valide
      const hasValidPassport = await this.passportVerificationService.hasValidPassport(user.walletAddress);
      
      if (!hasValidPassport) {
        return {
          success: false,
          error: 'Valid passport required for bidding',
          code: 'NO_VALID_PASSPORT'
        };
      }
      
      // Récupérer l'enchère
      const auction = await this.dbService.findOne('auctions', { _id: auctionId });
      
      if (!auction) {
        return {
          success: false,
          error: 'Auction not found'
        };
      }
      
      if (auction.status !== 'active') {
        return {
          success: false,
          error: `Auction is not active (current status: ${auction.status})`
        };
      }
      
      if (new Date(auction.endTime) <= new Date()) {
        return {
          success: false,
          error: 'Auction has ended'
        };
      }
      
      // Vérifier si le montant de l'enchère est suffisant
      const highestBid = await this._getHighestBid(auctionId);
      const minimumBid = highestBid 
        ? highestBid.amount + auction.minBidIncrement
        : auction.startingPrice;
      
      if (amount < minimumBid) {
        return {
          success: false,
          error: `Bid amount must be at least ${minimumBid}`
        };
      }
      
      // Vérifier la solvabilité de l'utilisateur
      const hasSufficientFunds = await this._verifyUserFunds(userId, amount);
      
      if (!hasSufficientFunds) {
        return {
          success: false,
          error: 'Insufficient funds'
        };
      }
      
      // Créer l'enchère
      const bid = {
        auctionId,
        userId,
        amount,
        timestamp: new Date(),
        status: 'active'
      };
      
      const result = await this.dbService.insertOne('bids', bid);
      
      if (!result.insertedId) {
        return {
          success: false,
          error: 'Failed to save bid'
        };
      }
      
      // Mettre à jour le cache de l'enchère en cours
      await this._updateAuctionCache(auctionId);
      
      // Vérifier si c'est la première enchère de l'utilisateur pour cette vente
      const isFirstBid = await this.dbService.count('bids', {
        auctionId,
        userId
      }) === 1;
      
      if (isFirstBid) {
        // Enregistrer la participation (asynchrone, ne pas attendre)
        this._recordParticipation(auction, user.walletAddress)
          .catch(error => {
            console.error(`Error recording participation for user ${userId}:`, error);
          });
      }
      
      return {
        success: true,
        bidId: result.insertedId,
        amount,
        timestamp: bid.timestamp
      };
    } catch (error) {
      console.error(`Error placing bid:`, error);
      return {
        success: false,
        error: error.message || 'An unknown error occurred'
      };
    }
  }
  
  /**
   * Enregistre la participation à une enchère
   * @private
   */
  async _recordParticipation(auction, userAddress) {
    try {
      // Récupérer le tokenId du passeport
      const tokenId = await this.blockchainService.getPassportId(userAddress);
      
      if (tokenId == 0) {
        throw new Error(`User ${userAddress} does not have a passport`);
      }
      
      // Planifier la mise à jour des métadonnées
      await this.nftMetadataService.scheduleMetadataUpdate(tokenId.toString(), userAddress, {
        auction: {
          id: auction._id.toString(),
          title: auction.title
        },
        sector: auction.sector
      });
      
      // Enregistrer la participation
      await this.blockchainService.recordParticipation(
        tokenId,
        ethers.utils.formatBytes32String(auction.sector || 'general'),
        auction.title
      );
      
      return { success: true };
    } catch (error) {
      console.error(`Error recording participation:`, error);
      throw error;
    }
  }
  
  /**
   * Récupère l'enchère la plus élevée
   * @private
   */
  async _getHighestBid(auctionId) {
    // Vérifier d'abord le cache
    const cacheKey = `highest-bid-${auctionId}`;
    const cachedBid = await this.cache.get(cacheKey);
    
    if (cachedBid) {
      return JSON.parse(cachedBid);
    }
    
    // Récupérer depuis la base de données
    const highestBid = await this.dbService.findOne('bids', 
      { auctionId, status: 'active' }, 
      { sort: { amount: -1 } }
    );
    
    if (highestBid) {
      // Mettre en cache (10 secondes seulement car change fréquemment)
      await this.cache.set(cacheKey, JSON.stringify(highestBid), 10);
    }
    
    return highestBid;
  }
  
  /**
   * Met à jour le cache de l'enchère
   * @private
   */
  async _updateAuctionCache(auctionId) {
    // Supprimer les caches qui pourraient être affectés
    await this.cache.del(`highest-bid-${auctionId}`);
    await this.cache.del(`auction-details-${auctionId}`);
  }
  
  /**
   * Vérifie les fonds de l'utilisateur
   * @private
   */
  async _verifyUserFunds(userId, amount) {
    // Implémentation de la vérification des fonds
    // ...
    
    return true; // Pour l'exemple
  }
}
```

## Architecture Blockchain et Choix Testnet

### Pourquoi Polygon Mumbai?

Pour la phase de conception et de test, **Polygon Mumbai** est le testnet le plus adapté pour les raisons suivantes :

1. **Coûts de transaction minimaux** :
   - Les frais de gas sont très faibles comparés à Ethereum testnets
   - Permet de tester intensivement sans contraintes budgétaires

2. **Performance et rapidité** :
   - Temps de bloc d'environ 2 secondes
   - Finalité des transactions rapide
   - Idéal pour tester l'expérience utilisateur avec des temps de réaction réalistes

3. **Compatibilité totale avec l'écosystème Ethereum** :
   - Support complet de Solidity et des outils de développement Ethereum
   - Migration simple vers Polygon Mainnet quand la plateforme sera prête

4. **Stabilité et infrastructure** :
   - Réseau testnet bien maintenu et stable
   - Bons outils d'exploration et de surveillance des transactions
   - Faucets fiables pour obtenir des tokens de test

5. **Scalabilité** :
   - Environnement parfaitement adapté pour tester le comportement sous charge
   - Caractéristiques similaires à Polygon Mainnet qui pourra supporter une large base d'utilisateurs

### Configuration de l'environnement testnet

```javascript
// config/blockchain.js

const config = {
  testnet: {
    network: 'polygon-mumbai',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    chainId: 80001,
    blockExplorer: 'https://mumbai.polygonscan.com',
    contracts: {
      passportNFT: '0x...'  // Adresse du contrat déployé
    }
  },
  ipfs: {
    gateway: 'https://gateway.pinata.cloud/ipfs/',
    pinning: {
      service: 'pinata',
      apiKey: process.env.PINATA_API_KEY,
      secretKey: process.env.PINATA_SECRET_KEY
    }
  }
};
```

## Plan d'Implémentation et Déploiement

### Phase 1: Mise en place de l'infrastructure (2 semaines)

1. **Configuration de l'environnement de développement**
   - Mise en place du repository Git
   - Configuration des environnements de développement, test et staging
   - Configuration de CI/CD (GitHub Actions ou GitLab CI)

2. **Mise en place des services de base**
   - Déploiement des bases de données (PostgreSQL)
   - Configuration de Redis pour le cache et les files d'attente
   - Configuration du stockage IPFS (via Pinata)
   - Mise en place du monitoring (Prometheus + Grafana)

3. **Déploiement des smart contracts sur testnet**
   - Déploiement du contrat EtikaPassportNFT
   - Tests de validation des fonctionnalités blockchain
   - Configuration des écouteurs d'événements

### Phase 2: Développement du Backend (3 semaines)

1. **Implémentation des services principaux**
   - User Service
   - NFT Passport Service avec les améliorations
   - Auction Service
   - File d'attente et cache pour les mises à jour

2. **Développement des API**
   - Endpoints d'authentification
   - Endpoints de gestion des enchères
   - Endpoints pour les NFT passeports
   - Documentation OpenAPI

3. **Tests et validation**
   - Tests unitaires
   - Tests d'intégration
   - Tests de charge et de résilience

### Phase 3: Développement du Frontend (3 semaines)

1. **Développement des composants UI**
   - Page d'accueil et authentification
   - Interface des enchères
   - Page de profil utilisateur avec visualisation du NFT passeport
   - Page d'administration

2. **Intégration Web3**
   - Connexion du portefeuille
   - Interactions avec les smart contracts
   - Gestion des signatures

3. **Tests et optimisation UX**
   - Tests utilisateurs
   - Optimisation des performances
   - Compatibilité mobile

### Phase 4: Déploiement MVP et tests réels (2 semaines)

1. **Déploiement de l'environnement staging**
   - Configuration complète de l'infrastructure
   - Déploiement des services

2. **Tests avec utilisateurs pilotes**
   - Groupe restreint d'utilisateurs (10-20)
   - Recueil des retours d'expérience
   - Identification des bugs et problèmes

3. **Préparation au lancement**
   - Corrections finales
   - Documentation pour les utilisateurs
   - Plan de migration vers Polygon Mainnet

## Schéma d'Architecture Complète

```
+---------------------+
| FRONTEND            |
|                     |
| +----------------+  |
| | React App      |  |
| |                |  |
| | +-----------+  |  |
| | | UI        |  |  |
| | | Components|  |  |
| | +-----------+  |  |
| |                |  |
| | +-----------+  |  |
| | | Web3      |  |  |
| | | Integration|  |  |
| | +-----------+  |  |
| +----------------+  |
+---------------------+
          |
          v
+---------------------+
| API GATEWAY         |
|                     |
| +-----------------+ |
| | Express/NestJS  | |
| | Routes          | |
| +-----------------+ |
| | Rate Limiting   | |
| | Authentication  | |
| +-----------------+ |
+---------------------+
          |
          v
+---------------------+
| BACKEND SERVICES    |
|                     |
| +-----------------+ |
| | User Service    | |
| +-----------------+ |
|                     |
| +-----------------+ |
| | Auction Service | |
| +-----------------+ |
|                     |
| +-----------------+ |
| | NFT Passport    | |
| | Service         | |
| +-----------------+ |
|                     |
| +-----------------+ |
| | Metadata Service| |
| +-----------------+ |
+---------------------+
          |
          v
+---------------------+    +-------------------+
| INFRASTRUCTURE      |    | BLOCKCHAIN        |
|                     |    |                   |
| +-----------------+ |    | +---------------+ |
| | PostgreSQL      | |    | | Polygon Mumbai| |
| +-----------------+ |    | +---------------+ |
|                     |    |                   |
| +-----------------+ |    | +---------------+ |
| | Redis Cache     | |    | | Smart Contracts| |
| +-----------------+ |    | +---------------+ |
|                     |    +-------------------+
| +-----------------+ |             |
| | RabbitMQ        | |             v
| +-----------------+ |    +-------------------+
|                     |    | DECENTRALIZED     |
| +-----------------+ |    | STORAGE           |
| | Monitoring      | |    |                   |
| | Prometheus/     | |    | +---------------+ |
| | Grafana         | |    | | IPFS/Pinata   | |
| +-----------------+ |    | +---------------+ |
+---------------------+    +-------------------+
```

## Conclusion et Prochaines Étapes

L'architecture proposée offre une base solide pour la phase de conception d'Étika, avec une attention particulière aux améliorations identifiées lors des tests du NFT passeport. Les services sont conçus pour être modulaires, scalables, et résilients aux erreurs.

### Prochaines étapes recommandées :

1. **Validation de l'architecture** avec votre équipe technique
2. **Mise en place de l'infrastructure** de base (bases de données, cache, IPFS)
3. **Développement itératif** en commençant par les fonctionnalités critiques
4. **Tests continus** pendant tout le processus de développement

Cette architecture évolutive vous permettra de commencer avec un MVP solide, puis d'ajouter progressivement des fonctionnalités et d'optimiser les performances en fonction des retours utilisateurs.

Le choix de Polygon Mumbai comme testnet offre le meilleur équilibre entre coût, performance et facilité de développement pour cette phase de conception, tout en garantissant une transition simple vers le mainnet lorsque la plateforme sera prête pour la production.

En suivant ce plan, vous disposerez rapidement d'une plateforme tangible et fonctionnelle que vous pourrez présenter à vos premiers utilisateurs et partenaires, tout en ayant la certitude que l'architecture sous-jacente est robuste et prête à évoluer avec vos besoins futurs.

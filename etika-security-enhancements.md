    it('should throw error if auction is not active', async () => {
      // Arrange
      const mockAuction = {
        _id: new mongoose.Types.ObjectId().toString(),
        status: 'pending',
        startingPrice: 5000
      };
      
      mockDb.auctions.findOne.resolves(mockAuction);
      
      // Act & Assert
      try {
        await auctionSystem.placeBid(
          mockAuction._id,
          new mongoose.Types.ObjectId().toString(),
          6000
        );
        expect.fail('Should have thrown an InvalidBidError');
      } catch (err) {
        expect(err).to.be.instanceOf(InvalidBidError);
        expect(err.message).to.include('n\'est pas active');
        expect(mockDb.bids.insertOne.called).to.be.false;
      }
    });
    
    it('should throw error if bid amount is too low', async () => {
      // Arrange
      const auctionId = new mongoose.Types.ObjectId().toString();
      const mockAuction = {
        _id: auctionId,
        status: 'active',
        startingPrice: 5000,
        minBidIncrement: 100,
        endTime: new Date(Date.now() + 3600000),
        bids: []
      };
      
      mockDb.auctions.findOne.resolves(mockAuction);
      
      // Act & Assert
      try {
        await auctionSystem.placeBid(auctionId, new mongoose.Types.ObjectId().toString(), 4900);
        expect.fail('Should have thrown an InvalidBidError');
      } catch (err) {
        expect(err).to.be.instanceOf(InvalidBidError);
        expect(err.message).to.include('minimum');
        expect(mockDb.bids.insertOne.called).to.be.false;
      }
    });
  });
});

// tests/integration/auction.test.js
const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const app = require('../../app');
const Auction = require('../../models/Auction');
const Bid = require('../../models/Bid');
const User = require('../../models/User');
const { generateToken } = require('../../auth/authService');

describe('Auction API - Integration Tests', () => {
  let testUser;
  let adminUser;
  let companyUser;
  let userToken;
  let adminToken;
  let companyToken;
  
  before(async () => {
    // Connexion à la base de données de test
    await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/etika-test');
    
    // Nettoyer la base de données avant les tests
    await Promise.all([
      User.deleteMany({}),
      Auction.deleteMany({}),
      Bid.deleteMany({})
    ]);
    
    // Créer des utilisateurs de test
    testUser = await User.create({
      email: 'user@test.com',
      password: 'password123',
      role: 'user'
    });
    
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });
    
    companyUser = await User.create({
      email: 'company@test.com',
      password: 'password123',
      role: 'company',
      companyName: 'Test Company',
      companyStatus: 'approved'
    });
    
    // Générer des tokens pour les tests
    userToken = generateToken(testUser);
    adminToken = generateToken(adminUser);
    companyToken = generateToken(companyUser);
  });
  
  after(async () => {
    // Nettoyer la base de données après les tests
    await Promise.all([
      User.deleteMany({}),
      Auction.deleteMany({}),
      Bid.deleteMany({})
    ]);
    
    // Fermer la connexion à la base de données
    await mongoose.connection.close();
  });
  
  describe('GET /api/auctions', () => {
    before(async () => {
      // Créer quelques enchères de test
      await Auction.create([
        {
          category: 'Energie',
          title: 'Test Auction 1',
          description: 'Description for test auction 1',
          startTime: new Date(Date.now() - 86400000), // Hier
          endTime: new Date(Date.now() + 86400000), // Demain
          startingPrice: 1000,
          status: 'active',
          createdBy: adminUser._id
        },
        {
          category: 'Telecom',
          title: 'Test Auction 2',
          description: 'Description for test auction 2',
          startTime: new Date(Date.now() + 86400000), // Demain
          endTime: new Date(Date.now() + 172800000), // Après-demain
          startingPrice: 2000,
          status: 'pending',
          createdBy: adminUser._id
        }
      ]);
    });
    
    it('should get all auctions without authentication', async () => {
      const res = await request(app)
        .get('/api/auctions')
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auctions).to.be.an('array');
      expect(res.body.auctions.length).to.be.at.least(2);
    });
    
    it('should filter auctions by status', async () => {
      const res = await request(app)
        .get('/api/auctions?status=active')
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auctions).to.be.an('array');
      expect(res.body.auctions.every(a => a.status === 'active')).to.be.true;
    });
    
    it('should filter auctions by category', async () => {
      const res = await request(app)
        .get('/api/auctions?category=Energie')
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auctions).to.be.an('array');
      expect(res.body.auctions.every(a => a.category === 'Energie')).to.be.true;
    });
  });
  
  describe('POST /api/auctions', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/auctions')
        .send({
          category: 'Banque',
          title: 'New Auction',
          description: 'Description for new auction',
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 86400000),
          startingPrice: 3000
        })
        .expect(401);
      
      expect(res.body.success).to.be.false;
    });
    
    it('should create auction with admin authentication', async () => {
      const newAuction = {
        category: 'Banque',
        title: 'New Auction',
        description: 'Description for new auction',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 86400000),
        startingPrice: 3000
      };
      
      const res = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAuction)
        .expect(201);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auction).to.include({
        category: newAuction.category,
        title: newAuction.title,
        status: 'pending'
      });
    });
    
    it('should validate auction data', async () => {
      const invalidAuction = {
        // Données incomplètes
        title: 'Invalid Auction'
      };
      
      const res = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidAuction)
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
  });
  
  describe('POST /api/auctions/:id/bids', () => {
    let testAuction;
    
    before(async () => {
      // Créer une enchère active pour les tests
      testAuction = await Auction.create({
        category: 'Assurance',
        title: 'Bid Test Auction',
        description: 'Description for bid test auction',
        startTime: new Date(Date.now() - 3600000), // Il y a 1 heure
        endTime: new Date(Date.now() + 3600000), // Dans 1 heure
        startingPrice: 4000,
        minBidIncrement: 500,
        status: 'active',
        createdBy: adminUser._id
      });
    });
    
    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/auctions/${testAuction._id}/bids`)
        .send({ amount: 5000 })
        .expect(401);
      
      expect(res.body.success).to.be.false;
    });
    
    it('should place bid with company authentication', async () => {
      const bidAmount = 5000;
      
      const res = await request(app)
        .post(`/api/auctions/${testAuction._id}/bids`)
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ amount: bidAmount })
        .expect(201);
      
      expect(res.body.success).to.be.true;
      expect(res.body.bid).to.include({
        auctionId: testAuction._id.toString(),
        amount: bidAmount,
        status: 'active'
      });
      
      // Vérifier que l'enchère a été ajoutée à la base de données
      const bid = await Bid.findById(res.body.bid._id);
      expect(bid).to.exist;
      expect(bid.amount).to.equal(bidAmount);
    });
    
    it('should reject bid with amount too low', async () => {
      const lowBidAmount = 3000; // Inférieur au prix de départ
      
      const res = await request(app)
        .post(`/api/auctions/${testAuction._id}/bids`)
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ amount: lowBidAmount })
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
    
    it('should reject bid from non-company user', async () => {
      const res = await request(app)
        .post(`/api/auctions/${testAuction._id}/bids`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 6000 })
        .expect(403);
      
      expect(res.body.success).to.be.false;
    });
  });
});
```

## 3. Scalabilité pour la Phase 2

### 3.1 Cluster Node.js

```javascript
// cluster.js
const cluster = require('cluster');
const os = require('os');
const logger = require('./utils/logger');

const WORKERS = process.env.WEB_CONCURRENCY || os.cpus().length;

if (cluster.isMaster) {
  logger.info(`Master ${process.pid} is running`);
  logger.info(`Starting ${WORKERS} workers...`);

  // Fork workers
  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died with code: ${code} and signal: ${signal}`);
    logger.info('Starting a new worker');
    cluster.fork();
  });
  
  // Redémarrage gracieux au signal SIGUSR2 (pour Nodemon en dev)
  process.on('SIGUSR2', () => {
    logger.info('SIGUSR2 received, reloading workers');
    
    const workers = Object.values(cluster.workers);
    
    const restartWorker = (workerIndex) => {
      const worker = workers[workerIndex];
      if (!worker) return;
      
      worker.on('exit', () => {
        if (!worker.exitedAfterDisconnect) return;
        logger.info(`Exited worker ${worker.process.pid}`);
        
        cluster.fork().on('listening', () => {
          // Continuer avec le prochain worker une fois le nouveau démarré
          restartWorker(workerIndex + 1);
        });
      });
      
      worker.disconnect();
    };
    
    restartWorker(0);
  });
} else {
  // Les workers partagent le port
  require('./server');
}
```

### 3.2 Cache Distribué avec Redis

```javascript
// services/cacheService.js
const redis = require('redis');
const { promisify } = require('util');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          // Echec de connexion - réessayer
          logger.error('Redis connection refused, retrying...');
          return Math.min(options.attempt * 100, 3000);
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          // Trop de tentatives (1 heure)
          logger.error('Redis retry time exhausted');
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          // Trop de tentatives
          logger.error('Redis max retries reached');
          return undefined;
        }
        // Stratégie de backoff exponentielle
        return Math.min(options.attempt * 100, 3000);
      }
    });
    
    this.client.on('error', (err) => {
      logger.error('Redis Error:', err);
    });
    
    this.client.on('ready', () => {
      logger.info('Redis connected');
    });
    
    // Promisification des méthodes Redis
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
    this.expireAsync = promisify(this.client.expire).bind(this.client);
    this.scanAsync = promisify(this.client.scan).bind(this.client);
    this.flushDbAsync = promisify(this.client.flushdb).bind(this.client);
  }
  
  /**
   * Récupère une valeur du cache
   * @param {string} key - Clé de cache
   * @returns {Promise<any>} - Valeur du cache (null si non trouvée)
   */
  async get(key) {
    try {
      const data = await this.getAsync(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error(`Redis GET error for key ${key}:`, err);
      return null;
    }
  }
  
  /**
   * Définit une valeur dans le cache
   * @param {string} key - Clé de cache
   * @param {any} value - Valeur à stocker
   * @param {number} expireSeconds - Durée de validité en secondes (0 = pas d'expiration)
   * @returns {Promise<boolean>} - Succès de l'opération
   */
  async set(key, value, expireSeconds = 0) {
    try {
      const stringValue = JSON.stringify(value);
      if (expireSeconds > 0) {
        await this.setAsync(key, stringValue, 'EX', expireSeconds);
      } else {
        await this.setAsync(key, stringValue);
      }
      return true;
    } catch (err) {
      logger.error(`Redis SET error for key ${key}:`, err);
      return false;
    }
  }
  
  /**
   * Supprime une ou plusieurs clés du cache
   * @param {...string} keys - Clés à supprimer
   * @returns {Promise<boolean>} - Succès de l'opération
   */
  async delete(...keys) {
    try {
      if (keys.length === 0) return true;
      await this.delAsync(...keys);
      return true;
    } catch (err) {
      logger.error(`Redis DEL error for keys ${keys}:`, err);
      return false;
    }
  }
  
  /**
   * Supprime les clés qui correspondent à un modèle
   * @param {string} pattern - Modèle de clé (ex: "auction:*")
   * @returns {Promise<boolean>} - Succès de l'opération
   */
  async deletePattern(pattern) {
    try {
      let cursor = '0';
      let keys = [];
      
      do {
        const reply = await this.scanAsync(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = reply[0];
        keys = keys.concat(reply[1]);
      } while (cursor !== '0');
      
      if (keys.length > 0) {
        await this.delAsync(...keys);
      }
      
      return true;
    } catch (err) {
      logger.error(`Redis SCAN/DEL error for pattern ${pattern}:`, err);
      return false;
    }
  }
  
  /**
   * Vide complètement le cache (attention, à utiliser avec précaution)
   * @returns {Promise<boolean>} - Succès de l'opération
   */
  async clear() {
    try {
      await this.flushDbAsync();
      return true;
    } catch (err) {
      logger.error('Redis FLUSHDB error:', err);
      return false;
    }
  }
  
  /**
   * Ferme la connexion au cache
   */
  close() {
    this.client.quit();
  }
}

// Export en singleton
module.exports = new CacheService();

// services/auctionService.js (extrait avec cache)
const cacheService = require('./cacheService');
const { AuctionNotFoundError } = require('../errors/customErrors');

// Constantes pour le cache
const CACHE_TTL_ACTIVE_AUCTIONS = 60; // 1 minute
const CACHE_TTL_AUCTION_DETAILS = 300; // 5 minutes
const CACHE_KEY_ACTIVE_AUCTIONS = 'auctions:active';
const CACHE_KEY_AUCTION_PREFIX = 'auction:';

/**
 * Récupère les détails d'une enchère avec cache
 * @param {string} auctionId - ID de l'enchère
 * @returns {Promise<Object>} - Détails complets de l'enchère
 */
async function getAuctionDetails(auctionId) {
  const cacheKey = `${CACHE_KEY_AUCTION_PREFIX}${auctionId}`;
  
  // Essayer d'abord le cache
  const cachedAuction = await cacheService.get(cacheKey);
  if (cachedAuction) {
    return cachedAuction;
  }
  
  // Récupérer depuis la base de données
  const auction = await Auction.findById(auctionId)
    .populate('createdBy', 'email companyName')
    .lean();
    
  if (!auction) {
    throw new AuctionNotFoundError(auctionId);
  }
  
  // Récupérer les enchères associées
  const bids = await Bid.find({ auctionId })
    .sort({ amount: -1, createdAt: -1 })
    .populate('bidderId', 'email companyName')
    .lean();
  
  // Enrichir l'objet enchère
  const enrichedAuction = {
    ...auction,
    bids,
    currentHighestBid: bids.length > 0 ? bids[0] : null,
    timeRemaining: auction.status === 'active' 
      ? Math.max(0, new Date(auction.endTime).getTime() - Date.now()) 
      : 0,
    bidCount: bids.length,
    participantCount: new Set(bids.map(bid => bid.bidderId._id.toString())).size
  };
  
  // Mettre en cache pour 5 minutes (ou moins si l'enchère est active et se termine bientôt)
  const ttl = auction.status === 'active'
    ? Math.min(CACHE_TTL_AUCTION_DETAILS, Math.ceil(enrichedAuction.timeRemaining / 1000))
    : CACHE_TTL_AUCTION_DETAILS;
    
  await cacheService.set(cacheKey, enrichedAuction, ttl);
  
  return enrichedAuction;
}

/**
 * Invalide le cache d'une enchère après une modification
 * @param {string} auctionId - ID de l'enchère
 */
async function invalidateAuctionCache(auctionId) {
  await Promise.all([
    cacheService.delete(`${CACHE_KEY_AUCTION_PREFIX}${auctionId}`),
    cacheService.delete(CACHE_KEY_ACTIVE_AUCTIONS)
  ]);
}
```

### 3.3 Files d'Attente pour Traitements Asynchrones

```javascript
// services/queueService.js
const Bull = require('bull');
const logger = require('../utils/logger');

// Configuration Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD
};

/**
 * Service de gestion des files d'attente
 */
class QueueService {
  constructor() {
    // Initialisation des files d'attente
    this.notificationQueue = new Bull('notifications', { redis: redisConfig });
    this.paymentQueue = new Bull('payments', { redis: redisConfig });
    this.blockchainQueue = new Bull('blockchain', { redis: redisConfig });
    this.imageGenerationQueue = new Bull('image-generation', { redis: redisConfig });
    
    this._setupQueues();
  }
  
  /**
   * Configure les files d'attente et leurs processeurs
   * @private
   */
  _setupQueues() {
    // Configuration de la file de notifications
    this.notificationQueue.process(async (job) => {
      try {
        const { type, recipient, data } = job.data;
        logger.info(`Processing notification job ${job.id} of type ${type}`);
        
        // Traitement selon le type de notification
        switch (type) {
          case 'email':
            await this._processEmailNotification(recipient, data);
            break;
          case 'sms':
            await this._processSmsNotification(recipient, data);
            break;
          case 'push':
            await this._processPushNotification(recipient, data);
            break;
          default:
            throw new Error(`Unknown notification type: ${type}`);
        }
        
        return { success: true, jobId: job.id };
      } catch (error) {
        logger.error(`Error processing notification job ${job.id}:`, error);
        throw error; // Réessai automatique selon la configuration
      }
    });
    
    // Configuration de la file de paiements
    this.paymentQueue.process(async (job) => {
      try {
        const { type, data } = job.data;
        logger.info(`Processing payment job ${job.id} of type ${type}`);
        
        // Traitement selon le type de paiement
        switch (type) {
          case 'process':
            return await this._processPayment(data);
          case 'verify':
            return await this._verifyPayment(data);
          case 'refund':
            return await this._processRefund(data);
          default:
            throw new Error(`Unknown payment type: ${type}`);
        }
      } catch (error) {
        logger.error(`Error processing payment job ${job.id}:`, error);
        throw error;
      }
    });
    
    // Configuration de la file blockchain
    this.blockchainQueue.process(async (job) => {
      try {
        const { type, data } = job.data;
        logger.info(`Processing blockchain job ${job.id} of type ${type}`);
        
        // Traitement selon le type d'opération blockchain
        switch (type) {
          case 'mint-nft':
            return await this._processMintNFT(data);
          case 'transfer-token':
            return await this._processTokenTransfer(data);
          case 'verify-transaction':
            return await this._verifyBlockchainTransaction(data);
          default:
            throw new Error(`Unknown blockchain operation type: ${type}`);
        }
      } catch (error) {
        logger.error(`Error processing blockchain job ${job.id}:`, error);
        throw error;
      }
    });
    
    // Configuration de la file de génération d'images
    this.imageGenerationQueue.process(async (job) => {
      try {
        const { prompt, style, width, height, userId } = job.data;
        logger.info(`Processing image generation job ${job.id}`);
        
        return await this._generateImage(prompt, style, width, height, userId);
      } catch (error) {
        logger.error(`Error processing image generation job ${job.id}:`, error);
        throw error;
      }
    });
    
    // Gestion globale des événements de file d'attente
    const queues = [
      this.notificationQueue, 
      this.paymentQueue, 
      this.blockchainQueue,
      this.imageGenerationQueue
    ];
    
    queues.forEach(queue => {
      queue.on('completed', job => {
        logger.info(`Job ${job.id} completed in queue ${queue.name}`);
      });
      
      queue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} failed in queue ${queue.name}:`, err);
      });
      
      queue.on('error', err => {
        logger.error(`Queue ${queue.name} error:`, err);
      });
    });
  }
  
  /**
   * Ajoute une tâche de notification à la file d'attente
   * @param {string} type - Type de notification (email, sms, push)
   * @param {string} recipient - Destinataire
   * @param {Object} data - Données de la notification
   * @param {Object} options - Options de la tâche
   * @returns {Promise<Object>} - ID de la tâche
   */
  async addNotification(type, recipient, data, options = {}) {
    const job = await this.notificationQueue.add(
      { type, recipient, data },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        ...options
      }
    );
    
    return { id: job.id };
  }
  
  /**
   * Ajoute une tâche de paiement à la file d'attente
   * @param {string} type - Type de paiement (process, verify, refund)
   * @param {Object} data - Données du paiement
   * @param {Object} options - Options de la tâche
   * @returns {Promise<Object>} - ID de la tâche
   */
  async addPayment(type, data, options = {}) {
    const job = await this.paymentQueue.add(
      { type, data },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: true,
        ...options
      }
    );
    
    return { id: job.id };
  }
  
  /**
   * Ajoute une tâche blockchain à la file d'attente
   * @param {string} type - Type d'opération (mint-nft, transfer-token, verify-transaction)
   * @param {Object} data - Données de l'opération
   * @param {Object} options - Options de la tâche
   * @returns {Promise<Object>} - ID de la tâche
   */
  async addBlockchainOperation(type, data, options = {}) {
    const job = await this.blockchainQueue.add(
      { type, data },
      {
        attempts: 4,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: true,
        ...options
      }
    );
    
    return { id: job.id };
  }
  
  /**
   * Ajoute une tâche de génération d'image à la file d'attente
   * @param {string} prompt - Description textuelle de l'image
   * @param {string} style - Style de l'image
   * @param {number} width - Largeur de l'image
   * @param {number} height - Hauteur de l'image
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} options - Options de la tâche
   * @returns {Promise<Object>} - ID de la tâche
   */
  async addImageGeneration(prompt, style, width, height, userId, options = {}) {
    const job = await this.imageGenerationQueue.add(
      { prompt, style, width, height, userId },
      {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 10000
        },
        removeOnComplete: true,
        ...options
      }
    );
    
    return { id: job.id };
  }
  
  // Implémentations des processeurs privés
  async _processEmailNotification(recipient, data) {
    // Implémentation avec un service d'email
    // ...
  }
  
  async _processSmsNotification(recipient, data) {
    // Implémentation avec un service SMS
    // ...
  }
  
  async _processPushNotification(recipient, data) {
    // Implémentation avec un service de notifications push
    // ...
  }
  
  async _processPayment(data) {
    // Implémentation avec un service de paiement
    // ...
  }
  
  async _verifyPayment(data) {
    // Implémentation de vérification de paiement
    // ...
  }
  
  async _processRefund(data) {
    // Implémentation de remboursement
    // ...
  }
  
  async _processMintNFT(data) {
    // Implémentation de création de NFT sur la blockchain
    // ...
  }
  
  async _processTokenTransfer(data) {
    // Implémentation de transfert de tokens
    // ...
  }
  
  async _verifyBlockchainTransaction(data) {
    // Implémentation de vérification de transaction blockchain
    // ...
  }
  
  async _generateImage(prompt, style, width, height, userId) {
    // Implémentation de génération d'image via IA
    // ...
  }
}

// Singleton
module.exports = new QueueService();
```

## 4. Résumé des Améliorations

Ces améliorations répondent directement aux points soulevés dans l'analyse de Gemini:

### Sécurité
- Hachage des mots de passe avec bcrypt
- Gestion de sessions sécurisées et JWT
- Protection CSRF
- Validation rigoureuse des données (Joi + Mongoose)
- Intégration sécurisée des paiements

### Robustesse
- Gestion d'erreurs personnalisées et hiérarchiques
- Tests unitaires et d'intégration complets
- Validation des données à plusieurs niveaux
- Gestion de la concurrence et des cas limites

### Flexibilité
- Configuration externalisée
- Injection de dépendances maintenue
- Interfaces clairement définies
- Middlewares modulaires

### Scalabilité (Phase 2)
- Support de clustering Node.js
- Cache distribué avec Redis
- Files d'attente pour les opérations asynchrones
- Architecture prête pour les microservices

Ces modifications établissent une base technique solide pour la Phase 1 tout en préparant efficacement le terrain pour la Phase 2. Elles assurent que la plateforme d'enchères Étika est:

- Suffisamment sécurisée pour protéger les données sensibles
- Assez robuste pour gérer les pics d'utilisation et les erreurs
- Facilement extensible pour accueillir de nouvelles fonctionnalités
- Prête à évoluer vers une solution blockchain complète si le test est un succès

En intégrant ces améliorations, Étika offre une expérience utilisateur transparente tout en maintenant des standards techniques élevés qui faciliteront sa croissance future.
  # Améliorations de Sécurité et Robustesse pour Étika

Ce document présente les améliorations à apporter au code du système d'enchères d'Étika, en réponse à l'analyse de Gemini. Ces modifications renforceront la sécurité, la robustesse, la flexibilité et la scalabilité du système.

## 1. Sécurité

### 1.1 Authentification Sécurisée

```javascript
// auth/passwordService.js
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

/**
 * Hache un mot de passe en texte brut
 * @param {string} plainPassword - Mot de passe en texte brut
 * @returns {Promise<string>} - Mot de passe haché
 */
async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Vérifie un mot de passe en texte brut par rapport à un hash
 * @param {string} plainPassword - Mot de passe en texte brut
 * @param {string} hashedPassword - Mot de passe haché stocké
 * @returns {Promise<boolean>} - Vrai si le mot de passe correspond
 */
async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

module.exports = {
  hashPassword,
  verifyPassword
};

// models/User.js
const mongoose = require('mongoose');
const { hashPassword } = require('../auth/passwordService');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Format d\'email invalide']
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    enum: ['user', 'company', 'admin', 'ngo'],
    default: 'user'
  },
  companyName: String,
  companyStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: Date
});

// Hacher le mot de passe avant l'enregistrement
UserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await hashPassword(this.password);
  }
  next();
});

const User = mongoose.model('User', UserSchema);
module.exports = User;

// auth/authController.js
const User = require('../models/User');
const { verifyPassword } = require('./passwordService');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-jwt-super-securise';
const JWT_EXPIRATION = '24h';

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Rechercher l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }
    
    // Vérifier le mot de passe
    const passwordIsValid = await verifyPassword(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }
    
    // Mise à jour de la date de dernière connexion
    user.lastLogin = Date.now();
    await user.save();
    
    // Générer un token JWT
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );
    
    // Répondre avec les informations utilisateur et le token
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        companyName: user.companyName || null,
        companyStatus: user.companyStatus || null
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la connexion' 
    });
  }
};

// auth/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-jwt-super-securise';

/**
 * Middleware pour vérifier l'authentification JWT
 */
exports.verifyToken = (req, res, next) => {
  const token = req.headers['x-access-token'] || req.headers['authorization'];
  
  if (!token) {
    return res.status(403).json({
      success: false,
      message: 'Aucun token fourni'
    });
  }
  
  // Supprimer le préfixe 'Bearer ' si présent
  const tokenValue = token.startsWith('Bearer ') ? token.slice(7) : token;
  
  try {
    const decoded = jwt.verify(tokenValue, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token invalide ou expiré'
    });
  }
};

/**
 * Middleware pour vérifier le rôle de l'utilisateur
 * @param {string[]} roles - Rôles autorisés
 */
exports.authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: 'Authentification requise'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }
    
    next();
  };
};
```

### 1.2 Protection CSRF et Sécurité des Sessions

```javascript
// server.js (extrait)
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const csurf = require('csurf');
const helmet = require('helmet');

const app = express();

// Protection contre diverses attaques
app.use(helmet());

// Mise en place des sessions sécurisées
app.use(session({
  secret: process.env.SESSION_SECRET || 'etika-session-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/etika',
    ttl: 14 * 24 * 60 * 60 // 14 jours
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 jours
  }
}));

// Protection CSRF pour les routes qui modifient des données
const csrfProtection = csurf({ cookie: false });

// Middleware pour ajouter le token CSRF aux réponses
app.use((req, res, next) => {
  if (req.csrfToken) {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
});

// Appliquer la protection CSRF aux routes qui en ont besoin
app.post('/api/auth/*', csrfProtection);
app.post('/api/auctions/*', csrfProtection);
app.put('/api/auctions/*', csrfProtection);
app.delete('/api/auctions/*', csrfProtection);
```

### 1.3 Validation des Données

```javascript
// validation/auctionValidation.js
const Joi = require('joi');

// Schéma de validation pour la création d'enchère
const createAuctionSchema = Joi.object({
  category: Joi.string().required().trim().messages({
    'string.empty': 'La catégorie est requise',
    'any.required': 'La catégorie est requise'
  }),
  title: Joi.string().required().min(3).max(100).trim().messages({
    'string.empty': 'Le titre est requis',
    'string.min': 'Le titre doit contenir au moins {#limit} caractères',
    'string.max': 'Le titre ne doit pas dépasser {#limit} caractères',
    'any.required': 'Le titre est requis'
  }),
  description: Joi.string().required().min(10).max(2000).trim().messages({
    'string.empty': 'La description est requise',
    'string.min': 'La description doit contenir au moins {#limit} caractères',
    'string.max': 'La description ne doit pas dépasser {#limit} caractères',
    'any.required': 'La description est requise'
  }),
  startTime: Joi.date().min('now').required().messages({
    'date.min': 'La date de début doit être future',
    'any.required': 'La date de début est requise'
  }),
  endTime: Joi.date().greater(Joi.ref('startTime')).required().messages({
    'date.greater': 'La date de fin doit être postérieure à la date de début',
    'any.required': 'La date de fin est requise'
  }),
  startingPrice: Joi.number().positive().required().messages({
    'number.positive': 'Le prix de départ doit être positif',
    'any.required': 'Le prix de départ est requis'
  }),
  minBidIncrement: Joi.number().positive().default(100).messages({
    'number.positive': 'L\'incrément minimum doit être positif'
  }),
  territory: Joi.string().default('global')
});

// Schéma de validation pour les enchères
const bidSchema = Joi.object({
  auctionId: Joi.string().required().messages({
    'string.empty': 'L\'ID de l\'enchère est requis',
    'any.required': 'L\'ID de l\'enchère est requis'
  }),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant de l\'enchère doit être positif',
    'any.required': 'Le montant de l\'enchère est requis'
  })
});

// Middleware de validation pour la création d'enchère
function validateCreateAuction(req, res, next) {
  const { error } = createAuctionSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      errors: errorMessages
    });
  }
  
  next();
}

// Middleware de validation pour les enchères
function validateBid(req, res, next) {
  const { error } = bidSchema.validate(req.body, { abortEarly: false });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    return res.status(400).json({
      success: false,
      errors: errorMessages
    });
  }
  
  next();
}

module.exports = {
  validateCreateAuction,
  validateBid
};

// models/Auction.js
const mongoose = require('mongoose');

const AuctionSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 2000
  },
  startTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'La date de début doit être future'
    }
  },
  endTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > this.startTime;
      },
      message: 'La date de fin doit être postérieure à la date de début'
    }
  },
  startingPrice: {
    type: Number,
    required: true,
    min: [1, 'Le prix de départ doit être positif']
  },
  minBidIncrement: {
    type: Number,
    default: 100,
    min: [1, 'L\'incrément minimum doit être positif']
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'cancelled', 'failed', 'payment_pending'],
    default: 'pending'
  },
  territory: {
    type: String,
    default: 'global'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  winningBid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bid'
  },
  adminValidation: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  finalizedAt: Date
});

// Middleware pré-mise à jour pour mettre à jour updatedAt
AuctionSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

const Auction = mongoose.model('Auction', AuctionSchema);
module.exports = Auction;
```

### 1.4 Gestion Sécurisée des Paiements

```javascript
// services/paymentService.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('../utils/logger');

/**
 * Traite un paiement via Stripe
 * @param {Object} paymentData - Données de paiement
 * @returns {Promise<Object>} - Résultat du traitement
 */
async function processPayment(paymentData) {
  try {
    const { amount, currency = 'eur', userId, metadata = {} } = paymentData;
    
    // Créer un intent de paiement avec Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe utilise les centimes
      currency,
      metadata: {
        userId,
        ...metadata
      },
      description: `Paiement Étika - ${metadata.description || 'Enchère'}`,
      confirm: true,
      payment_method: paymentData.paymentMethodId,
      return_url: process.env.PAYMENT_RETURN_URL
    });
    
    // Vérifier le statut du paiement
    if (paymentIntent.status === 'succeeded') {
      logger.info(`Paiement réussi: ${paymentIntent.id} pour l'utilisateur ${userId}`);
      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        amount: amount,
        currency: currency,
        status: paymentIntent.status
      };
    } else if (paymentIntent.status === 'requires_action') {
      return {
        success: false,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } else {
      logger.warn(`Paiement non réussi: ${paymentIntent.id}, statut: ${paymentIntent.status}`);
      return {
        success: false,
        status: paymentIntent.status,
        paymentIntentId: paymentIntent.id
      };
    }
  } catch (error) {
    // Gestion des erreurs Stripe
    if (error.type === 'StripeCardError') {
      logger.warn(`Erreur de carte: ${error.message}`);
      return {
        success: false,
        error: 'card_error',
        message: error.message
      };
    } else if (error.type === 'StripeInvalidRequestError') {
      logger.error(`Erreur de requête Stripe: ${error.message}`);
      return {
        success: false,
        error: 'invalid_request',
        message: 'Paramètres de paiement invalides'
      };
    } else {
      logger.error('Erreur de paiement:', error);
      return {
        success: false,
        error: 'payment_processing_error',
        message: 'Erreur lors du traitement du paiement'
      };
    }
  }
}

/**
 * Vérifie le statut d'un paiement
 * @param {string} paymentIntentId - ID de l'intent de paiement
 * @returns {Promise<Object>} - Statut du paiement
 */
async function checkPaymentStatus(paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    return {
      success: paymentIntent.status === 'succeeded',
      status: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata
    };
  } catch (error) {
    logger.error(`Erreur lors de la vérification du paiement ${paymentIntentId}:`, error);
    throw new Error(`Erreur lors de la vérification du paiement: ${error.message}`);
  }
}

module.exports = {
  processPayment,
  checkPaymentStatus
};
```

## 2. Robustesse

### 2.1 Gestion des Erreurs Personnalisées

```javascript
// errors/customErrors.js
class EtikaError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends EtikaError {
  constructor(message, validationErrors = []) {
    super(message || 'Erreur de validation des données', 400);
    this.validationErrors = validationErrors;
  }
}

class AuthenticationError extends EtikaError {
  constructor(message) {
    super(message || 'Authentification requise', 401);
  }
}

class AuthorizationError extends EtikaError {
  constructor(message) {
    super(message || 'Accès non autorisé', 403);
  }
}

class ResourceNotFoundError extends EtikaError {
  constructor(resource, id) {
    super(`${resource} non trouvé: ${id}`, 404);
    this.resource = resource;
    this.resourceId = id;
  }
}

class AuctionNotFoundError extends ResourceNotFoundError {
  constructor(auctionId) {
    super('Enchère', auctionId);
  }
}

class UserNotFoundError extends ResourceNotFoundError {
  constructor(userId) {
    super('Utilisateur', userId);
  }
}

class InvalidBidError extends EtikaError {
  constructor(message) {
    super(message || 'Enchère invalide', 400);
  }
}

class PaymentError extends EtikaError {
  constructor(message, paymentInfo = {}) {
    super(message || 'Erreur de paiement', 402);
    this.paymentInfo = paymentInfo;
  }
}

class ConflictError extends EtikaError {
  constructor(message) {
    super(message || 'Conflit de ressources', 409);
  }
}

module.exports = {
  EtikaError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ResourceNotFoundError,
  AuctionNotFoundError,
  UserNotFoundError,
  InvalidBidError,
  PaymentError,
  ConflictError
};

// middleware/errorHandler.js
const { EtikaError } = require('../errors/customErrors');
const logger = require('../utils/logger');

/**
 * Middleware de gestion globale des erreurs
 */
function errorHandler(err, req, res, next) {
  // Journaliser l'erreur
  if (err instanceof EtikaError) {
    logger.warn(`${err.name}: ${err.message}`);
  } else {
    logger.error('Erreur non gérée:', err);
  }

  // Erreurs personnalisées
  if (err instanceof EtikaError) {
    return res.status(err.status).json({
      success: false,
      error: {
        type: err.name,
        message: err.message,
        details: err.validationErrors || err.paymentInfo || undefined,
        resource: err.resource,
        resourceId: err.resourceId
      }
    });
  }

  // Erreurs Mongoose de validation
  if (err.name === 'ValidationError') {
    const validationErrors = Object.values(err.errors).map(error => error.message);
    return res.status(400).json({
      success: false,
      error: {
        type: 'ValidationError',
        message: 'Erreur de validation des données',
        details: validationErrors
      }
    });
  }

  // Erreurs Mongoose de duplicate key
  if (err.name === 'MongoError' && err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: {
        type: 'DuplicateKeyError',
        message: 'Cette ressource existe déjà'
      }
    });
  }

  // Erreurs JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        type: 'TokenError',
        message: 'Token invalide'
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        type: 'TokenExpiredError',
        message: 'Token expiré'
      }
    });
  }

  // Erreurs CSRF
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      error: {
        type: 'CSRFError',
        message: 'Protection CSRF déclenchée'
      }
    });
  }

  // Erreur par défaut (500)
  return res.status(500).json({
    success: false,
    error: {
      type: 'InternalServerError',
      message: process.env.NODE_ENV === 'production' 
        ? 'Une erreur interne est survenue'
        : err.message
    }
  });
}

module.exports = errorHandler;

// server.js (extrait)
const errorHandler = require('./middleware/errorHandler');

// ... autres middlewares et routes

// Middleware de gestion des erreurs (à placer à la fin)
app.use(errorHandler);
```

### 2.2 Tests Unitaires et d'Intégration

```javascript
// tests/unit/auction.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { EtikaAuctionSystem } = require('../../services/auctionService');
const { AuctionNotFoundError, InvalidBidError } = require('../../errors/customErrors');

describe('EtikaAuctionSystem - Unit Tests', () => {
  let auctionSystem;
  let mockDb;
  let mockBlockchain;
  let mockAdminService;
  let mockPaymentService;
  
  beforeEach(() => {
    // Créer des mocks pour les dépendances
    mockDb = {
      auctions: {
        insertOne: sinon.stub(),
        findOne: sinon.stub(),
        updateOne: sinon.stub(),
        find: sinon.stub().returns({
          toArray: sinon.stub().resolves([])
        })
      },
      bids: {
        insertOne: sinon.stub(),
        find: sinon.stub().returns({
          toArray: sinon.stub().resolves([])
        })
      }
    };
    
    mockBlockchain = {
      submitTransaction: sinon.stub().resolves({ hash: 'mock-hash' })
    };
    
    mockAdminService = {
      notifyNewAuction: sinon.stub().resolves(true)
    };
    
    mockPaymentService = {
      processPayment: sinon.stub().resolves({ success: true, id: 'payment-id' })
    };
    
    // Créer l'instance du système d'enchères avec les mocks
    auctionSystem = new EtikaAuctionSystem(
      mockDb,
      mockBlockchain,
      mockAdminService,
      mockPaymentService
    );
  });
  
  afterEach(() => {
    // Restaurer tous les stubs
    sinon.restore();
  });
  
  describe('createAuction', () => {
    it('should create a new auction successfully', async () => {
      // Arrange
      const mockAuctionId = new mongoose.Types.ObjectId().toString();
      mockDb.auctions.insertOne.resolves({ insertedId: mockAuctionId });
      
      const auctionData = {
        category: 'Energie',
        title: 'Sponsor Officiel Energie',
        description: 'Enchère pour devenir sponsor officiel',
        startTime: new Date(Date.now() + 3600000), // 1 heure dans le futur
        endTime: new Date(Date.now() + 86400000), // 24 heures dans le futur
        startingPrice: 5000,
        createdBy: new mongoose.Types.ObjectId().toString()
      };
      
      // Act
      const result = await auctionSystem.createAuction(auctionData);
      
      // Assert
      expect(result).to.be.an('object');
      expect(result.id).to.equal(mockAuctionId);
      expect(mockDb.auctions.insertOne.calledOnce).to.be.true;
      expect(mockAdminService.notifyNewAuction.calledOnce).to.be.true;
    });
    
    it('should throw validation error if auction data is invalid', async () => {
      // Arrange
      const invalidData = {
        // Données incomplètes
        title: 'Titre seulement'
      };
      
      // Act & Assert
      try {
        await auctionSystem.createAuction(invalidData);
        // Si on arrive ici, le test échoue car on s'attend à une erreur
        expect.fail('Should have thrown a ValidationError');
      } catch (err) {
        expect(err.name).to.equal('ValidationError');
        expect(mockDb.auctions.insertOne.called).to.be.false;
      }
    });
  });
  
  describe('placeBid', () => {
    it('should place a bid successfully on an active auction', async () => {
      // Arrange
      const auctionId = new mongoose.Types.ObjectId().toString();
      const bidderId = new mongoose.Types.ObjectId().toString();
      const amount = 6000;
      
      // Mock d'une enchère active
      const mockAuction = {
        _id: auctionId,
        status: 'active',
        startingPrice: 5000,
        minBidIncrement: 100,
        endTime: new Date(Date.now() + 3600000), // 1 heure dans le futur
        bids: []
      };
      
      mockDb.auctions.findOne.resolves(mockAuction);
      mockDb.bids.insertOne.resolves({ insertedId: new mongoose.Types.ObjectId() });
      
      // Act
      const result = await auctionSystem.placeBid(auctionId, bidderId, amount);
      
      // Assert
      expect(result).to.be.an('object');
      expect(result.auctionId).to.equal(auctionId);
      expect(result.bidderId).to.equal(bidderId);
      expect(result.amount).to.equal(amount);
      expect(mockDb.bids.insertOne.calledOnce).to.be.true;
      expect(mockDb.auctions.updateOne.calledOnce).to.be.true;
    });
    
    it('should throw error if auction is not found', async () => {
      // Arrange
      mockDb.auctions.findOne.resolves(null);
      
      // Act & Assert
      try {
        await auctionSystem.placeBid(
          new mongoose.Types.ObjectId().toString(),
          new mongoose.Types.ObjectId().toString(),
          6000
        );
        expect.fail('Should have thrown an AuctionNotFoundError');
      } catch (err) {
        expect(err).to.be.instanceOf(AuctionNotFoundError);
        expect(mockDb.bids.insertOne.called).to.be.false;
      }
    });
    
    it('should throw error if auction is not active', async () => {
      // Arrange
      const mockAuction = {
        _id: new mongoose.Types.ObjectId().toString(),
        status: 'pending',
        startingPrice: 5000
      };
      
      mockDb.auctions.findOne.resolves(mockAuction);
      
      // Act & Assert
      try {
        await auctionSystem.placeBid(
          mockAuction._id,
          new mongoose.Types.ObjectId().toString(),
          6000
        );
        expect.fail('Should have thrown an InvalidBidError');
      } catch (err) {
        expect(err).to.be.instanceOf(InvalidBidError);
        expect(err.message).to.include('n\'est pas active');
        expect(mockDb.bids.insertOne.called).to.be.false;
      }
    });
    
    it('shoul
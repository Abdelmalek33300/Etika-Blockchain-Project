const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const Redis = require('ioredis');

class DatabaseService {
  constructor(config = {}) {
    this.config = {
      mongoUri: config.mongoUri || process.env.MONGO_URI || 'mongodb://localhost:27017/etika',
      redisUri: config.redisUri || process.env.REDIS_URI || 'redis://localhost:6379',
      debug: config.debug || process.env.NODE_ENV !== 'production'
    };

    this.mongoose = mongoose;
    this.redis = null;
    this.isConnected = false;
    this.models = {};
  }

  /**
   * Initialise la connexion à la base de données
   */
  async initialize() {
    try {
      // Configuration de Mongoose
      if (this.config.debug) {
        mongoose.set('debug', true);
      }

      // Connexion à MongoDB
      await mongoose.connect(this.config.mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        autoIndex: true
      });

      // Connexion à Redis
      this.redis = new Redis(this.config.redisUri, {
        retryStrategy: (times) => {
          return Math.min(times * 50, 2000);
        }
      });

      this.isConnected = true;
      console.log('Connexion à la base de données établie');

      // Initialiser les modèles
      this._initializeModels();

      return true;
    } catch (error) {
      console.error('Erreur de connexion à la base de données:', error);
      throw error;
    }
  }

  /**
   * Initialise les schémas et modèles Mongoose
   */
  _initializeModels() {
    // Schéma utilisateur
    const UserSchema = new mongoose.Schema({
      address: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        index: true
      },
      nonce: String,
      role: {
        type: String,
        required: true,
        enum: ['admin', 'consumer', 'merchant', 'producer', 'supplier', 'validator'],
        default: 'consumer'
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      lastLogin: Date,
      profile: {
        name: String,
        email: String,
        avatar: String
      },
      settings: {
        notifications: {
          email: { type: Boolean, default: true },
          push: { type: Boolean, default: true }
        },
        language: { type: String, default: 'fr' }
      },
      metrics: {
        transactionCount: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },
        totalSaved: { type: Number, default: 0 },
        validationCount: { type: Number, default: 0 }
      }
    });

    // Schéma transaction
    const TransactionSchema = new mongoose.Schema({
      transactionId: {
        type: String,
        required: true,
        unique: true,
        index: true
      },
      blockchainTxHash: String,
      type: {
        type: String,
        required: true,
        enum: ['sale', 'validation', 'conversion', 'delegation']
      },
      status: {
        type: String,
        required: true,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
      },
      from: {
        type: String,
        required: true,
        lowercase: true
      },
      to: {
        type: String,
        required: true,
        lowercase: true
      },
      amount: {
        type: Number,
        required: true
      },
      metadata: {
        description: String,
        location: String,
        items: [{
          description: String,
          quantity: Number,
          unitPrice: Number,
          supplierId: String
        }]
      },
      timestamps: {
        created: { type: Date, default: Date.now },
        updated: { type: Date, default: Date.now },
        completed: Date
      },
      validations: [{
        validator: String,
        timestamp: Date,
        signature: String
      }]
    });

    // Schéma métriques
    const MetricsSchema = new mongoose.Schema({
      timestamp: {
        type: Date,
        required: true,
        index: true
      },
      dailyTransactions: Number,
      activeUsers: Number,
      totalVolume: Number,
      validatorCount: Number,
      averageValidationTime: Number,
      systemHealth: {
        type: String,
        enum: ['healthy', 'warning', 'critical']
      }
    });

    // Schéma cache blockchain
    const BlockchainCacheSchema = new mongoose.Schema({
      key: {
        type: String,
        required: true,
        unique: true
      },
      data: mongoose.Schema.Types.Mixed,
      updatedAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // TTL 1 heure
      }
    });

    // Créer les modèles
    this.models.User = mongoose.model('User', UserSchema);
    this.models.Transaction = mongoose.model('Transaction', TransactionSchema);
    this.models.Metrics = mongoose.model('Metrics', MetricsSchema);
    this.models.BlockchainCache = mongoose.model('BlockchainCache', BlockchainCacheSchema);

    // Créer les index
    this.models.Transaction.createIndexes();
    this.models.User.createIndexes();
  }

  /**
   * Cache Redis pour les données blockchain
   */
  async cacheBlockchainData(key, data, ttl = 3600) {
    try {
      await this.redis.setex(
        `blockchain:${key}`,
        ttl,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error('Erreur lors du cache des données:', error);
    }
  }

  /**
   * Récupère les données en cache
   */
  async getCachedBlockchainData(key) {
    try {
      const data = await this.redis.get(`blockchain:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Erreur lors de la récupération du cache:', error);
      return null;
    }
  }

  /**
   * Enregistre une transaction
   */
  async saveTransaction(transactionData) {
    try {
      const transaction = new this.models.Transaction(transactionData);
      await transaction.save();

      // Mettre à jour les métriques des utilisateurs
      await this.models.User.updateOne(
        { address: transactionData.from },
        {
          $inc: {
            'metrics.transactionCount': 1,
            'metrics.totalSpent': transactionData.amount
          }
        }
      );

      return transaction;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la transaction:', error);
      throw error;
    }
  }

  /**
   * Met à jour le statut d'une transaction
   */
  async updateTransactionStatus(transactionId, status, blockchainTxHash = null) {
    try {
      const update = {
        status,
        'timestamps.updated': new Date()
      };

      if (blockchainTxHash) {
        update.blockchainTxHash = blockchainTxHash;
      }

      if (status === 'completed') {
        update['timestamps.completed'] = new Date();
      }

      const transaction = await this.models.Transaction.findOneAndUpdate(
        { transactionId },
        { $set: update },
        { new: true }
      );

      return transaction;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la transaction:', error);
      throw error;
    }
  }

  /**
   * Ajoute une validation à une transaction
   */
  async addTransactionValidation(transactionId, validatorAddress, signature) {
    try {
      const transaction = await this.models.Transaction.findOneAndUpdate(
        { transactionId },
        {
          $push: {
            validations: {
              validator: validatorAddress,
              timestamp: new Date(),
              signature
            }
          }
        },
        { new: true }
      );

      // Mettre à jour les métriques du validateur
      await this.models.User.updateOne(
        { address: validatorAddress },
        { $inc: { 'metrics.validationCount': 1 } }
      );

      return transaction;
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la validation:', error);
      throw error;
    }
  }

  /**
   * Met à jour les métriques système
   */
  async updateSystemMetrics(metrics) {
    try {
      const dailyMetrics = new this.models.Metrics({
        timestamp: new Date(),
        ...metrics
      });

      await dailyMetrics.save();

      // Mettre en cache les métriques actuelles
      await this.cacheBlockchainData('currentMetrics', metrics);

      return dailyMetrics;
    } catch (error) {
      console.error('Erreur lors de la mise à jour des métriques:', error);
      throw error;
    }
  }

  /**
   * Recherche de transactions
   */
  async searchTransactions(filters = {}, options = {}) {
    try {
      const query = {};

      // Construction de la requête
      if (filters.type) query.type = filters.type;
      if (filters.status) query.status = filters.status;
      if (filters.from) query.from = filters.from.toLowerCase();
      if (filters.to) query.to = filters.to.toLowerCase();
      if (filters.minAmount) query.amount = { $gte: filters.minAmount };
      if (filters.maxAmount) {
        query.amount = { ...query.amount, $lte: filters.maxAmount };
      }
      if (filters.dateFrom) {
        query['timestamps.created'] = { $gte: new Date(filters.dateFrom) };
      }
      if (filters.dateTo) {
        query['timestamps.created'] = {
          ...query['timestamps.created'],
          $lte: new Date(filters.dateTo)
        };
      }

      // Options de pagination
      const limit = options.limit || 10;
      const skip = (options.page || 0) * limit;

      // Exécution de la requête
      const transactions = await this.models.Transaction
        .find(query)
        .sort({ 'timestamps.created': -1 })
        .skip(skip)
        .limit(limit);

      const total = await this.models.Transaction.countDocuments(query);

      return {
        transactions,
        total,
        page: options.page || 0,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Erreur lors de la recherche de transactions:', error);
      throw error;
    }
  }

  /**
   * Ferme les connexions à la base de données
   */
  async close() {
    try {
      await mongoose.disconnect();
      if (this.redis) {
        await this.redis.quit();
      }
      this.isConnected = false;
      console.log('Connexions à la base de données fermées');
    } catch (error) {
      console.error('Erreur lors de la fermeture des connexions:', error);
      throw error;
    }
  }

  /**
   * Nettoie le cache Redis
   */
  async clearCache(pattern = 'blockchain:*') {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
      console.log(`Cache nettoyé pour le pattern: ${pattern}`);
    } catch (error) {
      console.error('Erreur lors du nettoyage du cache:', error);
      throw error;
    }
  }
}

module.exports = DatabaseService;
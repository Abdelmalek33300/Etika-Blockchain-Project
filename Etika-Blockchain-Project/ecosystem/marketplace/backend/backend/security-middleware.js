const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { ethers } = require('ethers');
const { createHash } = require('crypto');

class SecurityMiddleware {
  constructor(config = {}) {
    this.config = {
      maxRequestsPerMinute: config.maxRequestsPerMinute || 100,
      maxTransactionAmount: config.maxTransactionAmount || 1000000, // 1M tokens
      allowedOrigins: config.allowedOrigins || ['http://localhost:3000'],
      debug: config.debug || process.env.NODE_ENV !== 'production',
      ...config
    };

    this.rateLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: this.config.maxRequestsPerMinute,
      message: 'Trop de requêtes, veuillez réessayer plus tard'
    });
  }

  /**
   * Applique tous les middlewares de sécurité
   */
  applyMiddlewares(app) {
    // Protection basique avec helmet
    app.use(helmet());

    // Configuration CORS
    app.use(cors({
      origin: this.config.allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    }));

    // Rate limiting
    app.use(this.rateLimiter);

    // Middleware de validation des transactions
    app.use('/api/transactions', this.validateTransactionMiddleware());

    // Middleware de validation des signatures
    app.use('/api/*/validate', this.validateSignatureMiddleware());

    // Middleware de sécurité supplémentaire
    app.use(this.securityHeadersMiddleware());

    // Middleware de logging de sécurité
    if (this.config.debug) {
      app.use(this.securityLoggingMiddleware());
    }
  }

  /**
   * Middleware de validation des transactions
   */
  validateTransactionMiddleware() {
    return async (req, res, next) => {
      if (req.method === 'POST' && req.path === '/create') {
        try {
          const transaction = req.body;

          // Validation de base
          if (!this.validateTransactionStructure(transaction)) {
            return res.status(400).json({
              error: 'Structure de transaction invalide'
            });
          }

          // Validation du montant
          if (!this.validateTransactionAmount(transaction.amount)) {
            return res.status(400).json({
              error: 'Montant de transaction invalide'
            });
          }

          // Validation des adresses
          if (!this.validateAddresses(transaction)) {
            return res.status(400).json({
              error: 'Adresses invalides'
            });
          }

          // Ajouter le hash de la transaction
          req.body.transactionHash = this.hashTransaction(transaction);

          next();
        } catch (error) {
          console.error('Erreur de validation de transaction:', error);
          return res.status(500).json({
            error: 'Erreur lors de la validation de la transaction'
          });
        }
      } else {
        next();
      }
    };
  }

  /**
   * Middleware de validation des signatures
   */
  validateSignatureMiddleware() {
    return async (req, res, next) => {
      try {
        const { signature, message, address } = req.body;

        if (!signature || !message || !address) {
          return res.status(400).json({
            error: 'Signature, message ou adresse manquante'
          });
        }

        // Vérifier la signature
        const recoveredAddress = ethers.verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          return res.status(401).json({
            error: 'Signature invalide'
          });
        }

        next();
      } catch (error) {
        console.error('Erreur de validation de signature:', error);
        return res.status(500).json({
          error: 'Erreur lors de la validation de la signature'
        });
      }
    };
  }

  /**
   * Middleware pour les en-têtes de sécurité
   */
  securityHeadersMiddleware() {
    return (req, res, next) => {
      // En-têtes de sécurité supplémentaires
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      
      // En-têtes spécifiques à l'application
      res.setHeader('X-ETIKA-App-Version', '1.0.0');
      res.setHeader('X-ETIKA-Network', this.config.network || 'testnet');

      next();
    };
  }

  /**
   * Middleware de logging de sécurité
   */
  securityLoggingMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
      };

      // Logging à la fin de la requête
      res.on('finish', () => {
        logData.duration = Date.now() - start;
        logData.status = res.statusCode;
        console.log('Security Log:', logData);
      });

      next();
    };
  }

  /**
   * Valide la structure d'une transaction
   */
  validateTransactionStructure(transaction) {
    const requiredFields = ['type', 'from', 'to', 'amount'];
    return requiredFields.every(field => transaction.hasOwnProperty(field));
  }

  /**
   * Valide le montant d'une transaction
   */
  validateTransactionAmount(amount) {
    const numAmount = Number(amount);
    return (
      !isNaN(numAmount) &&
      numAmount > 0 &&
      numAmount <= this.config.maxTransactionAmount
    );
  }

  /**
   * Valide les adresses dans une transaction
   */
  validateAddresses(transaction) {
    try {
      const addresses = [transaction.from, transaction.to];
      if (transaction.supplier) addresses.push(transaction.supplier);
      
      return addresses.every(address => 
        ethers.isAddress(address) && address !== ethers.ZeroAddress
      );
    } catch (error) {
      console.error('Erreur de validation d\'adresses:', error);
      return false;
    }
  }

  /**
   * Crée un hash de transaction
   */
  hashTransaction(transaction) {
    const data = JSON.stringify({
      type: transaction.type,
      from: transaction.from.toLowerCase(),
      to: transaction.to.toLowerCase(),
      amount: transaction.amount.toString(),
      timestamp: Date.now()
    });

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Vérifie une signature Web3
   */
  async verifyWeb3Signature(message, signature, expectedAddress) {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error('Erreur de vérification de signature Web3:', error);
      return false;
    }
  }

  /**
   * Valide un nonce
   */
  validateNonce(nonce, timestamp, validityPeriod = 5 * 60 * 1000) { // 5 minutes
    try {
      const nonceData = JSON.parse(Buffer.from(nonce, 'base64').toString());
      return (
        nonceData.timestamp &&
        Date.now() - nonceData.timestamp < validityPeriod
      );
    } catch (error) {
      console.error('Erreur de validation de nonce:', error);
      return false;
    }
  }

  /**
   * Crée un nouveau nonce
   */
  generateNonce() {
    const nonceData = {
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(2)
    };
    return Buffer.from(JSON.stringify(nonceData)).toString('base64');
  }

  /**
   * Valide un token JWT
   */
  validateJWT(token) {
    try {
      // La validation réelle est gérée par le middleware d'authentification
      return token && token.split('.').length === 3;
    } catch (error) {
      console.error('Erreur de validation JWT:', error);
      return false;
    }
  }

  /**
   * Middleware de validation des données d'entrée
   */
  validateInput(schema) {
    return (req, res, next) => {
      try {
        const { error } = schema.validate(req.body);
        if (error) {
          return res.status(400).json({
            error: 'Données invalides',
            details: error.details.map(detail => detail.message)
          });
        }
        next();
      } catch (error) {
        console.error('Erreur de validation des données:', error);
        return res.status(500).json({
          error: 'Erreur lors de la validation des données'
        });
      }
    };
  }

  /**
   * Middleware anti-injection
   */
  preventInjection() {
    return (req, res, next) => {
      // Vérifier les en-têtes suspects
      const suspiciousHeaders = ['x-forwarded-for', 'x-forwarded-host'];
      for (const header of suspiciousHeaders) {
        if (req.headers[header] && this.containsSuspiciousContent(req.headers[header])) {
          return res.status(400).json({
            error: 'Contenu suspect détecté'
          });
        }
      }

      // Vérifier le corps de la requête
      if (req.body && typeof req.body === 'object') {
        if (this.containsSuspiciousContent(JSON.stringify(req.body))) {
          return res.status(400).json({
            error: 'Contenu suspect détecté'
          });
        }
      }

      next();
    };
  }

  /**
   * Vérifie la présence de contenu suspect
   */
  containsSuspiciousContent(content) {
    const suspicious = [
      '../../',
      '<script>',
      'javascript:',
      'data:',
      'vbscript:',
      'onload=',
      'onerror=',
      'SELECT FROM',
      'UNION SELECT',
      'DROP TABLE'
    ];

    return suspicious.some(pattern => 
      content.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Middleware de détection des attaques
   */
  detectAttacks() {
    const attackPatterns = new Map();
    
    return (req, res, next) => {
      const clientIp = req.ip;
      const now = Date.now();
      
      // Récupérer ou initialiser le pattern pour cette IP
      if (!attackPatterns.has(clientIp)) {
        attackPatterns.set(clientIp, {
          requests: [],
          violations: 0,
          lastReset: now
        });
      }
      
      const pattern = attackPatterns.get(clientIp);
      
      // Nettoyer les anciennes requêtes
      pattern.requests = pattern.requests.filter(
        time => now - time < 60000 // 1 minute
      );
      
      // Ajouter la requête actuelle
      pattern.requests.push(now);
      
      // Vérifier les patterns d'attaque
      if (this.isAttackPattern(pattern)) {
        pattern.violations++;
        
        if (pattern.violations >= 3) {
          return res.status(403).json({
            error: 'Activité suspecte détectée'
          });
        }
      }
      
      // Réinitialiser les violations après une période
      if (now - pattern.lastReset > 3600000) { // 1 heure
        pattern.violations = 0;
        pattern.lastReset = now;
      }
      
      next();
    };
  }

  /**
   * Vérifie si un pattern correspond à une attaque
   */
  isAttackPattern(pattern) {
    // Trop de requêtes en peu de temps
    if (pattern.requests.length > 50) {
      return true;
    }
    
    // Requêtes trop rapprochées
    const intervals = [];
    for (let i = 1; i < pattern.requests.length; i++) {
      intervals.push(pattern.requests[i] - pattern.requests[i-1]);
    }
    
    if (intervals.length > 0) {
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      if (avgInterval < 100) { // Moins de 100ms entre les requêtes
        return true;
      }
    }
    
    return false;
  }

  /**
   * Retourne les statistiques de sécurité
   */
  getSecurityStats() {
    return {
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: this.config.maxRequestsPerMinute
      },
      cors: {
        allowedOrigins: this.config.allowedOrigins
      },
      maxTransactionAmount: this.config.maxTransactionAmount,
      debug: this.config.debug
    };
  }
}

module.exports = SecurityMiddleware;
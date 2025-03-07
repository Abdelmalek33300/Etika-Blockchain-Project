const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ethers } = require('ethers');

class AuthenticationService {
  constructor(db, config = {}) {
    this.db = db;
    this.config = {
      jwtSecret: config.jwtSecret || process.env.JWT_SECRET || 'etika-auth-secret',
      jwtExpiration: config.jwtExpiration || '24h',
      saltRounds: config.saltRounds || 10,
      roles: {
        ADMIN: 'admin',
        CONSUMER: 'consumer',
        MERCHANT: 'merchant',
        PRODUCER: 'producer',
        SUPPLIER: 'supplier',
        VALIDATOR: 'validator'
      }
    };
  }

  /**
   * Génère un nonce unique pour la signature Web3
   */
  async generateNonce() {
    const nonce = crypto.randomBytes(32).toString('hex');
    return nonce;
  }

  /**
   * Crée le message à signer pour l'authentification Web3
   */
  createSignMessage(address, nonce) {
    return `Connexion à ETIKA Platform\n\nAdresse: ${address}\nNonce: ${nonce}\nDate: ${new Date().toISOString()}`;
  }

  /**
   * Vérifie une signature Web3
   */
  async verifySignature(address, signature, message) {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('Erreur de vérification de signature:', error);
      return false;
    }
  }

  /**
   * Authentification avec wallet Web3
   */
  async authenticateWithWeb3(address, signature, nonce) {
    try {
      // Vérifier que l'adresse est au bon format
      if (!ethers.isAddress(address)) {
        throw new Error('Adresse invalide');
      }

      // Récupérer l'utilisateur
      let user = await this.db.users.findOne({ address: address.toLowerCase() });

      // Vérifier la signature
      const message = this.createSignMessage(address, nonce);
      const isValidSignature = await this.verifySignature(address, signature, message);
      
      if (!isValidSignature) {
        throw new Error('Signature invalide');
      }

      // Créer l'utilisateur s'il n'existe pas
      if (!user) {
        user = await this.db.users.create({
          address: address.toLowerCase(),
          nonce,
          role: this.config.roles.CONSUMER, // Rôle par défaut
          createdAt: new Date(),
          lastLogin: new Date()
        });
      } else {
        // Mettre à jour le nonce et la date de dernière connexion
        await this.db.users.updateOne(
          { address: address.toLowerCase() },
          { 
            $set: { 
              nonce,
              lastLogin: new Date()
            }
          }
        );
      }

      // Générer le token JWT
      const token = this.generateToken(user);

      return {
        token,
        user: {
          address: user.address,
          role: user.role,
          createdAt: user.createdAt
        }
      };
    } catch (error) {
      console.error('Erreur d\'authentification Web3:', error);
      throw error;
    }
  }

  /**
   * Génère un token JWT
   */
  generateToken(user) {
    return jwt.sign(
      {
        address: user.address,
        role: user.role,
        sessionId: crypto.randomBytes(16).toString('hex')
      },
      this.config.jwtSecret,
      {
        expiresIn: this.config.jwtExpiration
      }
    );
  }

  /**
   * Vérifie un token JWT
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret);
      return decoded;
    } catch (error) {
      console.error('Erreur de vérification du token:', error);
      throw error;
    }
  }

  /**
   * Middleware d'authentification pour Express
   */
  authMiddleware() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.status(401).json({ error: 'Token manquant' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = this.verifyToken(token);

        // Récupérer l'utilisateur
        const user = await this.db.users.findOne({ address: decoded.address });
        if (!user) {
          return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        // Ajouter l'utilisateur à la requête
        req.user = user;
        next();
      } catch (error) {
        console.error('Erreur d\'authentification:', error);
        return res.status(401).json({ error: 'Token invalide' });
      }
    };
  }

  /**
   * Middleware de vérification des rôles
   */
  requireRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Non authentifié' });
      }

      const userRole = req.user.role;
      const authorizedRoles = Array.isArray(roles) ? roles : [roles];

      if (!authorizedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: 'Accès refusé',
          required: authorizedRoles,
          current: userRole
        });
      }

      next();
    };
  }

  /**
   * Vérifie si un utilisateur a un rôle spécifique
   */
  hasRole(user, role) {
    return user.role === role;
  }

  /**
   * Met à jour le rôle d'un utilisateur
   */
  async updateUserRole(address, newRole) {
    try {
      // Vérifier que le rôle est valide
      if (!Object.values(this.config.roles).includes(newRole)) {
        throw new Error('Rôle invalide');
      }

      const user = await this.db.users.findOneAndUpdate(
        { address: address.toLowerCase() },
        { $set: { role: newRole } },
        { new: true }
      );

      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      return user;
    } catch (error) {
      console.error('Erreur lors de la mise à jour du rôle:', error);
      throw error;
    }
  }

  /**
   * Synchronise les rôles avec le smart contract ETIKA
   */
  async syncRolesWithContract(etikaService) {
    try {
      // Récupérer tous les utilisateurs
      const users = await this.db.users.find({});

      for (const user of users) {
        try {
          // Vérifier le rôle dans le contrat
          const contractRole = await etikaService.getValidatorRole(user.address);
          
          // Mettre à jour le rôle si nécessaire
          if (contractRole && contractRole !== user.role) {
            await this.updateUserRole(user.address, contractRole);
            console.log(`Rôle mis à jour pour ${user.address}: ${contractRole}`);
          }
        } catch (error) {
          console.error(`Erreur lors de la synchronisation du rôle pour ${user.address}:`, error);
          continue;
        }
      }

      console.log('Synchronisation des rôles terminée');
    } catch (error) {
      console.error('Erreur lors de la synchronisation des rôles:', error);
      throw error;
    }
  }

  /**
   * Déconnexion
   */
  async logout(token) {
    try {
      // Ajouter le token à la liste noire si nécessaire
      // Note: Dans une implémentation réelle, vous voudrez peut-être
      // stocker les tokens révoqués dans Redis ou une autre solution
      return true;
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  }
}

module.exports = AuthenticationService;
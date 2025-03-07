/**
 * API Service pour ETIKA Platform
 * 
 * Ce service expose les fonctionnalités du smart contract ETIKA via une API RESTful
 * et fournit l'interface entre la plateforme web et la blockchain.
 */
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { EtikaIntegrationService } from './etika-integration-service';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const config = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'etika-platform-secret',
  adminAddress: process.env.ADMIN_ADDRESS
};

// Initialisation du service
const etikaService = new EtikaIntegrationService();
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Middleware d'authentification
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, config.jwtSecret, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Middleware pour vérifier le rôle d'administrateur
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Accès refusé: privilèges administrateur requis' });
  }
};

// Routes
app.get('/api/status', async (req, res) => {
  try {
    const isInitialized = etikaService.initialized;
    const systemPaused = isInitialized ? await etikaService.isSystemPaused() : null;
    
    res.json({
      status: 'ok',
      initialized: isInitialized,
      systemPaused,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialisation du service
app.post('/api/initialize', async (req, res) => {
  try {
    if (etikaService.initialized) {
      return res.json({ status: 'already_initialized' });
    }
    
    await etikaService.initialize();
    res.json({ status: 'initialized', accounts: etikaService.accounts.map(acc => acc.address) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authentification
app.post('/api/auth/login', async (req, res) => {
  try {
    const { address, signature } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Adresse requise' });
    }
    
    // Vérification de la signature (en situation réelle)
    // const isValid = await verifySignature(address, signature);
    const isValid = true; // Pour démonstration
    
    if (!isValid) {
      return res.status(401).json({ error: 'Signature invalide' });
    }
    
    // Vérification de l'existence du compte dans le système ETIKA
    let role = 'user';
    try {
      // Si l'adresse correspond à l'admin configuré
      if (address === config.adminAddress) {
        role = 'admin';
      }
    } catch (error) {
      console.warn('Impossible de vérifier le rôle dans le contrat:', error);
    }
    
    // Génération du token
    const token = jwt.sign(
      { address, role, sessionId: uuidv4() },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        address,
        role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoints utilisateurs
app.post('/api/users/create', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { address, role } = req.body;
    
    if (!address || !role) {
      return res.status(400).json({ error: 'Adresse et rôle requis' });
    }
    
    const result = await etikaService.createAccount(address, role);
    res.json({ status: 'success', txHash: result.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/validators/register', authenticateJWT, async (req, res) => {
  try {
    const { address, role } = req.body;
    
    if (!address || !role) {
      return res.status(400).json({ error: 'Adresse et rôle requis' });
    }
    
    // Définir le compte actif comme étant l'utilisateur authentifié
    etikaService.setCurrentAccount(req.user.address);
    
    const result = await etikaService.registerValidator(address, role);
    res.json({ status: 'success', txHash: result.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/validators/vote', authenticateJWT, async (req, res) => {
  try {
    const { candidateAddress } = req.body;
    
    if (!candidateAddress) {
      return res.status(400).json({ error: 'Adresse du candidat requise' });
    }
    
    // Définir le compte actif comme étant l'utilisateur authentifié
    etikaService.setCurrentAccount(req.user.address);
    
    const result = await etikaService.voteForValidator(candidateAddress);
    res.json({ status: 'success', txHash: result.hash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoints transactions
app.post('/api/transactions/create', authenticateJWT, async (req, res) => {
  try {
    const { 
      saleType, 
      consumer, 
      merchant, 
      supplier, 
      amount, 
      savingsPercentage,
      items,
      locationData,
      origin,
      description
    } = req.body;
    
    if (!saleType || !consumer || !merchant || !amount || !items) {
      return res.status(400).json({ 
        error: 'Paramètres incomplets. Requis: saleType, consumer, merchant, amount, items' 
      });
    }
    
    // Définir le compte actif comme étant l'utilisateur authentifié
    etikaService.setCurrentAccount(req.user.address);
    
    const result = await etikaService.createSaleTransaction({
      saleType,
      consumer,
      merchant,
      supplier,
      amount,
      savingsPercentage,
      items,
      locationData,
      origin,
      description
    });
    
    res.json({ 
      status: 'success', 
      txHash: result.hash,
      message: 'Transaction en attente de validation'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions/validate', authenticateJWT, async (req, res) => {
  try {
    const { transactionId, signature } = req.body;
    
    if (!transactionId) {
      return res.status(400).json({ error: 'ID de transaction requis' });
    }
    
    // Définir le compte actif comme étant l'utilisateur authentifié
    etikaService.setCurrentAccount(req.user.address);
    
    const result = await etikaService.validatePop(transactionId, signature);
    res.json({ 
      status: 'success', 
      txHash: result.hash,
      message: 'Validation effectuée'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/transactions/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    
    const details = await etikaService.getTransactionDetails(id);
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoints tokens & épargne
app.get('/api/balances/tokens/:address', authenticateJWT, async (req, res) => {
  try {
    const { address } = req.params;
    
    const balance = await etikaService.getTokenBalance(address);
    res.json({ address, tokens: balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/balances/epargne/:address', authenticateJWT, async (req, res) => {
  try {
    const { address } = req.params;
    
    const balance = await etikaService.getEpargneBalance(address);
    res.json({ address, epargne: balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tokens/convert', authenticateJWT, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Montant requis' });
    }
    
    // Définir le compte actif comme étant l'utilisateur authentifié
    etikaService.setCurrentAccount(req.user.address);
    
    const result = await etikaService.convertTokensToSavings(amount);
    res.json({ 
      status: 'success', 
      txHash: result.hash,
      message: 'Conversion effectuée'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoints délégation d'épargne
app.post('/api/savings/delegate', authenticateJWT, async (req, res) => {
  try {
    const { delegateAddress } = req.body;
    
    if (!delegateAddress) {
      return res.status(400).json({ error: 'Adresse du délégué requise' });
    }
    
    // Définir le compte actif comme étant l'utilisateur authentifié
    etikaService.setCurrentAccount(req.user.address);
    
    const result = await etikaService.setSavingsDelegation(delegateAddress);
    res.json({ 
      status: 'success', 
      txHash: result.hash,
      message: 'Délégation configurée'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/savings/undelegate', authenticateJWT, async (req, res) => {
  try {
    // Définir le compte actif comme étant l'utilisateur authentifié
    etikaService.setCurrentAccount(req.user.address);
    
    const result = await etikaService.removeSavingsDelegation();
    res.json({ 
      status: 'success', 
      txHash: result.hash,
      message: 'Délégation supprimée'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoints enchères
app.post('/api/auctions/create', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const { category, minBid, duration } = req.body;
    
    if (!category || !minBid) {
      return res.status(400).json({ error: 'Catégorie et enchère minimale requises' });
    }
    
    // Définir le compte actif comme étant l'utilisateur authentifié
    etikaService.setCurrentAccount(req.user.address);
    
    const result = await etikaService.createAuction(category, minBid, duration);
    res.json({ 
      status: 'success', 
      txHash: result.hash,
      message: 'Enchère créée'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auctions/bid', authenticateJWT, async (req, res) => {
  try {
    const { category, bidAmount, ecosystemCommitment } = req.body;
    
    if (!category || !bidAmount || !ecosystemCommitment) {
      return res.status(400).json({ 
        error: 'Catégorie, montant et engagement écosystémique requis' 
      });
    }
    
    // Définir le compte actif comme étant l'utilisateur authentifié
    etikaService.setCurrentAccount(req.user.address);
    
    const result = await etikaService.placeBid(category, bidAmount, ecosystemCommitment);
    res.json({ 
      status: 'success', 
      txHash: result.hash,
      message: 'Enchère placée'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auctions/:category', authenticateJWT, async (req, res) => {
  try {
    const { category } = req.params;
    
    const details = await etikaService.getAuctionDetails(category);
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Métriques et statistiques
app.get('/api/metrics/ecosystem', async (req, res) => {
  try {
    const metrics = await etikaService.getEcosystemMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialisation et démarrage du serveur
const startServer = async () => {
  try {
    // Tenter d'initialiser le service au démarrage
    await etikaService.initialize();
    console.log('Service ETIKA initialisé avec succès au démarrage');
  } catch (error) {
    console.warn('Impossible d\'initialiser le service au démarrage:', error.message);
    console.log('Le service s\'initialisera à la première requête /api/initialize');
  }
  
  app.listen(config.port, () => {
    console.log(`API ETIKA en écoute sur le port ${config.port}`);
  });
};

// Démarrer le serveur
startServer();

export default app;

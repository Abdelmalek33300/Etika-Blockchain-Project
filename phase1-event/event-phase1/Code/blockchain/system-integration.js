// systemIntegration.js
// Ce fichier intègre tous les services ensemble et s'assure que le système fonctionne de manière cohérente

const auctionService = require('./services/auctionService');
const treasuryService = require('./services/treasuryService');
const { unifiedLoyaltyService } = require('./services/unifiedLoyaltyService');
const sponsorSelectionService = require('./services/sponsorSelectionService');
const transactionValidationService = require('./services/transactionValidationService');
const transactionDoubleValidator = require('./services/transactionDoubleValidator');
const auctionLockMechanism = require('./services/auctionLockMechanism');
const { logError } = require('./utils/errorTracking');
const config = require('./config');

// Planifier les tâches récurrentes
const setupRecurringTasks = () => {
  console.log('Setting up recurring tasks...');
  
  // Vérification des enchères toutes les heures
  auctionService.scheduleAuctionChecks();
  
  // Nettoyage des entrées d'audit toutes les 6 heures
  transactionDoubleValidator.scheduleCleanup();
  
  console.log('Recurring tasks set up successfully');
};

// Initialiser tous les services
const initializeAllServices = async () => {
  console.log('Initializing all services...');
  
  try {
    // Initialiser les services dans l'ordre de dépendance
    await treasuryService.initialize();
    await unifiedLoyaltyService.initialize();
    await transactionDoubleValidator.initialize();
    await auctionLockMechanism.initialize();
    
    console.log('All services initialized successfully');
    return true;
  } catch (error) {
    logError('Error initializing services', error);
    return false;
  }
};

// Vérifier l'intégrité du système
const checkSystemIntegrity = async () => {
  console.log('Checking system integrity...');
  
  const checkResults = {
    treasury: false,
    loyalty: false,
    auction: false,
    transaction: false
  };
  
  try {
    // Vérifier la caisse commune
    const treasuryBalance = await treasuryService.getTotalBalance();
    checkResults.treasury = treasuryBalance !== undefined;
    
    // Vérifier le service de loyauté
    checkResults.loyalty = await unifiedLoyaltyService.checkConnection();
    
    // Vérifier les enchères
    const auctionStats = await auctionService.getAuctionStatistics();
    checkResults.auction = auctionStats !== undefined;
    
    // Vérifier la validation des transactions
    const nonce = await transactionValidationService.createTransactionNonce('system-check');
    checkResults.transaction = nonce !== undefined;
    
    const allChecksPass = Object.values(checkResults).every(result => result === true);
    
    console.log('System integrity check completed:');
    console.log(JSON.stringify(checkResults, null, 2));
    
    return {
      success: allChecksPass,
      checks: checkResults
    };
  } catch (error) {
    logError('Error checking system integrity', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Fonction pour démarrer tout le système
const bootSystem = async () => {
  console.log('Booting system...');
  
  try {
    // Étape 1: Initialiser tous les services
    const initialized = await initializeAllServices();
    if (!initialized) {
      throw new Error('Failed to initialize all services');
    }
    
    // Étape 2: Vérifier l'intégrité du système
    const integrityCheck = await checkSystemIntegrity();
    if (!integrityCheck.success) {
      throw new Error('System integrity check failed');
    }
    
    // Étape 3: Configurer les tâches récurrentes
    setupRecurringTasks();
    
    console.log('System booted successfully');
    return true;
  } catch (error) {
    logError('Error booting system', error);
    return false;
  }
};

// API pour obtenir un rapport complet sur l'état du système
const getSystemStatus = async () => {
  try {
    // Vérifier l'intégrité du système
    const integrityCheck = await checkSystemIntegrity();
    
    // Récupérer les statistiques de la caisse commune
    const treasuryDashboard = await treasuryService.getDashboard();
    
    // Récupérer les statistiques des enchères
    const auctionStats = await auctionService.getAuctionStatistics();
    
    // Récupérer les dernières transactions
    const recentTransactions = await getRecentTransactions();
    
    return {
      success: true,
      status: integrityCheck.success ? 'healthy' : 'degraded',
      serviceStatus: integrityCheck.checks,
      treasuryStats: {
        totalBalance: treasuryDashboard.totalBalance,
        totalAllocated: treasuryDashboard.totalAllocated,
        totalConsumed: treasuryDashboard.totalConsumed,
        sponsorCount: treasuryDashboard.sponsorCount
      },
      auctionStats: {
        activeAuctions: auctionStats.activeAuctions,
        upcomingAuctions: auctionStats.upcomingAuctions,
        finalizedAuctions: auctionStats.finalizedAuctions,
        totalBids: auctionStats.totalBids
      },
      recentTransactions: recentTransactions.slice(0, 10) // Limiter à 10 transactions
    };
  } catch (error) {
    logError('Error getting system status', error);
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
};

// Fonction auxiliaire pour récupérer les transactions récentes
const getRecentTransactions = async () => {
  try {
    const { TransactionHistory } = require('./models/TransactionHistory');
    
    const transactions = await TransactionHistory.find()
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('userId', 'name email')
      .populate('sectorId', 'name')
      .populate('sponsorId', 'name');
    
    return transactions.map(t => ({
      id: t._id,
      type: t.transactionType,
      status: t.status,
      amount: t.amount,
      timestamp: t.timestamp,
      user: t.userId ? t.userId.name : null,
      sector: t.sectorId ? t.sectorId.name : null,
      sponsor: t.sponsorId ? t.sponsorId.name : null
    }));
  } catch (error) {
    logError('Error getting recent transactions', error);
    return [];
  }
};

// Exporter les fonctions principales
module.exports = {
  bootSystem,
  checkSystemIntegrity,
  getSystemStatus
};

// Si ce fichier est exécuté directement, démarrer le système
if (require.main === module) {
  bootSystem().then(result => {
    if (result) {
      console.log('System started successfully');
    } else {
      console.error('Failed to start system');
      process.exit(1);
    }
  });
}

// controllers/treasuryDashboardController.js
// Contrôleur pour gérer l'affichage du tableau de bord de la caisse commune

const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const treasuryService = require('../services/treasuryService');
const { TransactionHistory } = require('../models/TransactionHistory');
const { Sector } = require('../models/Sector');
const { Company } = require('../models/Company');
const { logError } = require('../utils/errorTracking');

/**
 * @route GET /api/treasury/dashboard
 * @desc Récupère le tableau de bord complet de la caisse commune
 * @access Public
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Récupérer les données du tableau de bord depuis le service
    const dashboard = await treasuryService.getDashboard();
    
    res.json(dashboard);
  } catch (error) {
    logError('Error fetching treasury dashboard', error);
    res.status(500).json({ error: 'Failed to fetch treasury dashboard' });
  }
});

/**
 * @route GET /api/treasury/sponsors
 * @desc Récupère la liste des sponsors avec leurs contributions
 * @access Public
 */
router.get('/sponsors', async (req, res) => {
  try {
    // Récupérer les secteurs sponsorisés
    const sponsoredSectors = await treasuryService.getSponsoredSectors();
    
    // Extraire les adresses uniques des sponsors
    const sponsorAddresses = [...new Set(
      sponsoredSectors
        .filter(s => s.sponsor && s.sponsor.sponsorAddress)
        .map(s => s.sponsor.sponsorAddress)
    )];
    
    // Récupérer les détails de chaque sponsor
    const sponsors = await Promise.all(
      sponsorAddresses.map(async (address) => {
        // Récupérer l'entreprise depuis la base de données
        const company = await Company.findOne({ walletAddress: address });
        
        if (!company) {
          return null;
        }
        
        // Récupérer les contributions du sponsor
        const contributions = await treasuryService.getSponsorContributions(address);
        
        // Récupérer les secteurs sponsorisés par cette entreprise
        const sectors = sponsoredSectors
          .filter(s => s.sponsor && s.sponsor.sponsorAddress === address)
          .map(s => ({
            id: s.sectorId,
            name: s.name,
            allocatedFunds: s.sponsor.allocatedFunds,
            consumedFunds: s.sponsor.consumedFunds,
            remainingFunds: s.sponsor.remainingFunds,
            startTime: s.sponsor.startTime,
            endTime: s.sponsor.endTime
          }));
        
        // Calculer les totaux
        const totalAllocated = sectors.reduce((sum, s) => sum + s.allocatedFunds, 0);
        const totalConsumed = sectors.reduce((sum, s) => sum + s.consumedFunds, 0);
        
        return {
          id: company._id,
          name: company.name,
          logo: company.logo,
          industry: company.industry,
          walletAddress: address,
          totalAllocated,
          totalConsumed,
          remainingFunds: totalAllocated - totalConsumed,
          contributionCount: contributions.length,
          sectors,
          contributionHistory: contributions.slice(0, 10) // Limiter à 10 contributions récentes
        };
      })
    );
    
    // Filtrer les sponsors null et trier par montant alloué
    const validSponsors = sponsors
      .filter(s => s !== null)
      .sort((a, b) => b.totalAllocated - a.totalAllocated);
    
    res.json({
      success: true,
      count: validSponsors.length,
      sponsors: validSponsors
    });
  } catch (error) {
    logError('Error fetching sponsors', error);
    res.status(500).json({ error: 'Failed to fetch sponsors' });
  }
});

/**
 * @route GET /api/treasury/sectors
 * @desc Récupère les détails de tous les secteurs avec leurs sponsors et soldes
 * @access Public
 */
router.get('/sectors', async (req, res) => {
  try {
    // Récupérer tous les secteurs
    const sectors = await Sector.find({});
    
    // Enrichir chaque secteur avec les informations de son sponsor et son solde
    const enrichedSectors = await Promise.all(
      sectors.map(async (sector) => {
        try {
          // Récupérer les informations du sponsor
          const sponsorInfo = await treasuryService.getSponsorInfo(sector._id);
          
          // Récupérer le solde du secteur
          const balance = await treasuryService.getSectorBalance(sector._id);
          
          // Récupérer les 5 dernières transactions pour ce secteur
          const recentTransactions = await TransactionHistory.find({ sectorId: sector._id })
            .sort({ timestamp: -1 })
            .limit(5)
            .populate('userId', 'name email')
            .populate('sponsorId', 'name');
          
          return {
            id: sector._id,
            name: sector.name,
            description: sector.description,
            status: sector.status,
            icon: sector.icon,
            color: sector.color,
            balance,
            sponsor: sponsorInfo,
            recentTransactions: recentTransactions.map(t => ({
              id: t._id,
              amount: t.amount,
              type: t.transactionType,
              timestamp: t.timestamp,
              user: t.userId ? {
                id: t.userId._id,
                name: t.userId.name
              } : null,
              description: t.description
            }))
          };
        } catch (error) {
          // En cas d'erreur, retourner des informations minimales
          return {
            id: sector._id,
            name: sector.name,
            description: sector.description,
            status: sector.status,
            error: 'Failed to fetch complete sector details'
          };
        }
      })
    );
    
    res.json({
      success: true,
      count: enrichedSectors.length,
      sectors: enrichedSectors
    });
  } catch (error) {
    logError('Error fetching sectors', error);
    res.status(500).json({ error: 'Failed to fetch sectors' });
  }
});

/**
 * @route GET /api/treasury/transactions
 * @desc Récupère l'historique des transactions (distribution et utilisation)
 * @access Public
 */
router.get('/transactions', async (req, res) => {
  try {
    // Paramètres de pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Filtres optionnels
    const filters = {};
    
    if (req.query.sectorId) {
      filters.sectorId = req.query.sectorId;
    }
    
    if (req.query.sponsorId) {
      filters.sponsorId = req.query.sponsorId;
    }
    
    if (req.query.type) {
      filters.transactionType = req.query.type;
    }
    
    // Récupérer les transactions
    const transactions = await TransactionHistory.find(filters)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('sectorId', 'name')
      .populate('sponsorId', 'name logo');
    
    // Compter le nombre total de transactions
    const total = await TransactionHistory.countDocuments(filters);
    
    // Calculer les statistiques
    const stats = await TransactionHistory.aggregate([
      { $match: filters },
      { $group: {
          _id: '$transactionType',
          count: { $sum: 1 },
          totalAmount: { $sum: { $abs: '$amount' } }
        }
      }
    ]);
    
    // Formater les statistiques
    const statsMap = stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount
      };
      return acc;
    }, {});
    
    res.json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      stats: statsMap,
      transactions: transactions.map(t => ({
        id: t._id,
        userId: t.userId ? t.userId._id : null,
        userName: t.userId ? t.userId.name : null,
        sectorId: t.sectorId ? t.sectorId._id : null,
        sectorName: t.sectorId ? t.sectorId.name : null,
        sponsorId: t.sponsorId ? t.sponsorId._id : null,
        sponsorName: t.sponsorId ? t.sponsorId.name : null,
        sponsorLogo: t.sponsorId ? t.sponsorId.logo : null,
        amount: t.amount,
        type: t.transactionType,
        status: t.status,
        timestamp: t.timestamp,
        description: t.description,
        txHash: t.txHash
      }))
    });
  } catch (error) {
    logError('Error fetching treasury transactions', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * @route GET /api/treasury/realtime
 * @desc Récupère les données en temps réel de la caisse commune
 * @access Public
 */
router.get('/realtime', async (req, res) => {
  try {
    // Récupérer le solde total de la caisse commune
    const totalBalance = await treasuryService.getTotalBalance();
    
    // Récupérer les secteurs sponsorisés
    const sponsoredSectors = await treasuryService.getSponsoredSectors();
    
    // Récupérer les transactions récentes (10 dernières)
    const recentTransactions = await TransactionHistory.find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('userId', 'name')
      .populate('sectorId', 'name')
      .populate('sponsorId', 'name');
    
    // Calculer les stats des dernières 24h
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const last24hStats = await TransactionHistory.aggregate([
      { $match: { timestamp: { $gte: yesterday } } },
      { $group: {
          _id: '$transactionType',
          count: { $sum: 1 },
          totalAmount: { $sum: { $abs: '$amount' } }
        }
      }
    ]);
    
    res.json({
      success: true,
      totalBalance,
      sectorCount: sponsoredSectors.length,
      recentActivity: recentTransactions.map(t => ({
        id: t._id,
        userName: t.userId ? t.userId.name : null,
        sectorName: t.sectorId ? t.sectorId.name : null,
        sponsorName: t.sponsorId ? t.sponsorId.name : null,
        amount: t.amount,
        type: t.transactionType,
        timestamp: t.timestamp
      })),
      last24hStats: last24hStats.reduce((acc, stat) => {
        acc[stat._id] = {
          count: stat.count,
          totalAmount: stat.totalAmount
        };
        return acc;
      }, {})
    });
  } catch (error) {
    logError('Error fetching realtime treasury data', error);
    res.status(500).json({ error: 'Failed to fetch realtime data' });
  }
});

/**
 * @route GET /api/treasury/user/:userId
 * @desc Récupère le tableau de bord personnel d'un utilisateur
 * @access Private
 */
router.get('/user/:userId', authenticateJWT, async (req, res) => {
  try {
    // Vérifier que l'utilisateur demande ses propres données ou est un administrateur
    if (req.user.id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    // Récupérer le token NFT de l'utilisateur
    const user = await User.findById(req.params.userId);
    
    if (!user || !user.tokenId) {
      return res.status(404).json({ error: 'User or token not found' });
    }
    
    // Récupérer les détails du token
    const tokenDetails = await unifiedLoyaltyService.getCardDetails(user.tokenId);
    
    if (!tokenDetails) {
      return res.status(404).json({ error: 'Loyalty card not found' });
    }
    
    // Récupérer l'historique des transactions de l'utilisateur
    const transactions = await TransactionHistory.getUserTransactions(user._id, 20);
    
    // Récupérer les statistiques de l'utilisateur
    const stats = await TransactionHistory.getUserStats(user._id);
    
    // Calculer les totaux par secteur
    const sectorTotals = {};
    
    for (const [sectorId, balance] of Object.entries(tokenDetails.balances)) {
      // Récupérer les informations du secteur
      const sector = await Sector.findById(sectorId);
      
      if (sector) {
        sectorTotals[sectorId] = {
          id: sectorId,
          name: sector.name,
          icon: sector.icon,
          color: sector.color,
          balance: balance.balance,
          totalReceived: balance.totalEarned,
          totalSpent: balance.totalSpent
        };
      }
    }
    
    res.json({
      success: true,
      userId: user._id,
      tokenId: user.tokenId,
      balances: sectorTotals,
      transactions: transactions.map(t => ({
        id: t._id,
        amount: t.amount,
        sectorName: t.sectorId ? t.sectorId.name : null,
        sponsorName: t.sponsorId ? t.sponsorId.name : null,
        type: t.transactionType,
        timestamp: t.timestamp,
        description: t.description
      })),
      stats
    });
  } catch (error) {
    logError(`Error fetching user treasury dashboard for ${req.params.userId}`, error);
    res.status(500).json({ error: 'Failed to fetch user dashboard' });
  }
});

module.exports = router;

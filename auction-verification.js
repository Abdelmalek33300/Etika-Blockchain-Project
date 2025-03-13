// tests/auctionVerificationTests.js
// Tests de vérification pour le verrouillage des enchères et l'engagement des sponsors

const auctionService = require('../services/auctionService');
const auctionLockMechanism = require('../services/auctionLockMechanism');
const treasuryService = require('../services/treasuryService');
const { Auction } = require('../models/Auction');
const { Bid } = require('../models/Bid');
const { Company } = require('../models/Company');
const { Sector } = require('../models/Sector');
const { logError } = require('../utils/errorTracking');

/**
 * Vérifie qu'une enchère gagnante est correctement verrouillée et ne peut pas être remboursée
 * @param {string} auctionId - ID de l'enchère à tester
 * @returns {Promise<Object>} - Résultats du test
 */
async function testWinningBidLockdown(auctionId) {
  console.log(`Running winning bid lockdown test for auction ${auctionId}...`);
  
  const testResults = {
    auctionId,
    tests: [],
    overallSuccess: true
  };
  
  try {
    // Étape 1: Vérifier que l'enchère existe et est finalisée
    const auction = await Auction.findById(auctionId);
    
    if (!auction) {
      throw new Error(`Auction ${auctionId} not found`);
    }
    
    if (auction.status !== 'finalized') {
      throw new Error(`Auction ${auctionId} is not finalized`);
    }
    
    testResults.tests.push({
      name: 'Auction exists and is finalized',
      success: true
    });
    
    // Étape 2: Vérifier que les enchères gagnantes sont bien enregistrées
    const winners = auction.winners || [];
    
    if (winners.length === 0) {
      throw new Error(`No winners found for auction ${auctionId}`);
    }
    
    testResults.tests.push({
      name: 'Auction has winners',
      success: true,
      winnerCount: winners.length
    });
    
    // Étape 3: Pour chaque gagnant, vérifier que les fonds sont bien transférés à la caisse commune
    for (const winner of winners) {
      if (!winner.sectorId || !winner.companyId) {
        testResults.tests.push({
          name: `Winner data validation for sector`,
          success: false,
          error: 'Invalid winner data'
        });
        testResults.overallSuccess = false;
        continue;
      }
      
      try {
        // Vérifier que le secteur a bien un sponsor actif
        const sponsorInfo = await treasuryService.getSponsorInfo(winner.sectorId);
        
        if (!sponsorInfo || !sponsorInfo.active) {
          testResults.tests.push({
            name: `Sponsor activation for sector ${winner.sectorId}`,
            success: false,
            error: 'No active sponsor for this sector'
          });
          testResults.overallSuccess = false;
          continue;
        }
        
        // Vérifier que l'entreprise gagnante correspond au sponsor
        const company = await Company.findById(winner.companyId);
        
        if (!company) {
          testResults.tests.push({
            name: `Company validation for ${winner.companyId}`,
            success: false,
            error: 'Company not found'
          });
          testResults.overallSuccess = false;
          continue;
        }
        
        if (company.walletAddress !== sponsorInfo.sponsorAddress) {
          testResults.tests.push({
            name: `Company-sponsor match for ${company.name}`,
            success: false,
            error: 'Company address does not match sponsor address'
          });
          testResults.overallSuccess = false;
          continue;
        }
        
        // Vérifier que les fonds ont été transférés à la caisse commune
        const bid = await Bid.findOne({
          auctionId,
          sectorId: winner.sectorId,
          companyId: winner.companyId
        }).sort({ amount: -1 });
        
        if (!bid) {
          testResults.tests.push({
            name: `Bid validation for sector ${winner.sectorId}`,
            success: false,
            error: 'Winning bid not found'
          });
          testResults.overallSuccess = false;
          continue;
        }
        
        // Vérifier que l'enchère est marquée comme transférée
        if (!bid.transferred) {
          testResults.tests.push({
            name: `Bid transfer for ${bid._id}`,
            success: false,
            error: 'Bid not marked as transferred'
          });
          testResults.overallSuccess = false;
          continue;
        }
        
        // Vérifier que l'enchère n'est plus verrouillée (car déjà transférée)
        if (bid.locked) {
          testResults.tests.push({
            name: `Bid lock status for ${bid._id}`,
            success: false,
            error: 'Bid still marked as locked after transfer'
          });
          testResults.overallSuccess = false;
          continue;
        }
        
        // Vérifier qu'on ne peut pas déverrouiller cette enchère
        try {
          await auctionLockMechanism.unlockLosingBidFunds(bid._id);
          
          testResults.tests.push({
            name: `Bid unlock prevention for ${bid._id}`,
            success: false,
            error: 'Was able to unlock a winning bid'
          });
          testResults.overallSuccess = false;
        } catch (unlockError) {
          // L'erreur est attendue, c'est bon signe
          testResults.tests.push({
            name: `Bid unlock prevention for ${bid._id}`,
            success: true,
            note: 'Correctly prevented unlocking a winning bid'
          });
        }
        
        // Vérifier que le sponsor ne peut pas retirer les fonds
        const canWithdraw = await auctionLockMechanism.canSponsorWithdrawFunds(
          winner.sectorId,
          company.walletAddress
        );
        
        if (canWithdraw) {
          testResults.tests.push({
            name: `Sponsor withdrawal prevention for ${company.name}`,
            success: false,
            error: 'Sponsor can withdraw funds'
          });
          testResults.overallSuccess = false;
        } else {
          testResults.tests.push({
            name: `Sponsor withdrawal prevention for ${company.name}`,
            success: true,
            note: 'Correctly prevented sponsor from withdrawing funds'
          });
        }
        
      } catch (winnerError) {
        testResults.tests.push({
          name: `Winner verification for sector ${winner.sectorId}`,
          success: false,
          error: winnerError.message
        });
        testResults.overallSuccess = false;
      }
    }
    
    // Étape 4: Vérifier qu'aucune enchère perdante n'a été transférée à la caisse commune
    const losingBids = await Bid.find({
      auctionId,
      transferred: true
    });
    
    const unauthorizedTransfers = losingBids.filter(bid => {
      // Vérifier si cette enchère correspond à un gagnant
      return !winners.some(w => 
        w.sectorId.toString() === bid.sectorId.toString() && 
        w.companyId.toString() === bid.companyId.toString()
      );
    });
    
    if (unauthorizedTransfers.length > 0) {
      testResults.tests.push({
        name: 'Unauthorized transfers check',
        success: false,
        error: `Found ${unauthorizedTransfers.length} unauthorized transfers`
      });
      testResults.overallSuccess = false;
    } else {
      testResults.tests.push({
        name: 'Unauthorized transfers check',
        success: true,
        note: 'No unauthorized transfers found'
      });
    }
    
    return testResults;
  } catch (error) {
    testResults.tests.push({
      name: 'Overall auction verification',
      success: false,
      error: error.message
    });
    testResults.overallSuccess = false;
    
    return testResults;
  }
}

/**
 * Tente de forcer un remboursement d'une enchère gagnante et vérifie que c'est impossible
 * @param {string} auctionId - ID de l'enchère
 * @param {string} sectorId - ID du secteur
 * @returns {Promise<Object>} - Résultat du test
 */
async function testForcedRefund(auctionId, sectorId) {
  console.log(`Running forced refund test for auction ${auctionId}, sector ${sectorId}...`);
  
  try {
    // Récupérer l'enchère gagnante pour ce secteur
    const auction = await Auction.findById(auctionId);
    
    if (!auction || auction.status !== 'finalized') {
      throw new Error('Auction not found or not finalized');
    }
    
    const winner = (auction.winners || []).find(w => w.sectorId.toString() === sectorId.toString());
    
    if (!winner) {
      throw new Error('No winner found for this sector');
    }
    
    // Récupérer l'enchère
    const winningBid = await Bid.findOne({
      auctionId,
      sectorId,
      companyId: winner.companyId
    }).sort({ amount: -1 });
    
    if (!winningBid) {
      throw new Error('Winning bid not found');
    }
    
    // Vérifier que l'enchère est bien marquée comme transférée
    if (!winningBid.transferred) {
      throw new Error('Winning bid not marked as transferred');
    }
    
    // Récupérer l'entreprise
    const company = await Company.findById(winner.companyId);
    
    if (!company) {
      throw new Error('Company not found');
    }
    
    // Tenter différentes méthodes pour forcer un remboursement
    
    // 1. Tenter de déverrouiller directement l'enchère
    let directUnlockFailed = false;
    try {
      await auctionLockMechanism.unlockLosingBidFunds(winningBid._id);
      directUnlockFailed = false;
    } catch (unlockError) {
      // C'est normal que ça échoue
      directUnlockFailed = true;
    }
    
    // 2. Tenter de modifier directement le statut de l'enchère
    let statusModificationFailed = false;
    try {
      winningBid.transferred = false;
      winningBid.locked = true;
      await winningBid.save();
      
      // Vérifier que la modification a échoué (validation côté DB)
      const reloadedBid = await Bid.findById(winningBid._id);
      statusModificationFailed = reloadedBid.transferred === true;
    } catch (modError) {
      // C'est normal que ça échoue
      statusModificationFailed = true;
    }
    
    // 3. Tenter de retirer les fonds du sponsor
    let withdrawalFailed = false;
    try {
      const canWithdraw = await auctionLockMechanism.canSponsorWithdrawFunds(
        sectorId,
        company.walletAddress
      );
      
      if (canWithdraw) {
        withdrawalFailed = false;
      } else {
        // Le retrait n'est pas autorisé, c'est normal
        withdrawalFailed = true;
      }
    } catch (withdrawError) {
      // C'est normal que ça échoue
      withdrawalFailed = true;
    }
    
    return {
      auctionId,
      sectorId,
      companyId: winner.companyId,
      tests: [
        {
          name: 'Direct unlock prevention',
          success: directUnlockFailed,
          note: directUnlockFailed ? 
            'Correctly prevented direct unlock' : 
            'WARNING: Could unlock a winning bid'
        },
        {
          name: 'Status modification prevention',
          success: statusModificationFailed,
          note: statusModificationFailed ? 
            'Correctly prevented status modification' : 
            'WARNING: Could modify winning bid status'
        },
        {
          name: 'Withdrawal prevention',
          success: withdrawalFailed,
          note: withdrawalFailed ? 
            'Correctly prevented withdrawal' : 
            'WARNING: Sponsor could withdraw funds'
        }
      ],
      overallSuccess: directUnlockFailed && statusModificationFailed && withdrawalFailed
    };
  } catch (error) {
    return {
      auctionId,
      sectorId,
      error: error.message,
      overallSuccess: false
    };
  }
}

/**
 * Vérifie que les enchères perdantes sont bien déverrouillées
 * @param {string} auctionId - ID de l'enchère
 * @returns {Promise<Object>} - Résultat du test
 */
async function testLosingBidsUnlock(auctionId) {
  console.log(`Running losing bids unlock test for auction ${auctionId}...`);
  
  try {
    // Récupérer l'enchère
    const auction = await Auction.findById(auctionId);
    
    if (!auction || auction.status !== 'finalized') {
      throw new Error('Auction not found or not finalized');
    }
    
    // Récupérer les ID des enchères gagnantes
    const winningBidIds = new Set();
    
    for (const winner of (auction.winners || [])) {
      if (!winner.sectorId || !winner.companyId) continue;
      
      const winningBid = await Bid.findOne({
        auctionId,
        sectorId: winner.sectorId,
        companyId: winner.companyId
      }).sort({ amount: -1 });
      
      if (winningBid) {
        winningBidIds.add(winningBid._id.toString());
      }
    }
    
    // Récupérer toutes les enchères pour cette vente aux enchères
    const allBids = await Bid.find({ auctionId });
    
    // Filtrer pour obtenir les enchères perdantes
    const losingBids = allBids.filter(bid => !winningBidIds.has(bid._id.toString()));
    
    // Vérifier que toutes les enchères perdantes sont bien déverrouillées
    const lockedLosingBids = losingBids.filter(bid => bid.locked);
    
    // Vérifier qu'aucune enchère perdante n'a été transférée
    const transferredLosingBids = losingBids.filter(bid => bid.transferred);
    
    return {
      auctionId,
      tests: [
        {
          name: 'Losing bids unlocked',
          success: lockedLosingBids.length === 0,
          note: lockedLosingBids.length === 0 ?
            'All losing bids are correctly unlocked' :
            `Found ${lockedLosingBids.length} losing bids still locked`
        },
        {
          name: 'Losing bids not transferred',
          success: transferredLosingBids.length === 0,
          note: transferredLosingBids.length === 0 ?
            'No losing bids were transferred' :
            `Found ${transferredLosingBids.length} losing bids incorrectly transferred`
        }
      ],
      stats: {
        totalBids: allBids.length,
        winningBids: winningBidIds.size,
        losingBids: losingBids.length
      },
      overallSuccess: lockedLosingBids.length === 0 && transferredLosingBids.length === 0
    };
  } catch (error) {
    return {
      auctionId,
      error: error.message,
      overallSuccess: false
    };
  }
}

// Exporter les fonctions de test
module.exports = {
  testWinningBidLockdown,
  testForcedRefund,
  testLosingBidsUnlock
};

// services/treasuryService.js
// Service pour gérer la caisse commune sponsorisée

import Web3 from 'web3';
import { logError } from './utils/errorTracking.js';
import { getSecureItem } from '../utils/secureStorage.js';
import fs from 'fs';

const SponsorTreasuryABI = JSON.parse(
  fs.readFileSync(new URL('../contracts/SponsorTreasuryABI.json', import.meta.url))
);

import config from '../config.js';
import { Sector } from '../models/Sector.js';
import { Company } from '../models/Company.js';

class TreasuryService {
  constructor() {
    this.web3 = null;
    this.contract = null;
    this.initialized = false;
    this.initializePromise = null;
  }
  
  /**
   * Initialise le service et la connexion au contrat blockchain
   */
  async initialize() {
    if (this.initialized) return;
    
    // Si une initialisation est déjà en cours, attendre qu'elle se termine
    if (this.initializePromise) {
      return this.initializePromise;
    }
    
    this.initializePromise = (async () => {
      try {
        // Créer une instance Web3 connectée au réseau Polygon
        this.web3 = new Web3(config.POLYGON_RPC_URL);
        
        // Charger la clé privée pour les transactions (utiliser le service sécurisé)
        const privateKey = await getSecureItem('ETIKA_ADMIN_PRIVATE_KEY');
        
        if (privateKey) {
          // Ajouter le compte à l'instance Web3
          const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
          this.web3.eth.accounts.wallet.add(account);
          this.adminAddress = account.address;
        } else {
          console.warn('No admin private key found, read-only mode enabled');
          this.adminAddress = null;
        }
        
        // Créer une instance du contrat
        this.contract = new this.web3.eth.Contract(
          SponsorTreasuryABI,
          config.SPONSOR_TREASURY_CONTRACT_ADDRESS
        );
        
        this.initialized = true;
        console.log('TreasuryService initialized successfully');
      } catch (error) {
        logError('Failed to initialize TreasuryService', error);
        throw new Error(`Initialization failed: ${error.message}`);
      } finally {
        this.initializePromise = null;
      }
    })();
    
    return this.initializePromise;
  }
  
  /**
   * Enregistre un sponsor pour un secteur suite à une enchère
   * @param {string} sectorId - ID du secteur
   * @param {string} sponsorAddress - Adresse blockchain du sponsor
   * @param {number} allocatedFunds - Fonds alloués au secteur (en wei)
   * @param {number} durationDays - Durée en jours de la période de sponsoring
   * @returns {Promise<Object>} - Informations sur l'opération
   */
  async registerAuctionWinner(sectorId, sponsorAddress, allocatedFunds, durationDays) {
    await this.initialize();
    
    try {
      // Vérifier que le secteur existe
      const sector = await Sector.findById(sectorId);
      if (!sector) {
        throw new Error(`Sector ${sectorId} not found`);
      }
      
      // Vérifier que l'entreprise existe
      const company = await Company.findOne({ walletAddress: sponsorAddress });
      if (!company) {
        throw new Error(`Company with wallet address ${sponsorAddress} not found`);
      }
      
      // Ajouter le sponsor au contrat
      const tx = await this.contract.methods.addSponsor(
        sectorId,
        sponsorAddress,
        allocatedFunds.toString(),
        durationDays
      ).send({
        from: this.adminAddress,
        gas: 500000
      });
      
      // Mettre à jour le secteur dans la base de données
      sector.currentWinner = {
        companyId: company._id,
        bidAmount: allocatedFunds,
        winDate: new Date()
      };
      
      await sector.save();
      
      return {
        success: true,
        txHash: tx.transactionHash,
        sectorId,
        sponsorAddress,
        allocatedFunds,
        durationDays,
        startTime: Math.floor(Date.now() / 1000), // Timestamp actuel en secondes
        endTime: Math.floor(Date.now() / 1000) + (durationDays * 86400) // Timestamp de fin
      };
    } catch (error) {
      logError('Error registering auction winner', error);
      throw new Error(`Failed to register auction winner: ${error.message}`);
    }
  }
  
  /**
   * Enregistre une contribution native (ETH/MATIC) d'un sponsor
   * @param {string} sponsorAddress - Adresse blockchain du sponsor
   * @param {number} amount - Montant de la contribution (en wei)
   * @param {string} referenceId - ID de référence (ex: ID de l'enchère)
   * @param {string} transactionType - Type de transaction (ex: "auction_win", "topup")
   * @returns {Promise<Object>} - Informations sur l'opération
   */
  async recordNativeContribution(sponsorAddress, amount, referenceId, transactionType) {
    await this.initialize();
    
    try {
      // Vérifier que l'entreprise existe
      const company = await Company.findOne({ walletAddress: sponsorAddress });
      if (!company) {
        throw new Error(`Company with wallet address ${sponsorAddress} not found`);
      }
      
      // Préparer un wallet pour l'entreprise si ce n'est pas déjà fait
      const sponsorWallet = this.web3.eth.accounts.privateKeyToAccount(
        await getSecureItem(`SPONSOR_PRIVATE_KEY_${company._id}`)
      );
      
      this.web3.eth.accounts.wallet.add(sponsorWallet);
      
      // Convertir referenceId en bytes32
      const bytes32ReferenceId = this.web3.utils.asciiToHex(referenceId.padEnd(32, '\0'));
      
      // Envoyer la transaction
      const tx = await this.contract.methods.contributeNative(
        bytes32ReferenceId,
        transactionType
      ).send({
        from: sponsorWallet.address,
        value: amount.toString(),
        gas: 300000
      });
      
      // Mettre à jour l'entreprise dans la base de données
      const paymentRecord = {
        amount: amount,
        timestamp: new Date(),
        transactionType: transactionType,
        referenceId: referenceId,
        transactionHash: tx.transactionHash
      };
      
      // Ajouter l'historique des paiements si nécessaire
      if (!company.paymentsHistory) {
        company.paymentsHistory = [];
      }
      
      company.paymentsHistory.push(paymentRecord);
      await company.save();
      
      return {
        success: true,
        txHash: tx.transactionHash,
        sponsorAddress,
        amount,
        referenceId,
        transactionType
      };
    } catch (error) {
      logError('Error recording native contribution', error);
      throw new Error(`Failed to record native contribution: ${error.message}`);
    }
  }
  
  /**
   * Distribue des avoirs à un utilisateur
   * @param {string} sectorId - ID du secteur
   * @param {string} tokenId - ID du token NFT de l'utilisateur
   * @param {number} amount - Montant des avoirs à distribuer
   * @param {string} sponsorAddress - Adresse du sponsor qui distribue les avoirs
   * @returns {Promise<Object>} - Informations sur l'opération
   */
  async distributeAvoirs(sectorId, tokenId, amount, sponsorAddress) {
    await this.initialize();
    
    try {
      // Vérifier que le secteur existe
      const sector = await Sector.findById(sectorId);
      if (!sector) {
        throw new Error(`Sector ${sectorId} not found`);
      }
      
      // Vérifier le solde disponible pour le secteur
      const sectorBalance = await this.contract.methods.getSectorBalance(sectorId).call();
      if (parseInt(sectorBalance) < amount) {
        throw new Error(`Insufficient balance for sector ${sectorId}: ${sectorBalance} < ${amount}`);
      }
      
      // Préparer un wallet pour le sponsor ou utiliser l'admin si non fourni
      let fromAddress = this.adminAddress;
      
      if (sponsorAddress) {
        const company = await Company.findOne({ walletAddress: sponsorAddress });
        if (company) {
          const sponsorWallet = this.web3.eth.accounts.privateKeyToAccount(
            await getSecureItem(`SPONSOR_PRIVATE_KEY_${company._id}`)
          );
          
          this.web3.eth.accounts.wallet.add(sponsorWallet);
          fromAddress = sponsorWallet.address;
        }
      }
      
      // Distribuer les avoirs
      const tx = await this.contract.methods.distributeAvoirs(
        sectorId,
        tokenId,
        amount.toString()
      ).send({
        from: fromAddress,
        gas: 300000
      });
      
      return {
        success: true,
        txHash: tx.transactionHash,
        sectorId,
        tokenId,
        amount
      };
    } catch (error) {
      logError('Error distributing avoirs', error);
      throw new Error(`Failed to distribute avoirs: ${error.message}`);
    }
  }
  
  /**
   * Récupère le solde disponible pour un secteur
   * @param {string} sectorId - ID du secteur
   * @returns {Promise<number>} - Solde disponible
   */
  async getSectorBalance(sectorId) {
    await this.initialize();
    
    try {
      const balance = await this.contract.methods.getSectorBalance(sectorId).call();
      return parseInt(balance);
    } catch (error) {
      logError(`Error getting sector balance for ${sectorId}`, error);
      return 0;
    }
  }
  
  /**
   * Récupère le solde total de la caisse commune
   * @returns {Promise<number>} - Solde total
   */
  async getTotalBalance() {
    await this.initialize();
    
    try {
      const balance = await this.contract.methods.totalBalance().call();
      return parseInt(balance);
    } catch (error) {
      logError('Error getting total balance', error);
      return 0;
    }
  }
  
  /**
   * Récupère les informations d'un sponsor pour un secteur
   * @param {string} sectorId - ID du secteur
   * @returns {Promise<Object>} - Informations sur le sponsor
   */
  async getSponsorInfo(sectorId) {
    await this.initialize();
    
    try {
      const info = await this.contract.methods.getSponsorInfo(sectorId).call();
      
      // Récupérer les informations de l'entreprise depuis la base de données
      let company = null;
      if (info.sponsorAddress !== '0x0000000000000000000000000000000000000000') {
        company = await Company.findOne({ walletAddress: info.sponsorAddress });
      }
      
      return {
        sponsorAddress: info.sponsorAddress,
        allocatedFunds: parseInt(info.allocatedFunds),
        consumedFunds: parseInt(info.consumedFunds),
        remainingFunds: parseInt(info.allocatedFunds) - parseInt(info.consumedFunds),
        startTime: new Date(parseInt(info.startTime) * 1000),
        endTime: new Date(parseInt(info.endTime) * 1000),
        active: info.active,
        company: company ? {
          id: company._id,
          name: company.name,
          logo: company.logo
        } : null
      };
    } catch (error) {
      logError(`Error getting sponsor info for sector ${sectorId}`, error);
      return null;
    }
  }
  
  /**
   * Récupère la liste des secteurs sponsorisés
   * @returns {Promise<Array>} - Liste des secteurs sponsorisés avec leurs détails
   */
  async getSponsoredSectors() {
    await this.initialize();
    
    try {
      // Récupérer les IDs des secteurs sponsorisés
      const sectorIds = await this.contract.methods.getSponsoredSectors().call();
      
      // Récupérer les détails de chaque secteur
      const sectors = [];
      
      for (const sectorId of sectorIds) {
        // Récupérer les informations du sponsor
        const sponsorInfo = await this.getSponsorInfo(sectorId);
        
        // Récupérer les informations du secteur depuis la base de données
        const sector = await Sector.findById(sectorId);
        
        if (sector && sponsorInfo) {
          sectors.push({
            sectorId: sectorId,
            name: sector.name,
            description: sector.description,
            sponsor: sponsorInfo
          });
        }
      }
      
      return sectors;
    } catch (error) {
      logError('Error getting sponsored sectors', error);
      return [];
    }
  }
  
  /**
   * Récupère les contributions d'un sponsor
   * @param {string} sponsorAddress - Adresse du sponsor
   * @returns {Promise<Array>} - Liste des contributions
   */
  async getSponsorContributions(sponsorAddress) {
    await this.initialize();
    
    try {
      const contributions = await this.contract.methods.getSponsorContributions(sponsorAddress).call();
      
      return contributions.map(c => ({
        amount: parseInt(c.amount),
        timestamp: new Date(parseInt(c.timestamp) * 1000),
        transactionType: c.transactionType,
        referenceId: this.web3.utils.hexToAscii(c.referenceId).replace(/\0/g, '')
      }));
    } catch (error) {
      logError(`Error getting contributions for sponsor ${sponsorAddress}`, error);
      return [];
    }
  }
  
  /**
   * Alloue des fonds à un secteur spécifique
   * @param {string} sectorId - ID du secteur
   * @param {number} amount - Montant à allouer
   * @returns {Promise<Object>} - Informations sur l'opération
   */
  async allocateToSector(sectorId, amount) {
    await this.initialize();
    
    try {
      // Vérifier le solde total disponible
      const totalBalance = await this.getTotalBalance();
      if (totalBalance < amount) {
        throw new Error(`Insufficient total balance: ${totalBalance} < ${amount}`);
      }
      
      // Vérifier que le secteur existe
      const sector = await Sector.findById(sectorId);
      if (!sector) {
        throw new Error(`Sector ${sectorId} not found`);
      }
      
      // Allouer les fonds
      const tx = await this.contract.methods.allocateToSector(
        sectorId,
        amount.toString()
      ).send({
        from: this.adminAddress,
        gas: 200000
      });
      
      return {
        success: true,
        txHash: tx.transactionHash,
        sectorId,
        amount
      };
    } catch (error) {
      logError('Error allocating funds to sector', error);
      throw new Error(`Failed to allocate funds: ${error.message}`);
    }
  }
  
  /**
   * Récupère le tableau de bord de la caisse commune
   * @returns {Promise<Object>} - Tableau de bord complet
   */
  async getDashboard() {
    await this.initialize();
    
    try {
      // Récupérer le solde total
      const totalBalance = await this.getTotalBalance();
      
      // Récupérer les secteurs sponsorisés
      const sponsoredSectors = await this.getSponsoredSectors();
      
      // Calculer les statistiques
      const totalAllocated = sponsoredSectors.reduce(
        (sum, s) => sum + s.sponsor.allocatedFunds, 
        0
      );
      
      const totalConsumed = sponsoredSectors.reduce(
        (sum, s) => sum + s.sponsor.consumedFunds, 
        0
      );
      
      // Récupérer les entreprises sponsors
      const sponsorAddresses = sponsoredSectors.map(s => s.sponsor.sponsorAddress);
      const uniqueSponsors = [...new Set(sponsorAddresses)];
      
      const sponsors = [];
      for (const address of uniqueSponsors) {
        const company = await Company.findOne({ walletAddress: address });
        if (company) {
          const contributions = await this.getSponsorContributions(address);
          
          sponsors.push({
            id: company._id,
            name: company.name,
            logo: company.logo,
            address: address,
            totalContributed: contributions.reduce((sum, c) => sum + c.amount, 0),
            sectorsSponsored: sponsoredSectors
              .filter(s => s.sponsor.sponsorAddress === address)
              .map(s => s.name)
          });
        }
      }
      
      return {
        totalBalance,
        totalAllocated,
        totalConsumed,
        remainingUnallocated: totalBalance - totalAllocated,
        sectorCount: sponsoredSectors.length,
        sponsorCount: uniqueSponsors.length,
        sectors: sponsoredSectors,
        sponsors
      };
    } catch (error) {
      logError('Error getting treasury dashboard', error);
      throw new Error(`Failed to get dashboard: ${error.message}`);
    }
  }
}

// Exporter une instance unique du service
const treasuryService = new TreasuryService();
export default treasuryService;

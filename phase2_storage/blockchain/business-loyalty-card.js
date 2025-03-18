// models/BusinessLoyaltyCard.js
// Modèle pour les cartes de fidélité destinées aux professionnels (entreprises)

const mongoose = require('mongoose');

// Statuts de la carte
const CARD_STATUS = {
  ACTIVE: 'active',           // Carte active
  SUSPENDED: 'suspended',     // Carte temporairement suspendue
  REVOKED: 'revoked',         // Carte révoquée définitivement
  EXPIRED: 'expired'          // Carte expirée
};

// Types de transactions
const TRANSACTION_TYPES = {
  CREDIT: 'credit',           // Ajout d'avoirs
  DEBIT: 'debit',             // Utilisation d'avoirs
  REFUND: 'refund',           // Remboursement
  TRANSFER: 'transfer',       // Transfert entre cartes
  ADJUSTMENT: 'adjustment'    // Ajustement administratif
};

// Schéma de la carte professionnelle
const businessLoyaltyCardSchema = new mongoose.Schema({
  // Informations de base
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  tokenId: {
    type: String,
    required: true,
    unique: true
  },
  nftAddress: {
    type: String,
    required: true
  },
  
  // Statut et validité
  status: {
    type: String,
    enum: Object.values(CARD_STATUS),
    default: CARD_STATUS.ACTIVE
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 an
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Niveaux et avantages
  tierLevel: {
    type: String,
    enum: ['standard', 'silver', 'gold', 'platinum'],
    default: 'standard'
  },
  benefitsEnabled: [{
    type: String,
    enum: [
      'group_discounts', 
      'priority_access', 
      'extended_payment_terms', 
      'free_shipping', 
      'exclusive_events'
    ]
  }],
  
  // Avoirs par secteur
  sectorBalances: [{
    sectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sector'
    },
    balance: {
      type: Number,
      default: 0
    },
    totalEarned: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    lastActivity: Date
  }],
  
  // Restrictions d'utilisation
  restrictions: {
    maxTransactionAmount: {
      type: Number,
      default: 0  // 0 = pas de limite
    },
    dailyLimit: {
      type: Number,
      default: 0  // 0 = pas de limite
    },
    restrictedSectors: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sector'
    }],
    requiresApproval: {
      type: Boolean,
      default: false
    }
  },
  
  // Historique des transactions (limité aux 50 dernières)
  recentTransactions: [{
    transactionId: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPES)
    },
    sectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sector'
    },
    amount: Number,
    balanceAfter: Number,
    sponsorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company'
    },
    description: String,
    transactionHash: String
  }],
  
  // Métadonnées blockchain
  blockchain: {
    chainId: {
      type: Number,
      default: 137  // Polygon Mainnet
    },
    ownerAddress: {
      type: String,
      required: true
    },
    metadataUri: String,
    mintTransaction: String
  },
  
  // Métadonnées
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index pour recherches efficaces
businessLoyaltyCardSchema.index({ tokenId: 1 });
businessLoyaltyCardSchema.index({ status: 1 });
businessLoyaltyCardSchema.index({ tierLevel: 1 });
businessLoyaltyCardSchema.index({ 'blockchain.ownerAddress': 1 });

// Middleware de pré-sauvegarde
businessLoyaltyCardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Méthode pour récupérer le solde d'un secteur spécifique
businessLoyaltyCardSchema.methods.getSectorBalance = function(sectorId) {
  const sectorBalance = this.sectorBalances.find(
    sb => sb.sectorId.toString() === sectorId.toString()
  );
  
  return sectorBalance ? sectorBalance.balance : 0;
};

// Méthode pour ajouter des avoirs à un secteur
businessLoyaltyCardSchema.methods.addBalance = async function(sectorId, amount, transactionDetails) {
  // Vérifier si le secteur existe déjà dans les soldes
  let sectorBalance = this.sectorBalances.find(
    sb => sb.sectorId.toString() === sectorId.toString()
  );
  
  // Si le secteur n'existe pas encore, l'ajouter
  if (!sectorBalance) {
    sectorBalance = {
      sectorId,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0
    };
    this.sectorBalances.push(sectorBalance);
  }
  
  // Mettre à jour le solde
  sectorBalance.balance += amount;
  sectorBalance.totalEarned += amount;
  sectorBalance.lastActivity = new Date();
  
  // Ajouter la transaction à l'historique
  const transaction = {
    transactionId: transactionDetails.transactionId || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    type: TRANSACTION_TYPES.CREDIT,
    sectorId,
    amount,
    balanceAfter: sectorBalance.balance,
    sponsorId: transactionDetails.sponsorId,
    description: transactionDetails.description || 'Ajout d'avoirs',
    transactionHash: transactionDetails.transactionHash
  };
  
  this.recentTransactions.unshift(transaction);
  
  // Limiter l'historique aux 50 dernières transactions
  if (this.recentTransactions.length > 50) {
    this.recentTransactions = this.recentTransactions.slice(0, 50);
  }
  
  return await this.save();
};

// Méthode pour dépenser des avoirs d'un secteur
businessLoyaltyCardSchema.methods.spendBalance = async function(sectorId, amount, transactionDetails) {
  // Vérifier si le secteur existe et a un solde suffisant
  const sectorBalance = this.sectorBalances.find(
    sb => sb.sectorId.toString() === sectorId.toString()
  );
  
  if (!sectorBalance || sectorBalance.balance < amount) {
    throw new Error('Solde insuffisant');
  }
  
  // Mettre à jour le solde
  sectorBalance.balance -= amount;
  sectorBalance.totalSpent += amount;
  sectorBalance.lastActivity = new Date();
  
  // Ajouter la transaction à l'historique
  const transaction = {
    transactionId: transactionDetails.transactionId || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    type: TRANSACTION_TYPES.DEBIT,
    sectorId,
    amount: -amount,  // Montant négatif pour une dépense
    balanceAfter: sectorBalance.balance,
    sponsorId: transactionDetails.sponsorId,
    description: transactionDetails.description || 'Utilisation d'avoirs',
    transactionHash: transactionDetails.transactionHash
  };
  
  this.recentTransactions.unshift(transaction);
  
  // Limiter l'historique aux 50 dernières transactions
  if (this.recentTransactions.length > 50) {
    this.recentTransactions = this.recentTransactions.slice(0, 50);
  }
  
  return await this.save();
};

// Méthode pour vérifier si la carte peut être utilisée
businessLoyaltyCardSchema.methods.canBeUsed = function() {
  // Vérifier le statut
  if (this.status !== CARD_STATUS.ACTIVE) {
    return false;
  }
  
  // Vérifier la date d'expiration
  if (this.expiresAt && this.expiresAt < new Date()) {
    // Mettre à jour le statut si la carte est expirée
    this.status = CARD_STATUS.EXPIRED;
    this.save();
    return false;
  }
  
  return true;
};

// Méthode pour mettre à jour le niveau de la carte
businessLoyaltyCardSchema.methods.updateTier = async function() {
  // Calculer le total des avoirs gagnés tous secteurs confondus
  const totalEarned = this.sectorBalances.reduce((sum, sb) => sum + sb.totalEarned, 0);
  
  // Définir le niveau selon le total des avoirs
  if (totalEarned >= 100000) {
    this.tierLevel = 'platinum';
  } else if (totalEarned >= 50000) {
    this.tierLevel = 'gold';
  } else if (totalEarned >= 10000) {
    this.tierLevel = 'silver';
  } else {
    this.tierLevel = 'standard';
  }
  
  // Mettre à jour les avantages selon le niveau
  switch (this.tierLevel) {
    case 'platinum':
      this.benefitsEnabled = [
        'group_discounts', 
        'priority_access', 
        'extended_payment_terms', 
        'free_shipping', 
        'exclusive_events'
      ];
      break;
    case 'gold':
      this.benefitsEnabled = [
        'group_discounts', 
        'priority_access', 
        'extended_payment_terms', 
        'free_shipping'
      ];
      break;
    case 'silver':
      this.benefitsEnabled = [
        'group_discounts', 
        'priority_access'
      ];
      break;
    default:
      this.benefitsEnabled = ['group_discounts'];
  }
  
  return await this.save();
};

// Créer le modèle à partir du schéma
const BusinessLoyaltyCard = mongoose.model('BusinessLoyaltyCard', businessLoyaltyCardSchema);

// Exporter les constantes avec le modèle
module.exports = {
  BusinessLoyaltyCard,
  CARD_STATUS,
  TRANSACTION_TYPES
};

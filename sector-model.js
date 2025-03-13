// models/Sector.js
// Modèle pour les secteurs d'enchères

const mongoose = require('mongoose');

// Statuts des secteurs
const SECTOR_STATUS = {
  ACTIVE: 'active',         // Secteur actif pour les enchères en cours
  INACTIVE: 'inactive',     // Secteur inactif (pas dans les enchères actuelles)
  CLOSED: 'closed',         // Enchères terminées pour ce secteur
  PENDING: 'pending'        // En attente de la prochaine vague d'enchères
};

// Schéma du secteur
const sectorSchema = new mongoose.Schema({
  // Informations de base
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  
  // Configuration d'affichage
  icon: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true,
    default: '#3B82F6' // Bleu par défaut
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  
  // Statut et configuration
  status: {
    type: String,
    enum: Object.values(SECTOR_STATUS),
    default: SECTOR_STATUS.PENDING
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Configuration des enchères
  auctionConfig: {
    minimumBid: {
      type: Number,
      required: true,
      min: 0
    },
    bidIncrement: {
      type: Number,
      required: true,
      min: 1
    },
    currency: {
      type: String,
      enum: ['EUR', 'USD', 'ETH', 'MATIC'],
      default: 'EUR'
    },
    maxParticipants: {
      type: Number,
      default: 0 // 0 = illimité
    }
  },
  
  // Blockchain et smart contract
  contractConfig: {
    blockchainAddress: String,
    smartContractAddress: String,
    creationTxHash: String,
    lastUpdateTxHash: String
  },
  
  // Enchère et lauréat actuel
  currentAuction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    default: null
  },
  currentWinner: {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null
    },
    bidAmount: {
      type: Number,
      default: 0
    },
    winDate: Date
  },
  
  // Historique des enchères précédentes
  auctionHistory: [{
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction'
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company'
    },
    winningBid: Number,
    startDate: Date,
    endDate: Date,
    participants: Number
  }],
  
  // Règles et critères d'éligibilité
  eligibilityCriteria: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    isRequired: {
      type: Boolean,
      default: true
    }
  }],
  
  // Métadonnées
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Index pour recherches efficaces
sectorSchema.index({ name: 'text', description: 'text' });
sectorSchema.index({ status: 1 });
sectorSchema.index({ displayOrder: 1 });
sectorSchema.index({ 'currentAuction': 1 });

// Middleware de pré-sauvegarde
sectorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Méthode pour obtenir tous les secteurs actifs
sectorSchema.statics.getActiveSectors = async function() {
  return await this.find({ status: SECTOR_STATUS.ACTIVE })
    .sort({ displayOrder: 1 })
    .exec();
};

// Méthode pour mettre à jour le gagnant d'une enchère
sectorSchema.methods.updateWinner = async function(companyId, bidAmount) {
  this.currentWinner = {
    companyId,
    bidAmount,
    winDate: new Date()
  };
  
  return await this.save();
};

// Méthode pour marquer le secteur comme fermé après une enchère
sectorSchema.methods.closeAuction = async function(auctionId) {
  // Si pas de gagnant, ne rien faire
  if (!this.currentWinner || !this.currentWinner.companyId) {
    return false;
  }
  
  // Ajouter à l'historique des enchères
  this.auctionHistory.push({
    auctionId: this.currentAuction,
    winnerId: this.currentWinner.companyId,
    winningBid: this.currentWinner.bidAmount,
    startDate: this.currentAuction.startDate,
    endDate: this.currentAuction.endDate,
    participants: this.currentAuction.participants?.length || 0
  });
  
  // Mettre à jour le statut
  this.status = SECTOR_STATUS.CLOSED;
  this.currentAuction = null;
  
  return await this.save();
};

// Méthode pour préparer le secteur pour la prochaine enchère
sectorSchema.methods.prepareForNextAuction = async function() {
  // Conserver l'historique mais réinitialiser l'enchère actuelle
  this.status = SECTOR_STATUS.PENDING;
  this.currentAuction = null;
  this.currentWinner = {
    companyId: null,
    bidAmount: 0,
    winDate: null
  };
  
  return await this.save();
};

// Créer le modèle à partir du schéma
const Sector = mongoose.model('Sector', sectorSchema);

// Exporter les constantes avec le modèle
module.exports = {
  Sector,
  SECTOR_STATUS
};

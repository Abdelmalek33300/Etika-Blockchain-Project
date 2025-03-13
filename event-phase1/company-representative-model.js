// models/CompanyRepresentative.js
// Modèle pour gérer les représentants d'entreprise (3 obligatoires)

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Types de représentants
const REPRESENTATIVE_TYPES = {
  PRIMARY: 'primary',     // Représentant principal
  SECONDARY: 'secondary', // Représentant secondaire
  TERTIARY: 'tertiary'    // Représentant tertiaire
};

// Statuts des représentants
const REPRESENTATIVE_STATUS = {
  PENDING: 'pending',     // En attente de vérification
  VERIFIED: 'verified',   // Vérifié
  REJECTED: 'rejected',   // Rejeté
  SUSPENDED: 'suspended'  // Suspendu
};

// Schéma du représentant d'entreprise
const representativeSchema = new mongoose.Schema({
  // Informations personnelles
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/.+\@.+\..+/, 'Email invalide']
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    type: String,
    required: true,
    trim: true
  },
  
  // Informations d'authentification
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  lastPasswordChange: {
    type: Date,
    default: Date.now
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null
  },
  
  // Lien avec l'entreprise
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  representativeType: {
    type: String,
    enum: Object.values(REPRESENTATIVE_TYPES),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(REPRESENTATIVE_STATUS),
    default: REPRESENTATIVE_STATUS.PENDING
  },
  
  // Vérification
  verificationToken: String,
  verificationTokenExpires: Date,
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Sécurité
  loginAttempts: {
    type: Number,
    required: true,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastLogin: Date,
  
  // Journal d'activité (récent)
  recentActivity: [{
    action: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String
  }],
  
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

// Index pour des recherches efficaces
representativeSchema.index({ email: 1 });
representativeSchema.index({ companyId: 1, representativeType: 1 });
representativeSchema.index({ status: 1 });

// Virtuals
representativeSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

representativeSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Middleware de pré-sauvegarde pour hacher les mots de passe
representativeSchema.pre('save', async function(next) {
  const representative = this;
  
  // Mettre à jour la date de dernière modification
  representative.updatedAt = Date.now();
  
  // Seulement hacher le mot de passe s'il a été modifié ou est nouveau
  if (!representative.isModified('password')) {
    return next();
  }
  
  try {
    // Générer un sel
    const salt = await bcrypt.genSalt(10);
    
    // Hacher le mot de passe avec le sel
    const hash = await bcrypt.hash(representative.password, salt);
    
    // Remplacer le mot de passe en clair par le hachage
    representative.password = hash;
    
    // Si le mot de passe est modifié, mettre à jour lastPasswordChange
    representative.lastPasswordChange = Date.now();
    
    next();
  } catch (error) {
    next(error);
  }
});

// Méthode pour vérifier le mot de passe
representativeSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Méthode pour générer un token JWT
representativeSchema.methods.generateAuthToken = function() {
  const representative = this;
  
  const token = jwt.sign(
    { 
      _id: representative._id.toString(),
      companyId: representative.companyId.toString(),
      representativeType: representative.representativeType,
      email: representative.email
    }, 
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRATION || '1h' 
    }
  );
  
  return token;
};

// Méthode pour enregistrer une activité
representativeSchema.methods.logActivity = function(action, ipAddress, userAgent) {
  this.recentActivity.unshift({
    action,
    timestamp: Date.now(),
    ipAddress,
    userAgent
  });
  
  // Garder seulement les 10 dernières activités
  if (this.recentActivity.length > 10) {
    this.recentActivity = this.recentActivity.slice(0, 10);
  }
  
  return this.save();
};

// Méthode pour gérer les tentatives de connexion
representativeSchema.methods.incrementLoginAttempts = async function() {
  // Si l'utilisateur est déjà verrouillé, ne rien faire
  if (this.isLocked) {
    return;
  }
  
  // Incrémenter le compteur de tentatives
  this.loginAttempts += 1;
  
  // Verrouiller le compte après 5 tentatives
  if (this.loginAttempts >= 5) {
    // Verrouillage de 1 heure
    this.lockUntil = Date.now() + 60 * 60 * 1000;
  }
  
  return this.save();
};

// Méthode pour réinitialiser les tentatives de connexion
representativeSchema.methods.resetLoginAttempts = function() {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  this.lastLogin = Date.now();
  
  return this.save();
};

// Méthode statique pour vérifier si une entreprise a ses 3 représentants
representativeSchema.statics.hasRequiredRepresentatives = async function(companyId) {
  const representatives = await this.find({ 
    companyId,
    status: REPRESENTATIVE_STATUS.VERIFIED
  });
  
  // Vérifier qu'il y a exactement un représentant de chaque type
  const hasPrimary = representatives.some(rep => rep.representativeType === REPRESENTATIVE_TYPES.PRIMARY);
  const hasSecondary = representatives.some(rep => rep.representativeType === REPRESENTATIVE_TYPES.SECONDARY);
  const hasTertiary = representatives.some(rep => rep.representativeType === REPRESENTATIVE_TYPES.TERTIARY);
  
  return hasPrimary && hasSecondary && hasTertiary;
};

// Méthode statique pour créer un représentant avec des vérifications
representativeSchema.statics.createRepresentative = async function(representativeData) {
  // Vérifier qu'aucun autre représentant du même type n'existe pour cette entreprise
  const existingRepresentative = await this.findOne({
    companyId: representativeData.companyId,
    representativeType: representativeData.representativeType
  });
  
  if (existingRepresentative) {
    throw new Error(`This company already has a ${representativeData.representativeType} representative`);
  }
  
  // Créer le représentant
  const representative = new this(representativeData);
  
  // Générer un token de vérification
  const verificationToken = Math.random().toString(36).substring(2, 15) + 
                           Math.random().toString(36).substring(2, 15);
  
  representative.verificationToken = verificationToken;
  representative.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 heures
  
  await representative.save();
  
  return { representative, verificationToken };
};

// Créer le modèle à partir du schéma
const CompanyRepresentative = mongoose.model('CompanyRepresentative', representativeSchema);

// Exporter les constantes avec le modèle
module.exports = {
  CompanyRepresentative,
  REPRESENTATIVE_TYPES,
  REPRESENTATIVE_STATUS
};

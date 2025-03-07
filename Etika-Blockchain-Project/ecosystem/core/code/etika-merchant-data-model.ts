// src/models/merchant.ts - Modèle de données pour les différents types de commerçants

/**
 * Type d'organisation commerciale
 */
export enum MerchantType {
  INDEPENDENT = 'independent',       // Commerçant indépendant
  FRANCHISEE = 'franchisee',         // Point de vente franchisé
  FRANCHISOR = 'franchisor',         // Tête de réseau franchiseur
  CHAIN_STORE = 'chain_store',       // Magasin d'une chaîne/enseigne
  CHAIN_HQ = 'chain_hq',             // Siège de chaîne/enseigne
  ECOMMERCE = 'ecommerce',           // Site e-commerce
  OMNICHANNEL = 'omnichannel',       // Commerce omnicanal
  COOPERATIVE = 'cooperative',       // Coopérative de commerçants
  COOPERATIVE_MEMBER = 'coop_member' // Membre d'une coopérative
}

/**
 * Mode d'intégration avec le système de caisse
 */
export enum PosIntegrationType {
  API = 'api',                  // Intégration API directe
  SDK = 'sdk',                  // Kit de développement logiciel
  QR_CODE = 'qr_code',          // QR Code pour attribution manuelle
  PLUGIN = 'plugin',            // Plugin pour logiciel de caisse standard
  MANUAL = 'manual',            // Saisie manuelle
  TERMINAL = 'terminal',        // Terminal de paiement dédié
  ECOMMERCE_WIDGET = 'widget'   // Widget pour site e-commerce
}

/**
 * Interface pour les commerçants
 */
export interface Merchant {
  id: string;
  name: string;
  legalName: string;
  siret: string;
  vatNumber: string;
  type: MerchantType;
  parentOrganizationId?: string;  // Pour les franchisés, magasins de chaîne, etc.
  website?: string;
  description?: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Paramètres d'intégration
  posIntegrationType: PosIntegrationType;
  posProviderName?: string;
  apiKey?: string;
  webhookUrl?: string;
  
  // Paramètres de contact
  contactEmail: string;
  contactPhone: string;
  technicalContactEmail?: string;
  technicalContactPhone?: string;
  
  // Paramètres d'adresse
  address: Address;
  
  // Paramètres spécifiques au type de commerce
  settings: MerchantSettings;
  
  // Relations
  locations?: MerchantLocation[];         // Points de vente physiques
  users?: MerchantUser[];                 // Utilisateurs liés au commerçant
  loyaltyPrograms?: LoyaltyProgram[];     // Programmes de fidélité
}

/**
 * Structure d'adresse
 */
export interface Address {
  street: string;
  street2?: string;
  city: string;
  zipCode: string;
  state?: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Paramètres du commerçant selon son type
 */
export interface MerchantSettings {
  // Paramètres généraux
  defaultCurrency: string;
  languagePreference: string;
  timezone: string;
  
  // Paramètres de tokens
  tokenGenerationRate: number;         // Taux d'émission de tokens par euro dépensé
  tokenRedemptionRate: number;         // Valeur en euro d'un token lors de l'utilisation
  minimumTokensForRedemption: number;  // Nombre minimum de tokens pour utilisation
  
  // Paramètres spécifiques par type
  hierarchySettings?: HierarchySettings;       // Pour les chaînes, franchises, coopératives
  ecommerceSettings?: EcommerceSettings;       // Pour l'e-commerce
  omnichannelSettings?: OmnichannelSettings;   // Pour l'omnicanal
}

/**
 * Paramètres pour les structures hiérarchiques (franchises, chaînes...)
 */
export interface HierarchySettings {
  isHeadquarters: boolean;                  // Si c'est le siège/franchiseur
  centralizedLoyaltyProgram: boolean;       // Programme de fidélité centralisé ou indépendant
  centralizedTokenPool: boolean;            // Pool de tokens centralisé ou indépendant
  mandatorySettings: string[];              // Paramètres imposés par le siège
  customizableSettings: string[];           // Paramètres personnalisables localement
  tokenSharingPercentage: number;           // % des tokens partagés avec le siège
  reportingFrequency: 'daily' | 'weekly' | 'monthly';  // Fréquence des rapports consolidés
}

/**
 * Paramètres pour l'e-commerce
 */
export interface EcommerceSettings {
  platform: string;                         // Plateforme e-commerce (Shopify, WooCommerce, etc.)
  checkoutIntegration: boolean;             // Intégration au tunnel de conversion
  emailNotificationsEnabled: boolean;       // Notifications par email pour les tokens
  orderConfirmationTokens: boolean;         // Attribution de tokens à la confirmation de commande
  deliveryConfirmationTokens: boolean;      // Attribution de tokens à la livraison
  reviewRewardTokens: number;               // Tokens attribués pour un avis client
}

/**
 * Paramètres pour l'omnicanal
 */
export interface OmnichannelSettings {
  unifiedCustomerRecognition: boolean;      // Reconnaissance client unifiée
  crossChannelRedemption: boolean;          // Utilisation des tokens cross-canal
  webToStoreEnabled: boolean;               // Fonctionnalités web-to-store
  storeToWebEnabled: boolean;               // Fonctionnalités store-to-web
  channelSynchronizationFrequency: 'realtime' | 'hourly' | 'daily';  // Synchro entre canaux
}

/**
 * Point de vente physique
 */
export interface MerchantLocation {
  id: string;
  merchantId: string;
  name: string;
  address: Address;
  phone?: string;
  email?: string;
  managerName?: string;
  openingHours?: string;
  posIntegrationType: PosIntegrationType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Utilisateur lié à un commerçant
 */
export interface MerchantUser {
  id: string;
  merchantId: string;
  locationId?: string;          // Si l'utilisateur est lié à un point de vente spécifique
  email: string;
  firstName: string;
  lastName: string;
  role: MerchantUserRole;
  permissions: string[];
  lastLogin?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rôles des utilisateurs commerçants
 */
export enum MerchantUserRole {
  ADMIN = 'admin',                      // Admin avec tous les droits
  LOCATION_MANAGER = 'location_manager', // Gérant d'un point de vente
  CASHIER = 'cashier',                  // Caissier
  MARKETING = 'marketing',              // Responsable marketing
  FINANCE = 'finance',                  // Responsable financier
  ANALYST = 'analyst',                  // Analyste (lecture seule)
  TECHNICAL = 'technical'               // Contact technique
}

/**
 * Programme de fidélité
 */
export interface LoyaltyProgram {
  id: string;
  merchantId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  tokenGenerationRate: number;
  minimumPurchaseAmount: number;
  rules: LoyaltyRule[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Règle de programme de fidélité
 */
export interface LoyaltyRule {
  id: string;
  loyaltyProgramId: string;
  name: string;
  type: 'purchase' | 'visit' | 'anniversary' | 'registration' | 'referral' | 'product_specific';
  condition: string;          // Expression de condition
  tokenReward: number;        // Nombre de tokens attribués
  maxRewardsPerCustomer: number;
  startDate?: Date;
  endDate?: Date;
  daysOfWeek?: number[];     // Jours d'application (1=Lundi, 7=Dimanche)
  timeStart?: string;        // Heure de début (format HH:MM)
  timeEnd?: string;          // Heure de fin (format HH:MM)
  productIds?: string[];     // IDs des produits concernés
  productCategoryIds?: string[];  // IDs des catégories concernées
  isActive: boolean;
}
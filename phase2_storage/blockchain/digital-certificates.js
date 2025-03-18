// digital-certificates.js
// Système de certificats numériques (NFT) pour la phase événementielle d'Étika

const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

/**
 * Classe pour gérer les certificats numériques (NFT) d'Étika
 * Utilise une approche hybride: stockage en base de données + blockchain
 */
class EtikaDigitalCertificates {
  constructor(dbProvider, blockchainProvider, imageGenerationService) {
    this.db = dbProvider;
    this.blockchain = blockchainProvider; // Polygon, Tezos ou autre blockchain à faible empreinte
    this.imageService = imageGenerationService;
    this.certificateTypes = new Map(); // Cache des types de certificats
  }

  /**
   * Initialise les types de certificats disponibles
   * @returns {Promise<void>}
   */
  async initializeCertificateTypes() {
    // Charger les types de certificats depuis la base de données
    const types = await this.db.certificateTypes.find({});
    
    // Mettre en cache pour un accès rapide
    types.forEach(type => {
      this.certificateTypes.set(type.id, type);
    });
    
    if (types.length === 0) {
      // Créer des types par défaut si aucun n'existe
      await this._createDefaultCertificateTypes();
    }
  }
  
  /**
   * Crée un nouveau certificat numérique pour un utilisateur
   * @param {String} userId - ID de l'utilisateur
   * @param {String} certificateTypeId - Type de certificat
   * @param {Object} metadata - Métadonnées supplémentaires
   * @returns {Promise<Object>} - Le certificat créé
   */
  async createCertificate(userId, certificateTypeId, metadata = {}) {
    try {
      // Vérifier que le type de certificat existe
      if (!this.certificateTypes.has(certificateTypeId)) {
        throw new Error(`Type de certificat inconnu: ${certificateTypeId}`);
      }
      
      const certificateType = this.certificateTypes.get(certificateTypeId);
      
      // Générer un identifiant unique
      const certificateId = uuidv4();
      
      // Générer l'image du certificat
      const imageData = await this._generateCertificateImage(certificateType, userId, metadata);
      
      // Stocker l'image et récupérer l'URL
      const imageUrl = await this._storeCertificateImage(certificateId, imageData);
      
      // Préparer les métadonnées du certificat
      const certificateMetadata = {
        name: `${certificateType.name} #${certificateId.slice(0, 8)}`,
        description: certificateType.description,
        image: imageUrl,
        attributes: [
          {
            trait_type: 'Type',
            value: certificateType.name
          },
          {
            trait_type: 'Rareté',
            value: certificateType.rarity
          },
          ...this._generateAttributes(certificateType, metadata)
        ],
        created_at: new Date().toISOString(),
        etika_metadata: {
          user_id: userId,
          certificate_type: certificateTypeId,
          ...metadata
        }
      };
      
      // Stocker les métadonnées sur IPFS ou système de stockage décentralisé
      const metadataUri = await this._storeMetadata(certificateId, certificateMetadata);
      
      // Créer l'entrée du certificat en base de données
      const certificate = {
        id: certificateId,
        userId,
        certificateTypeId,
        metadataUri,
        imageUrl,
        status: 'active', // active, revoked, expired
        createdAt: Date.now(),
        updatedAt: Date.now(),
        onChain: false, // Indique si le certificat a été enregistré sur la blockchain
        onChainId: null, // Identifiant sur la blockchain
        customMetadata: metadata
      };
      
      // Enregistrer dans la base de données
      await this.db.certificates.insert(certificate);
      
      // Tenter l'enregistrement sur la blockchain (en arrière-plan)
      this._registerOnBlockchain(certificateId).catch(err => {
        console.error(`Erreur lors de l'enregistrement blockchain du certificat ${certificateId}:`, err);
      });
      
      return {
        ...certificate,
        metadata: certificateMetadata
      };
    } catch (error) {
      console.error("Erreur lors de la création du certificat:", error);
      throw new Error(`Échec de création du certificat: ${error.message}`);
    }
  }
  
  /**
   * Récupère un certificat numérique
   * @param {String} certificateId - ID du certificat
   * @returns {Promise<Object>} - Le certificat avec ses métadonnées
   */
  async getCertificate(certificateId) {
    const certificate = await this.db.certificates.findOne({ id: certificateId });
    if (!certificate) {
      throw new Error(`Certificat non trouvé: ${certificateId}`);
    }
    
    // Récupérer les métadonnées
    const metadata = await this._fetchMetadata(certificate.metadataUri);
    
    return {
      ...certificate,
      metadata
    };
  }
  
  /**
   * Récupère tous les certificats d'un utilisateur
   * @param {String} userId - ID de l'utilisateur
   * @returns {Promise<Array>} - Liste des certificats
   */
  async getUserCertificates(userId) {
    const certificates = await this.db.certificates.find({ userId });
    
    // Pour chaque certificat, récupérer le type
    const enrichedCertificates = await Promise.all(
      certificates.map(async cert => {
        const type = this.certificateTypes.get(cert.certificateTypeId);
        return {
          ...cert,
          type
        };
      })
    );
    
    return enrichedCertificates;
  }
  
  /**
   * Vérifie l'authenticité d'un certificat
   * @param {String} certificateId - ID du certificat
   * @returns {Promise<Object>} - Résultat de vérification
   */
  async verifyCertificate(certificateId) {
    const certificate = await this.db.certificates.findOne({ id: certificateId });
    if (!certificate) {
      return {
        valid: false,
        reason: 'not_found',
        message: 'Certificat non trouvé'
      };
    }
    
    // Vérifier le statut
    if (certificate.status !== 'active') {
      return {
        valid: false,
        reason: 'inactive',
        message: `Le certificat est ${certificate.status}`
      };
    }
    
    // Si le certificat est sur la blockchain, vérifier
    if (certificate.onChain && certificate.onChainId) {
      try {
        const blockchainVerification = await this._verifyOnBlockchain(certificate);
        if (!blockchainVerification.valid) {
          return blockchainVerification;
        }
      } catch (error) {
        return {
          valid: false,
          reason: 'blockchain_error',
          message: `Erreur de vérification blockchain: ${error.message}`
        };
      }
    }
    
    return {
      valid: true,
      certificateId,
      userId: certificate.userId,
      certificateType: certificate.certificateTypeId,
      issuedAt: new Date(certificate.createdAt).toISOString(),
      onChain: certificate.onChain
    };
  }
  
  /**
   * Crée un nouveau type de certificat
   * @param {Object} typeData - Données du type de certificat
   * @returns {Promise<Object>} - Le type créé
   */
  async createCertificateType(typeData) {
    const typeId = uuidv4();
    
    const certificateType = {
      id: typeId,
      name: typeData.name,
      description: typeData.description,
      rarity: typeData.rarity || 'common', // common, uncommon, rare, legendary
      imagePrompts: typeData.imagePrompts || [],
      attributeTemplates: typeData.attributeTemplates || [],
      ngoPartner: typeData.ngoPartner || null,
      maxSupply: typeData.maxSupply || 0, // 0 = illimité
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: true
    };
    
    // Vérifier les données
    if (!certificateType.name) throw new Error("Le nom du type est requis");
    if (!certificateType.description) throw new Error("La description du type est requise");
    
    // Insérer dans la base de données
    await this.db.certificateTypes.insert(certificateType);
    
    // Mettre à jour le cache
    this.certificateTypes.set(typeId, certificateType);
    
    return certificateType;
  }
  
  // Méthodes privées
  
  /**
   * Crée des types de certificats par défaut
   * @private
   */
  async _createDefaultCertificateTypes() {
    const defaultTypes = [
      {
        name: "Certificat Fondateur",
        description: "Certificat attribué aux membres fondateurs de la communauté Étika",
        rarity: "legendary",
        imagePrompts: ["nature", "growth", "foundation", "community"],
        attributeTemplates: [
          { name: "génération", valueType: "number", defaultValue: 1 }
        ]
      },
      {
        name: "Certificat Écologique",
        description: "Certificat représentant l'engagement envers la protection de l'environnement",
        rarity: "rare",
        imagePrompts: ["nature", "ecology", "earth", "green"],
        attributeTemplates: [
          { name: "élément", valueType: "string", possibleValues: ["eau", "terre", "air"] }
        ]
      },
      {
        name: "Certificat Social",
        description: "Certificat représentant l'engagement envers la justice sociale",
        rarity: "rare",
        imagePrompts: ["community", "solidarity", "equality", "hands"],
        attributeTemplates: [
          { name: "focus", valueType: "string", possibleValues: ["éducation", "santé", "inclusion"] }
        ]
      },
      {
        name: "Certificat Parrainage",
        description: "Certificat attribué pour avoir parrainé de nouveaux membres",
        rarity: "uncommon",
        imagePrompts: ["connection", "network", "growth", "sharing"],
        attributeTemplates: [
          { name: "parrainages", valueType: "number", defaultValue: 1 }
        ]
      }
    ];
    
    for (const typeData of defaultTypes) {
      await this.createCertificateType(typeData);
    }
  }
  
  /**
   * Génère une image pour un certificat
   * @private
   */
  async _generateCertificateImage(certificateType, userId, metadata) {
    // Utilisation du service d'IA pour générer une image
    const prompt = this._createImagePrompt(certificateType, metadata);
    
    try {
      const imageData = await this.imageService.generateImage({
        prompt,
        width: 1024,
        height: 1024,
        style: "etika",
        userId
      });
      
      return imageData;
    } catch (error) {
      console.error("Erreur lors de la génération d'image:", error);
      // Utiliser une image par défaut en cas d'échec
      return this._getDefaultImage(certificateType.id);
    }
  }
  
  /**
   * Crée un prompt pour la génération d'image
   * @private
   */
  _createImagePrompt(certificateType, metadata) {
    let basePrompt = `Certificate for Etika project, ${certificateType.description}, `;
    
    // Ajouter les prompts spécifiques au type de certificat
    if (certificateType.imagePrompts && certificateType.imagePrompts.length > 0) {
      basePrompt += certificateType.imagePrompts.join(", ") + ", ";
    }
    
    // Ajouter des éléments basés sur les métadonnées
    if (metadata.element) {
      basePrompt += `featuring ${metadata.element} element, `;
    }
    
    if (metadata.focus) {
      basePrompt += `focusing on ${metadata.focus}, `;
    }
    
    // Ajouter des instructions de style
    basePrompt += "digital art style, vibrant colors, inspiring, ethical values, sustainability, social justice";
    
    return basePrompt;
  }
  
  /**
   * Récupère une image par défaut en cas d'échec de génération
   * @private
   */
  _getDefaultImage(typeId) {
    // Implémentation avec des images prédéfinies par type
    const defaultImages = {
      "founder": "/assets/default-images/founder-certificate.png",
      "ecological": "/assets/default-images/ecological-certificate.png",
      "social": "/assets/default-images/social-certificate.png",
      "referral": "/assets/default-images/referral-certificate.png"
    };
    
    // Retourner l'image correspondante ou une image générique
    return defaultImages[typeId] || "/assets/default-images/generic-certificate.png";
  }
  
  /**
   * Stocke l'image d'un certificat
   * @private
   */
  async _storeCertificateImage(certificateId, imageData) {
    // Stocker l'image (dans un stockage cloud ou IPFS)
    const storageKey = `certificates/${certificateId}.png`;
    
    try {
      // Implémentation du stockage (AWS S3, IPFS, etc.)
      const uploadResult = await this.blockchain.storeFile(imageData, storageKey);
      return uploadResult.url;
    } catch (error) {
      console.error("Erreur lors du stockage de l'image:", error);
      throw new Error(`Échec de stockage de l'image: ${error.message}`);
    }
  }
  
  /**
   * Génère des attributs pour un certificat basé sur son type
   * @private
   */
  _generateAttributes(certificateType, metadata) {
    const attributes = [];
    
    if (certificateType.attributeTemplates) {
      for (const template of certificateType.attributeTemplates) {
        // Récupérer la valeur depuis les métadonnées ou utiliser la valeur par défaut
        let value = metadata[template.name] || template.defaultValue;
        
        // Si des valeurs possibles sont définies, vérifier que la valeur est valide
        if (template.possibleValues && value) {
          if (!template.possibleValues.includes(value)) {
            value = template.defaultValue || template.possibleValues[0];
          }
        }
        
        if (value !== undefined) {
          attributes.push({
            trait_type: template.name,
            value
          });
        }
      }
    }
    
    return attributes;
  }
  
  /**
   * Stocke les métadonnées d'un certificat
   * @private
   */
  async _storeMetadata(certificateId, metadata) {
    const metadataKey = `metadata/${certificateId}.json`;
    
    try {
      // Stocker les métadonnées (dans un stockage cloud ou IPFS)
      const uploadResult = await this.blockchain.storeJSON(metadata, metadataKey);
      return uploadResult.url;
    } catch (error) {
      console.error("Erreur lors du stockage des métadonnées:", error);
      throw new Error(`Échec de stockage des métadonnées: ${error.message}`);
    }
  }
  
  /**
   * Récupère les métadonnées d'un certificat
   * @private
   */
  async _fetchMetadata(metadataUri) {
    try {
      // Si l'URI est déjà un objet JSON complet, le retourner directement
      if (typeof metadataUri === 'object') {
        return metadataUri;
      }
      
      // Sinon, récupérer depuis l'URI
      const response = await axios.get(metadataUri);
      return response.data;
    } catch (error) {
      console.error("Erreur lors de la récupération des métadonnées:", error);
      return { error: "Métadonnées non disponibles" };
    }
  }
  
  /**
   * Enregistre un certificat sur la blockchain
   * @private
   */
  async _registerOnBlockchain(certificateId) {
    try {
      const certificate = await this.db.certificates.findOne({ id: certificateId });
      if (!certificate) {
        throw new Error("Certificat non trouvé");
      }
      
      // Éviter les doublons
      if (certificate.onChain) {
        return { alreadyRegistered: true };
      }
      
      // Récupérer les métadonnées
      const metadata = await this._fetchMetadata(certificate.metadataUri);
      
      // Créer un NFT sur la blockchain
      const mintResult = await this.blockchain.mintNFT({
        to: certificate.userId,
        metadataUri: certificate.metadataUri,
        metadata,
        certificateId
      });
      
      // Mettre à jour le certificat avec les informations blockchain
      await this.db.certificates.update(
        { id: certificateId },
        { 
          $set: { 
            onChain: true, 
            onChainId: mintResult.tokenId,
            updatedAt: Date.now(),
            blockchainTxHash: mintResult.transactionHash
          } 
        }
      );
      
      return mintResult;
    } catch (error) {
      console.error(`Erreur lors de l'enregistrement blockchain du certificat ${certificateId}:`, error);
      throw error;
    }
  }
  
  /**
   * Vérifie un certificat sur la blockchain
   * @private
   */
  async _verifyOnBlockchain(certificate) {
    try {
      // Vérifier l'existence et la propriété du NFT
      const verificationResult = await this.blockchain.verifyNFT({
        tokenId: certificate.onChainId,
        ownerId: certificate.userId
      });
      
      if (!verificationResult.exists) {
        return {
          valid: false,
          reason: 'not_on_chain',
          message: 'Le certificat n\'existe pas sur la blockchain'
        };
      }
      
      if (!verificationResult.ownerMatch) {
        return {
          valid: false,
          reason: 'owner_mismatch',
          message: 'Le propriétaire du certificat ne correspond pas'
        };
      }
      
      return {
        valid: true,
        blockchainInfo: verificationResult
      };
    } catch (error) {
      console.error("Erreur lors de la vérification blockchain:", error);
      throw error;
    }
  }
}

module.exports = EtikaDigitalCertificates;
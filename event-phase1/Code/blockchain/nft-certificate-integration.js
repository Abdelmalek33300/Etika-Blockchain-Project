// services/NFTCertificateIntegration.js
// Module d'intégration sécurisée des certificats NFT dans l'application Étika

import { mintNFTCertificate } from '../utils/blockchainTransactionService';
import { getSecureItem, setSecureItem, STORAGE_KEYS } from '../utils/secureStorage';
import { logError } from '../utils/errorTracking';
import axios from 'axios';
import joi from 'joi';
import { API_URL } from '../config';

// Schéma de validation pour les données de certificat
const certificateDataSchema = joi.object({
  userId: joi.string().required(),
  certificateTypeId: joi.string().required(),
  name: joi.string().min(3).max(100).required(),
  description: joi.string().min(10).max(1000).required(),
  image: joi.string().uri().optional(),
  attributes: joi.array().items(joi.object({
    trait_type: joi.string().required(),
    value: joi.string().required()
  })).default([]),
  metadata: joi.object().default({})
});

/**
 * Service d'intégration des certificats NFT
 */
class NFTCertificateIntegration {
  constructor() {
    this.apiClient = axios.create({
      baseURL: `${API_URL}/api`,
      timeout: 10000,
    });
    
    // Intercepteur pour ajouter le token d'authentification
    this.apiClient.interceptors.request.use(async (config) => {
      try {
        const token = await getSecureItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      } catch (error) {
        logError('Error setting auth token in request', error);
        return config;
      }
    });
  }
  
  /**
   * Récupère les certificats de l'utilisateur
   * @param {boolean} forceRefresh - Force le rafraîchissement depuis le serveur
   * @returns {Promise<Array>} - Liste des certificats
   */
  async getUserCertificates(forceRefresh = false) {
    try {
      // Vérifier d'abord le cache local si pas de forceRefresh
      if (!forceRefresh) {
        const cachedCertificates = await getSecureItem(STORAGE_KEYS.CACHED_CERTIFICATES);
        if (cachedCertificates) {
          return cachedCertificates;
        }
      }
      
      // Récupérer les certificats depuis le serveur
      const response = await this.apiClient.get('/certificates/user');
      
      if (response.data && Array.isArray(response.data.certificates)) {
        // Mettre en cache les certificats
        await setSecureItem(STORAGE_KEYS.CACHED_CERTIFICATES, response.data.certificates);
        return response.data.certificates;
      }
      
      return [];
    } catch (error) {
      logError('Error fetching user certificates', error);
      
      // En cas d'erreur, tenter de retourner les données en cache
      const cachedCertificates = await getSecureItem(STORAGE_KEYS.CACHED_CERTIFICATES);
      return cachedCertificates || [];
    }
  }
  
  /**
   * Crée un nouveau certificat NFT pour l'utilisateur
   * @param {Object} certificateData - Données du certificat
   * @returns {Promise<Object>} - Le certificat créé
   */
  async createCertificate(certificateData) {
    try {
      // Valider les données du certificat
      const { error, value } = certificateDataSchema.validate(certificateData);
      if (error) {
        throw new Error(`Invalid certificate data: ${error.message}`);
      }
      
      // Récupérer l'adresse du wallet de l'utilisateur
      const walletAddress = await getSecureItem(STORAGE_KEYS.WALLET_ADDRESS);
      if (!walletAddress) {
        throw new Error('User wallet address not found');
      }
      
      // Préparer les métadonnées pour le certificat
      const metadata = {
        name: value.name,
        description: value.description,
        image: value.image || '',
        attributes: value.attributes,
        ...value.metadata
      };
      
      // Enregistrer d'abord le certificat dans la base de données
      const dbResponse = await this.apiClient.post('/certificates', {
        certificateTypeId: value.certificateTypeId,
        metadata
      });
      
      if (!dbResponse.data || !dbResponse.data.certificateId) {
        throw new Error('Failed to create certificate in database');
      }
      
      // Créer le NFT sur la blockchain
      const nftData = {
        id: dbResponse.data.certificateId,
        uri: `${API_URL}/api/certificates/metadata/${dbResponse.data.certificateId}`,
        metadata
      };
      
      // Minter le NFT et obtenir le résultat
      const mintResult = await mintNFTCertificate(nftData, walletAddress);
      
      if (!mintResult || !mintResult.success) {
        throw new Error('Failed to mint NFT certificate');
      }
      
      // Mettre à jour le certificat dans la base de données avec les informations blockchain
      await this.apiClient.patch(`/certificates/${dbResponse.data.certificateId}`, {
        txHash: mintResult.txHash,
        status: 'minted'
      });
      
      // Rafraîchir le cache des certificats
      const certificates = await this.getUserCertificates(true);
      
      return {
        success: true,
        certificateId: dbResponse.data.certificateId,
        txHash: mintResult.txHash,
        certificate: certificates.find(cert => cert.id === dbResponse.data.certificateId)
      };
    } catch (error) {
      logError('Error creating certificate', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Récupère les détails d'un certificat spécifique
   * @param {string} certificateId - Identifiant du certificat
   * @returns {Promise<Object>} - Détails du certificat
   */
  async getCertificateDetails(certificateId) {
    try {
      const response = await this.apiClient.get(`/certificates/${certificateId}`);
      return response.data;
    } catch (error) {
      logError(`Error fetching certificate details: ${certificateId}`, error);
      throw new Error(`Failed to fetch certificate details: ${error.message}`);
    }
  }
  
  /**
   * Vérifie l'authenticité d'un certificat
   * @param {string} certificateId - Identifiant du certificat
   * @returns {Promise<boolean>} - Authenticité du certificat
   */
  async verifyCertificateAuthenticity(certificateId) {
    try {
      const response = await this.apiClient.get(`/certificates/verify/${certificateId}`);
      return response.data.authentic === true;
    } catch (error) {
      logError(`Error verifying certificate: ${certificateId}`, error);
      return false;
    }
  }
  
  /**
   * Partage un certificat avec un autre utilisateur
   * @param {string} certificateId - Identifiant du certificat
   * @param {string} recipientEmail - Email du destinataire
   * @returns {Promise<Object>} - Résultat du partage
   */
  async shareCertificate(certificateId, recipientEmail) {
    try {
      // Valider l'email
      if (!recipientEmail || !recipientEmail.includes('@')) {
        throw new Error('Invalid recipient email');
      }
      
      const response = await this.apiClient.post(`/certificates/share`, {
        certificateId,
        recipientEmail
      });
      
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      logError(`Error sharing certificate: ${certificateId}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Exportation d'une instance unique du service
export default new NFTCertificateIntegration();

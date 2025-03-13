// utils/blockchainTransactionService.js
import { ethers } from 'ethers';
import axios from 'axios';
import { loadPrivateKey } from './keyManager';
import { logError } from './errorTracking';
import { API_URL } from '../config';

// Configurations
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 secondes

/**
 * Signe une transaction avec la clé privée sécurisée
 * @param {Object} transaction - Transaction à signer
 * @returns {Promise<string>} - Transaction signée
 */
export async function signTransaction(transaction) {
  try {
    // Charger la clé privée depuis le stockage sécurisé
    const privateKey = await loadPrivateKey();
    if (!privateKey) {
      throw new Error('Failed to load private key for signing transaction');
    }
    
    // Créer un wallet avec la clé privée
    const wallet = new ethers.Wallet(privateKey);
    
    // Signer la transaction
    const signedTx = await wallet.signTransaction(transaction);
    
    return signedTx;
  } catch (error) {
    logError('Error signing transaction', error);
    throw new Error(`Transaction signing failed: ${error.message}`);
  }
}

/**
 * Envoie une transaction signée à la blockchain avec retry automatique
 * @param {string} signedTransaction - Transaction signée
 * @returns {Promise<Object>} - Résultat de la transaction
 */
export async function sendTransaction(signedTransaction) {
  let attempt = 0;
  let lastError = null;
  
  while (attempt < MAX_RETRIES) {
    try {
      attempt++;
      
      // Envoyer la transaction au service blockchain
      const response = await axios.post(`${API_URL}/api/blockchain/send-transaction`, {
        transaction: signedTransaction
      });
      
      // Vérifier la réponse
      if (!response.data || !response.data.txHash) {
        throw new Error('Invalid response from blockchain service');
      }
      
      // Vérifier que la transaction est bien reçue
      await verifyTransaction(response.data.txHash);
      
      return response.data;
    } catch (error) {
      lastError = error;
      logError(`Transaction attempt ${attempt} failed`, error);
      
      // Attendre avant de réessayer
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }
    }
  }
  
  // Toutes les tentatives ont échoué
  throw new Error(`Failed to send transaction after ${MAX_RETRIES} attempts: ${lastError.message}`);
}

/**
 * Vérifie qu'une transaction a bien été incluse dans la blockchain
 * @param {string} txHash - Hash de la transaction
 * @returns {Promise<boolean>}
 */
async function verifyTransaction(txHash) {
  try {
    // Attente de confirmation (peut être ajusté selon le réseau)
    const response = await axios.get(`${API_URL}/api/blockchain/transaction/${txHash}`);
    
    if (!response.data || !response.data.confirmed) {
      throw new Error('Transaction not confirmed');
    }
    
    return true;
  } catch (error) {
    logError(`Error verifying transaction ${txHash}`, error);
    throw error;
  }
}

/**
 * Crée et envoie une transaction NFT complète
 * @param {Object} nftData - Données du NFT
 * @param {string} userAddress - Adresse du destinataire
 * @returns {Promise<Object>} - Résultat de la transaction
 */
export async function mintNFTCertificate(nftData, userAddress) {
  try {
    // Préparer la transaction
    const transaction = {
      to: process.env.NFT_CONTRACT_ADDRESS,
      data: encodeMintFunction(nftData, userAddress),
      // Autres paramètres de transaction...
    };
    
    // Signer la transaction
    const signedTx = await signTransaction(transaction);
    
    // Envoyer la transaction
    const result = await sendTransaction(signedTx);
    
    return {
      success: true,
      txHash: result.txHash,
      certificateId: result.certificateId || nftData.id
    };
  } catch (error) {
    logError('Error minting NFT certificate', error);
    throw new Error(`NFT minting failed: ${error.message}`);
  }
}

/**
 * Encode les données pour la fonction de mint du contrat NFT
 * @param {Object} nftData - Données du NFT
 * @param {string} recipient - Adresse du destinataire
 * @returns {string} - Données encodées pour la transaction
 */
function encodeMintFunction(nftData, recipient) {
  // Cette fonction dépend de l'ABI de votre contrat NFT
  // Exemple simplifié :
  const abi = ["function mint(address to, string memory uri, uint256 id)"];
  const iface = new ethers.utils.Interface(abi);
  return iface.encodeFunctionData("mint", [recipient, nftData.uri, nftData.id]);
}

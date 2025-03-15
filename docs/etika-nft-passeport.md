# Implémentation du NFT Passeport Universel pour Étika

## Architecture Générale

Pour implémenter un NFT unique par participant qui soit évolutif, sécurisé et scalable, nous allons utiliser une architecture hybride combinant stockage on-chain et off-chain :

1. **Contrat intelligent NFT** : Un contrat ERC-721 pour représenter la propriété du NFT
2. **Stockage de métadonnées dynamiques** : Système hybride on-chain/off-chain
3. **Système de mise à jour** : API sécurisée pour mettre à jour les attributs du NFT
4. **Système de vérification** : Mécanisme pour valider la participation aux enchères

## 1. Contrat Intelligent pour le NFT Passeport

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title EtikaPassportNFT
 * @dev Contrat NFT représentant le passeport universel d'un participant aux enchères Étika
 */
contract EtikaPassportNFT is ERC721URIStorage, AccessControl, Pausable {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;

    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    Counters.Counter private _tokenIdCounter;
    
    // Mapping depuis l'adresse de l'utilisateur vers son tokenId
    mapping(address => uint256) private _userTokens;
    
    // Mapping pour les NFT blacklistés
    mapping(uint256 => bool) private _blacklistedTokens;
    
    // Mapping pour garder trace du nombre d'enchères par participant
    mapping(uint256 => uint256) private _auctionParticipationCount;
    
    // Mapping pour l'historique des secteurs (limité aux 5 derniers pour économiser le gaz)
    mapping(uint256 => bytes32[5]) private _recentSectors;
    
    // Mapping pour les dernières enchères (timestamp, nom)
    mapping(uint256 => LastAuction) private _lastAuction;
    
    // Structure pour stocker les informations de la dernière enchère
    struct LastAuction {
        uint256 timestamp;
        string name;
    }
    
    // Événements
    event PassportMinted(address indexed to, uint256 indexed tokenId);
    event ParticipationRecorded(uint256 indexed tokenId, bytes32 sector, string auctionName);
    event PassportBlacklisted(uint256 indexed tokenId, bool status);
    event TokenURIUpdated(uint256 indexed tokenId, string newURI);
    
    /**
     * @dev Constructeur
     */
    constructor() ERC721("Etika Passport", "ETIPASS") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Crée un nouveau passeport NFT pour un utilisateur
     * @param to L'adresse du bénéficiaire
     * @param initialURI L'URI initiale des métadonnées du NFT
     * @return Le tokenId du nouveau passeport
     */
    function mintPassport(address to, string memory initialURI) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenNotPaused 
        returns (uint256) 
    {
        require(_userTokens[to] == 0, "User already has a passport");
        
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        _mint(to, tokenId);
        _setTokenURI(tokenId, initialURI);
        
        _userTokens[to] = tokenId;
        _auctionParticipationCount[tokenId] = 0;
        
        emit PassportMinted(to, tokenId);
        
        return tokenId;
    }
    
    /**
     * @dev Enregistre une participation à une enchère
     * @param tokenId L'ID du token passeport
     * @param sector Le secteur de l'enchère (en bytes32 pour économiser du gaz)
     * @param auctionName Le nom de l'enchère
     */
    function recordParticipation(uint256 tokenId, bytes32 sector, string calldata auctionName) 
        external 
        onlyRole(UPDATER_ROLE) 
        whenNotPaused 
    {
        require(_exists(tokenId), "Token does not exist");
        require(!_blacklistedTokens[tokenId], "Passport is blacklisted");
        
        // Incrémenter le compteur de participations
        _auctionParticipationCount[tokenId]++;
        
        // Mettre à jour la dernière enchère
        _lastAuction[tokenId] = LastAuction({
            timestamp: block.timestamp,
            name: auctionName
        });
        
        // Mettre à jour l'historique des secteurs (FIFO: First In, First Out)
        for (uint i = 4; i > 0; i--) {
            _recentSectors[tokenId][i] = _recentSectors[tokenId][i-1];
        }
        _recentSectors[tokenId][0] = sector;
        
        emit ParticipationRecorded(tokenId, sector, auctionName);
    }
    
    /**
     * @dev Met à jour l'URI des métadonnées du token
     * @param tokenId L'ID du token à mettre à jour
     * @param newURI La nouvelle URI des métadonnées
     */
    function updateTokenURI(uint256 tokenId, string calldata newURI) 
        external 
        onlyRole(UPDATER_ROLE) 
        whenNotPaused 
    {
        require(_exists(tokenId), "Token does not exist");
        
        _setTokenURI(tokenId, newURI);
        
        emit TokenURIUpdated(tokenId, newURI);
    }
    
    /**
     * @dev Change le statut de blacklist d'un passeport
     * @param tokenId L'ID du token à blacklister/déblacklister
     * @param blacklisted Le nouveau statut (true = blacklisté)
     */
    function setBlacklistStatus(uint256 tokenId, bool blacklisted) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(_exists(tokenId), "Token does not exist");
        
        _blacklistedTokens[tokenId] = blacklisted;
        
        emit PassportBlacklisted(tokenId, blacklisted);
    }
    
    /**
     * @dev Vérifie si un utilisateur possède un passeport valide
     * @param user L'adresse de l'utilisateur à vérifier
     * @return validPassport Vrai si l'utilisateur a un passeport valide
     */
    function hasValidPassport(address user) 
        external 
        view 
        returns (bool validPassport) 
    {
        uint256 tokenId = _userTokens[user];
        return tokenId != 0 && !_blacklistedTokens[tokenId];
    }
    
    /**
     * @dev Récupère le token ID du passeport d'un utilisateur
     * @param user L'adresse de l'utilisateur
     * @return tokenId L'ID du token du passeport (0 si aucun)
     */
    function getPassportId(address user) 
        external 
        view 
        returns (uint256 tokenId) 
    {
        return _userTokens[user];
    }
    
    /**
     * @dev Récupère les données on-chain du passeport
     * @param tokenId L'ID du token du passeport
     * @return participationCount Nombre total de participations aux enchères
     * @return lastAuctionTime Timestamp de la dernière enchère
     * @return lastAuctionName Nom de la dernière enchère
     * @return sectors Tableau des 5 derniers secteurs d'enchères
     */
    function getPassportData(uint256 tokenId) 
        external 
        view 
        returns (
            uint256 participationCount,
            uint256 lastAuctionTime,
            string memory lastAuctionName,
            bytes32[5] memory sectors
        ) 
    {
        require(_exists(tokenId), "Token does not exist");
        
        return (
            _auctionParticipationCount[tokenId],
            _lastAuction[tokenId].timestamp,
            _lastAuction[tokenId].name,
            _recentSectors[tokenId]
        );
    }
    
    /**
     * @dev Vérifie si un passeport est blacklisté
     * @param tokenId L'ID du token du passeport
     * @return Vrai si le passeport est blacklisté
     */
    function isBlacklisted(uint256 tokenId) 
        external 
        view 
        returns (bool) 
    {
        require(_exists(tokenId), "Token does not exist");
        return _blacklistedTokens[tokenId];
    }
    
    /**
     * @dev Empêche le transfert des passeports blacklistés
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        require(!_blacklistedTokens[tokenId], "Blacklisted passport cannot be transferred");
        
        // Si c'est un transfert (pas un mint ni un burn)
        if (from != address(0) && to != address(0)) {
            // Mettre à jour le mapping userTokens
            _userTokens[from] = 0;
            _userTokens[to] = tokenId;
        }
        
        // Si c'est un burn
        if (to == address(0)) {
            _userTokens[from] = 0;
        }
    }
    
    /**
     * @dev Fonction de pause du contrat
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Fonction de reprise du contrat
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Fonction obligatoire pour la compatibilité avec AccessControl
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

## 2. Service de Métadonnées Dynamiques

```javascript
// metadata-service.js

const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');
const { create } = require('ipfs-http-client');
const router = express.Router();

// Configuration IPFS
const ipfs = create({ 
  host: process.env.IPFS_HOST || 'ipfs.infura.io', 
  port: process.env.IPFS_PORT || 5001, 
  protocol: process.env.IPFS_PROTOCOL || 'https' 
});

// Connexion au contrat
const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_NODE_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const passportContract = new ethers.Contract(
  process.env.PASSPORT_CONTRACT_ADDRESS,
  PassportABI,
  wallet
);

/**
 * Génère les métadonnées d'un NFT passeport
 */
async function generatePassportMetadata(tokenId, ownerAddress) {
  try {
    // Récupérer les données on-chain du passeport
    const passportData = await passportContract.getPassportData(tokenId);
    
    // Récupérer les données historiques complètes depuis la base de données
    const historicalData = await db.auctionParticipations.find(
      { userAddress: ownerAddress },
      { sort: { timestamp: -1 } }
    ).toArray();
    
    // Convertir les secteurs bytes32 en chaînes lisibles
    const sectors = passportData.sectors
      .filter(sector => sector !== ethers.constants.HashZero)
      .map(sector => ethers.utils.parseBytes32String(sector));
    
    // Récupérer tous les secteurs uniques des participations
    const allSectors = [...new Set(historicalData.map(data => data.sector))];
    
    // Générer la valeur pour l'attribut de la dernière enchère
    const lastAuctionValue = passportData.lastAuctionTime > 0
      ? `${passportData.lastAuctionName} - ${new Date(passportData.lastAuctionTime * 1000).toISOString().split('T')[0]}`
      : "Aucune enchère";
    
    // Construire les métadonnées
    const metadata = {
      name: `NFT Étika - Passeport Enchères`,
      description: `Ce NFT permet de participer à toutes les enchères sur la plateforme Étika.`,
      image: `${process.env.BASE_IMAGE_URL}/passport-image/${tokenId}`,
      external_url: `${process.env.BASE_URL}/profile/${ownerAddress}`,
      attributes: [
        { trait_type: "Participant", value: ownerAddress },
        { trait_type: "Total Enchères Participées", value: passportData.participationCount },
        { trait_type: "Dernière Enchère", value: lastAuctionValue },
        { trait_type: "Historique des Enchères", value: allSectors }
      ]
    };
    
    return metadata;
  } catch (error) {
    console.error(`Error generating metadata for token ${tokenId}:`, error);
    throw error;
  }
}

/**
 * Route API pour récupérer les métadonnées d'un passeport
 */
router.get('/metadata/:tokenId', async (req, res) => {
  try {
    const tokenId = req.params.tokenId;
    
    // Vérifier que le token existe
    const exists = await passportContract.callStatic.ownerOf(tokenId).then(() => true).catch(() => false);
    if (!exists) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    // Récupérer le propriétaire du token
    const ownerAddress = await passportContract.ownerOf(tokenId);
    
    // Générer les métadonnées
    const metadata = await generatePassportMetadata(tokenId, ownerAddress);
    
    res.json(metadata);
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ error: 'Error generating metadata' });
  }
});

/**
 * Mettre à jour les métadonnées d'un passeport et les publier sur IPFS
 */
async function updatePassportMetadataOnIPFS(tokenId, ownerAddress) {
  try {
    // Générer les métadonnées
    const metadata = await generatePassportMetadata(tokenId, ownerAddress);
    
    // Convertir en Buffer pour IPFS
    const metadataBuffer = Buffer.from(JSON.stringify(metadata));
    
    // Ajouter à IPFS
    const result = await ipfs.add(metadataBuffer);
    const ipfsHash = result.path;
    
    // Construire l'URI IPFS
    const uri = `ipfs://${ipfsHash}`;
    
    // Mettre à jour l'URI du token
    const tx = await passportContract.updateTokenURI(tokenId, uri);
    await tx.wait();
    
    // Enregistrer la mise à jour dans la base de données
    await db.metadataUpdates.insertOne({
      tokenId,
      uri,
      ipfsHash,
      timestamp: new Date(),
      version: (await db.metadataUpdates.countDocuments({ tokenId })) + 1
    });
    
    return { success: true, uri, ipfsHash };
  } catch (error) {
    console.error(`Error updating metadata for token ${tokenId}:`, error);
    throw error;
  }
}

/**
 * Enregistrer une participation à une enchère et mettre à jour le passeport
 */
async function recordAuctionParticipation(userAddress, auctionId, auctionName, sector) {
  try {
    // Récupérer le tokenId du passeport de l'utilisateur
    const tokenId = await passportContract.getPassportId(userAddress);
    
    if (tokenId == 0) {
      throw new Error('User does not have a passport');
    }
    
    // Convertir le secteur en bytes32
    const sectorBytes32 = ethers.utils.formatBytes32String(sector);
    
    // Enregistrer la participation sur la blockchain
    const tx = await passportContract.recordParticipation(tokenId, sectorBytes32, auctionName);
    await tx.wait();
    
    // Enregistrer dans la base de données pour l'historique complet
    await db.auctionParticipations.insertOne({
      userAddress,
      tokenId: tokenId.toString(),
      auctionId,
      auctionName,
      sector,
      timestamp: new Date()
    });
    
    // Mettre à jour les métadonnées sur IPFS
    const metadataUpdate = await updatePassportMetadataOnIPFS(tokenId, userAddress);
    
    return {
      success: true,
      tokenId: tokenId.toString(),
      metadataUri: metadataUpdate.uri
    };
  } catch (error) {
    console.error('Error recording auction participation:', error);
    throw error;
  }
}

module.exports = {
  router,
  recordAuctionParticipation,
  updatePassportMetadataOnIPFS,
  generatePassportMetadata
};
```

## 3. Service d'Image Dynamique

Pour générer des images de NFT dynamiques basées sur les participations des utilisateurs :

```javascript
// image-service.js

const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const router = express.Router();

/**
 * Génère une image dynamique pour le passeport NFT
 */
router.get('/passport-image/:tokenId', async (req, res) => {
  try {
    const tokenId = req.params.tokenId;
    
    // Vérifier que le tokenId est valide
    if (!Number.isInteger(parseInt(tokenId))) {
      return res.status(400).send('Invalid token ID');
    }
    
    // Récupérer les données du passeport
    const passportData = await db.passports.findOne({ tokenId });
    if (!passportData) {
      return res.status(404).send('Passport not found');
    }
    
    // Récupérer le nombre de participations
    const participationCount = await db.auctionParticipations.countDocuments({ tokenId });
    
    // Créer un canvas pour l'image
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');
    
    // Charger l'image de base
    const baseImage = await loadImage('./assets/passport-template.png');
    ctx.drawImage(baseImage, 0, 0, 1000, 1000);
    
    // Définir les styles de texte
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    
    // Ajouter le numéro du passeport
    ctx.fillText(`Passport #${tokenId}`, 100, 150);
    
    // Ajouter le nombre de participations
    ctx.font = '30px Arial';
    ctx.fillText(`Participations: ${participationCount}`, 100, 250);
    
    // Ajouter le statut du passeport
    const status = passportData.blacklisted ? 'BLACKLISTED' : 'ACTIVE';
    ctx.fillStyle = passportData.blacklisted ? '#FF0000' : '#00FF00';
    ctx.fillText(`Status: ${status}`, 100, 300);
    
    // Ajouter les secteurs d'enchères
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Secteurs:', 100, 400);
    
    // Récupérer les secteurs uniques
    const sectors = await db.auctionParticipations.distinct('sector', { tokenId });
    
    // Afficher jusqu'à 5 secteurs
    for (let i = 0; i < Math.min(sectors.length, 5); i++) {
      ctx.fillText(`• ${sectors[i]}`, 120, 450 + i * 40);
    }
    
    // Ajouter la date de dernière participation
    const lastParticipation = await db.auctionParticipations.findOne(
      { tokenId },
      { sort: { timestamp: -1 } }
    );
    
    if (lastParticipation) {
      const date = new Date(lastParticipation.timestamp).toISOString().split('T')[0];
      ctx.fillText(`Dernière participation: ${date}`, 100, 700);
      ctx.fillText(`Enchère: ${lastParticipation.auctionName}`, 100, 750);
    }
    
    // Convertir le canvas en image PNG et l'envoyer
    res.setHeader('Content-Type', 'image/png');
    canvas.createPNGStream().pipe(res);
  } catch (error) {
    console.error('Error generating passport image:', error);
    res.status(500).send('Error generating image');
  }
});

module.exports = router;
```

## 4. Service d'Intégration avec le Système d'Enchères

```javascript
// auction-passport-integration.js

const { recordAuctionParticipation } = require('./metadata-service');
const { ethers } = require('ethers');

/**
 * Middleware pour vérifier si un utilisateur a un passeport valide
 */
async function checkValidPassport(req, res, next) {
  try {
    const userAddress = req.user.walletAddress;
    
    // Vérifier si l'utilisateur a un passeport valide
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_NODE_URL);
    const passportContract = new ethers.Contract(
      process.env.PASSPORT_CONTRACT_ADDRESS,
      PassportABI,
      provider
    );
    
    const hasValidPassport = await passportContract.hasValidPassport(userAddress);
    
    if (!hasValidPassport) {
      return res.status(403).json({
        error: 'No valid passport',
        message: 'You need a valid passport to participate in auctions'
      });
    }
    
    next();
  } catch (error) {
    console.error('Error checking passport:', error);
    res.status(500).json({ error: 'Error verifying passport' });
  }
}

/**
 * Intégrer avec le système d'enchères existant
 */
function integrateWithAuctionSystem(auctionService) {
  // Intercepter les participations aux enchères
  const originalPlaceBid = auctionService.placeBid;
  
  auctionService.placeBid = async function(auctionId, bidderId, amount) {
    // Appeler la fonction originale pour placer l'enchère
    const bidResult = await originalPlaceBid.call(this, auctionId, bidderId, amount);
    
    if (bidResult.success) {
      try {
        // Récupérer les détails de l'enchère
        const auction = await this.getAuctionDetails(auctionId);
        
        // Récupérer l'adresse du portefeuille de l'utilisateur
        const user = await userService.getUserById(bidderId);
        
        // Si c'est la première enchère de l'utilisateur pour cette vente aux enchères
        const isFirstBid = await db.bids.countDocuments({
          auctionId,
          bidderId,
        }) === 1;
        
        if (isFirstBid) {
          // Enregistrer la participation
          await recordAuctionParticipation(
            user.walletAddress,
            auctionId,
            auction.title,
            auction.sectorId
          );
        }
      } catch (error) {
        // Ne pas bloquer l'enchère si l'enregistrement échoue
        console.error('Failed to record auction participation:', error);
      }
    }
    
    return bidResult;
  };
  
  return auctionService;
}

/**
 * Créer un passeport pour un nouvel utilisateur
 */
async function createPassportForUser(userAddress) {
  try {
    // Vérifier si l'utilisateur a déjà un passeport
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_NODE_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const passportContract = new ethers.Contract(
      process.env.PASSPORT_CONTRACT_ADDRESS,
      PassportABI,
      wallet
    );
    
    const existingTokenId = await passportContract.getPassportId(userAddress);
    
    if (existingTokenId != 0) {
      console.log(`User ${userAddress} already has passport #${existingTokenId}`);
      return {
        success: true,
        tokenId: existingTokenId.toString(),
        message: 'User already has a passport'
      };
    }
    
    // Générer les métadonnées initiales
    const initialMetadata = {
      name: `NFT Étika - Passeport Enchères`,
      description: `Ce NFT permet de participer à toutes les enchères sur la plateforme Étika.`,
      image: `${process.env.BASE_IMAGE_URL}/passport-image/initial`,
      attributes: [
        { trait_type: "Participant", value: userAddress },
        { trait_type: "Total Enchères Participées", value: 0 },
        { trait_type: "Dernière Enchère", value: "Aucune enchère" },
        { trait_type: "Historique des Enchères", value: [] }
      ]
    };
    
    // Convertir en Buffer pour IPFS
    const metadataBuffer = Buffer.from(JSON.stringify(initialMetadata));
    
    // Ajouter à IPFS
    const ipfs = create({ 
      host: process.env.IPFS_HOST || 'ipfs.infura.io', 
      port: process.env.IPFS_PORT || 5001, 
      protocol: process.env.IPFS_PROTOCOL || 'https' 
    });
    
    const result = await ipfs.add(metadataBuffer);
    const ipfsHash = result.path;
    
    // Construire l'URI IPFS
    const uri = `ipfs://${ipfsHash}`;
    
    // Mint le passeport
    const tx = await passportContract.mintPassport(userAddress, uri);
    const receipt = await tx.wait();
    
    // Récupérer l'événement PassportMinted pour obtenir le tokenId
    const mintEvent = receipt.events.find(e => e.event === 'PassportMinted');
    const tokenId = mintEvent.args.tokenId.toString();
    
    // Enregistrer dans la base de données
    await db.passports.insertOne({
      tokenId,
      userAddress,
      mintedAt: new Date(),
      initialUri: uri,
      ipfsHash,
      blacklisted: false
    });
    
    return {
      success: true,
      tokenId,
      uri
    };
  } catch (error) {
    console.error(`Error creating passport for user ${userAddress}:`, error);
    throw error;
  }
}

module.exports = {
  checkValidPassport,
  integrateWithAuctionSystem,
  createPassportForUser
};
```

## 5. Scripts de Migration et d'Initialisation

```javascript
// migration.js - Script pour migrer du système par enchère au système de passeport unique

const { ethers } = require('ethers');
const { createPassportForUser } = require('./auction-passport-integration');

/**
 * Migre les utilisateurs existants vers le système de passeport
 */
async function migrateUsersToPassport() {
  try {
    // Récupérer tous les utilisateurs ayant participé à des enchères
    const distinctUsers = await db.auctionParticipants.distinct('userId');
    
    console.log(`Found ${distinctUsers.length} unique users to migrate`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Pour chaque utilisateur, créer un passeport s'il n'en a pas déjà un
    for (const userId of distinctUsers) {
      try {
        // Récupérer l'adresse de portefeuille de l'utilisateur
        const user = await db.users.findOne({ _id: userId });
        
        if (!user || !user.walletAddress) {
          console.warn(`User ${userId} has no wallet address, skipping`);
          failureCount++;
          continue;
        }
        
        // Créer un passeport pour l'utilisateur
        const result = await createPassportForUser(user.walletAddress);
        
        if (result.success) {
          successCount++;
          
          // Mettre à jour l'utilisateur avec son tokenId de passeport
          await db.users.updateOne(
            { _id: userId },
            { $set: { passportTokenId: result.tokenId } }
          );
          
          console.log(`Created passport #${result.tokenId} for user ${userId} (${user.walletAddress})`);
          
          // Récupérer l'historique des participations aux enchères de l'utilisateur
          const participations = await db.auctionParticipants.find({ userId }).toArray();
          
          // Pour chaque participation, l'enregistrer dans le passeport
          for (const participation of participations) {
            try {
              // Récupérer les détails de l'enchère
              const auction = await db.auctions.findOne({ _id: participation.auctionId });
              
              if (!auction) {
                console.warn(`Auction ${participation.auctionId} not found, skipping`);
                continue;
              }
              
              // Enregistrer la participation dans le passeport
              await recordAuctionParticipation(
                user.walletAddress,
                auction._id.toString(),
                auction.title,
                auction.sectorId
              );
              
              console.log(`Recorded participation for auction ${auction.title} for user ${userId}`);
            } catch (error) {
              console.error(`Error recording participation for user ${userId} in auction ${participation.auctionId}:`, error);
            }
          }
        } else {
          console.warn(`Failed to create passport for user ${userId}:`, result);
          failureCount++;
        }
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        failureCount++;
      }
    }
    
    console.log(`Migration completed. Success: ${successCount}, Failures: ${failureCount}`);
    
    return {
      success: true,
      totalUsers: distinctUsers.length,
      successCount,
      failureCount
    };
  } catch (error) {
    console.error('Error migrating users to passport system:', error);
    throw error;
  }
}

// Exécuter la migration si ce script est appelé directement
if (require.main === module) {
  migrateUsersToPassport()
    .then(result => {
      console.log('Migration result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = {
  migrateUsersToPassport
};
```

## 6. Implémentation côté Frontend

Voici comment implémenter la visualisation du passeport NFT dans l'interface utilisateur :

```javascript
// PassportNFTCard.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';

const PassportNFTCard = ({ userAddress }) => {
  const [loading, setLoading] = useState(true);
  const [passport, setPassport] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchPassport = async () => {
      try {
        setLoading(true);
        
        // Récupérer les données du passeport
        const response = await axios.get(`/api/passports/user/${userAddress}`);
        
        if (response.data.success) {
          setPassport(response.data.passport);
        } else {
          setError(response.data.message || 'Failed to fetch passport');
        }
      } catch (error) {
        console.error('Error fetching passport:', error);
        setError('Error retrieving passport information');
      } finally {
        setLoading(false);
      }
    };
    
    if (userAddress) {
      fetchPassport();
    }
  }, [userAddress]);
  
  if (loading) {
    return (
      <div className="passport-card loading">
        <div className="loader">Loading passport information...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="passport-card error">
        <div className="error-message">{error}</div>
        <button className="btn-primary" onClick={() => window.location.href = '/create-passport'}>
          Create Your Passport
        </button>
      </div>
    );
  }
  
  if (!passport) {
    return (
      <div className="passport-card empty">
        <h3>No Passport Found</h3>
        <p>You don't have an Étika Passport NFT yet.</p>
        <button className="btn-primary" onClick={() => window.location.href = '/create-passport'}>
          Create Your Passport
        </button>
      </div>
    );
  }
  
  return (
    <div className={`passport-card ${passport.blacklisted ? 'blacklisted' : 'active'}`}>
      <div className="passport-header">
        <h3>Étika Passport NFT</h3>
        <span className="passport-id">#{passport.tokenId}</span>
      </div>
      
      <div className="passport-image">
        <img src={passport.imageUrl} alt="Étika Passport NFT" />
      </div>
      
      <div className="passport-details">
        <div className="detail-row">
          <span className="label">Status:</span>
          <span className={`status ${passport.blacklisted ? 'blacklisted' : 'active'}`}>
            {passport.blacklisted ? 'BLACKLISTED' : 'ACTIVE'}
          </span>
        </div>
        
        <div className="detail-row">
          <span className="label">Participations:</span>
          <span className="value">{passport.participationCount}</span>
        </div>
        
        <div className="detail-row">
          <span className="label">Last Auction:</span>
          <span className="value">{passport.lastAuction || 'None'}</span>
        </div>
        
        <div className="sectors">
          <h4>Sectors:</h4>
          <div className="sector-tags">
            {passport.sectors.map((sector, index) => (
              <span key={index} className="sector-tag">{sector}</span>
            ))}
          </div>
        </div>
      </div>
      
      <div className="passport-footer">
        <a 
          href={`https://etherscan.io/token/${process.env.REACT_APP_PASSPORT_CONTRACT_ADDRESS}?a=${passport.tokenId}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="etherscan-link"
        >
          View on Etherscan
        </a>
        
        <a 
          href={passport.metadataUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="metadata-link"
        >
          View Metadata
        </a>
      </div>
    </div>
  );
};

export default PassportNFTCard;
```

## 7. Choix Techniques et Optimisations

### Choix pour l'Architecture Hybrid On-Chain/Off-Chain

Notre implémentation utilise une approche hybride avec :

1. **Données critiques en chaîne** :
   - Le propriétaire du NFT (via ERC-721)
   - Le compteur de participations
   - Les 5 secteurs les plus récents
   - La dernière enchère
   - Le statut blacklisté

2. **Données étendues hors chaîne** :
   - Historique complet des participations
   - Métadonnées détaillées
   - Image dynamique du NFT

Cette approche offre plusieurs avantages :

- **Coût réduit** : Minimise les écritures en chaîne coûteuses
- **Évolutivité** : Permet de stocker un historique illimité sans contraintes de taille
- **Flexibilité** : Permet de mettre à jour l'apparence du NFT sans transactions onéreuses
- **Sécurité** : Garde les informations critiques en chaîne

### Optimisations de Stockage

1. **Utilisation de IPFS** : 
   - Stockage décentralisé et immuable des métadonnées
   - Déduplication naturelle des données
   - Résilience et disponibilité des données

2. **Stockage bytes32 en chaîne** : 
   - Les secteurs sont stockés en tant que `bytes32` au lieu de chaînes 
   - Économise considérablement le gaz par rapport aux chaînes
   - 5 secteurs récents en chaîne sont suffisants pour la majorité des cas d'utilisation

3. **Base de données off-chain** :
   - MongoDB pour stocker l'historique complet des participations
   - Indexation efficace pour les requêtes fréquentes
   - Jointures pour récupérer les données complètes rapidement

### Scalabilité du Système

1. **Batch Updates** : 
   - Possibilité d'ajouter un mécanisme de mises à jour par lots pour économiser du gaz
   - Une fonction admin pourrait mettre à jour plusieurs NFT en une seule transaction

2. **Lazy Minting** :
   - Le passeport est créé uniquement lors de la première participation
   - Évite de créer des NFT pour des utilisateurs inactifs

3. **APIs Performantes** :
   - Utilisation de mise en cache Redis pour les métadonnées fréquemment accédées
   - CDN pour servir les images dynamiques des NFT
   - Déploiement sur des serveurs régionaux pour minimiser la latence

### Sécurité

1. **Contrôle d'accès** :
   - Rôles séparés pour les administrateurs et les mises à jour
   - Seuls les contrats autorisés peuvent enregistrer des participations

2. **Mécanisme de Blacklist** :
   - Possibilité de blacklister les passeports frauduleux
   - Empêche les transferts de passeports blacklistés

3. **Validation** :
   - Vérification que l'utilisateur possède un passeport valide avant de participer aux enchères
   - Empêche les participations multiples du même utilisateur

## 8. Avantages par Rapport au Système Précédent

Le système de NFT passeport unique présente plusieurs avantages par rapport à un NFT par enchère :

1. **Économie de coûts** :
   - Un seul mint par utilisateur au lieu d'un mint par participation
   - Réduction drastique des frais de gas pour les utilisateurs réguliers

2. **Meilleure expérience utilisateur** :
   - Un seul NFT à gérer dans le portefeuille
   - Visualisation consolidée de l'historique des participations
   - Sentiment d'appartenance et de progression

3. **Valeur accrue** :
   - Un NFT qui s'enrichit avec le temps devient plus précieux et significatif
   - Possibilité d'ajouter des fonctionnalités basées sur l'ancienneté ou le niveau d'activité

4. **Scalabilité** :
   - Croissance linéaire avec le nombre d'utilisateurs plutôt qu'avec le nombre de participations
   - Meilleure gestion de la base de données et des indexations

5. **Gestion de la réputation** :
   - Facilite la mise en place d'un système de réputation
   - Permet de blacklister les utilisateurs problématiques

## 9. Perspectives d'Évolution

Ce système de passeport NFT ouvre la voie à plusieurs évolutions futures :

1. **Niveaux et Badges** :
   - Ajout de niveaux basés sur le nombre de participations
   - Badges spéciaux pour certains types d'enchères ou de secteurs

2. **Avantages Progressive** :
   - Déblocage de fonctionnalités spéciales basées sur l'historique du passeport
   - Accès anticipé à certaines enchères pour les utilisateurs fréquents

3. **Intégration Cross-Platform** :
   - Utilisation du même passeport sur d'autres plateformes partenaires
   - Création d'un écosystème plus large autour de l'identité Étika

4. **Fonctionnalités Sociales** :
   - Possibilité de "suivre" d'autres participants
   - Classements des participants les plus actifs

5. **Gouvernance** :
   - Implémentation future d'un système de vote pondéré par l'activité
   - Participation aux décisions sur la plateforme

## Conclusion

L'implémentation du NFT passeport unique pour Étika représente une amélioration majeure par rapport à l'approche d'un NFT par enchère. Cette solution est plus économique, plus scalable et offre une meilleure expérience utilisateur tout en maintenant un haut niveau de sécurité.

En utilisant une architecture hybride on-chain/off-chain et des technologies éprouvées comme IPFS, nous pouvons créer un système qui combine le meilleur des deux mondes : l'immuabilité et la sécurité de la blockchain avec la flexibilité et la scalabilité du stockage hors chaîne.

Ce système représente non seulement une solution technique efficace aux exigences actuelles, mais pose également les bases pour de futures évolutions qui pourront enrichir l'écosystème Étika et renforcer l'engagement des utilisateurs.

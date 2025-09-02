/**
 * Module d'intégration du Smart Contract ETIKA avec la plateforme web
 * 
 * Ce module fournit les services nécessaires pour interagir avec le smart contract
 * ETIKA déployé sur la blockchain et exposer ses fonctionnalités via une API web.
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { ContractPromise } from '@polkadot/api-contract';
import { web3Accounts, web3Enable, web3FromSource } from '@polkadot/extension-dapp';
import keyring from '@polkadot/ui-keyring';
import { formatBalance, hexToU8a } from '@polkadot/util';
import { decodeAddress } from '@polkadot/util-crypto';
import BN from 'bn.js';

// Configuration
const config = {
  wsProvider: 'wss://etika-node.etika.io',
  contractAddress: '5G6rkijvCLKG4gp8UofEq7bYbA2oYo2r3QW6PvuJHsRdCeWW', // Adresse du contrat ETIKA déployé
  decimals: 12,
  tokenSymbol: 'ETK',
  network: 'ETIKA Platform',
  contractMetadata: null, // Sera chargé dynamiquement
};

// Import de l'ABI du contrat
import contractAbi from './etika-contract-abi.json';

// Classe principale d'intégration
class EtikaIntegrationService {
  constructor() {
    this.api = null;
    this.contract = null;
    this.initialized = false;
    this.accounts = [];
    this.currentAccount = null;
    this.events = []; // Pour stocker les événements reçus
    this.transactionSubscriptions = new Map(); // Pour suivre les souscriptions aux événements
  }

  /**
   * Initialise la connexion avec la blockchain et le contrat
   */
  async initialize() {
    try {
      console.log('Initialisation du service ETIKA...');
      
      // Connexion à la blockchain
      const wsProvider = new WsProvider(config.wsProvider);
      this.api = await ApiPromise.create({ 
        provider: wsProvider,
        types: {
          // Types personnalisés pour le système ETIKA
          TransactionId: 'String',
          ValidatorId: 'AccountId',
          SignatureData: 'Vec<u8>',
          TokenAmount: 'u128',
          EpargneAmount: 'u128',
          Timestamp: 'u64'
        }
      });
      console.log(`Connecté au réseau: ${config.network}`);
      
      // Chargement des métadonnées du contrat
      config.contractMetadata = contractAbi;
      
      // Initialisation du contrat
      this.contract = new ContractPromise(
        this.api, 
        config.contractMetadata, 
        config.contractAddress
      );
      
      // Initialisation du Keyring
      keyring.loadAll({ 
        ss58Format: 42, 
        type: 'sr25519',
        isDevelopment: false 
      });
      
      // Connexion avec l'extension de portefeuille
      const extensions = await web3Enable('ETIKA Platform');
      if (extensions.length === 0) {
        console.warn('Aucune extension de portefeuille trouvée, fonctionnalités limitées');
      } else {
        // Récupération des comptes
        this.accounts = await web3Accounts();
        if (this.accounts.length > 0) {
          this.currentAccount = this.accounts[0];
          console.log(`Compte par défaut: ${this.currentAccount.address}`);
        }
      }
      
      // Configuration de l'écoute des événements globaux
      this._setupEventListeners();
      
      this.initialized = true;
      console.log('Service ETIKA initialisé avec succès');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Configure les écouteurs d'événements pour le contrat
   */
  _setupEventListeners() {
    if (!this.api || !this.contract) {
      console.warn('Impossible de configurer les écouteurs d\'événements: API ou contrat non initialisé');
      return;
    }

    // S'abonner aux événements du contrat
    this.api.query.system.events((events) => {
      events.forEach((record) => {
        const { event } = record;
        
        // Filtrer les événements du contrat
        if (event.section === 'contracts') {
          this._processContractEvent(event);
        }
      });
    });
  }
  
  /**
   * Traite les événements émis par le contrat
   */
  _processContractEvent(event) {
    try {
      if (event.method === 'ContractEmitted' && event.data) {
        const [contractAddress, encodedEvent] = event.data;
        
        // Vérifier si l'événement provient de notre contrat
        if (contractAddress.toString() === config.contractAddress) {
          const decodedEvent = this.contract.abi.decodeEvent(encodedEvent);
          
          if (decodedEvent) {
            const { event: { identifier }, args } = decodedEvent;
            
            // Stocker l'événement
            const eventData = {
              name: identifier,
              timestamp: Date.now(),
              data: args.reduce((acc, arg, index) => {
                acc[decodedEvent.event.args[index].name] = arg.toString();
                return acc;
              }, {})
            };
            
            this.events.push(eventData);
            
            // Notifier les abonnés à cet événement
            if (this.transactionSubscriptions.has(eventData.data.transaction_id)) {
              const callbacks = this.transactionSubscriptions.get(eventData.data.transaction_id);
              callbacks.forEach(callback => callback(eventData));
            }
            
            console.log(`Événement reçu: ${identifier}`, eventData.data);
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors du traitement d\'un événement:', error);
    }
  }

  /**
   * Vérifie si le service est initialisé
   */
  _checkInitialized() {
    if (!this.initialized) {
      throw new Error('Le service ETIKA n\'est pas initialisé');
    }
  }

  /**
   * Obtient l'injecteur pour l'adresse courante
   */
  async _getInjector() {
    this._checkInitialized();
    
    if (!this.currentAccount) {
      throw new Error('Aucun compte actif défini');
    }
    
    const injector = await web3FromSource(this.currentAccount.meta.source);
    return injector;
  }

  /**
   * Traite les callbacks des transactions
   */
  _processContractCallback(operationName) {
    return (result) => {
      if (result.status.isInBlock) {
        console.log(`${operationName} incluse dans le bloc: ${result.status.asInBlock.toHex()}`);
      } else if (result.status.isFinalized) {
        console.log(`${operationName} finalisée dans le bloc: ${result.status.asFinalized.toHex()}`);
        
        // Vérifier les événements
        result.events.forEach(({ event }) => {
          if (event.method === 'ExtrinsicSuccess') {
            console.log(`${operationName} réussie`);
          } else if (event.method === 'ExtrinsicFailed') {
            console.error(`${operationName} échouée`);
            // Extraire les détails de l'erreur si disponible
            const errorInfo = event.data[0];
            if (errorInfo.isModule) {
              const { index, error } = this.api.registry.findMetaError(errorInfo.asModule);
              console.error(`Erreur: ${index}.${error}`);
            }
          }
        });
      }
    };
  }

  /**
   * Convertit un rôle en enum pour le contrat
   */
  _mapRoleToEnum(role) {
    const roles = {
      'consumer': { Consumer: null },
      'merchant': { Merchant: null },
      'producer': { Producer: null },
      'supplier': { Supplier: null },
      'subcontractor': { Subcontractor: null },
      'admin': { Admin: null },
      'officialSponsor': { OfficialSponsor: null },
      'ngo': { NGO: null },
      'localAuthority': { LocalAuthority: null }
    };
    
    const roleKey = role.toLowerCase();
    if (!roles[roleKey]) {
      throw new Error(`Rôle non supporté: ${role}`);
    }
    
    return roles[roleKey];
  }
  
  /**
   * Convertit un type de transaction en enum pour le contrat
   */
  _mapTransactionTypeToEnum(type) {
    const types = {
      'directSale': { DirectSale: null },
      'retailSale': { RetailSale: null },
      'complexSale': { ComplexSale: null },
      'system': { System: null },
      'deposit': { Deposit: null },
      'withdrawal': { Withdrawal: null },
      'tokenTransfer': { TokenTransfer: null },
      'tokenConversion': { TokenConversion: null },
      'bidPlacement': { BidPlacement: null },
      'bidFinalization': { BidFinalization: null },
      'supplierPayment': { SupplierPayment: null },
      'tokenBurn': { TokenBurn: null }
    };
    
    const typeKey = type.toLowerCase();
    if (!types[typeKey]) {
      throw new Error(`Type de transaction non supporté: ${type}`);
    }
    
    return types[typeKey];
  }

  /**
   * S'abonne aux événements d'une transaction spécifique
   */
  subscribeToTransaction(transactionId, callback) {
    if (!this.transactionSubscriptions.has(transactionId)) {
      this.transactionSubscriptions.set(transactionId, []);
    }
    
    this.transactionSubscriptions.get(transactionId).push(callback);
    return {
      unsubscribe: () => {
        const callbacks = this.transactionSubscriptions.get(transactionId) || [];
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
        if (callbacks.length === 0) {
          this.transactionSubscriptions.delete(transactionId);
        }
      }
    };
  }

  /**
   * Définit le compte actif
   */
  setCurrentAccount(address) {
    const account = this.accounts.find(acc => acc.address === address);
    if (!account) {
      throw new Error(`Compte ${address} non trouvé`);
    }
    this.currentAccount = account;
    console.log(`Compte actif défini: ${address}`);
  }

  /**
   * Crée un nouveau compte utilisateur sur la plateforme ETIKA
   */
  async createAccount(address, role) {
    this._checkInitialized();
    
    try {
      const injector = await this._getInjector();
      const roleEnum = this._mapRoleToEnum(role);
      
      // Préparer les paramètres d'appel
      const gasLimit = 3000n * 1000000n;
      const storageDepositLimit = null;
      
      // Appel de la méthode du contrat
      const tx = await this.contract.tx
        .createAccount({ gasLimit, storageDepositLimit }, address, roleEnum)
        .signAndSend(
          this.currentAccount.address,
          { signer: injector.signer },
          this._processContractCallback('Création de compte')
        );
      
      return tx;
    } catch (error) {
      console.error('Erreur lors de la création de compte:', error);
      throw error;
    }
  }

  /**
   * Enregistre un utilisateur comme validateur
   */
  async registerValidator(address, role) {
    this._checkInitialized();
    
    try {
      const injector = await this._getInjector();
      const roleEnum = this._mapRoleToEnum(role);
      
      // Préparer les paramètres d'appel
      const gasLimit = 3000n * 1000000n;
      const storageDepositLimit = null;
      
      // Appel de la méthode du contrat
      const tx = await this.contract.tx
        .registerValidator({ gasLimit, storageDepositLimit }, address, roleEnum)
        .signAndSend(
          this.currentAccount.address,
          { signer: injector.signer },
          this._processContractCallback('Enregistrement validateur')
        );
      
      return tx;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du validateur:', error);
      throw error;
    }
  }

  /**
   * Crée une transaction de vente avec triple validation (PoP)
   */
  async createSaleTransaction(params) {
    this._checkInitialized();
    
    try {
      const injector = await this._getInjector();
      
      // Préparation des paramètres de vente
      const saleType = this._mapTransactionTypeToEnum(params.saleType);
      const saleParams = {
        consumer: params.consumer,
        merchant: params.merchant,
        supplier: params.supplier || null,
        amount: new BN(params.amount),
        savings_percentage: params.savingsPercentage || 15, // par défaut 1.5%
        items: params.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: new BN(item.unitPrice),
          supplier_id: item.supplierId || null
        })),
        location_data: params.locationData || null
      };
      
      // Métadonnées de la transaction
      const metadata = {
        version: "1.0",
        origin: params.origin || "Web Platform",
        description: params.description || null,
        metadata_hash: null
      };
      
      // Préparer les paramètres d'appel
      const gasLimit = 5000n * 1000000n;
      const storageDepositLimit = null;
      
      // Appel de la méthode du contrat
      const tx = await this.contract.tx
        .createSaleTransaction(
          { gasLimit, storageDepositLimit },
          saleType,
          saleParams,
          metadata
        )
        .signAndSend(
          this.currentAccount.address,
          { signer: injector.signer },
          this._processContractCallback('Création transaction de vente')
        );
      
      return tx;
    } catch (error) {
      console.error('Erreur lors de la création de la transaction:', error);
      throw error;
    }
  }

  /**
   * Valide une preuve d'achat (PoP)
   */
  async validatePop(transactionId, signature = null) {
    this._checkInitialized();
    
    try {
      const injector = await this._getInjector();
      
      // Préparer les paramètres d'appel
      const gasLimit = 3000n * 1000000n;
      const storageDepositLimit = null;
      
      // Appel de la méthode du contrat
      const tx = await this.contract.tx
        .validatePop(
          { gasLimit, storageDepositLimit },
          transactionId,
          signature
        )
        .signAndSend(
          this.currentAccount.address,
          { signer: injector.signer },
          this._processContractCallback('Validation PoP')
        );
      
      return tx;
    } catch (error) {
      console.error('Erreur lors de la validation PoP:', error);
      throw error;
    }
  }

  /**
   * Convertit des tokens en épargne
   */
  async convertTokensToSavings(amount) {
    this._checkInitialized();
    
    try {
      const injector = await this._getInjector();
      
      // Préparer les paramètres d'appel
      const gasLimit = 3000n * 1000000n;
      const storageDepositLimit = null;
      
      // Convertir le montant en BN
      const bnAmount = new BN(amount);
      
      // Appel de la méthode du contrat
      const tx = await this.contract.tx
        .convertTokensToSavings(
          { gasLimit, storageDepositLimit },
          bnAmount
        )
        .signAndSend(
          this.currentAccount.address,
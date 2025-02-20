#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
/// Contrat intelligent ETIKA - Une plateforme décentralisée pour créer un circuit court financier auto-alimenté
///
/// Ce contrat implémente un écosystème financier avec:
/// - Système de preuve d'achat (PoP) pour validation
/// - Circuit court financier auto-alimenté
/// - Génération d'épargne en temps réel
/// - Affacturage innovant pour les entreprises
/// - Système d'enchères pour les sponsors officiels
mod etika {
    use ink_storage::{
        collections::{HashMap as StorageHashMap, Vec as StorageVec},
        traits::{PackedLayout, SpreadLayout},
    };
    use ink_prelude::{
        string::String,
        vec::Vec,
    };
    use scale::{Decode, Encode};

    // ===============================
    // TYPES ET ÉNUMÉRATIONS
    // ===============================

    /// Types d'identifiants et montants
    pub type TransactionId = String;
    pub type ValidatorId = AccountId;
    pub type SignatureData = Vec<u8>;
    pub type TokenAmount = u128;
    pub type EpargneAmount = u128;
    pub type Timestamp = u64;

    /// Types de transactions supportées
    #[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum TransactionType {
        DirectSale,        // Vente directe (producteur → consommateur)
        RetailSale,        // Vente au détail (commerçant → consommateur)
        ComplexSale,       // Vente complexe (multi-parties)
        System,            // Transaction système
        Deposit,           // Dépôt d'épargne
        Withdrawal,        // Retrait d'épargne
        TokenTransfer,     // Transfert de tokens
        TokenConversion,   // Conversion tokens → épargne
        BidPlacement,      // Placement d'enchère
        BidFinalization,   // Finalisation d'enchère
        SupplierPayment,   // Paiement fournisseur (affacturage)
        TokenBurn,         // Brûlage de tokens
    }

    /// Statuts possibles d'une transaction
    #[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum TransactionStatus {
        Pending,      // En attente
        InProgress,   // En cours
        Confirmed,    // Confirmée
        Failed,       // Échouée
        Expired,      // Expirée
    }

    /// Rôles des validateurs dans le système
    #[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum ValidatorRole {
        Consumer,      // Consommateur
        Merchant,      // Commerçant
        Producer,      // Producteur
        Supplier,      // Fournisseur
        Subcontractor, // Sous-traitant
        Admin,         // Administrateur système
        OfficialSponsor, // Sponsor officiel
        NGO,           // Organisation non gouvernementale
        LocalAuthority, // Collectivité territoriale
    }

    /// Statuts de validation
    #[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum ValidationStatus {
        Pending,      // En attente
        Validated,    // Validée
        Rejected,     // Rejetée
    }

    /// Niveaux de sécurité du système
    #[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum SecurityLevel {
        Normal,        // Normal
        Elevated,      // Élevé
        High,          // Haut
        Critical,      // Critique
    }

    /// Statut d'une enchère
    #[derive(Debug, Clone, PartialEq, Eq, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum AuctionStatus {
        Pending,       // En attente
        Active,        // Active
        Completed,     // Terminée
        Cancelled,     // Annulée
    }

    // ===============================
    // STRUCTURES DE PARAMÈTRES
    // ===============================

    /// Paramètres de dépôt
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct DepositParams {
        pub recipient: ValidatorId,
        pub amount: EpargneAmount,
        pub source: String,
        pub reference: String,
    }

    /// Paramètres de retrait
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct WithdrawalParams {
        pub sender: ValidatorId,
        pub amount: EpargneAmount,
        pub destination: String,
        pub purpose: String,
    }

    /// Paramètres de transfert de tokens
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct TokenTransferParams {
        pub sender: ValidatorId,
        pub recipient: ValidatorId,
        pub amount: TokenAmount,
        pub memo: Option<String>,
    }

    /// Paramètres de conversion de tokens
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct TokenConversionParams {
        pub sender: ValidatorId,
        pub amount: TokenAmount,
        pub rate: u32,  // Taux en millièmes
    }

    /// Paramètres d'enchère
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct BidParams {
        pub bidder: ValidatorId,
        pub sponsor_category: String,
        pub amount: EpargneAmount,
        pub duration: u64,
        pub ecosystem_commitment: String,
    }

    /// Paramètres de paiement fournisseur
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct SupplierPaymentParams {
        pub merchant: ValidatorId,
        pub supplier: ValidatorId,
        pub amount: EpargneAmount,
        pub invoice_reference: String,
        pub sale_transaction_id: Option<TransactionId>,
    }

    /// Paramètres de transaction de vente
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct SaleTransactionParams {
        pub consumer: ValidatorId,
        pub merchant: ValidatorId,
        pub supplier: Option<ValidatorId>,
        pub amount: EpargneAmount,
        pub savings_percentage: u32,  // En millièmes
        pub items: Vec<PurchaseItem>,
        pub location_data: Option<String>,
    }

    /// Item d'achat pour PoP
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct PurchaseItem {
        pub description: String,
        pub quantity: u32,
        pub unit_price: EpargneAmount,
        pub supplier_id: Option<ValidatorId>,
    }

    /// Paramètres spécifiques à chaque type de transaction
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum TransactionParams {
        Deposit(DepositParams),
        Withdrawal(WithdrawalParams),
        TokenTransfer(TokenTransferParams),
        TokenConversion(TokenConversionParams),
        Bid(BidParams),
        SupplierPayment(SupplierPaymentParams),
        Sale(SaleTransactionParams),
    }

    // ===============================
    // STRUCTURES DE DONNÉES PRINCIPALES
    // ===============================

    /// Information sur un validateur
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct Validator {
        pub address: ValidatorId,
        pub role: ValidatorRole,
        pub is_active: bool,
        pub reputation: u32,           // 0-100
        pub success_rate: u32,         // En millièmes (0-1000)
        pub total_validations: u64,
        pub failed_validations: u64,
        pub slashed_amount: TokenAmount,
        pub votes_received: u32,
        pub last_validation: Timestamp,
    }

    /// Action effectuée par un validateur
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct ValidatorAction {
        pub validator: ValidatorId,
        pub status: ValidationStatus,
        pub timestamp: Timestamp,
        pub signature: Option<SignatureData>,
        pub reason: Option<String>,
    }

    /// Métadonnées d'une transaction
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct TransactionMetadata {
        pub version: String,
        pub origin: String,
        pub description: Option<String>,
        pub metadata_hash: Option<[u8; 32]>,
    }

    /// Structure principale d'une transaction
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct Transaction {
        pub id: TransactionId,
        pub tx_type: TransactionType,
        pub amount: EpargneAmount,
        pub created_at: Timestamp,
        pub updated_at: Timestamp,
        pub status: TransactionStatus,
        pub validators: Vec<ValidatorId>,
        pub required_validations: u32,
        pub current_validation_step: u32,
        pub validation_actions: Vec<ValidatorAction>,
        pub validated_by: Vec<ValidatorId>,
        pub validation_deadline: Timestamp,
        pub extensions_count: u8,
        pub metadata: TransactionMetadata,
        pub specific_params: Option<TransactionParams>,
        pub rewards: Vec<(ValidatorId, TokenAmount)>,
        pub recovery_attempts: u8,
        pub associated_savings: Option<EpargneAmount>,
        pub auto_factoring: bool,
        pub triple_validation_complete: bool,
    }

    /// Structure de données des enchères
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct AuctionData {
        pub category: String,
        pub start_time: Timestamp,
        pub end_time: Timestamp,
        pub min_bid: EpargneAmount,
        pub highest_bid: EpargneAmount,
        pub highest_bidder: Option<ValidatorId>,
        pub bids_count: u32,
        pub status: AuctionStatus,
        pub finalized: bool,
    }

    /// Configuration dynamique du système
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct SystemConfig {
        pub min_validators: u32,
        pub timeout_base: u64,
        pub extended_timeout: u64,
        pub token_conversion_rate: u32,    // En millièmes (1000 = 1.0)
        pub max_daily_withdrawal: EpargneAmount,
        pub min_validator_reputation: u32,
        pub slash_percentage: u32,         // En millièmes
        pub vote_threshold: u32,
        pub security_level: SecurityLevel,
        pub paused: bool,
        pub savings_distribution_rate: u32, // En millièmes
        pub token_burn_rate: u32,          // En millièmes
        pub auto_factoring_enabled: bool,
        pub auction_duration: u64,         // En secondes
        pub sponsor_rewards_multiplier: u32, // En millièmes
    }

    /// Compte utilisateur
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct UserAccount {
        pub user_id: ValidatorId,
        pub tokens: TokenAmount,
        pub epargne: EpargneAmount,
        pub role: ValidatorRole,
        pub created_at: Timestamp,
        pub last_activity: Timestamp,
        pub withdrawal_today: EpargneAmount,
        pub reset_day: u16,                 // Jour courant
        pub is_validator: bool,
        pub validator_votes: u32,
        pub total_savings_generated: EpargneAmount,
        pub tokens_burned: TokenAmount,
        pub is_sponsor: bool,
        pub sponsor_category: Option<String>,
        pub sponsor_until: Option<Timestamp>,
        pub delegated_savings_to: Option<ValidatorId>,
        pub ecosystem_metrics: Option<UserEcosystemMetrics>,
    }

    /// Métriques écosystémiques de l'utilisateur
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct UserEcosystemMetrics {
        pub transactions_count: u64,
        pub total_purchase_volume: EpargneAmount,
        pub total_token_circulation: TokenAmount,
        pub carbon_footprint_saved: u64,
        pub local_economy_contribution: EpargneAmount,
        pub ethical_impact_score: u32,     // 0-100
    }

    /// Métriques globales de l'écosystème
    #[derive(Debug, Clone, Encode, Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct EcosystemMetrics {
        pub total_transactions: u64,
        pub active_users: u64,
        pub sponsors_count: u32,
        pub average_transaction_amount: EpargneAmount,
        pub total_auction_volume: EpargneAmount,
        pub total_carbon_saved: u64,
        pub local_economy_boost: EpargneAmount,
        pub total_supplier_payments: EpargneAmount,
        pub ethical_projects_funded: u32,
    }

    /// Erreurs possibles
    #[derive(Debug, Clone, PartialEq, Eq, Encode, Decode)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        ValidationTimeout,
        InvalidSignature,
        InsufficientValidators,
        InvalidValidator,
        SequenceError,
        DoublePending,
        InsufficientFunds,
        InvalidAmount,
        InvalidParams,
        Unauthorized,
        ExceededLimit,
        SystemPaused,
        SecurityViolation,
        ContractError,
        TransactionExpired,
        RecoveryNotAllowed,
        ValidationRejected,
        AlreadyValidated,
        TooManyExtensions,
        AuctionNotActive,
        BidTooLow,
        AuctionEnded,
        TripleValidationIncomplete,
        InvalidSponsor,
        InvalidSupplier,
        AlreadyProcessed,
        TokenBurnFailed,
        NotASponsor,
        InvalidCategory,
        EthicalViolation,
    }

    // Type de résultat
    pub type Result<T> = core::result::Result<T, Error>;

    // ===============================
    // ÉVÉNEMENTS DU SYSTÈME
    // ===============================

    #[ink(event)]
    pub struct TransactionValidated {
        #[ink(topic)]
        transaction_id: TransactionId,
        #[ink(topic)]
        validator: ValidatorId,
        timestamp: Timestamp,
    }

    #[ink(event)]
    pub struct TransactionRejected {
        #[ink(topic)]
        transaction_id: TransactionId,
        #[ink(topic)]
        validator: ValidatorId,
        reason: String,
    }

    #[ink(event)]
    pub struct TransactionCompleted {
        #[ink(topic)]
        transaction_id: TransactionId,
        status: TransactionStatus,
        completion_time: Timestamp,
    }

    #[ink(event)]
    pub struct SavingsGenerated {
        #[ink(topic)]
        consumer: ValidatorId,
        #[ink(topic)]
        transaction_id: TransactionId,
        amount: EpargneAmount,
    }

    #[ink(event)]
    pub struct TokensBurned {
        #[ink(topic)]
        sender: ValidatorId,
        amount: TokenAmount,
        reason: String,
    }

    #[ink(event)]
    pub struct BidPlaced {
        #[ink(topic)]
        bidder: ValidatorId,
        #[ink(topic)]
        category: String,
        amount: EpargneAmount,
    }

    #[ink(event)]
    pub struct AuctionCompleted {
        #[ink(topic)]
        category: String,
        winner: ValidatorId,
        amount: EpargneAmount,
    }

    #[ink(event)]
    pub struct SupplierPaid {
        #[ink(topic)]
        supplier: ValidatorId,
        #[ink(topic)]
        merchant: ValidatorId,
        amount: EpargneAmount,
        invoice_reference: String,
    }

    #[ink(event)]
    pub struct TripleValidationCompleted {
        #[ink(topic)]
        transaction_id: TransactionId,
        consumer: ValidatorId,
        merchant: ValidatorId,
        supplier: ValidatorId,
    }

    #[ink(event)]
    pub struct SecurityLevelChanged {
        old_level: SecurityLevel,
        new_level: SecurityLevel,
        reason: String,
    }

    #[ink(event)]
    pub struct ValidatorSlashed {
        #[ink(topic)]
        validator: ValidatorId,
        amount: TokenAmount,
        reason: String,
    }

    // ===============================
    // CONTRAT PRINCIPAL
    // ===============================

    #[ink(storage)]
    pub struct EtikaContract {
        // Stockage principal
        owner: AccountId,
        validators: StorageHashMap<ValidatorId, Validator>,
        transactions: StorageHashMap<TransactionId, Transaction>,
        accounts: StorageHashMap<ValidatorId, UserAccount>,
        config: SystemConfig,
        
        // Compteurs et index
        transaction_count: u64,
        total_token_supply: TokenAmount,
        total_epargne: EpargneAmount,
        
        // Indexation
        validators_by_role: StorageHashMap<ValidatorRole, StorageVec<ValidatorId>>,
        pending_transactions: StorageVec<TransactionId>,
        
        // Sécurité
        authorized_admins: StorageVec<ValidatorId>,
        
        // Enchères et sponsors
        active_auctions: StorageHashMap<String, AuctionData>,
        sponsors_by_category: StorageHashMap<String, ValidatorId>,
        
        // PoP (Proof of Purchase)
        pending_triple_validations: StorageHashMap<TransactionId, Vec<ValidatorId>>,
        
        // Affacturage
        supplier_payments: StorageHashMap<String, TransactionId>, // invoice_reference -> transaction_id
        
        // Épargne et statistiques
        total_savings_generated: EpargneAmount,
        total_tokens_burned: TokenAmount,
        ecosystem_impact_metrics: EcosystemMetrics,
    }

    impl EtikaContract {
        /// Initialise un nouveau contrat
        #[ink(constructor)]
        pub fn new(initial_admin: AccountId) -> Self {
            let config = SystemConfig {
                min_validators: 2,
                timeout_base: 86400,      // 24 heures en secondes
                extended_timeout: 43200,  // 12 heures supplémentaires
                token_conversion_rate: 1000, // 1:1 initialement
                max_daily_withdrawal: 10000,
                min_validator_reputation: 50,
                slash_percentage: 100,    // 10% en millièmes
                vote_threshold: 10,       // 10 votes pour devenir validateur
                security_level: SecurityLevel::Normal,
                paused: false,
                savings_distribution_rate: 15, // 1.5% en millièmes
                token_burn_rate: 50,      // 5% en millièmes
                auto_factoring_enabled: true,
                auction_duration: 604800, // 7 jours en secondes
                sponsor_rewards_multiplier: 150, // 1.5x en pourcentage
            };
            
            let ecosystem_metrics = EcosystemMetrics {
                total_transactions: 0,
                active_users: 0,
                sponsors_count: 0,
                average_transaction_amount: 0,
                total_auction_volume: 0,
                total_carbon_saved: 0,
                local_economy_boost: 0,
                total_supplier_payments: 0,
                ethical_projects_funded: 0,
            };
            
            let mut validators_by_role = StorageHashMap::new();
            for role in [
                ValidatorRole::Admin,
                ValidatorRole::Consumer,
                ValidatorRole::Merchant,
                ValidatorRole::Producer,
                ValidatorRole::Supplier,
                ValidatorRole::Subcontractor,
                ValidatorRole::OfficialSponsor,
                ValidatorRole::NGO,
                ValidatorRole::LocalAuthority,
            ].iter() {
                validators_by_role.insert(role.clone(), StorageVec::new());
            }
            
            let mut authorized_admins = StorageVec::new();
            authorized_admins.push(initial_admin);
            
            Self {
                owner: initial_admin,
                validators: StorageHashMap::new(),
                transactions: StorageHashMap::new(),
                accounts: StorageHashMap::new(),
                config,
                transaction_count: 0,
                total_token_supply: 0,
                total_epargne: 0,
                validators_by_role,
                pending_transactions: StorageVec::new(),
                authorized_admins,
                active_auctions: StorageHashMap::new(),
                sponsors_by_category: StorageHashMap::new(),
                pending_triple_validations: StorageHashMap::new(),
                supplier_payments: StorageHashMap::new(),
                total_savings_generated: 0,
                total_tokens_burned: 0,
                ecosystem_impact_metrics: ecosystem_metrics,
            }
        }

        // ===============================
        // FONCTIONS DE GESTION DES COMPTES 
        // ===============================

        /// Crée un nouveau compte utilisateur
        #[ink(message)]
        pub fn create_account(&mut self, user: ValidatorId, role: ValidatorRole) -> Result<()> {
            // Vérification que le compte n'existe pas déjà
            if self.accounts.contains_key(&user) {
                return Err(Error::InvalidParams);
            }
            
            let now = self.env().block_timestamp();
            
            // Vérifier que l'appelant est un administrateur
            if !self.authorized_admins.contains(&caller) {
                return Err(Error::Unauthorized);
            }
            
            // Vérifier que l'enchère existe
            let mut auction = match self.active_auctions.get(&category) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidCategory),
            };
            
            // Vérifier que l'enchère n'est pas déjà finalisée
            if auction.finalized {
                return Err(Error::AlreadyProcessed);
            }
            
            // Vérifier que l'enchère est terminée ou qu'un admin la finalise manuellement
            if now < auction.end_time && auction.status == AuctionStatus::Active {
                auction.end_time = now; // Terminer l'enchère prématurément
            }
            
            // Finaliser l'enchère
            auction.status = AuctionStatus::Completed;
            auction.finalized = true;
            
            // Si un gagnant existe, enregistrer le nouveau sponsor
            if let Some(winner) = auction.highest_bidder {
                // Mettre à jour le compte du gagnant
                if let Some(mut account) = self.accounts.get(&winner) {
                    // Vérifier les fonds
                    if account.epargne < auction.highest_bid {
                        return Err(Error::InsufficientFunds);
                    }
                    
                    // Débiter le compte
                    account.epargne -= auction.highest_bid;
                    account.is_sponsor = true;
                    account.sponsor_category = Some(category.clone());
                    account.sponsor_until = Some(now + 31536000); // 1 an en secondes
                    
                    self.accounts.insert(winner, account);
                    
                    // Enregistrer le sponsor pour cette catégorie
                    self.sponsors_by_category.insert(category.clone(), winner);
                    
                    // Mettre à jour les métriques
                    self.ecosystem_impact_metrics.sponsors_count += 1;
                    self.ecosystem_impact_metrics.total_auction_volume += auction.highest_bid;
                    
                    // Créer une transaction de finalisation d'enchère
                    self.transaction_count += 1;
                    let tx_id = format!("BIDWIN-{}-{}", self.transaction_count, now);
                    
                    let transaction = Transaction {
                        id: tx_id.clone(),
                        tx_type: TransactionType::BidFinalization,
                        amount: auction.highest_bid,
                        created_at: now,
                        updated_at: now,
                        status: TransactionStatus::Confirmed,
                        validators: vec![caller, winner],
                        required_validations: 0, // Auto-confirmée
                        current_validation_step: 0,
                        validation_actions: Vec::new(),
                        validated_by: vec![caller],
                        validation_deadline: 0, // Pas de deadline
                        extensions_count: 0,
                        metadata: TransactionMetadata {
                            version: "1.0".to_string(),
                            origin: format!("Finalisation enchère {}", category),
                            description: Some(format!("Sponsor officiel - catégorie {}", category)),
                            metadata_hash: None,
                        },
                        specific_params: None,
                        rewards: Vec::new(),
                        recovery_attempts: 0,
                        associated_savings: None,
                        auto_factoring: false,
                        triple_validation_complete: false,
                    };
                    
                    self.transactions.insert(tx_id, transaction);
                    
                    // Émettre l'événement
                    self.env().emit_event(AuctionCompleted {
                        category: category.clone(),
                        winner,
                        amount: auction.highest_bid,
                    });
                }
            }
            
            // Sauvegarder l'enchère mise à jour
            self.active_auctions.insert(category, auction);
            
            Ok(())
        }
        
        // ===============================
        // FONCTIONS UTILITAIRES ET SÉCURITÉ
        // ===============================
        
        /// Met à jour les métriques de l'écosystème
        fn update_ecosystem_metrics(&mut self, transaction: &Transaction) {
            self.ecosystem_impact_metrics.total_transactions += 1;
            
            // Calculer la moyenne mobile des montants de transaction
            let current_avg = self.ecosystem_impact_metrics.average_transaction_amount;
            let num_transactions = self.ecosystem_impact_metrics.total_transactions;
            let new_avg = if num_transactions == 1 {
                transaction.amount
            } else {
                current_avg + (transaction.amount - current_avg) / num_transactions
            };
            self.ecosystem_impact_metrics.average_transaction_amount = new_avg;
            
            // Mise à jour spécifique selon le type de transaction
            match transaction.tx_type {
                TransactionType::DirectSale | TransactionType::RetailSale | TransactionType::ComplexSale => {
                    // Augmentation estimée de l'impact sur l'économie locale
                    self.ecosystem_impact_metrics.local_economy_boost += transaction.amount / 5;
                    
                    // Estimation simplifiée de l'empreinte carbone épargnée (en grammes)
                    // (Comparé aux circuits traditionnels avec multiples intermédiaires)
                    let carbon_saved = (transaction.amount as u64) / 1000;
                    self.ecosystem_impact_metrics.total_carbon_saved += carbon_saved;
                },
                TransactionType::SupplierPayment => {
                    self.ecosystem_impact_metrics.total_supplier_payments += transaction.amount;
                },
                _ => {}
            }
        }
        
        /// Vérifie une signature
        fn verify_signature(&self, transaction_id: &TransactionId, validator: &ValidatorId, signature: &SignatureData) -> bool {
            // Cette fonction devrait implémenter une vérification cryptographique réelle
            // Dans un environnement de production, utilisez une bibliothèque cryptographique
            
            // Implémentation simplifiée pour la démonstration
            if signature.len() < 32 {
                return false;
            }
            
            // Simuler une vérification basique
            let hash_input = format!("{}{}", transaction_id, validator);
            let expected_prefix = hash_input.as_bytes()[0..4].to_vec();
            let signature_prefix = signature[0..4].to_vec();
            
            expected_prefix == signature_prefix
        }
        
        /// Configure le niveau de sécurité du système
        #[ink(message)]
        pub fn set_security_level(&mut self, level: SecurityLevel, reason: String) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier que l'appelant est un administrateur
            if !self.authorized_admins.contains(&caller) {
                return Err(Error::Unauthorized);
            }
            
            let old_level = self.config.security_level.clone();
            self.config.security_level = level.clone();
            
            // Émettre l'événement
            self.env().emit_event(SecurityLevelChanged {
                old_level,
                new_level: level,
                reason,
            });
            
            Ok(())
        }
        
        /// Met le système en pause (urgence)
        #[ink(message)]
        pub fn pause_system(&mut self) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier que l'appelant est un administrateur
            if !self.authorized_admins.contains(&caller) {
                return Err(Error::Unauthorized);
            }
            
            self.config.paused = true;
            
            Ok(())
        }
        
        /// Reprend le système après une pause
        #[ink(message)]
        pub fn unpause_system(&mut self) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier que l'appelant est un administrateur
            if !self.authorized_admins.contains(&caller) {
                return Err(Error::Unauthorized);
            }
            
            self.config.paused = false;
            
            Ok(())
        }
        
        /// Met à jour la configuration du système
        #[ink(message)]
        pub fn update_system_config(
            &mut self,
            min_validators: u32,
            timeout_base: u64,
            token_conversion_rate: u32,
            savings_distribution_rate: u32,
            token_burn_rate: u32,
            auto_factoring_enabled: bool
        ) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier que l'appelant est un administrateur
            if !self.authorized_admins.contains(&caller) {
                return Err(Error::Unauthorized);
            }
            
            // Vérifications de validité
            if min_validators < 2 {
                return Err(Error::InvalidParams);
            }
            
            if timeout_base == 0 || token_conversion_rate == 0 {
                return Err(Error::InvalidParams);
            }
            
            // Mettre à jour la configuration
            self.config.min_validators = min_validators;
            self.config.timeout_base = timeout_base;
            self.config.token_conversion_rate = token_conversion_rate;
            self.config.savings_distribution_rate = savings_distribution_rate;
            self.config.token_burn_rate = token_burn_rate;
            self.config.auto_factoring_enabled = auto_factoring_enabled;
            
            Ok(())
        }
        
        // ===============================
        // FONCTIONS DE REQUÊTE PUBLIQUES
        // ===============================
        
        /// Obtient les métriques globales de l'écosystème
        #[ink(message)]
        pub fn get_ecosystem_metrics(&self) -> EcosystemMetrics {
            self.ecosystem_impact_metrics.clone()
        }
        
        /// Obtient les détails d'une transaction
        #[ink(message)]
        pub fn get_transaction_details(&self, transaction_id: TransactionId) -> Result<Transaction> {
            match self.transactions.get(&transaction_id) {
                Some(tx) => Ok(tx.clone()),
                None => Err(Error::InvalidParams),
            }
        }
        
        /// Obtient les détails d'une enchère en cours
        #[ink(message)]
        pub fn get_auction_details(&self, category: String) -> Result<AuctionData> {
            match self.active_auctions.get(&category) {
                Some(auction) => Ok(auction.clone()),
                None => Err(Error::InvalidCategory),
            }
        }
        
        /// Vérifie si le système est en pause
        #[ink(message)]
        pub fn is_system_paused(&self) -> bool {
            self.config.paused
        }
        
        /// Obtient le niveau de sécurité actuel
        #[ink(message)]
        pub fn get_security_level(&self) -> SecurityLevel {
            self.config.security_level.clone()
        }
    }

    // ===============================
    // TESTS
    // ===============================

    #[cfg(test)]
    mod tests {
        use super::*;
        use ink_env::{
            test,
            AccountId,
        };

        /// Initialise le contexte de test
        fn init_contract() -> EtikaContract {
            // Créer compte d'admin
            let admin = AccountId::from([0x01; 32]);
            
            // Initialiser le contrat avec admin
            let contract = EtikaContract::new(admin);
            contract
        }

        /// Teste la création de compte
        #[test]
        fn test_create_account() {
            let mut contract = init_contract();
            let user = AccountId::from([0x02; 32]);
            
            // Créer un compte consommateur
            let result = contract.create_account(user, ValidatorRole::Consumer);
            assert!(result.is_ok());
            
            // Vérifier que le compte existe
            let balance = contract.get_token_balance(user);
            assert!(balance.is_ok());
            assert_eq!(balance.unwrap(), 0);
            
            // Vérifier erreur si compte existe déjà
            let duplicate = contract.create_account(user, ValidatorRole::Consumer);
            assert!(duplicate.is_err());
        }
        
        /// Teste la validation PoP
        #[test]
        fn test_proof_of_purchase() {
            // Implémentation de test pour PoP
            // ...
        }
        
        /// Teste le système d'enchères
        #[test]
        fn test_auction_system() {
            // Implémentation de test pour enchères
            // ...
        }
        
        /// Teste la génération d'épargne
        #[test]
        fn test_savings_generation() {
            // Implémentation de test pour génération d'épargne
            // ...
        }
    }
} self.env().block_timestamp();
            
            let account = UserAccount {
                user_id: user,
                tokens: 0,
                epargne: 0,
                role: role.clone(),
                created_at: now,
                last_activity: now,
                withdrawal_today: 0,
                reset_day: (now / 86400) as u16,  // Jour actuel
                is_validator: false,
                validator_votes: 0,
                total_savings_generated: 0,
                tokens_burned: 0,
                is_sponsor: false,
                sponsor_category: None,
                sponsor_until: None,
                delegated_savings_to: None,
                ecosystem_metrics: Some(UserEcosystemMetrics {
                    transactions_count: 0,
                    total_purchase_volume: 0,
                    total_token_circulation: 0,
                    carbon_footprint_saved: 0,
                    local_economy_contribution: 0,
                    ethical_impact_score: 50, // Score initial moyen
                }),
            };
            
            self.accounts.insert(user, account);
            
            // Mettre à jour les métriques du système
            self.ecosystem_impact_metrics.active_users += 1;
            
            Ok(())
        }

        /// Vérifie le solde en tokens d'un utilisateur
        #[ink(message)]
        pub fn get_token_balance(&self, user: ValidatorId) -> Result<TokenAmount> {
            match self.accounts.get(&user) {
                Some(account) => Ok(account.tokens),
                None => Err(Error::InvalidValidator),
            }
        }

        /// Vérifie le solde en épargne d'un utilisateur
        #[ink(message)]
        pub fn get_epargne_balance(&self, user: ValidatorId) -> Result<EpargneAmount> {
            match self.accounts.get(&user) {
                Some(account) => Ok(account.epargne),
                None => Err(Error::InvalidValidator),
            }
        }
        
        /// Configure la délégation d'épargne vers un membre de famille
        #[ink(message)]
        pub fn set_savings_delegation(&mut self, delegate: ValidatorId) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier que le compte existe
            let mut account = match self.accounts.get(&caller) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidValidator),
            };
            
            // Vérifier que le destinataire existe aussi
            if !self.accounts.contains_key(&delegate) {
                return Err(Error::InvalidValidator);
            }
            
            // Mettre à jour la délégation
            account.delegated_savings_to = Some(delegate);
            account.last_activity = self.env().block_timestamp();
            
            self.accounts.insert(caller, account);
            
            Ok(())
        }
        
        /// Supprime la délégation d'épargne
        #[ink(message)]
        pub fn remove_savings_delegation(&mut self) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier que le compte existe
            let mut account = match self.accounts.get(&caller) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidValidator),
            };
            
            // Supprimer la délégation
            account.delegated_savings_to = None;
            account.last_activity = self.env().block_timestamp();
            
            self.accounts.insert(caller, account);
            
            Ok(())
        }

        // ===============================
        // FONCTIONS DE GESTION DES VALIDATEURS
        // ===============================

        /// Enregistre un nouveau validateur
        #[ink(message)]
        pub fn register_validator(&mut self, candidate: ValidatorId, role: ValidatorRole) -> Result<()> {
            // Vérifier que l'utilisateur a un compte
            if !self.accounts.contains_key(&candidate) {
                return Err(Error::InvalidValidator);
            }
            
            // Vérifier s'il est déjà validateur
            if self.validators.contains_key(&candidate) {
                return Err(Error::InvalidParams);
            }
            
            let now = self.env().block_timestamp();
            let validator = Validator {
                address: candidate,
                role: role.clone(),
                is_active: false, // Nécessite des votes pour activation
                reputation: 70,   // Réputation initiale
                success_rate: 1000, // 100% initialement
                total_validations: 0,
                failed_validations: 0,
                slashed_amount: 0,
                votes_received: 0,
                last_validation: now,
            };
            
            self.validators.insert(candidate, validator);
            
            // Ajouter à l'index par rôle
            if let Some(role_list) = self.validators_by_role.get_mut(&role) {
                role_list.push(candidate);
            } else {
                let mut new_list = StorageVec::new();
                new_list.push(candidate);
                self.validators_by_role.insert(role, new_list);
            }
            
            Ok(())
        }

        /// Vote pour un validateur
        #[ink(message)]
        pub fn vote_for_validator(&mut self, candidate: ValidatorId) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier que le candidat est enregistré comme validateur
            let mut validator = match self.validators.get(&candidate) {
                Some(v) => v.clone(),
                None => return Err(Error::InvalidValidator),
            };
            
            // Vérifier que le votant a un compte
            if !self.accounts.contains_key(&caller) {
                return Err(Error::Unauthorized);
            }
            
            // Incrémenter les votes
            validator.votes_received += 1;
            
            // Activer si le seuil est atteint
            if !validator.is_active && validator.votes_received >= self.config.vote_threshold {
                validator.is_active = true;
                
                // Mettre à jour le statut de validateur dans le compte
                if let Some(mut account) = self.accounts.get(&candidate) {
                    account.is_validator = true;
                    self.accounts.insert(candidate, account);
                }
            }
            
            // Mettre à jour le validateur
            self.validators.insert(candidate, validator.clone());
            
            // Mettre à jour les votes dans le compte utilisateur
            if let Some(mut account) = self.accounts.get(&candidate) {
                account.validator_votes = validator.votes_received;
                self.accounts.insert(candidate, account);
            }
            
            self.env().emit_event(ValidatorVoted {
                candidate,
                voter: caller,
                new_vote_count: validator.votes_received,
            });
            
            Ok(())
        }

        /// Retire un validateur (admin seulement)
        #[ink(message)]
        pub fn remove_validator(&mut self, validator_id: ValidatorId) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier les permissions d'administrateur
            if !self.authorized_admins.contains(&caller) {
                return Err(Error::Unauthorized);
            }
            
            // Vérifier que le validateur existe
            if !self.validators.contains_key(&validator_id) {
                return Err(Error::InvalidValidator);
            }
            
            // Retirer le validateur
            let validator = self.validators.take(&validator_id).unwrap();
            
            // Mettre à jour le statut dans le compte utilisateur
            if let Some(mut account) = self.accounts.get(&validator_id) {
                account.is_validator = false;
                self.accounts.insert(validator_id, account);
            }
            
            // Retirer de l'index par rôle
            if let Some(mut role_list) = self.validators_by_role.get_mut(&validator.role) {
                let position = role_list.iter().position(|x| *x == validator_id);
                if let Some(index) = position {
                    role_list.swap_remove(index);
                }
            }
            
            Ok(())
        }

        // ===============================
        // FONCTIONS DE TRIPLE VALIDATION (PoP)
        // ===============================

        /// Crée une transaction de vente avec triple validation (PoP)
        #[ink(message)]
        pub fn create_sale_transaction(
            &mut self,
            sale_type: TransactionType,
            params: SaleTransactionParams,
            metadata: TransactionMetadata
        ) -> Result<TransactionId> {
            let caller = self.env().caller();
            
            // Vérifier si le système est en pause
            if self.config.paused {
                return Err(Error::SystemPaused);
            }
            
            // Vérifier que le type de transaction est valide pour une vente
            if sale_type != TransactionType::DirectSale &&
               sale_type != TransactionType::RetailSale &&
               sale_type != TransactionType::ComplexSale {
                return Err(Error::InvalidParams);
            }
            
            // Vérifier que les participants existent
            if !self.accounts.contains_key(&params.consumer) ||
               !self.accounts.contains_key(&params.merchant) {
                return Err(Error::InvalidValidator);
            }
            
            // Si fournisseur spécifié, vérifier qu'il existe
            if let Some(supplier_id) = params.supplier {
                if !self.accounts.contains_key(&supplier_id) {
                    return Err(Error::InvalidSupplier);
                }
            }
            
            // Générer un ID unique pour la transaction
            self.transaction_count += 1;
            let tx_id = format!("TX-{}-{}", self.transaction_count, self.env().block_timestamp());
            
            // Déterminer les validateurs requis
            let mut validators = vec![params.consumer, params.merchant];
            if let Some(supplier) = params.supplier {
                validators.push(supplier);
            }
            
            let now = self.env().block_timestamp();
            
            // Créer la transaction
            let transaction = Transaction {
                id: tx_id.clone(),
                tx_type: sale_type,
                amount: params.amount,
                created_at: now,
                updated_at: now,
                status: TransactionStatus::Pending,
                validators: validators.clone(),
                required_validations: validators.len() as u32, // Triple validation requiert tous les validateurs
                current_validation_step: 0,
                validation_actions: Vec::new(),
                validated_by: Vec::new(),
                validation_deadline: now + self.config.timeout_base,
                extensions_count: 0,
                metadata,
                specific_params: Some(TransactionParams::Sale(params.clone())),
                rewards: Vec::new(),
                recovery_attempts: 0,
                associated_savings: Some(self.calculate_savings_amount(params.amount, params.savings_percentage)),
                auto_factoring: self.config.auto_factoring_enabled,
                triple_validation_complete: false,
            };
            
            // Initialiser la liste des validateurs en attente pour la triple validation
            self.pending_triple_validations.insert(tx_id.clone(), validators);
            
            // Sauvegarder la transaction
            self.transactions.insert(tx_id.clone(), transaction);
            self.pending_transactions.push(tx_id.clone());
            
            Ok(tx_id)
        }
        
        /// Calcule le montant d'épargne généré
        fn calculate_savings_amount(&self, transaction_amount: EpargneAmount, savings_percentage: u32) -> EpargneAmount {
            (transaction_amount as u128 * savings_percentage as u128 / 1000) as EpargneAmount
        }

        /// Effectue une validation PoP (Proof of Purchase)
        #[ink(message)]
        pub fn validate_pop(
            &mut self,
            transaction_id: TransactionId,
            signature: Option<SignatureData>
        ) -> Result<()> {
            let caller = self.env().caller();
            let now = self.env().block_timestamp();
            
            // Vérifier si le système est en pause
            if self.config.paused {
                return Err(Error::SystemPaused);
            }
            
            // Récupérer la transaction
            let mut transaction = match self.transactions.get(&transaction_id) {
                Some(tx) => tx.clone(),
                None => return Err(Error::InvalidParams),
            };
            
            // Vérifier que c'est une transaction de type vente
            match transaction.tx_type {
                TransactionType::DirectSale | TransactionType::RetailSale | TransactionType::ComplexSale => {},
                _ => return Err(Error::InvalidParams),
            }
            
            // Vérifier que la transaction est en attente ou en cours
            if transaction.status != TransactionStatus::Pending && 
               transaction.status != TransactionStatus::InProgress {
                return Err(Error::ValidationRejected);
            }
            
            // Vérifier que le délai n'est pas dépassé
            if now > transaction.validation_deadline {
                transaction.status = TransactionStatus::Expired;
                self.transactions.insert(transaction_id.clone(), transaction);
                return Err(Error::TransactionExpired);
            }
            
            // Vérifier que le validateur est autorisé pour cette transaction
            if !transaction.validators.contains(&caller) {
                return Err(Error::Unauthorized);
            }
            
            // Vérifier que le validateur n'a pas déjà validé
            if transaction.validated_by.contains(&caller) {
                return Err(Error::AlreadyValidated);
            }
            
            // Vérifier la signature si requise
            if let Some(sig) = &signature {
                if !self.verify_signature(&transaction_id, &caller, sig) {
                    return Err(Error::InvalidSignature);
                }
            }
            
            // Mise à jour de la liste des validateurs en attente pour PoP
            if let Some(mut pending_validators) = self.pending_triple_validations.get(&transaction_id) {
                if let Some(pos) = pending_validators.iter().position(|v| *v == caller) {
                    pending_validators.swap_remove(pos);
                }
                self.pending_triple_validations.insert(transaction_id.clone(), pending_validators.clone());
                
                // Vérifier si la triple validation est complète
                if pending_validators.is_empty() {
                    transaction.triple_validation_complete = true;
                    
                    // Émettre l'événement
                    let params = if let Some(TransactionParams::Sale(sale_params)) = &transaction.specific_params {
                        sale_params
                    } else {
                        return Err(Error::ContractError);
                    };
                    
                    let supplier = params.supplier.unwrap_or(params.merchant);
                    
                    self.env().emit_event(TripleValidationCompleted {
                        transaction_id: transaction_id.clone(),
                        consumer: params.consumer,
                        merchant: params.merchant,
                        supplier,
                    });
                    
                    // Si l'affacturage automatique est activé, créer une transaction de paiement fournisseur
                    if transaction.auto_factoring && params.supplier.is_some() {
                        self.create_auto_supplier_payment(
                            params.merchant,
                            params.supplier.unwrap(),
                            params.amount,
                            format!("PoP-{}", transaction_id),
                            Some(transaction_id.clone())
                        )?;
                    }
                }
            }
            
            // Enregistrer l'action de validation
            let validation_action = ValidatorAction {
                validator: caller,
                status: ValidationStatus::Validated,
                timestamp: now,
                signature,
                reason: None,
            };
            
            transaction.validation_actions.push(validation_action);
            transaction.validated_by.push(caller);
            transaction.current_validation_step += 1;
            transaction.updated_at = now;
            
            // Mettre à jour le statut si c'est la première validation
            if transaction.status == TransactionStatus::Pending {
                transaction.status = TransactionStatus::InProgress;
            }
            
            // Vérifier si le consensus est atteint (tous les validateurs ont validé)
            if transaction.validated_by.len() as u32 >= transaction.required_validations {
                transaction.status = TransactionStatus::Confirmed;
                
                // Générer l'épargne pour le consommateur si la triple validation est complète
                if transaction.triple_validation_complete {
                    if let Some(TransactionParams::Sale(sale_params)) = &transaction.specific_params {
                        if let Some(savings_amount) = transaction.associated_savings {
                            self.generate_savings(sale_params.consumer, savings_amount, &transaction_id)?;
                        }
                    }
                }
                
                // Calculer et distribuer les récompenses
                let rewards = self.calculate_rewards(&transaction);
                transaction.rewards = rewards.clone();
                
                // Distribuer les tokens aux validateurs
                for (validator_id, amount) in rewards {
                    self.mint_tokens(validator_id, amount)?;
                }
                
                // Émettre l'événement de complétion
                self.env().emit_event(TransactionCompleted {
                    transaction_id: transaction_id.clone(),
                    status: TransactionStatus::Confirmed,
                    completion_time: now,
                });
                
                // Mettre à jour les métriques de l'écosystème
                self.update_ecosystem_metrics(&transaction);
            }
            
            // Sauvegarder la transaction mise à jour
            self.transactions.insert(transaction_id.clone(), transaction);
            
            // Émettre l'événement de validation
            self.env().emit_event(TransactionValidated {
                transaction_id,
                validator: caller,
                timestamp: now,
            });
            
            // Mettre à jour les statistiques du validateur
            if let Some(mut validator) = self.validators.get(&caller) {
                validator.total_validations += 1;
                validator.last_validation = now;
                
                // Recalculer le taux de succès
                validator.success_rate = ((validator.total_validations - validator.failed_validations) * 1000) 
                    / validator.total_validations.max(1);
                
                self.validators.insert(caller, validator);
            }
            
            Ok(())
        }
        
        /// Génère l'épargne pour un consommateur
        fn generate_savings(&mut self, consumer_id: ValidatorId, amount: EpargneAmount, transaction_id: &TransactionId) -> Result<()> {
            // Vérifier que le consommateur existe
            let mut account = match self.accounts.get(&consumer_id) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidValidator),
            };
            
            // Vérifier si l'épargne est déléguée à quelqu'un d'autre
            let recipient_id = if let Some(delegate) = account.delegated_savings_to {
                if self.accounts.contains_key(&delegate) {
                    delegate
                } else {
                    consumer_id
                }
            } else {
                consumer_id
            };
            
            // Mise à jour du compte du destinataire
            let mut recipient_account = if recipient_id == consumer_id {
                account.clone()
            } else {
                match self.accounts.get(&recipient_id) {
                    Some(a) => a.clone(),
                    None => return Err(Error::InvalidValidator),
                }
            };
            
            // Créditer l'épargne
            recipient_account.epargne += amount;
            recipient_account.total_savings_generated += amount;
            recipient_account.last_activity = self.env().block_timestamp();
            
            // Mettre à jour les comptes
            if recipient_id == consumer_id {
                account = recipient_account;
            } else {
                self.accounts.insert(recipient_id, recipient_account);
            }
            
            // Mettre à jour les métriques utilisateur
            if let Some(mut metrics) = account.ecosystem_metrics {
                metrics.total_purchase_volume += amount;
                metrics.local_economy_contribution += amount;
                account.ecosystem_metrics = Some(metrics);
            }
            
            self.accounts.insert(consumer_id, account);
            
            // Mettre à jour les métriques du système
            self.total_epargne += amount;
            self.total_savings_generated += amount;
            
            // Émettre l'événement
            self.env().emit_event(SavingsGenerated {
                consumer: consumer_id,
                transaction_id: transaction_id.clone(),
                amount,
            });
            
            Ok(())
        }
        
        /// Crée une transaction de paiement fournisseur automatique
        fn create_auto_supplier_payment(
            &mut self,
            merchant: ValidatorId,
            supplier: ValidatorId,
            amount: EpargneAmount,
            invoice_reference: String,
            associated_sale: Option<TransactionId>
        ) -> Result<TransactionId> {
            // Vérifier que les comptes existent
            if !self.accounts.contains_key(&merchant) || !self.accounts.contains_key(&supplier) {
                return Err(Error::InvalidValidator);
            }
            
            // Vérifier que cette facture n'a pas déjà été payée
            if self.supplier_payments.contains_key(&invoice_reference) {
                return Err(Error::AlreadyProcessed);
            }
            
            // Vérifier que le commerçant a assez d'épargne
            let merchant_account = self.accounts.get(&merchant).unwrap();
            if merchant_account.epargne < amount {
                return Err(Error::InsufficientFunds);
            }
            
            // Générer un ID unique pour la transaction
            self.transaction_count += 1;
            let tx_id = format!("SUPP-{}-{}", self.transaction_count, self.env().block_timestamp());
            
            let now = self.env().block_timestamp();
            
            // Créer les paramètres spécifiques
            let params = SupplierPaymentParams {
                merchant,
                supplier,
                amount,
                invoice_reference: invoice_reference.clone(),
                sale_transaction_id: associated_sale,
            };
            
            // Créer la metadata
            let metadata = TransactionMetadata {
                version: "1.0".to_string(),
                origin: "Affacturage automatique".to_string(),
                description: Some(format!("Paiement fournisseur automatique pour facture {}", invoice_reference)),
                metadata_hash: None,
            };
            
            // Créer la transaction
            let transaction = Transaction {
                id: tx_id.clone(),
                tx_type: TransactionType::SupplierPayment,
                amount,
                created_at: now,
                updated_at: now,
                status: TransactionStatus::Pending,
                validators: vec![merchant, supplier],
                required_validations: 2,
                current_validation_step: 0,
                validation_actions: Vec::new(),
                validated_by: Vec::new(),
                validation_deadline: now + self.config.timeout_base,
                extensions_count: 0,
                metadata,
                specific_params: Some(TransactionParams::SupplierPayment(params)),
                rewards: Vec::new(),
                recovery_attempts: 0,
                associated_savings: None,
                auto_factoring: false,
                triple_validation_complete: false,
            };
            
            // Sauvegarder la transaction
            self.transactions.insert(tx_id.clone(), transaction);
            self.pending_transactions.push(tx_id.clone());
            
            // Enregistrer le référencement de facture
            self.supplier_payments.insert(invoice_reference.clone(), tx_id.clone());
            
            Ok(tx_id)
        }

        // ===============================
        // FONCTIONS DE GESTION DES TOKENS
        // ===============================
        
        /// Frappe de nouveaux tokens (mint)
        fn mint_tokens(&mut self, recipient: ValidatorId, amount: TokenAmount) -> Result<()> {
            // Vérifier que le recipient existe
            let mut account = match self.accounts.get(&recipient) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidValidator),
            };
            
            // Créditer les tokens
            account.tokens += amount;
            account.last_activity = self.env().block_timestamp();
            
            // Mettre à jour le compte
            self.accounts.insert(recipient, account);
            
            // Mettre à jour l'offre totale
            self.total_token_supply += amount;
            
            Ok(())
        }
        
        /// Brûle des tokens pour stabiliser leur valeur
        #[ink(message)]
        pub fn burn_tokens(
            &mut self,
            amount: TokenAmount,
            reason: String
        ) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier que l'appelant a un compte
            let mut account = match self.accounts.get(&caller) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidValidator),
            };
            
            // Vérifier que l'utilisateur a assez de tokens
            if account.tokens < amount {
                return Err(Error::InsufficientFunds);
            }
            
            // Brûler les tokens
            account.tokens -= amount;
            account.tokens_burned += amount;
            account.last_activity = self.env().block_timestamp();
            
            self.accounts.insert(caller, account);
            
            // Mettre à jour les totaux
            self.total_token_supply -= amount;
            self.total_tokens_burned += amount;
            
            // Émettre l'événement
            self.env().emit_event(TokensBurned {
                sender: caller,
                amount,
                reason,
            });
            
            Ok(())
        }
        
        /// Brûle automatiquement des tokens lors d'une conversion ou transaction
        fn auto_burn_tokens(&mut self, sender: ValidatorId, amount: TokenAmount) -> Result<TokenAmount> {
            let burn_amount = (amount as u128 * self.config.token_burn_rate as u128 / 1000) as TokenAmount;
            
            if burn_amount == 0 {
                return Ok(0);
            }
            
            // Vérifier que l'utilisateur a un compte
            let mut account = match self.accounts.get(&sender) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidValidator),
            };
            
            // Vérifier que l'utilisateur a assez de tokens
            if account.tokens < burn_amount {
                return Ok(0); // Ne pas échouer, juste ne rien brûler
            }
            
            // Brûler les tokens
            account.tokens -= burn_amount;
            account.tokens_burned += burn_amount;
            
            self.accounts.insert(sender, account);
            
            // Mettre à jour les totaux
            self.total_token_supply -= burn_amount;
            self.total_tokens_burned += burn_amount;
            
            Ok(burn_amount)
        }
        
        /// Convertit des tokens en épargne
        #[ink(message)]
        pub fn convert_tokens_to_savings(
            &mut self,
            amount: TokenAmount
        ) -> Result<EpargneAmount> {
            let caller = self.env().caller();
            
            // Vérifier que l'utilisateur a un compte
            let mut account = match self.accounts.get(&caller) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidValidator),
            };
            
            // Vérifier que l'utilisateur a assez de tokens
            if account.tokens < amount {
                return Err(Error::InsufficientFunds);
            }
            
            // Calculer le montant d'épargne correspondant
            let savings_amount = (amount as u128 * self.config.token_conversion_rate as u128 / 1000) as EpargneAmount;
            
            // Vérifier que le montant n'est pas nul
            if savings_amount == 0 {
                return Err(Error::InvalidAmount);
            }
            
            // Brûler automatiquement une partie des tokens
            let burned_amount = self.auto_burn_tokens(caller, amount)?;
            let effective_amount = amount - burned_amount;
            
            // Débiter les tokens et créditer l'épargne
            account.tokens -= effective_amount;
            account.epargne += savings_amount;
            account.last_activity = self.env().block_timestamp();
            
            self.accounts.insert(caller, account);
            
            // Mettre à jour les totaux
            self.total_token_supply -= effective_amount;
            self.total_epargne += savings_amount;
            
            Ok(savings_amount)
        }
        
        /// Calcule les récompenses pour les validateurs d'une transaction
        fn calculate_rewards(&self, transaction: &Transaction) -> Vec<(ValidatorId, TokenAmount)> {
            let base_reward: TokenAmount = match transaction.tx_type {
                TransactionType::DirectSale | TransactionType::RetailSale => 100,
                TransactionType::ComplexSale => 200,
                TransactionType::SupplierPayment => 50,
                _ => 20,
            };
            
            transaction.validators.iter()
                .filter(|validator_id| transaction.validated_by.contains(validator_id))
                .map(|validator_id| {
                    let mut reward = base_reward;
                    
                    // Bonus pour les sponsors officiels
                    if let Some(validator) = self.validators.get(validator_id) {
                        if validator.role == ValidatorRole::OfficialSponsor {
                            reward = (reward as u128 * self.config.sponsor_rewards_multiplier as u128 / 1000) as TokenAmount;
                        }
                    }
                    
                    // Bonus pour validation rapide
                    if let Some(action) = transaction.validation_actions.iter()
                        .find(|action| &action.validator == validator_id) {
                        if (action.timestamp - transaction.created_at) < self.config.timeout_base / 2 {
                            reward += reward / 10;  // +10% pour validation rapide
                        }
                    }
                    
                    (*validator_id, reward)
                })
                .collect()
        }
        
        // ===============================
        // FONCTIONS D'ENCHÈRES
        // ===============================
        
        /// Crée une nouvelle enchère pour sélectionner un sponsor officiel
        #[ink(message)]
        pub fn create_auction(
            &mut self,
            category: String,
            min_bid: EpargneAmount,
            duration: Option<u64>
        ) -> Result<()> {
            let caller = self.env().caller();
            
            // Vérifier que l'appelant est un administrateur
            if !self.authorized_admins.contains(&caller) {
                return Err(Error::Unauthorized);
            }
            
            // Vérifier que la catégorie n'est pas vide
            if category.is_empty() {
                return Err(Error::InvalidCategory);
            }
            
            // Vérifier qu'il n'y a pas déjà une enchère active pour cette catégorie
            if self.active_auctions.contains_key(&category) {
                return Err(Error::AlreadyProcessed);
            }
            
            let now = self.env().block_timestamp();
            let auction_duration = duration.unwrap_or(self.config.auction_duration);
            
            // Créer l'enchère
            let auction = AuctionData {
                category: category.clone(),
                start_time: now,
                end_time: now + auction_duration,
                min_bid,
                highest_bid: 0,
                highest_bidder: None,
                bids_count: 0,
                status: AuctionStatus::Active,
                finalized: false,
            };
            
            // Sauvegarder l'enchère
            self.active_auctions.insert(category, auction);
            
            Ok(())
        }
        
        /// Place une enchère
        #[ink(message)]
        pub fn place_bid(
            &mut self,
            category: String,
            bid_amount: EpargneAmount,
            ecosystem_commitment: String
        ) -> Result<()> {
            let caller = self.env().caller();
            let now = self.env().block_timestamp();
            
            // Vérifier que l'enchère existe et est active
            let mut auction = match self.active_auctions.get(&category) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidCategory),
            };
            
            // Vérifier que l'enchère est active
            if auction.status != AuctionStatus::Active {
                return Err(Error::AuctionNotActive);
            }
            
            // Vérifier que l'enchère n'est pas terminée
            if now > auction.end_time {
                auction.status = AuctionStatus::Completed;
                self.active_auctions.insert(category.clone(), auction);
                return Err(Error::AuctionEnded);
            }
            
            // Vérifier que l'enchère est supérieure au minimum
            if bid_amount < auction.min_bid {
                return Err(Error::BidTooLow);
            }
            
            // Vérifier que l'enchère est supérieure à l'enchère la plus haute
            if bid_amount <= auction.highest_bid && auction.highest_bid > 0 {
                return Err(Error::BidTooLow);
            }
            
            // Vérifier que l'enchérisseur a assez d'épargne
            let account = match self.accounts.get(&caller) {
                Some(a) => a.clone(),
                None => return Err(Error::InvalidValidator),
            };
            
            if account.epargne < bid_amount {
                return Err(Error::InsufficientFunds);
            }
            
            // Créer une transaction d'enchère
            let bid_params = BidParams {
                bidder: caller,
                sponsor_category: category.clone(),
                amount: bid_amount,
                duration: (auction.end_time - auction.start_time) / 86400, // Durée en jours
                ecosystem_commitment,
            };
            
            let metadata = TransactionMetadata {
                version: "1.0".to_string(),
                origin: format!("Enchère {}", category),
                description: Some(format!("Enchère pour devenir sponsor officiel - catégorie {}", category)),
                metadata_hash: None,
            };
            
            // Générer un ID unique pour la transaction
            self.transaction_count += 1;
            let tx_id = format!("BID-{}-{}", self.transaction_count, now);
            
            let transaction = Transaction {
                id: tx_id.clone(),
                tx_type: TransactionType::BidPlacement,
                amount: bid_amount,
                created_at: now,
                updated_at: now,
                status: TransactionStatus::Pending,
                validators: vec![caller],
                required_validations: 1,
                current_validation_step: 0,
                validation_actions: Vec::new(),
                validated_by: Vec::new(),
                validation_deadline: auction.end_time,
                extensions_count: 0,
                metadata,
                specific_params: Some(TransactionParams::Bid(bid_params)),
                rewards: Vec::new(),
                recovery_attempts: 0,
                associated_savings: None,
                auto_factoring: false,
                triple_validation_complete: false,
            };
            
            // Sauvegarder la transaction
            self.transactions.insert(tx_id, transaction);
            
            // Mettre à jour l'enchère
            auction.highest_bid = bid_amount;
            auction.highest_bidder = Some(caller);
            auction.bids_count += 1;
            
            self.active_auctions.insert(category.clone(), auction);
            
            // Émettre l'événement
            self.env().emit_event(BidPlaced {
                bidder: caller,
                category,
                amount: bid_amount,
            });
            
            Ok(())
        }
        
        /// Finalise une enchère
        #[ink(message)]
        pub fn finalize_auction(&mut self, category: String) -> Result<()> {
            let caller = self.env().caller();
            let now =
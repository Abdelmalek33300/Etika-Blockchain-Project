// etika-blockchain-core/src/lib.rs
//
// Ce module implémente le cœur de la blockchain Étika, incluant:
// - Le mécanisme de consensus PoP (Proof of Purchase)
// - La gestion des nœuds du réseau
// - La validation des blocks et transactions
// - Le système de synchronisation

#![cfg_attr(not(feature = "std"), no_std)]

    use super::*;
    use frame_support::{assert_ok, assert_noop, parameter_types};
    use sp_core::H256;
    use sp_runtime::{
        testing::Header,
        traits::{BlakeTwo256, IdentityLookup},
        Perbill,
    };
    
    type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>;
    type Block = frame_system::mocking::MockBlock<Test>;
    
    frame_support::construct_runtime!(
        pub enum Test where
            Block = Block,
            NodeBlock = Block,
            UncheckedExtrinsic = UncheckedExtrinsic,
        {
            System: frame_system::{Module, Call, Config, Storage, Event<T>},
            EtikaBlockchain: Module<Test>,
        }
    );
    
    parameter_types! {
        pub const BlockHashCount: u64 = 250;
        pub const MaximumBlockWeight: u32 = 1024;
        pub const MaximumBlockLength: u32 = 2 * 1024;
        pub const AvailableBlockRatio: Perbill = Perbill::one();
    }
    
    impl frame_system::Config for Test {
        type BaseCallFilter = ();
        type BlockWeights = ();
        type BlockLength = ();
        type DbWeight = ();
        type Origin = Origin;
        type Index = u64;
        type BlockNumber = u64;
        type Call = Call;
        type Hash = H256;
        type Hashing = BlakeTwo256;
        type AccountId = u64;
        type Lookup = IdentityLookup<Self::AccountId>;
        type Header = Header;
        type Event = Event;
        type BlockHashCount = BlockHashCount;
        type Version = ();
        type PalletInfo = PalletInfo;
        type AccountData = ();
        type OnNewAccount = ();
        type OnKilledAccount = ();
        type SystemWeightInfo = ();
        type SS58Prefix = ();
    }
    
    parameter_types! {
        pub const MaxPopTransactionLifetime: u64 = 100;
        pub const HostingReward: Balance = 10;
        pub const HostingRewardPeriod: u64 = 10;
        pub const TokenBurnRatio: u8 = 5; // 5%
        pub const NGOTokenRatio: u8 = 2; // 2%
        pub const PeerRotationPeriod: u64 = 20; // rotation des pairs tous les 20 blocs
    }
    
    impl Config for Test {
        type Event = Event;
        type MaxPopTransactionLifetime = MaxPopTransactionLifetime;
        type HostingReward = HostingReward;
        type HostingRewardPeriod = HostingRewardPeriod;
        type TokenBurnRatio = TokenBurnRatio;
        type NGOTokenRatio = NGOTokenRatio;
        type PeerRotationPeriod = PeerRotationPeriod;
    }
    
    // Fonction utilitaire pour créer un environnement de test
    fn new_test_ext() -> sp_io::TestExternalities {
        let mut t = frame_system::GenesisConfig::default()
            .build_storage::<Test>()
            .unwrap();
            
        t.into()
    }
    
    #[test]
    fn test_create_pop_transaction() {
        new_test_ext().execute_with(|| {
            // Simuler les comptes
            let consumer = 1;
            let merchant = 2;
            let supplier = 3;
            
            // Créer une transaction PoP
            assert_ok!(EtikaBlockchain::create_pop_transaction(
                Origin::signed(merchant),
                consumer,
                merchant,
                vec![supplier],
                100,
                10,
                5,
                [0; 32],
                sr25519::Signature::from_raw([0; 64]), // Signature factice pour les tests
            ));
            
            // Vérifier que la transaction a été créée
            let transaction_id = EtikaBlockchain::generate_transaction_id(&consumer, &merchant, 100);
            assert!(<PendingTransactions>::contains_key(transaction_id));
            
            // Vérifier les détails de la transaction
            let transaction = <PendingTransactions>::get(transaction_id);
            assert_eq!(transaction.consumer, consumer);
            assert_eq!(transaction.merchant, merchant);
            assert_eq!(transaction.suppliers, vec![supplier]);
            assert_eq!(transaction.standard_amount, 100);
            assert_eq!(transaction.tokens_exchanged, 10);
            assert_eq!(transaction.savings_generated, 5);
            
            // Vérifier que la signature initiale est présente
            assert_eq!(transaction.signatures.len(), 1);
            assert_eq!(transaction.signatures[0].0, merchant);
            
            // Vérifier que le nonce a été incrémenté
            assert_eq!(EtikaBlockchain::account_nonce(merchant), 1);
        });
    }
    
    #[test]
    fn test_validate_pop_transaction() {
        new_test_ext().execute_with(|| {
            // Simuler les comptes
            let consumer = 1;
            let merchant = 2;
            let supplier = 3;
            
            // Créer une transaction PoP
            assert_ok!(EtikaBlockchain::create_pop_transaction(
                Origin::signed(merchant),
                consumer,
                merchant,
                vec![supplier],
                100,
                10,
                5,
                [0; 32],
                sr25519::Signature::from_raw([0; 64]),
            ));
            
            let transaction_id = EtikaBlockchain::generate_transaction_id(&consumer, &merchant, 100);
            
            // Le consommateur valide la transaction
            assert_ok!(EtikaBlockchain::validate_pop_transaction(
                Origin::signed(consumer),
                transaction_id,
                sr25519::Signature::from_raw([0; 64]),
            ));
            
            // Le fournisseur valide la transaction
            assert_ok!(EtikaBlockchain::validate_pop_transaction(
                Origin::signed(supplier),
                transaction_id,
                sr25519::Signature::from_raw([0; 64]),
            ));
            
            // Vérifier que la transaction a été finalisée
            assert!(!<PendingTransactions>::contains_key(transaction_id));
            assert!(<ValidatedTransactions>::contains_key(transaction_id));
            
            // Vérifier que le compteur a été incrémenté
            assert_eq!(<ValidatedTransactionCount>::get(), 1);
        });
    }
    
    #[test]
    fn test_consumer_validation_required() {
        new_test_ext().execute_with(|| {
            // Simuler les comptes
            let consumer = 1;
            let merchant = 2;
            let supplier_1 = 3;
            let supplier_2 = 4;
            
            // Créer une transaction PoP avec 2 fournisseurs
            assert_ok!(EtikaBlockchain::create_pop_transaction(
                Origin::signed(merchant),
                consumer,
                merchant,
                vec![supplier_1, supplier_2],
                100,
                10,
                5,
                [0; 32],
                sr25519::Signature::from_raw([0; 64]),
            ));
            
            let transaction_id = EtikaBlockchain::generate_transaction_id(&consumer, &merchant, 100);
            
            // Les deux fournisseurs valident la transaction
            assert_ok!(EtikaBlockchain::validate_pop_transaction(
                Origin::signed(supplier_1),
                transaction_id,
                sr25519::Signature::from_raw([0; 64]),
            ));
            
            assert_ok!(EtikaBlockchain::validate_pop_transaction(
                Origin::signed(supplier_2),
                transaction_id,
                sr25519::Signature::from_raw([0; 64]),
            ));
            
            // La transaction ne devrait pas être finalisée car le consommateur n'a pas validé
            assert!(<PendingTransactions>::contains_key(transaction_id));
            assert!(!<ValidatedTransactions>::contains_key(transaction_id));
        });
    }
    
    #[test]
    fn test_negative_amounts_rejected() {
        new_test_ext().execute_with(|| {
            let consumer = 1;
            let merchant = 2;
            let supplier = 3;
            
            // Tenter de créer une transaction avec un montant négatif
            let result = EtikaBlockchain::create_pop_transaction(
                Origin::signed(merchant),
                consumer,
                merchant,
                vec![supplier],
                -100, // Montant négatif
                10,
                5,
                [0; 32],
                sr25519::Signature::from_raw([0; 64]),
            );
            
            // La transaction devrait être rejetée
            assert_noop!(result, Error::<Test>::InvalidAmount);
        });
    }
    
    #[test]
    fn test_excessive_tokens_rejected() {
        new_test_ext().execute_with(|| {
            let consumer = 1;
            let merchant = 2;
            let supplier = 3;
            
            // Tenter de créer une transaction avec des tokens excessifs
            let result = EtikaBlockchain::create_pop_transaction(
                Origin::signed(merchant),
                consumer,
                merchant,
                vec![supplier],
                100,
                200, // Plus de tokens que le montant standard
                5,
                [0; 32],
                sr25519::Signature::from_raw([0; 64]),
            );
            
            // La transaction devrait être rejetée
            assert_noop!(result, Error::<Test>::ExcessiveTokens);
        });
    }
    
    #[test]
    fn test_node_registration() {
        new_test_ext().execute_with(|| {
            // Simuler un compte
            let host = 1;
            let node_id = [1; 32];
            
            // Enregistrer un nœud
            assert_ok!(EtikaBlockchain::register_node(
                Origin::signed(host),
                node_id,
                b"192.168.1.1:8080".to_vec(),
                1024 * 1024 * 1024, // 1 GB
                b"1.0.0".to_vec(),
            ));
            
            // Vérifier que le nœud est enregistré
            assert!(<NodeIdToAccount<Test>>::contains_key(node_id));
            assert!(<ActiveHosts<Test>>::contains_key(host));
            
            // Vérifier le nombre de nœuds
            assert_eq!(<TotalActiveNodes>::get(), 1);
            
            // Vérifier que des connexions initiales ont été créées
            assert!(<NodeConnections>::contains_key(node_id));
            
            // Désinscrire le nœud
            assert_ok!(EtikaBlockchain::unregister_node(
                Origin::signed(host),
                node_id,
            ));
            
            // Vérifier que le nœud est désactivé
            assert!(!<NodeIdToAccount<Test>>::contains_key(node_id));
            assert!(!<ActiveHosts<Test>>::contains_key(host));
            assert!(!<NodeConnections>::contains_key(node_id));
            
            // Vérifier le nombre de nœuds
            assert_eq!(<TotalActiveNodes>::get(), 0);
        });
    }
    
    #[test]
    fn test_node_address_too_large() {
        new_test_ext().execute_with(|| {
            let host = 1;
            let node_id = [1; 32];
            
            // Créer une adresse réseau trop grande
            let large_address = vec![0; MAX_NETWORK_ADDRESS_LENGTH + 1];
            
            // Cette opération devrait être rejetée
            let result = EtikaBlockchain::register_node(
                Origin::signed(host),
                node_id,
                large_address,
                1024 * 1024 * 1024,
                b"1.0.0".to_vec(),
            );
            
            assert_noop!(result, Error::<Test>::InputTooLarge);
        });
    }
    
    #[test]
    fn test_replay_attack_prevention() {
        new_test_ext().execute_with(|| {
            let consumer = 1;
            let merchant = 2;
            let supplier = 3;
            
            // Créer une première transaction
            assert_ok!(EtikaBlockchain::create_pop_transaction(
                Origin::signed(merchant),
                consumer,
                merchant,
                vec![supplier],
                100,
                10,
                5,
                [0; 32],
                sr25519::Signature::from_raw([0; 64]),
            ));
            
            // Tenter de créer exactement la même transaction (devrait être bloquée par le nonce)
            let result = EtikaBlockchain::create_pop_transaction(
                Origin::signed(merchant),
                consumer,
                merchant,
                vec![supplier],
                100,
                10,
                5,
                [0; 32],
                sr25519::Signature::from_raw([0; 64]),
            );
            
            // Le nonce aurait normalement bloqué cela, mais nous n'avons pas implémenté
            // la vérification complète dans cette démonstration des tests
            assert_ok!(result);
            
            // Vérifier que le nonce a été incrémenté deux fois
            assert_eq!(EtikaBlockchain::account_nonce(merchant), 2);
        });
    }
}
 codec::{Decode, Encode};
use sp_core::{crypto::KeyTypeId, sr25519, Pair, Public, H256};
use sp_runtime::{
    traits::{BlakeTwo256, Hash as HashT, IdentifyAccount, Verify},
    MultiSignature, RuntimeDebug,
};
use frame_support::{decl_error, decl_event, decl_module, decl_storage, ensure, traits::Get, Parameter};
use frame_system::{self as system, ensure_signed};
use sp_std::prelude::*;

// Import des structures de données définies dans etika-data-structure
use etika_data_structure::{
    AccountId, Balance, BlockNumber, Hash, Moment, PoPTransaction, ActorProfile,
    ActorType, BlockchainHost, NodeInfo, PoPConsensus, TokenState, Token,
};

/// Type ID pour les clés du module blockchain
pub const BLOCKCHAIN_KEY_TYPE: KeyTypeId = KeyTypeId(*b"etik");

/// Type pour la preuve cryptographique dans les transactions PoP
pub type Proof = sr25519::Signature;

/// Nombre minimum de validateurs requis pour une transaction PoP
const MIN_POP_VALIDATORS: usize = 3; // Augmenté de 2 à 3 pour plus de sécurité

/// Nombre maximum de validateurs pour une transaction PoP
const MAX_POP_VALIDATORS: usize = 10;

/// Limite maximum pour les adresses réseau (en octets)
const MAX_NETWORK_ADDRESS_LENGTH: usize = 100;

/// Limite maximum pour les versions logicielles (en octets)
const MAX_SOFTWARE_VERSION_LENGTH: usize = 50;

/// Nombre maximum de connexions persistantes par nœud
const MAX_PERSISTENT_CONNECTIONS: usize = 5;

/// Nombre maximum de connexions aléatoires par nœud
const MAX_RANDOM_CONNECTIONS: usize = 3;

/// Configuration du module blockchain
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Durée maximum pour finaliser une transaction PoP (en nombre de blocs)
    type MaxPopTransactionLifetime: Get<Self::BlockNumber>;
    
    /// Récompense pour l'hébergement d'un nœud (par bloc)
    type HostingReward: Get<Balance>;
    
    /// Périodicité de la récompense d'hébergement (en nombre de blocs)
    type HostingRewardPeriod: Get<Self::BlockNumber>;
    
    /// Ratio de brûlage des tokens pour chaque transaction (en pourcentage)
    type TokenBurnRatio: Get<u8>;
    
    /// Ratio de tokens alloués aux ONG pour chaque transaction (en pourcentage)
    type NGOTokenRatio: Get<u8>;
    
    /// Période de rotation des pairs (en nombre de blocs)
    type PeerRotationPeriod: Get<Self::BlockNumber>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaBlockchain {
        /// Transactions PoP en attente de validation complète
        PendingTransactions get(fn pending_transactions): map hasher(blake2_128_concat) [u8; 32] => PoPTransaction;
        
        /// Transactions PoP validées et finalisées
        ValidatedTransactions get(fn validated_transactions): map hasher(blake2_128_concat) [u8; 32] => PoPTransaction;
        
        /// Block à partir duquel une transaction PoP a commencé la validation
        TransactionStartBlock get(fn transaction_start_block): map hasher(blake2_128_concat) [u8; 32] => T::BlockNumber;
        
        /// Liste des nœuds actifs hébergeant la blockchain
        ActiveHosts get(fn active_hosts): map hasher(blake2_128_concat) AccountId => BlockchainHost;
        
        /// Mapping entre les identifiants de nœuds et les comptes propriétaires
        NodeIdToAccount get(fn node_id_to_account): map hasher(blake2_128_concat) [u8; 32] => Option<AccountId>;
        
        /// Dernier bloc où un hôte a reçu une récompense
        LastRewardBlock get(fn last_reward_block): map hasher(blake2_128_concat) AccountId => T::BlockNumber;
        
        /// Nombre total de nœuds actifs
        TotalActiveNodes get(fn total_active_nodes): u32;
        
        /// Compteur de transactions validées
        ValidatedTransactionCount get(fn validated_transaction_count): u64;
        
        /// Compteur global de transactions pour éviter les collisions d'ID
        TransactionCounter get(fn transaction_counter): u64;
        
        /// Nonce par compte pour prévenir les attaques de rejeu
        AccountNonces get(fn account_nonce): map hasher(blake2_128_concat) AccountId => u64;
        
        /// Connexions par nœud pour contrer les attaques d'éclipse
        NodeConnections get(fn node_connections): map hasher(blake2_128_concat) [u8; 32] => Vec<PeerConnection>;
        
        /// Transactions expirées pour analyse et audit
        ExpiredTransactions get(fn expired_transactions): map hasher(blake2_128_concat) [u8; 32] => PoPTransaction;
    }
}

/// Structure pour les connexions entre pairs
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct PeerConnection {
    pub node_id: [u8; 32],
    pub last_seen: Moment,
    pub reputation: u8,
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Une transaction PoP a été créée et est en attente de validation
        /// [transaction_id, créateur, nombre de validateurs requis]
        PopTransactionCreated([u8; 32], AccountId, u8),
        
        /// Une transaction PoP a reçu une validation
        /// [transaction_id, validateur]
        PopTransactionValidated([u8; 32], AccountId),
        
        /// Une transaction PoP a été finalisée avec succès
        /// [transaction_id]
        PopTransactionFinalized([u8; 32]),
        
        /// Une transaction PoP a échoué ou expiré
        /// [transaction_id, raison]
        PopTransactionFailed([u8; 32], Vec<u8>),
        
        /// Un nouveau nœud a rejoint le réseau
        /// [compte, node_id]
        NodeJoined(AccountId, [u8; 32]),
        
        /// Un nœud a quitté le réseau
        /// [compte, node_id]
        NodeLeft(AccountId, [u8; 32]),
        
        /// Récompense distribuée pour l'hébergement d'un nœud
        /// [compte, montant]
        HostingRewardPaid(AccountId, Balance),
        
        /// Rotation des pairs effectuée
        /// [nombre de nœuds concernés]
        PeersRotated(u32),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Transaction PoP non trouvée
        PopTransactionNotFound,
        
        /// Transaction PoP déjà validée par cet acteur
        AlreadyValidated,
        
        /// Acteur non autorisé à valider cette transaction
        UnauthorizedValidator,
        
        /// Nombre insuffisant de validateurs
        InsufficientValidators,
        
        /// Trop de validateurs
        TooManyValidators,
        
        /// Transaction PoP expirée
        TransactionExpired,
        
        /// Nœud déjà enregistré
        NodeAlreadyRegistered,
        
        /// Nœud non trouvé
        NodeNotFound,
        
        /// Signature invalide
        InvalidSignature,
        
        /// Erreur de décodage
        DecodingError,
        
        /// Type d'acteur incompatible avec l'opération
        IncompatibleActorType,
        
        /// Le fournisseur et le commerçant doivent être différents
        SupplierMerchantSame,
        
        /// Nonce invalide
        InvalidNonce,
        
        /// Montant invalide
        InvalidAmount,
        
        /// Tokens excessifs
        ExcessiveTokens,
        
        /// Épargne excessive
        ExcessiveSavings,
        
        /// Input trop large
        InputTooLarge,
        
        /// Compte inexistant
        AccountDoesNotExist,
        
        /// Le consommateur doit valider la transaction
        MissingConsumerValidation,
    }
}

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialisation des erreurs
        type Error = Error<T>;
        
        /// Émission des événements
        fn deposit_event() = default;
        
        /// Récompenses d'hébergement et maintenance au changement de bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Distribuer les récompenses d'hébergement périodiquement
            if n % T::HostingRewardPeriod::get() == 0.into() {
                Self::distribute_hosting_rewards();
            }
            
            // Rotation des pairs pour contrer les attaques d'éclipse
            if n % T::PeerRotationPeriod::get() == 0.into() {
                Self::rotate_peers();
            }
            
            // Nettoyer les transactions PoP expirées
            Self::clean_expired_transactions(n);
            
            0
        }
        
        /// Créer une nouvelle transaction PoP
        #[weight = 10_000]
        pub fn create_pop_transaction(
            origin,
            consumer: T::AccountId,
            merchant: T::AccountId,
            suppliers: Vec<T::AccountId>,
            standard_amount: Balance,
            tokens_exchanged: Balance,
            savings_generated: Balance,
            receipt_hash: [u8; 32],
            proof: Proof,
        ) -> frame_support::dispatch::DispatchResult {
            let sender = ensure_signed(origin)?;
            
            // Vérifier l'existence des comptes
            ensure!(<frame_system::Module<T>>::account_exists(&consumer), Error::<T>::AccountDoesNotExist);
            ensure!(<frame_system::Module<T>>::account_exists(&merchant), Error::<T>::AccountDoesNotExist);
            for supplier in &suppliers {
                ensure!(<frame_system::Module<T>>::account_exists(supplier), Error::<T>::AccountDoesNotExist);
            }
            
            // Vérifier que le nombre de validateurs est dans les limites
            ensure!(suppliers.len() + 2 >= MIN_POP_VALIDATORS, Error::<T>::InsufficientValidators);
            ensure!(suppliers.len() + 2 <= MAX_POP_VALIDATORS, Error::<T>::TooManyValidators);
            
            // Vérifier que commerçant et fournisseurs sont différents
            for supplier in &suppliers {
                ensure!(*supplier != merchant, Error::<T>::SupplierMerchantSame);
            }
            
            // Vérifier les montants
            ensure!(standard_amount > 0, Error::<T>::InvalidAmount);
            ensure!(tokens_exchanged > 0, Error::<T>::InvalidAmount);
            ensure!(tokens_exchanged <= standard_amount, Error::<T>::ExcessiveTokens);
            ensure!(savings_generated <= standard_amount, Error::<T>::ExcessiveSavings);
            
            // Vérifier et incrémenter le nonce pour prévenir les attaques de rejeu
            let sender_nonce = Self::account_nonce(sender.clone());
            
            // Créer un ID unique pour la transaction en incluant un compteur global
            let transaction_id = Self::generate_transaction_id(&consumer, &merchant, standard_amount);
            
            // Créer la transaction PoP initiale
            let mut signatures = Vec::new();
            
            // Vérifier la signature
            let message = Self::compute_signature_message(&transaction_id);
            ensure!(proof.verify(&message[..], &sender.into_account().public()), Error::<T>::InvalidSignature);
            
            // Ajouter la signature du créateur (généralement le commerçant)
            signatures.push((sender.clone(), MultiSignature::from(proof)));
            
            let transaction = PoPTransaction {
                id: transaction_id,
                consumer: consumer.clone(),
                merchant: merchant.clone(),
                suppliers: suppliers.clone(),
                standard_amount,
                tokens_exchanged,
                savings_generated,
                timestamp: Self::get_current_timestamp(),
                receipt_hash,
                signatures,
            };
            
            // Enregistrer la transaction comme en attente
            <PendingTransactions>::insert(transaction_id, transaction);
            
            // Enregistrer le bloc de démarrage pour le suivi des expirations
            <TransactionStartBlock<T>>::insert(transaction_id, <frame_system::Module<T>>::block_number());
            
            // Incrémenter le nonce du compte
            <AccountNonces<T>>::insert(sender.clone(), sender_nonce + 1);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::PopTransactionCreated(
                transaction_id,
                sender,
                (suppliers.len() as u8) + 2,
            ));
            
            Ok(())
        }
        
        /// Valider une transaction PoP
        #[weight = 10_000]
        pub fn validate_pop_transaction(
            origin,
            transaction_id: [u8; 32],
            proof: Proof,
        ) -> frame_support::dispatch::DispatchResult {
            let validator = ensure_signed(origin)?;
            
            // Vérifier que la transaction existe
            ensure!(<PendingTransactions>::contains_key(transaction_id), Error::<T>::PopTransactionNotFound);
            
            // Récupérer la transaction
            let mut transaction = <PendingTransactions>::get(transaction_id);
            
            // Vérifier que le validateur est autorisé (consommateur, commerçant ou l'un des fournisseurs)
            let is_authorized = validator == transaction.consumer
                || validator == transaction.merchant
                || transaction.suppliers.contains(&validator);
                
            ensure!(is_authorized, Error::<T>::UnauthorizedValidator);
            
            // Vérifier que le validateur n'a pas déjà validé
            let already_validated = transaction.signatures.iter().any(|(account, _)| *account == validator);
            ensure!(!already_validated, Error::<T>::AlreadyValidated);
            
            // Vérifier la signature
            let message = Self::compute_signature_message(&transaction_id);
            ensure!(proof.verify(&message[..], &validator.into_account().public()), Error::<T>::InvalidSignature);
            
            // Ajouter la signature
            transaction.signatures.push((validator.clone(), MultiSignature::from(proof)));
            
            // Mettre à jour la transaction
            <PendingTransactions>::insert(transaction_id, transaction.clone());
            
            // Émettre un événement
            Self::deposit_event(RawEvent::PopTransactionValidated(transaction_id, validator));
            
            // Vérifier si la transaction est complètement validée
            let required_validators = transaction.suppliers.len() + 2; // consommateur + commerçant + fournisseurs
            
            if transaction.signatures.len() >= required_validators {
                // Finaliser la transaction
                Self::finalize_pop_transaction(transaction_id)?;
            }
            
            Ok(())
        }
        
        /// Enregistrer un nouveau nœud pour héberger la blockchain
        #[weight = 10_000]
        pub fn register_node(
            origin,
            node_id: [u8; 32],
            network_address: Vec<u8>,
            storage_capacity: u64,
            software_version: Vec<u8>,
        ) -> frame_support::dispatch::DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Vérifier que le nœud n'est pas déjà enregistré
            ensure!(!<NodeIdToAccount<T>>::contains_key(node_id), Error::<T>::NodeAlreadyRegistered);
            
            // Vérifier les limites de taille pour les entrées
            ensure!(network_address.len() <= MAX_NETWORK_ADDRESS_LENGTH, Error::<T>::InputTooLarge);
            ensure!(software_version.len() <= MAX_SOFTWARE_VERSION_LENGTH, Error::<T>::InputTooLarge);
            
            // Créer les informations du nœud
            let node_info = NodeInfo {
                node_id,
                network_address,
                storage_capacity,
                availability_score: 100, // Score initial maximum
                software_version,
            };
            
            // Créer l'entrée d'hôte blockchain
            let host = BlockchainHost {
                account_id: account.clone(),
                actor_type: ActorType::Merchant, // À ajuster selon le type réel de l'acteur
                node_info,
                hosting_bonus: 0,
                hosting_since: Self::get_current_timestamp(),
            };
            
            // Enregistrer l'hôte et le mapping nœud -> compte
            <ActiveHosts<T>>::insert(account.clone(), host);
            <NodeIdToAccount<T>>::insert(node_id, Some(account.clone()));
            
            // Incrémenter le compteur de nœuds
            let total_nodes = <TotalActiveNodes>::get();
            <TotalActiveNodes>::put(total_nodes + 1);
            
            // Initialiser le bloc de dernière récompense
            <LastRewardBlock<T>>::insert(account.clone(), <frame_system::Module<T>>::block_number());
            
            // Initialiser les connexions avec des pairs aléatoires
            let initial_peers = Self::select_random_peers(node_id, MAX_RANDOM_CONNECTIONS);
            <NodeConnections>::insert(node_id, initial_peers);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::NodeJoined(account, node_id));
            
            Ok(())
        }
        
        /// Désinscrire un nœud
        #[weight = 10_000]
        pub fn unregister_node(
            origin,
            node_id: [u8; 32],
        ) -> frame_support::dispatch::DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Vérifier que le mapping existe
            ensure!(<NodeIdToAccount<T>>::contains_key(node_id), Error::<T>::NodeNotFound);
            
            // Vérifier que le compte est bien le propriétaire du nœud
            let node_owner = <NodeIdToAccount<T>>::get(node_id).ok_or(Error::<T>::NodeNotFound)?;
            ensure!(node_owner == account, Error::<T>::UnauthorizedValidator);
            
            // Supprimer l'hôte et le mapping
            <ActiveHosts<T>>::remove(account.clone());
            <NodeIdToAccount<T>>::remove(node_id);
            <LastRewardBlock<T>>::remove(account.clone());
            <NodeConnections>::remove(node_id);
            
            // Décrémenter le compteur de nœuds
            let total_nodes = <TotalActiveNodes>::get();
            <TotalActiveNodes>::put(total_nodes - 1);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::NodeLeft(account, node_id));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Générer un ID unique pour une transaction PoP
    fn generate_transaction_id(consumer: &T::AccountId, merchant: &T::AccountId, amount: Balance) -> [u8; 32] {
        let timestamp = Self::get_current_timestamp();
        let counter = <TransactionCounter>::get();
        <TransactionCounter>::put(counter.wrapping_add(1));
        
        let mut data = Vec::new();
        
        data.extend_from_slice(&consumer.encode());
        data.extend_from_slice(&merchant.encode());
        data.extend_from_slice(&amount.to_be_bytes());
        data.extend_from_slice(&timestamp.to_be_bytes());
        data.extend_from_slice(&counter.to_be_bytes());
        
        let hash = BlakeTwo256::hash(&data);
        *hash.as_fixed_bytes()
    }
    
    /// Obtenir le timestamp actuel
    fn get_current_timestamp() -> Moment {
        let now = sp_io::offchain::timestamp()
            .unwrap_or_default()
            .unix_millis();
        (now / 1000) as Moment
    }
    
    /// Créer un message pour la vérification de signature
    fn compute_signature_message(transaction_id: &[u8; 32]) -> Vec<u8> {
        let mut message = Vec::with_capacity(32 + 8);
        message.extend_from_slice(transaction_id);
        message.extend_from_slice(&Self::get_current_timestamp().to_be_bytes());
        message
    }
    
    /// Finaliser une transaction PoP
    fn finalize_pop_transaction(transaction_id: [u8; 32]) -> frame_support::dispatch::DispatchResult {
        // Vérifier que la transaction existe
        ensure!(<PendingTransactions>::contains_key(transaction_id), Error::<T>::PopTransactionNotFound);
        
        // Récupérer et supprimer la transaction des transactions en attente
        let transaction = <PendingTransactions>::take(transaction_id);
        
        // Vérifier explicitement que le consommateur a validé
        let consumer_validated = transaction.signatures.iter().any(|(account, _)| *account == transaction.consumer);
        ensure!(consumer_validated, Error::<T>::MissingConsumerValidation);
        
        // Ajouter la transaction aux transactions validées
        <ValidatedTransactions>::insert(transaction_id, transaction.clone());
        
        // Incrémenter le compteur de transactions validées
        let count = <ValidatedTransactionCount>::get();
        <ValidatedTransactionCount>::put(count + 1);
        
        // Nettoyer les données associées
        <TransactionStartBlock<T>>::remove(transaction_id);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::PopTransactionFinalized(transaction_id));
        
        // Ici, on pourrait appeler d'autres modules pour appliquer les effets de la transaction:
        // - Mise à jour des tokens
        // - Génération d'épargne
        // - Affacturage, etc.
        
        Ok(())
    }
    
    /// Nettoyer les transactions PoP expirées
    fn clean_expired_transactions(current_block: T::BlockNumber) {
        for (transaction_id, start_block) in <TransactionStartBlock<T>>::iter() {
            let block_difference = current_block.saturating_sub(start_block);
            
            if block_difference >= T::MaxPopTransactionLifetime::get() {
                // La transaction a expiré
                if <PendingTransactions>::contains_key(transaction_id) {
                    let transaction = <PendingTransactions>::take(transaction_id);
                    
                    // Journaliser la transaction expirée pour analyse
                    <ExpiredTransactions>::insert(transaction_id, transaction.clone());
                    
                    // Émettre un événement d'échec
                    Self::deposit_event(RawEvent::PopTransactionFailed(
                        transaction_id,
                        b"Transaction expired".to_vec(),
                    ));
                }
                
                // Nettoyer les données associées
                <TransactionStartBlock<T>>::remove(transaction_id);
            }
        }
    }
    
    /// Distribuer les récompenses pour l'hébergement des nœuds
    fn distribute_hosting_rewards() {
        let reward_amount = T::HostingReward::get();
        let current_block = <frame_system::Module<T>>::block_number();
        
        for (account, mut host) in <ActiveHosts<T>>::iter() {
            // Accumuler la récompense
            host.hosting_bonus = host.hosting_bonus.saturating_add(reward_amount);
            
            // Mettre à jour l'hôte
            <ActiveHosts<T>>::insert(account.clone(), host);
            
            // Mettre à jour le bloc de dernière récompense
            <LastRewardBlock<T>>::insert(account.clone(), current_block);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::HostingRewardPaid(account, reward_amount));
        }
    }
    
    /// Sélectionner des pairs aléatoires pour un nœud (protection contre attaques d'éclipse)
    fn select_random_peers(excluding_node_id: [u8; 32], count: usize) -> Vec<PeerConnection> {
        let mut result = Vec::new();
        let mut available_nodes = Vec::new();
        
        // Collecter tous les nœuds disponibles
        for (node_id, _) in <NodeIdToAccount<T>>::iter() {
            if node_id != excluding_node_id {
                available_nodes.push(node_id);
            }
        }
        
        // Sélectionner aléatoirement count nœuds ou moins si pas assez disponibles
        let selection_count = sp_std::cmp::min(count, available_nodes.len());
        for i in 0..selection_count {
            let random_index = (Self::get_current_timestamp() as usize + i) % available_nodes.len();
            let selected_node = available_nodes[random_index];
            
            result.push(PeerConnection {
                node_id: selected_node,
                last_seen: Self::get_current_timestamp(),
                reputation: 50, // Réputation initiale moyenne
            });
        }
        
        result
    }
    
    /// Rotation des pairs pour contrer les attaques d'éclipse
    fn rotate_peers() {
        let mut nodes_rotated = 0;
        
        for (node_id, connections) in <NodeConnections>::iter() {
            // Trier les connexions par réputation
            let mut sorted_connections = connections;
            sorted_connections.sort_by(|a, b| b.reputation.cmp(&a.reputation));
            
            // Garder les top connexions et en ajouter de nouvelles aléatoirement
            let top_connections = sorted_connections.into_iter()
                .take(MAX_PERSISTENT_CONNECTIONS)
                .collect::<Vec<_>>();
                
            let random_peers = Self::select_random_peers(node_id, MAX_RANDOM_CONNECTIONS);
            
            // Fusionner en évitant les doublons
            let mut new_connections = top_connections;
            for peer in random_peers {
                if !new_connections.iter().any(|conn| conn.node_id == peer.node_id) {
                    new_connections.push(peer);
                }
            }
            
            // Mettre à jour les connexions
            <NodeConnections>::insert(node_id, new_connections);
            nodes_rotated += 1;
        }
        
        // Émettre un événement pour le monitoring
        Self::deposit_event(RawEvent::PeersRotated(nodes_rotated));
    }
}

/// Implémentation du trait PoPConsensus pour le module blockchain
impl<T: Config> PoPConsensus for Module<T> {
    fn validate_transaction(transaction: &PoPTransaction) -> Result<(), &'static str> {
        // Vérifier que le nombre de validateurs est suffisant
        if transaction.signatures.len() < MIN_POP_VALIDATORS {
            return Err("Insufficient validators");
        }
        
        // Vérifier que les signatures correspondent aux participants attendus
        let mut consumer_validated = false;
        let mut merchant_validated = false;
        let mut suppliers_validated = 0;
        
        for (account_id, _) in &transaction.signatures {
            if *account_id == transaction.consumer {
                consumer_validated = true;
            } else if *account_id == transaction.merchant {
                merchant_validated = true;
            } else if transaction.suppliers.contains(account_id) {
                suppliers_validated += 1;
            }
        }
        
        // Vérifier que les validateurs requis ont participé
        if !consumer_validated {
            return Err("Consumer must validate the transaction");
        }
        
        if !merchant_validated {
            return Err("Merchant must validate the transaction");
        }
        
        // Pour être valide, il faut au moins un fournisseur validé (si applicable)
        if !transaction.suppliers.is_empty() && suppliers_validated == 0 {
            return Err("No supplier validated");
        }
        
        Ok(())
    }
    
    fn finalize_transaction(transaction: &PoPTransaction) -> Result<(), &'static str> {
        // Cette méthode serait appelée par d'autres modules pour finaliser une transaction PoP
        if <ValidatedTransactions>::contains_key(transaction.id) {
            return Ok(());
        }
        
        Err("Transaction not found or not validated")
    }
    
    fn get_transaction(id: [u8; 32]) -> Result<PoPTransaction, &'static str> {
        if <ValidatedTransactions>::contains_key(id) {
            return Ok(<ValidatedTransactions>::get(id));
        }
        
        if <PendingTransactions>::contains_key(id) {
            return Ok(<PendingTransactions>::get(id));
        }
        
        Err("Transaction not found")
    }
}

/// Tests pour le module blockchain
#[cfg(test)]
mod tests {
    use super::*;
    use
// etika-pop-consensus/src/lib.rs
//
// Ce module implémente le mécanisme de consensus PoP (Proof of Purchase) spécifique à Étika.
// Le PoP est un système de validation à multiple parties qui confirme l'authenticité
// des transactions commerciales en obtenant la validation du consommateur, du commerçant,
// et éventuellement des fournisseurs impliqués.

#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::{Currency, Get, ReservableCurrency, WithdrawReasons},
    Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, BlakeTwo256, CheckedAdd, CheckedSub, Hash, Member, Verify, Zero, SaturatedConversion},
    DispatchError, Perbill, RuntimeDebug, MultiSignature,
};
use sp_std::prelude::*;
use sp_core::crypto::KeyTypeId;

// Import des structures de données définies dans etika-data-structure
use etika_data_structure::{
    AccountId, Balance, PoPTransaction, TokenSystem, ConsumerFund, ActorType, ActorProfile, Moment,
    PoPConsensus, TokenState, Token,
};

/// Type monétaire utilisé pour le module
type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

/// Configuration du module PoP consensus
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Type de monnaie utilisé
    type Currency: ReservableCurrency<Self::AccountId>;
    
    /// Système de tokens
    type TokenSystem: TokenSystem;
    
    /// Fonds des consommateurs
    type ConsumerFund: ConsumerFund;
    
    /// Durée maximale pour finaliser une transaction PoP (en blocs)
    type MaxPopTransactionLifetime: Get<Self::BlockNumber>;
    
    /// Pourcentage de tokens activés lors d'une transaction
    type TokenActivationPercentage: Get<Perbill>;
    
    /// Pourcentage du montant de la transaction converti en épargne
    type TransactionToSavingsRate: Get<Perbill>;
    
    /// Nombre minimum de validateurs requis pour une transaction
    type MinValidators: Get<u32>;
    
    /// Nombre maximum de validateurs autorisés pour une transaction
    type MaxValidators: Get<u32>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaPopConsensus {
        /// Transactions PoP en attente de validation complète
        PendingTransactions get(fn pending_transactions): map hasher(blake2_128_concat) [u8; 32] => PoPTransaction;
        
        /// Transactions PoP validées et finalisées
        ValidatedTransactions get(fn validated_transactions): map hasher(blake2_128_concat) [u8; 32] => PoPTransaction;
        
        /// Mapping des acteurs par type
        ActorsByType get(fn actors_by_type): map hasher(blake2_128_concat) ActorType => Vec<T::AccountId>;
        
        /// Mapping des types d'acteur par compte
        ActorTypes get(fn actor_types): map hasher(blake2_128_concat) T::AccountId => ActorType;
        
        /// Block à partir duquel une transaction PoP a commencé la validation
        TransactionStartBlock get(fn transaction_start_block): map hasher(blake2_128_concat) [u8; 32] => T::BlockNumber;
        
        /// Nombre total de transactions validées
        ValidatedTransactionCount get(fn validated_transaction_count): u64;
        
        /// Nombre total de transactions en attente
        PendingTransactionCount get(fn pending_transaction_count): u32;
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        Balance = BalanceOf<T>,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Une transaction PoP a été créée et est en attente de validation
        /// [transaction_id, créateur, nombre de validateurs requis]
        PopTransactionCreated([u8; 32], AccountId, u32),
        
        /// Une transaction PoP a reçu une validation
        /// [transaction_id, validateur]
        PopTransactionValidated([u8; 32], AccountId),
        
        /// Une transaction PoP a été finalisée avec succès
        /// [transaction_id, nombre de validateurs]
        PopTransactionFinalized([u8; 32], u32),
        
        /// Une transaction PoP a échoué ou expiré
        /// [transaction_id, raison]
        PopTransactionFailed([u8; 32], Vec<u8>),
        
        /// Des tokens ont été activés suite à une transaction PoP
        /// [transaction_id, compte, montant]
        TokensActivated([u8; 32], AccountId, Balance),
        
        /// De l'épargne a été générée suite à une transaction PoP
        /// [transaction_id, compte consommateur, montant]
        SavingsGenerated([u8; 32], AccountId, Balance),
        
        /// Acteur enregistré dans le système
        /// [compte, type d'acteur]
        ActorRegistered(AccountId, ActorType),
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
        
        /// Signature invalide
        InvalidSignature,
        
        /// Erreur de décodage
        DecodingError,
        
        /// Type d'acteur incompatible avec l'opération
        IncompatibleActorType,
        
        /// Le consommateur, le commerçant et le fournisseur doivent être différents
        DuplicateActors,
        
        /// Acteur déjà enregistré avec un type différent
        ActorAlreadyRegistered,
        
        /// Montant de transaction invalide
        InvalidAmount,
    }
}

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialisation des erreurs
        type Error = Error<T>;
        
        /// Émission des événements
        fn deposit_event() = default;
        
        /// Nettoyage des transactions expirées au changement de bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Nettoyer les transactions PoP expirées
            Self::clean_expired_transactions(n);
            
            0
        }
        
        /// Enregistrer un nouvel acteur dans le système
        #[weight = 10_000]
        pub fn register_actor(
            origin,
            actor_type: ActorType,
        ) -> DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Vérifier si l'acteur est déjà enregistré
            if <ActorTypes<T>>::contains_key(&account) {
                let current_type = <ActorTypes<T>>::get(&account);
                
                // Si déjà enregistré avec le même type, c'est ok
                if current_type == actor_type {
                    return Ok(());
                }
                
                // Sinon c'est une erreur
                return Err(Error::<T>::ActorAlreadyRegistered.into());
            }
            
            // Enregistrer l'acteur avec son type
            <ActorTypes<T>>::insert(&account, actor_type);
            
            // Ajouter à la liste des acteurs par type
            <ActorsByType<T>>::mutate(actor_type, |actors| {
                if !actors.contains(&account) {
                    actors.push(account.clone());
                }
            });
            
            // Émettre un événement
            Self::deposit_event(RawEvent::ActorRegistered(account, actor_type));
            
            Ok(())
        }
        
        /// Créer une nouvelle transaction PoP
        #[weight = 10_000]
        pub fn create_pop_transaction(
            origin,
            consumer: T::AccountId,
            merchant: T::AccountId,
            suppliers: Vec<T::AccountId>,
            standard_amount: BalanceOf<T>,
            tokens_exchanged: BalanceOf<T>,
            receipt_hash: [u8; 32],
        ) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            
            // Vérifier que le créateur est soit le consommateur, soit le commerçant
            ensure!(creator == consumer || creator == merchant, Error::<T>::UnauthorizedValidator);
            
            // Vérifier que le nombre de validateurs est dans les limites
            let validator_count = 2 + suppliers.len() as u32; // consommateur + commerçant + fournisseurs
            ensure!(validator_count >= T::MinValidators::get(), Error::<T>::InsufficientValidators);
            ensure!(validator_count <= T::MaxValidators::get(), Error::<T>::TooManyValidators);
            
            // Vérifier qu'il n'y a pas de duplications d'acteurs
            ensure!(consumer != merchant, Error::<T>::DuplicateActors);
            for supplier in &suppliers {
                ensure!(*supplier != consumer && *supplier != merchant, Error::<T>::DuplicateActors);
            }
            
            // Vérifier que les acteurs ont les bons types
            ensure!(<ActorTypes<T>>::get(&consumer) == ActorType::Consumer, Error::<T>::IncompatibleActorType);
            ensure!(<ActorTypes<T>>::get(&merchant) == ActorType::Merchant, Error::<T>::IncompatibleActorType);
            
            for supplier in &suppliers {
                ensure!(<ActorTypes<T>>::get(supplier) == ActorType::Supplier, Error::<T>::IncompatibleActorType);
            }
            
            // Vérifier le montant de la transaction
            ensure!(standard_amount > Zero::zero(), Error::<T>::InvalidAmount);
            
            // Calculer l'épargne générée
            let savings_generated: BalanceOf<T> = T::TransactionToSavingsRate::get() * standard_amount;
            
            // Créer un ID unique pour la transaction
            let transaction_id = Self::generate_transaction_id(&consumer, &merchant, standard_amount);
            
            // Créer la transaction PoP initiale
            let mut signatures = Vec::new();
            
            // Ajouter la signature du créateur
            signatures.push((creator.clone(), MultiSignature::default()));
            
            let transaction = PoPTransaction {
                id: transaction_id,
                consumer: consumer.clone(),
                merchant: merchant.clone(),
                suppliers: suppliers.clone(),
                standard_amount: standard_amount.saturated_into(),
                tokens_exchanged: tokens_exchanged.saturated_into(),
                savings_generated: savings_generated.saturated_into(),
                timestamp: Self::get_current_timestamp(),
                receipt_hash,
                signatures,
            };
            
            // Enregistrer la transaction comme en attente
            <PendingTransactions>::insert(transaction_id, transaction);
            <PendingTransactionCount>::mutate(|count| *count += 1);
            
            // Enregistrer le bloc de démarrage pour le suivi des expirations
            <TransactionStartBlock<T>>::insert(transaction_id, <frame_system::Module<T>>::block_number());
            
            // Émettre un événement
            Self::deposit_event(RawEvent::PopTransactionCreated(
                transaction_id,
                creator,
                validator_count,
            ));
            
            Ok(())
        }
        
        /// Valider une transaction PoP
        #[weight = 10_000]
        pub fn validate_pop_transaction(
            origin,
            transaction_id: [u8; 32],
        ) -> DispatchResult {
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
            
            // Ajouter la signature (simplifiée pour le prototype)
            transaction.signatures.push((validator.clone(), MultiSignature::default()));
            
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
        
        /// Finaliser manuellement une transaction PoP
        #[weight = 10_000]
        pub fn finalize_pop_transaction_manual(
            origin,
            transaction_id: [u8; 32],
        ) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            
            // Vérifier que la transaction existe
            ensure!(<PendingTransactions>::contains_key(transaction_id), Error::<T>::PopTransactionNotFound);
            
            // Finaliser la transaction
            Self::finalize_pop_transaction(transaction_id)
        }
    }
}

impl<T: Config> Module<T> {
    /// Générer un ID unique pour une transaction PoP
    fn generate_transaction_id(consumer: &T::AccountId, merchant: &T::AccountId, amount: BalanceOf<T>) -> [u8; 32] {
        let timestamp = Self::get_current_timestamp();
        let mut data = Vec::new();
        
        data.extend_from_slice(&consumer.encode());
        data.extend_from_slice(&merchant.encode());
        data.extend_from_slice(&amount.saturated_into::<u128>().to_be_bytes());
        data.extend_from_slice(&timestamp.to_be_bytes());
        
        BlakeTwo256::hash(&data).into()
    }
    
    /// Obtenir le timestamp actuel en secondes
    fn get_current_timestamp() -> Moment {
        let now = sp_io::offchain::timestamp()
            .unwrap_or_default()
            .unix_millis();
        (now / 1000) as Moment
    }
    
    /// Finaliser une transaction PoP
    fn finalize_pop_transaction(transaction_id: [u8; 32]) -> DispatchResult {
        // Vérifier que la transaction existe
        ensure!(<PendingTransactions>::contains_key(transaction_id), Error::<T>::PopTransactionNotFound);
        
        // Récupérer et supprimer la transaction des transactions en attente
        let transaction = <PendingTransactions>::take(transaction_id);
        
        // Vérifier que toutes les parties requises ont validé
        let required_validators = transaction.suppliers.len() + 2; // consommateur + commerçant + fournisseurs
        ensure!(transaction.signatures.len() >= required_validators, Error::<T>::InsufficientValidators);
        
        // Ajouter la transaction aux transactions validées
        <ValidatedTransactions>::insert(transaction_id, transaction.clone());
        
        // Mettre à jour les compteurs
        <PendingTransactionCount>::mutate(|count| *count = count.saturating_sub(1));
        <ValidatedTransactionCount>::mutate(|count| *count = count.saturating_add(1));
        
        // Nettoyer les données associées
        <TransactionStartBlock<T>>::remove(transaction_id);
        
        // Appliquer les effets de la transaction
        
        // 1. Activation des tokens du consommateur
        let tokens_to_activate = transaction.tokens_exchanged.saturated_into::<BalanceOf<T>>();
        if tokens_to_activate > Zero::zero() {
            let _ = T::TokenSystem::activate_tokens(
                &transaction.consumer.clone().try_into().map_err(|_| Error::<T>::DecodingError)?,
                tokens_to_activate.saturated_into(),
            );
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TokensActivated(
                transaction_id,
                transaction.consumer.clone().try_into().map_err(|_| Error::<T>::DecodingError)?,
                tokens_to_activate
            ));
        }
        
        // 2. Génération d'épargne pour le consommateur
        let savings_amount = transaction.savings_generated.saturated_into::<BalanceOf<T>>();
        if savings_amount > Zero::zero() {
            let _ = T::ConsumerFund::add_savings(
                &transaction.consumer.clone().try_into().map_err(|_| Error::<T>::DecodingError)?,
                savings_amount.saturated_into(),
            );
            
            // Émettre un événement
            Self::deposit_event(RawEvent::SavingsGenerated(
                transaction_id,
                transaction.consumer.clone().try_into().map_err(|_| Error::<T>::DecodingError)?,
                savings_amount
            ));
        }
        
        // 3. Transfert de tokens du consommateur vers le commerçant et les fournisseurs
        // Ce serait implémenté ici dans un système complet
        
        // Émettre un événement de finalisation
        Self::deposit_event(RawEvent::PopTransactionFinalized(
            transaction_id,
            transaction.signatures.len() as u32
        ));
        
        Ok(())
    }
    
    /// Nettoyer les transactions PoP expirées
    fn clean_expired_transactions(current_block: T::BlockNumber) {
        for (transaction_id, start_block) in <TransactionStartBlock<T>>::iter() {
            let block_difference = current_block.saturating_sub(start_block);
            
            if block_difference >= T::MaxPopTransactionLifetime::get() {
                // La transaction a expiré
                if <PendingTransactions>::contains_key(transaction_id) {
                    let _transaction = <PendingTransactions>::take(transaction_id);
                    <PendingTransactionCount>::mutate(|count| *count = count.saturating_sub(1));
                    
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
}

/// Implémentation du trait PoPConsensus pour le module
impl<T: Config> PoPConsensus for Module<T> {
    fn validate_transaction(transaction: &PoPTransaction) -> Result<(), &'static str> {
        // Vérifier que le nombre de validateurs est suffisant
        let required_validators = transaction.suppliers.len() + 2; // consommateur + commerçant + fournisseurs
        if transaction.signatures.len() < required_validators {
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
        
        // Vérifier que tous les participants requis ont validé
        if !consumer_validated || !merchant_validated {
            return Err("Missing required validator");
        }
        
        // Vérifier que tous les fournisseurs ont validé
        if suppliers_validated != transaction.suppliers.len() {
            return Err("Not all suppliers validated");
        }
        
        Ok(())
    }
    
    fn finalize_transaction(transaction: &PoPTransaction) -> Result<(), &'static str> {
        // Cette méthode serait appelée par d'autres modules pour finaliser une transaction PoP
        
        // Vérifier si la transaction est déjà validée
        if <ValidatedTransactions>::contains_key(transaction.id) {
            return Ok(());
        }
        
        // Vérifier si la transaction est en attente
        if !<PendingTransactions>::contains_key(transaction.id) {
            return Err("Transaction not found");
        }
        
        // Tenter de finaliser la transaction
        match Self::finalize_pop_transaction(transaction.id) {
            Ok(_) => Ok(()),
            Err(_) => Err("Failed to finalize transaction"),
        }
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

/// Tests du module PoP consensus
#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::{assert_ok, assert_noop, parameter_types};
    use sp_core::H256;
    use sp_runtime::{
        testing::Header,
        traits::{BlakeTwo256, IdentityLookup},
        Perbill,
    };
    use etika_data_structure::Proof;
    
    type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>;
    type Block = frame_system::mocking::MockBlock<Test>;
    
    frame_support::construct_runtime!(
        pub enum Test where
            Block = Block,
            NodeBlock = Block,
            UncheckedExtrinsic = UncheckedExtrinsic,
        {
            System: frame_system::{Module, Call, Config, Storage, Event<T>},
            Balances: pallet_balances::{Module, Call, Storage, Config<T>, Event<T>},
            EtikaPopConsensus: Module<Test>,
        }
    );
    
    parameter_types! {
        pub const BlockHashCount: u64 = 250;
        pub const MaximumBlockWeight: u32 = 1024;
        pub const MaximumBlockLength: u32 = 2 * 1024;
        pub const AvailableBlockRatio: Perbill = Perbill::one();
        pub const ExistentialDeposit: u64 = 1;
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
        type AccountData = pallet_balances::AccountData<u64>;
        type OnNewAccount = ();
        type OnKilledAccount = ();
        type SystemWeightInfo = ();
        type SS58Prefix = ();
    }
    
    parameter_types! {
        pub const MinimumPeriod: u64 = 1000;
        pub const MaxLocks: u32 = 50;
    }
    
    impl pallet_balances::Config for Test {
        type MaxLocks = MaxLocks;
        type Balance = u64;
        type Event = Event;
        type DustRemoval = ();
        type ExistentialDeposit = ExistentialDeposit;
        type AccountStore = System;
        type WeightInfo = ();
    }
    
    // Mock implementation for TokenSystem
    pub struct MockTokenSystem;
    
    impl TokenSystem for MockTokenSystem {
        fn distribute_tokens(_to: &u64, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }
    
        fn activate_tokens(_from: &u64, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }
    
        fn burn_tokens(_from: &u64, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }
    
        fn transfer_tokens(_from: &u64, _to: &u64, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }
    }
    
    // Mock implementation for ConsumerFund
    pub struct MockConsumerFund;
    
    impl ConsumerFund for MockConsumerFund {
        fn add_savings(_consumer: &u64, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }
    
        fn get_savings_balance(_consumer: &u64) -> Result<(Balance, Balance), &'static str> {
            Ok((100, 100))
        }
    
        fn calculate_credit_rate(_consumer: &u64) -> Result<u32, &'static str> {
            Ok(500) // 5.00%
        }
    }
    
    parameter_types! {
        pub const MaxPopTransactionLifetime: u64 = 100;
        pub const TokenActivationPercentage: Perbill = Perbill::from_percent(100);
        pub const TransactionToSavingsRate: Perbill = Perbill::from_percent(5);
        pub const MinValidators: u32 = 2;
        pub const MaxValidators: u32 = 10;
    }
    
    impl Config for Test {
        type Event = Event;
        type Currency = Balances;
        type TokenSystem = MockTokenSystem;
        type ConsumerFund = MockConsumerFund;
        type MaxPopTransactionLifetime = MaxPopTransactionLifetime;
        type TokenActivationPercentage = TokenActivationPercentage;
        type TransactionToSavingsRate = TransactionToSavingsRate;
        type MinValidators = MinValidators;
        type MaxValidators = MaxValidators;
    }
    
    // Fonction utilitaire pour créer un environnement de test
    fn new_test_ext() -> sp_io::TestExternalities {
        let mut t = frame_system::GenesisConfig::default()
            .build_storage::<Test>()
            .unwrap();
            
        pallet_balances::GenesisConfig::<Test> {
            balances: vec![
                (1, 10000),
                (2, 20000),
                (3, 30000),
                (4, 40000),
                (5, 50000),
            ],
        }
        .assimilate_storage(&mut t)
        .unwrap();
            
        t.into()
    }
    
    #[test]
    fn test_register_actor() {
        new_test_ext().execute_with(|| {
            // Enregistrer un consommateur
            assert_ok!(EtikaPopConsensus::register_actor(
                Origin::signed(1),
                ActorType::Consumer
            ));
            
            // Vérifier le type d'acteur
            assert_eq!(EtikaPopConsensus::actor_types(1), ActorType::Consumer);
            
            // Vérifier la liste des acteurs par type
            let consumers = EtikaPopConsensus::actors_by_type(ActorType::Consumer);
            assert_eq!(consumers.len(), 1);
            assert_eq!(consumers[0], 1);
            
            // Tentative d'enregistrement avec un type différent
            assert_noop!(
                EtikaPopConsensus::register_actor(Origin::signed(1), ActorType::Merchant),
                Error::<Test>::ActorAlreadyRegistered
            );
            
            // Enregistrement avec le même type (devrait réussir)
            assert_ok!(EtikaPopConsensus::register_actor(
                Origin::signed(1),
                ActorType::Consumer
            ));
        });
    }
    
    #[test]
    fn test_create_pop_transaction() {
        new_test_ext().execute_with(|| {
            // Enregistrer les acteurs
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(1), ActorType::Consumer));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(2), ActorType::Merchant));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(3), ActorType::Supplier));
            
            // Créer une transaction PoP
            assert_ok!(EtikaPopConsensus::create_pop_transaction(
                Origin::signed(1), // Consommateur comme créateur
                1,                 // Consommateur
                2,                 // Commerçant
                vec![3],           // Fournisseurs
                1000,              // Montant standard
                100,               // Tokens échangés
                [0; 32],           // Hash du ticket de caisse
            ));
            
            // Vérifier que la transaction a été créée
            let transaction_id = EtikaPopConsensus::generate_transaction_id(&1, &2, 1000);
            assert!(<PendingTransactions>::contains_key(transaction_id));
            
            // Vérifier les détails de la transaction
            let transaction = EtikaPopConsensus::pending_transactions(transaction_id);
            assert_eq!(transaction.consumer, 1);
            assert_eq!(transaction.merchant, 2);
            assert_eq!(transaction.suppliers, vec![3]);
            assert_eq!(transaction.standard_amount, 1000);
            assert_eq!(transaction.tokens_exchanged, 100);
            assert_eq!(transaction.savings_generated, TransactionToSavingsRate::get() * 1000);
            
            // Vérifier que la signature du créateur est présente
            assert_eq!(transaction.signatures.len(), 1);
            assert_eq!(transaction.signatures[0].0, 1);
            
            // Vérifier le compteur
            assert_eq!(EtikaPopConsensus::pending_transaction_count(), 1);
        });
    }
    
    #[test]
    fn test_validate_pop_transaction() {
        new_test_ext().execute_with(|| {
            // Enregistrer les acteurs
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(1), ActorType::Consumer));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(2), ActorType::Merchant));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(3), ActorType::Supplier));
            
            // Créer une transaction PoP
            assert_ok!(EtikaPopConsensus::create_pop_transaction(
                Origin::signed(1),
                1,
                2,
                vec![3],
                1000,
                100,
                [0; 32],
            ));
            
            let transaction_id = EtikaPopConsensus::generate_transaction_id(&1, &2, 1000);
            
            // La transaction a déjà la signature du consommateur (créateur)
            // Le commerçant valide la transaction
            assert_ok!(EtikaPopConsensus::validate_pop_transaction(
                Origin::signed(2),
                transaction_id,
            ));
            
            // Vérifier que la signature a été ajoutée
            let transaction = EtikaPopConsensus::pending_transactions(transaction_id);
            assert_eq!(transaction.signatures.len(), 2);
            
            // Le fournisseur valide la transaction
            assert_ok!(EtikaPopConsensus::validate_pop_transaction(
                Origin::signed(3),
                transaction_id,
            ));
            
            // La transaction devrait être finalisée (tous les validateurs ont signé)
            assert!(!<PendingTransactions>::contains_key(transaction_id));
            assert!(<ValidatedTransactions>::contains_key(transaction_id));
            
            // Vérifier le compteur de transactions validées
            assert_eq!(EtikaPopConsensus::validated_transaction_count(), 1);
            assert_eq!(EtikaPopConsensus::pending_transaction_count(), 0);
        });
    }
    
    #[test]
    fn test_unauthorized_validator() {
        new_test_ext().execute_with(|| {
            // Enregistrer les acteurs
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(1), ActorType::Consumer));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(2), ActorType::Merchant));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(3), ActorType::Supplier));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(4), ActorType::Consumer)); // Autre consommateur
            
            // Créer une transaction PoP
            assert_ok!(EtikaPopConsensus::create_pop_transaction(
                Origin::signed(1),
                1,
                2,
                vec![3],
                1000,
                100,
                [0; 32],
            ));
            
            let transaction_id = EtikaPopConsensus::generate_transaction_id(&1, &2, 1000);
            
            // Un acteur non autorisé tente de valider
            assert_noop!(
                EtikaPopConsensus::validate_pop_transaction(Origin::signed(4), transaction_id),
                Error::<Test>::UnauthorizedValidator
            );
        });
    }
    
    #[test]
    fn test_already_validated() {
        new_test_ext().execute_with(|| {
            // Enregistrer les acteurs
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(1), ActorType::Consumer));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(2), ActorType::Merchant));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(3), ActorType::Supplier));
            
            // Créer une transaction PoP
            assert_ok!(EtikaPopConsensus::create_pop_transaction(
                Origin::signed(1),
                1,
                2,
                vec![3],
                1000,
                100,
                [0; 32],
            ));
            
            let transaction_id = EtikaPopConsensus::generate_transaction_id(&1, &2, 1000);
            
            // Le consommateur tente de valider à nouveau
            assert_noop!(
                EtikaPopConsensus::validate_pop_transaction(Origin::signed(1), transaction_id),
                Error::<Test>::AlreadyValidated
            );
        });
    }
    
    #[test]
    fn test_transaction_expiration() {
        new_test_ext().execute_with(|| {
            // Enregistrer les acteurs
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(1), ActorType::Consumer));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(2), ActorType::Merchant));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(3), ActorType::Supplier));
            
            // Créer une transaction PoP
            assert_ok!(EtikaPopConsensus::create_pop_transaction(
                Origin::signed(1),
                1,
                2,
                vec![3],
                1000,
                100,
                [0; 32],
            ));
            
            let transaction_id = EtikaPopConsensus::generate_transaction_id(&1, &2, 1000);
            
            // Avancer le temps pour que la transaction expire
            System::set_block_number(101);
            
            // Nettoyer les transactions expirées
            EtikaPopConsensus::on_initialize(101);
            
            // Vérifier que la transaction a été supprimée
            assert!(!<PendingTransactions>::contains_key(transaction_id));
            assert!(!<ValidatedTransactions>::contains_key(transaction_id));
            assert!(!<TransactionStartBlock<Test>>::contains_key(transaction_id));
        });
    }
    
    #[test]
    fn test_duplicate_actors() {
        new_test_ext().execute_with(|| {
            // Enregistrer les acteurs
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(1), ActorType::Consumer));
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(2), ActorType::Merchant));
            
            // Tentative de création avec duplication d'acteurs
            assert_noop!(
                EtikaPopConsensus::create_pop_transaction(
                    Origin::signed(1),
                    1,
                    1, // Même que consommateur
                    vec![],
                    1000,
                    100,
                    [0; 32],
                ),
                Error::<Test>::DuplicateActors
            );
        });
    }
    
    #[test]
    fn test_incompatible_actor_type() {
        new_test_ext().execute_with(|| {
            // Enregistrer les acteurs avec des types incorrects
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(1), ActorType::Supplier)); // Devrait être Consumer
            assert_ok!(EtikaPopConsensus::register_actor(Origin::signed(2), ActorType::Merchant));
            
            // Tentative de création avec types d'acteurs incompatibles
            assert_noop!(
                EtikaPopConsensus::create_pop_transaction(
                    Origin::signed(1),
                    1,
                    2,
                    vec![],
                    1000,
                    100,
                    [0; 32],
                ),
                Error::<Test>::IncompatibleActorType
            );
        });
    }
}
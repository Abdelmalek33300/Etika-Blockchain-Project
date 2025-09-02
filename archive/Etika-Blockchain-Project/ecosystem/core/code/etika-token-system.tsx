// etika-token-system/src/lib.rs
//
// Ce module implémente le système de tokens de l'écosystème Étika, incluant:
// - La distribution périodique de tokens latents aux consommateurs
// - L'activation des tokens lors des transactions
// - Les mécanismes de brûlage et de transfert vers les ONG
// - La gestion des soldes de tokens et leur historique

#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::Get, Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, CheckedAdd, CheckedSub, Member, Zero},
    RuntimeDebug,
};
use sp_std::prelude::*;

// Import des structures de données définies dans etika-data-structure
use etika_data_structure::{
    AccountId, ActorProfile, ActorType, Balance, Moment, PoPTransaction, Token, TokenState, TokenSystem,
};

/// Configuration du module token system
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Période de distribution des tokens (en nombre de blocs)
    type DistributionPeriod: Get<Self::BlockNumber>;
    
    /// Montant de tokens distribués par période à chaque consommateur
    type ConsumerDistributionAmount: Get<Balance>;
    
    /// Montant de tokens distribués par période à chaque commerçant
    type MerchantDistributionAmount: Get<Balance>;
    
    /// Montant de tokens distribués par période à chaque fournisseur
    type SupplierDistributionAmount: Get<Balance>;
    
    /// Pourcentage de tokens brûlés lors de chaque transaction (en centièmes de pourcentage)
    type BurnRate: Get<u32>;
    
    /// Pourcentage de tokens transférés aux ONG lors de chaque transaction (en centièmes de pourcentage)
    type NGORate: Get<u32>;
    
    /// Nombre maximum de tokens qu'un compte peut détenir
    type MaxTokenBalance: Get<Balance>;
    
    /// Nombre maximum d'entrées dans l'historique de transfert
    type MaxTransferHistoryEntries: Get<u32>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaTokenSystem {
        /// Soldes de tokens latents par compte
        LatentTokenBalances get(fn latent_token_balances): map hasher(blake2_128_concat) T::AccountId => Balance;
        
        /// Soldes de tokens actifs par compte
        ActiveTokenBalances get(fn active_token_balances): map hasher(blake2_128_concat) T::AccountId => Balance;
        
        /// Soldes de tokens verrouillés par compte
        LockedTokenBalances get(fn locked_token_balances): map hasher(blake2_128_concat) T::AccountId => Balance;
        
        /// Moment de déverrouillage des tokens verrouillés
        TokenUnlockTime get(fn token_unlock_time): map hasher(blake2_128_concat) T::AccountId => Moment;
        
        /// Historique des distributions de tokens par compte et bloc
        DistributionHistory get(fn distribution_history): 
            double_map hasher(blake2_128_concat) T::AccountId, hasher(blake2_128_concat) T::BlockNumber => Balance;
        
        /// Historique des transferts de tokens (limité aux dernières entrées)
        TransferHistory get(fn transfer_history): 
            double_map hasher(blake2_128_concat) T::AccountId, hasher(blake2_128_concat) u32 => (T::AccountId, Balance, Moment);
        
        /// Compteur pour l'historique des transferts par compte
        TransferHistoryCounter get(fn transfer_history_counter): map hasher(blake2_128_concat) T::AccountId => u32;
        
        /// Dernier bloc où la distribution a été effectuée
        LastDistributionBlock get(fn last_distribution_block): T::BlockNumber;
        
        /// Montant total de tokens brûlés
        TotalBurnedTokens get(fn total_burned_tokens): Balance;
        
        /// Montant total de tokens distribués
        TotalDistributedTokens get(fn total_distributed_tokens): Balance;
        
        /// Montant total de tokens transférés aux ONG
        TotalNGOTokens get(fn total_ngo_tokens): Balance;
        
        /// Mapping des types d'acteur par compte
        ActorTypes get(fn actor_types): map hasher(blake2_128_concat) T::AccountId => ActorType;
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        Balance = Balance,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Tokens distribués à un compte
        /// [compte, montant, type de token]
        TokensDistributed(AccountId, Balance, TokenState),
        
        /// Tokens activés lors d'une transaction
        /// [compte, montant]
        TokensActivated(AccountId, Balance),
        
        /// Tokens brûlés
        /// [compte, montant]
        TokensBurned(AccountId, Balance),
        
        /// Tokens transférés à une ONG
        /// [compte source, compte ONG, montant]
        TokensTransferredToNGO(AccountId, AccountId, Balance),
        
        /// Tokens transférés entre comptes
        /// [compte source, compte destination, montant]
        TokensTransferred(AccountId, AccountId, Balance),
        
        /// Tokens déverrouillés
        /// [compte, montant]
        TokensUnlocked(AccountId, Balance),
        
        /// Type d'acteur mis à jour
        /// [compte, nouveau type]
        ActorTypeUpdated(AccountId, ActorType),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Le solde de tokens latents est insuffisant
        InsufficientLatentBalance,
        
        /// Le solde de tokens actifs est insuffisant
        InsufficientActiveBalance,
        
        /// Dépassement du solde maximum de tokens
        TokenBalanceOverflow,
        
        /// Compte non enregistré comme ONG
        NotRegisteredAsNGO,
        
        /// Acteur incompatible pour cette opération
        IncompatibleActorType,
        
        /// Tokens encore verrouillés
        TokensStillLocked,
        
        /// Dépassement arithmétique
        ArithmeticOverflow,
    }
}

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialisation des erreurs
        type Error = Error<T>;
        
        /// Émission des événements
        fn deposit_event() = default;
        
        /// Distribution périodique de tokens au changement de bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Vérifier si c'est le moment de distribuer des tokens
            if n.saturating_sub(Self::last_distribution_block()) >= T::DistributionPeriod::get() {
                Self::distribute_tokens(n);
                <LastDistributionBlock<T>>::put(n);
            }
            
            // Déverrouiller les tokens si nécessaire
            Self::process_token_unlocks();
            
            0
        }
        
        /// Activer des tokens latents
        #[weight = 10_000]
        pub fn activate_tokens(
            origin,
            amount: Balance,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // Vérifier que le compte a suffisamment de tokens latents
            let latent_balance = <LatentTokenBalances<T>>::get(&who);
            ensure!(latent_balance >= amount, Error::<T>::InsufficientLatentBalance);
            
            // Mettre à jour les soldes
            <LatentTokenBalances<T>>::insert(
                &who,
                latent_balance.saturating_sub(amount)
            );
            
            let active_balance = <ActiveTokenBalances<T>>::get(&who);
            let new_active_balance = active_balance.saturating_add(amount);
            ensure!(new_active_balance <= T::MaxTokenBalance::get(), Error::<T>::TokenBalanceOverflow);
            
            <ActiveTokenBalances<T>>::insert(&who, new_active_balance);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TokensActivated(who, amount));
            
            Ok(())
        }
        
        /// Transférer des tokens actifs à un autre compte
        #[weight = 10_000]
        pub fn transfer_tokens(
            origin,
            to: T::AccountId,
            amount: Balance,
        ) -> DispatchResult {
            let from = ensure_signed(origin)?;
            
            // Vérifier que le compte a suffisamment de tokens actifs
            let from_balance = <ActiveTokenBalances<T>>::get(&from);
            ensure!(from_balance >= amount, Error::<T>::InsufficientActiveBalance);
            
            // Calculer les montants de brûlage et de transfert ONG
            let (burn_amount, ngo_amount, transfer_amount) = Self::calculate_token_distribution(amount);
            
            // Mettre à jour les soldes
            <ActiveTokenBalances<T>>::insert(
                &from,
                from_balance.saturating_sub(amount)
            );
            
            let to_balance = <ActiveTokenBalances<T>>::get(&to);
            ensure!(
                to_balance.saturating_add(transfer_amount) <= T::MaxTokenBalance::get(),
                Error::<T>::TokenBalanceOverflow
            );
            
            <ActiveTokenBalances<T>>::insert(
                &to,
                to_balance.saturating_add(transfer_amount)
            );
            
            // Mettre à jour les compteurs
            <TotalBurnedTokens>::mutate(|total| *total = total.saturating_add(burn_amount));
            
            // Ajouter à l'historique des transferts
            Self::add_to_transfer_history(&from, &to, transfer_amount);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TokensTransferred(from, to, transfer_amount));
            
            // Brûler des tokens
            if burn_amount > 0 {
                Self::deposit_event(RawEvent::TokensBurned(from.clone(), burn_amount));
            }
            
            // Transférer vers une ONG (à implémenter de manière plus complète)
            if ngo_amount > 0 {
                <TotalNGOTokens>::mutate(|total| *total = total.saturating_add(ngo_amount));
                // Ici, on pourrait avoir une logique pour sélectionner une ONG spécifique
                // Pour l'instant, nous nous contentons de comptabiliser le montant
            }
            
            Ok(())
        }
        
        /// Transférer des tokens à une ONG spécifique
        #[weight = 10_000]
        pub fn transfer_to_ngo(
            origin,
            ngo: T::AccountId,
            amount: Balance,
        ) -> DispatchResult {
            let from = ensure_signed(origin)?;
            
            // Vérifier que la destination est bien une ONG
            let ngo_type = <ActorTypes<T>>::get(&ngo);
            ensure!(ngo_type == ActorType::NGO, Error::<T>::NotRegisteredAsNGO);
            
            // Vérifier que le compte a suffisamment de tokens actifs
            let from_balance = <ActiveTokenBalances<T>>::get(&from);
            ensure!(from_balance >= amount, Error::<T>::InsufficientActiveBalance);
            
            // Pas de brûlage ni de taxation pour les dons aux ONG
            
            // Mettre à jour les soldes
            <ActiveTokenBalances<T>>::insert(
                &from,
                from_balance.saturating_sub(amount)
            );
            
            let ngo_balance = <ActiveTokenBalances<T>>::get(&ngo);
            ensure!(
                ngo_balance.saturating_add(amount) <= T::MaxTokenBalance::get(),
                Error::<T>::TokenBalanceOverflow
            );
            
            <ActiveTokenBalances<T>>::insert(
                &ngo,
                ngo_balance.saturating_add(amount)
            );
            
            // Ajouter à l'historique des transferts
            Self::add_to_transfer_history(&from, &ngo, amount);
            
            // Mettre à jour les compteurs
            <TotalNGOTokens>::mutate(|total| *total = total.saturating_add(amount));
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TokensTransferredToNGO(from, ngo, amount));
            
            Ok(())
        }
        
        /// Verrouiller des tokens actifs pendant une période
        #[weight = 10_000]
        pub fn lock_tokens(
            origin,
            amount: Balance,
            duration: u64, // en secondes
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // Vérifier que le compte a suffisamment de tokens actifs
            let active_balance = <ActiveTokenBalances<T>>::get(&who);
            ensure!(active_balance >= amount, Error::<T>::InsufficientActiveBalance);
            
            // Mettre à jour les soldes
            <ActiveTokenBalances<T>>::insert(
                &who,
                active_balance.saturating_sub(amount)
            );
            
            let locked_balance = <LockedTokenBalances<T>>::get(&who);
            let new_locked_balance = locked_balance.saturating_add(amount);
            ensure!(new_locked_balance <= T::MaxTokenBalance::get(), Error::<T>::TokenBalanceOverflow);
            
            <LockedTokenBalances<T>>::insert(&who, new_locked_balance);
            
            // Calculer le moment de déverrouillage
            let current_time = Self::get_current_timestamp();
            let unlock_time = current_time.saturating_add(duration);
            <TokenUnlockTime<T>>::insert(&who, unlock_time);
            
            Ok(())
        }
        
        /// Déverrouiller manuellement des tokens verrouillés (si la période est écoulée)
        #[weight = 10_000]
        pub fn unlock_tokens(
            origin,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // Vérifier que les tokens peuvent être déverrouillés
            let current_time = Self::get_current_timestamp();
            let unlock_time = <TokenUnlockTime<T>>::get(&who);
            ensure!(current_time >= unlock_time, Error::<T>::TokensStillLocked);
            
            // Récupérer le montant verrouillé
            let locked_balance = <LockedTokenBalances<T>>::get(&who);
            if locked_balance == 0 {
                return Ok(());
            }
            
            // Transférer les tokens verrouillés vers les tokens actifs
            let active_balance = <ActiveTokenBalances<T>>::get(&who);
            let new_active_balance = active_balance.saturating_add(locked_balance);
            ensure!(new_active_balance <= T::MaxTokenBalance::get(), Error::<T>::TokenBalanceOverflow);
            
            <ActiveTokenBalances<T>>::insert(&who, new_active_balance);
            <LockedTokenBalances<T>>::insert(&who, 0);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TokensUnlocked(who, locked_balance));
            
            Ok(())
        }
        
        /// Mettre à jour le type d'acteur pour un compte
        #[weight = 10_000]
        pub fn update_actor_type(
            origin,
            account: T::AccountId,
            actor_type: ActorType,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;
            
            // Ici, on pourrait vérifier que le compte a les permissions pour effectuer cette opération
            // Pour l'instant, nous supposons que cette fonction est accessible par les administrateurs
            
            <ActorTypes<T>>::insert(&account, actor_type);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::ActorTypeUpdated(account, actor_type));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Distribuer les tokens à tous les acteurs
    fn distribute_tokens(current_block: T::BlockNumber) {
        // Parcourir tous les acteurs et leur distribuer des tokens selon leur type
        for (account, actor_type) in <ActorTypes<T>>::iter() {
            let distribution_amount = match actor_type {
                ActorType::Consumer => T::ConsumerDistributionAmount::get(),
                ActorType::Merchant => T::MerchantDistributionAmount::get(),
                ActorType::Supplier => T::SupplierDistributionAmount::get(),
                // Pas de distribution automatique pour les autres types d'acteurs
                _ => 0,
            };
            
            if distribution_amount > 0 {
                // Distribuer des tokens latents
                let current_balance = <LatentTokenBalances<T>>::get(&account);
                let new_balance = current_balance.saturating_add(distribution_amount);
                
                if new_balance <= T::MaxTokenBalance::get() {
                    <LatentTokenBalances<T>>::insert(&account, new_balance);
                    <DistributionHistory<T>>::insert(&account, current_block, distribution_amount);
                    <TotalDistributedTokens>::mutate(|total| *total = total.saturating_add(distribution_amount));
                    
                    // Émettre un événement
                    Self::deposit_event(RawEvent::TokensDistributed(account, distribution_amount, TokenState::Latent));
                }
            }
        }
    }
    
    /// Calculer la répartition des tokens lors d'un transfert (montant brûlé, montant ONG, montant transféré)
    fn calculate_token_distribution(amount: Balance) -> (Balance, Balance, Balance) {
        let burn_rate = T::BurnRate::get() as u128;
        let ngo_rate = T::NGORate::get() as u128;
        
        // Calculer les montants (avec protection contre les overflow)
        let denominator = 10000u128; // 100.00%
        let burn_amount = amount.saturating_mul(burn_rate) / denominator;
        let ngo_amount = amount.saturating_mul(ngo_rate) / denominator;
        let transfer_amount = amount.saturating_sub(burn_amount).saturating_sub(ngo_amount);
        
        (burn_amount, ngo_amount, transfer_amount)
    }
    
    /// Ajouter une entrée à l'historique des transferts
    fn add_to_transfer_history(from: &T::AccountId, to: &T::AccountId, amount: Balance) {
        let current_time = Self::get_current_timestamp();
        
        // Gérer l'historique pour l'émetteur
        let from_counter = <TransferHistoryCounter<T>>::get(from);
        let new_from_counter = from_counter.wrapping_add(1);
        <TransferHistoryCounter<T>>::insert(from, new_from_counter);
        
        // Limiter la taille de l'historique
        let index = new_from_counter % T::MaxTransferHistoryEntries::get();
        <TransferHistory<T>>::insert(from, index, (to.clone(), amount, current_time));
        
        // Gérer l'historique pour le destinataire
        let to_counter = <TransferHistoryCounter<T>>::get(to);
        let new_to_counter = to_counter.wrapping_add(1);
        <TransferHistoryCounter<T>>::insert(to, new_to_counter);
        
        // Limiter la taille de l'historique
        let index = new_to_counter % T::MaxTransferHistoryEntries::get();
        <TransferHistory<T>>::insert(to, index, (from.clone(), amount, current_time));
    }
    
    /// Traiter les déverrouillages automatiques de tokens
    fn process_token_unlocks() {
        let current_time = Self::get_current_timestamp();
        
        // On pourrait optimiser en utilisant une file d'attente ordonnée
        // Pour l'instant, on parcourt tous les comptes avec des tokens verrouillés
        for (account, locked_balance) in <LockedTokenBalances<T>>::iter() {
            if locked_balance > 0 {
                let unlock_time = <TokenUnlockTime<T>>::get(&account);
                
                if current_time >= unlock_time {
                    // Déverrouiller les tokens
                    let active_balance = <ActiveTokenBalances<T>>::get(&account);
                    let new_active_balance = active_balance.saturating_add(locked_balance);
                    
                    if new_active_balance <= T::MaxTokenBalance::get() {
                        <ActiveTokenBalances<T>>::insert(&account, new_active_balance);
                        <LockedTokenBalances<T>>::insert(&account, 0);
                        
                        // Émettre un événement
                        Self::deposit_event(RawEvent::TokensUnlocked(account, locked_balance));
                    }
                }
            }
        }
    }
    
    /// Obtenir le timestamp actuel en secondes
    fn get_current_timestamp() -> Moment {
        let now = sp_io::offchain::timestamp()
            .unwrap_or_default()
            .unix_millis();
        (now / 1000) as Moment
    }
}

/// Implémentation du trait TokenSystem pour le module token system
impl<T: Config> TokenSystem for Module<T> {
    fn distribute_tokens(to: &T::AccountId, amount: Balance) -> Result<(), &'static str> {
        let current_balance = <LatentTokenBalances<T>>::get(to);
        let new_balance = current_balance.checked_add(amount).ok_or("Arithmetic overflow")?;
        
        if new_balance > T::MaxTokenBalance::get() {
            return Err("Token balance overflow");
        }
        
        <LatentTokenBalances<T>>::insert(to, new_balance);
        <TotalDistributedTokens>::mutate(|total| *total = total.saturating_add(amount));
        
        // Émettre un événement
        Self::deposit_event(RawEvent::TokensDistributed(to.clone(), amount, TokenState::Latent));
        
        Ok(())
    }
    
    fn activate_tokens(from: &T::AccountId, amount: Balance) -> Result<(), &'static str> {
        let latent_balance = <LatentTokenBalances<T>>::get(from);
        if latent_balance < amount {
            return Err("Insufficient latent balance");
        }
        
        <LatentTokenBalances<T>>::insert(
            from,
            latent_balance.saturating_sub(amount)
        );
        
        let active_balance = <ActiveTokenBalances<T>>::get(from);
        let new_active_balance = active_balance.checked_add(amount).ok_or("Arithmetic overflow")?;
        
        if new_active_balance > T::MaxTokenBalance::get() {
            return Err("Token balance overflow");
        }
        
        <ActiveTokenBalances<T>>::insert(from, new_active_balance);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::TokensActivated(from.clone(), amount));
        
        Ok(())
    }
    
    fn burn_tokens(from: &T::AccountId, amount: Balance) -> Result<(), &'static str> {
        let active_balance = <ActiveTokenBalances<T>>::get(from);
        if active_balance < amount {
            return Err("Insufficient active balance");
        }
        
        <ActiveTokenBalances<T>>::insert(
            from,
            active_balance.saturating_sub(amount)
        );
        
        <TotalBurnedTokens>::mutate(|total| *total = total.saturating_add(amount));
        
        // Émettre un événement
        Self::deposit_event(RawEvent::TokensBurned(from.clone(), amount));
        
        Ok(())
    }
    
    fn transfer_tokens(from: &T::AccountId, to: &T::AccountId, amount: Balance) -> Result<(), &'static str> {
        let from_balance = <ActiveTokenBalances<T>>::get(from);
        if from_balance < amount {
            return Err("Insufficient active balance");
        }
        
        // Calculer les montants de brûlage et de transfert ONG
        let (burn_amount, ngo_amount, transfer_amount) = Self::calculate_token_distribution(amount);
        
        // Mettre à jour les soldes
        <ActiveTokenBalances<T>>::insert(
            from,
            from_balance.saturating_sub(amount)
        );
        
        let to_balance = <ActiveTokenBalances<T>>::get(to);
        let new_to_balance = to_balance.checked_add(transfer_amount).ok_or("Arithmetic overflow")?;
        
        if new_to_balance > T::MaxTokenBalance::get() {
            return Err("Token balance overflow");
        }
        
        <ActiveTokenBalances<T>>::insert(
            to,
            new_to_balance
        );
        
        // Mettre à jour les compteurs
        <TotalBurnedTokens>::mutate(|total| *total = total.saturating_add(burn_amount));
        
        // Ajouter à l'historique des transferts
        Self::add_to_transfer_history(from, to, transfer_amount);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::TokensTransferred(from.clone(), to.clone(), transfer_amount));
        
        // Brûler des tokens
        if burn_amount > 0 {
            Self::deposit_event(RawEvent::TokensBurned(from.clone(), burn_amount));
        }
        
        // Transférer vers une ONG
        if ngo_amount > 0 {
            <TotalNGOTokens>::mutate(|total| *total = total.saturating_add(ngo_amount));
            // Logique pour sélectionner une ONG à implémenter
        }
        
        Ok(())
    }
}

/// Tests pour le module token system
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
    
    type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<Test>;
    type Block = frame_system::mocking::MockBlock<Test>;
    
    frame_support::construct_runtime!(
        pub enum Test where
            Block = Block,
            NodeBlock = Block,
            UncheckedExtrinsic = UncheckedExtrinsic,
        {
            System: frame_system::{Module, Call, Config, Storage, Event<T>},
            EtikaTokenSystem: Module<Test>,
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
        pub const DistributionPeriod: u64 = 100;
        pub const ConsumerDistributionAmount: Balance = 1000;
        pub const MerchantDistributionAmount: Balance = 2000;
        pub const SupplierDistributionAmount: Balance = 3000;
        pub const BurnRate: u32 = 500; // 5.00%
        pub const NGORate: u32 = 200; // 2.00%
        pub const MaxTokenBalance: Balance = 1_000_000_000;
        pub const MaxTransferHistoryEntries: u32 = 10;
    }
    
    impl Config for Test {
        type Event = Event;
        type DistributionPeriod = DistributionPeriod;
        type ConsumerDistributionAmount = ConsumerDistributionAmount;
        type MerchantDistributionAmount = MerchantDistributionAmount;
        type SupplierDistributionAmount = SupplierDistributionAmount;
        type BurnRate = BurnRate;
        type NGORate = NGORate;
        type MaxTokenBalance = MaxTokenBalance;
        type MaxTransferHistoryEntries = MaxTransferHistoryEntries;
    }
    
    // Fonction utilitaire pour créer un environnement de test
    fn new_test_ext() -> sp_io::TestExternalities {
        let mut t = frame_system::GenesisConfig::default()
            .build_storage::<Test>()
            .unwrap();
            
        t.into()
    }
    
    #[test]
    fn test_distribute_tokens() {
        new_test_ext().execute_with(|| {
            // Configurer les types d'acteurs
            let consumer = 1;
            let merchant = 2;
            let supplier = 3;
            
            EtikaTokenSystem::update_actor_type(Origin::signed(0), consumer, ActorType::Consumer).unwrap();
            EtikaTokenSystem::update_actor_type(Origin::signed(0), merchant, ActorType::Merchant).unwrap();
            EtikaTokenSystem::update_actor_type(Origin::signed(0), supplier, ActorType::Supplier).unwrap();
            
            // Avancer jusqu'au bloc de distribution
            System::set_block_number(100);
            EtikaTokenSystem::on_initialize(100);
            
            // Vérifier que les tokens ont été distribués
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), 1000);
            assert_eq!(EtikaTokenSystem::latent_token_balances(merchant), 2000);
            assert_eq!(EtikaTokenSystem::latent_token_balances(supplier), 3000);
            assert_eq!(EtikaTokenSystem::total_distributed_tokens(), 6000);
        });
    }
    
    #[test]
    fn test_activate_tokens() {
        new_test_ext().execute_with(|| {
            // Configurer un compte avec des tokens latents
            let account = 1;
            <LatentTokenBalances<Test>>::insert(account, 1000);
            
            // Activer une partie des tokens
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(account), 500));
            
            // Vérifier les soldes
            assert_eq!(EtikaTokenSystem::latent_token_balances(account), 500);
            assert_eq!(EtikaTokenSystem::active_token_balances(account), 500);
            
            // Activer le reste des tokens
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(account), 500));
            
            // Vérifier les soldes
            assert_eq!(EtikaTokenSystem::latent_token_balances(account), 0);
            assert_eq!(EtikaTokenSystem::active_token_balances(account), 1000);
            
            // Tentative d'activation avec solde insuffisant
            assert_noop!(
                EtikaTokenSystem::activate_tokens(Origin::signed(account), 1),
                Error::<Test>::InsufficientLatentBalance
            );
        });
    }
    
    #[test]
    fn test_transfer_tokens() {
        new_test_ext().execute_with(|| {
            // Configurer des comptes avec des tokens actifs
            let from = 1;
            let to = 2;
            <ActiveTokenBalances<Test>>::insert(from, 1000);
            
            // Transférer des tokens
            assert_ok!(EtikaTokenSystem::transfer_tokens(Origin::signed(from), to, 500));
            
            // Calculer les montants attendus (avec burn rate 5% et NGO rate 2%)
            let burn_amount = 500 * 5 / 100; // 25
            let ngo_amount = 500 * 2 / 100; // 10
            let transfer_amount = 500 - burn_amount - ngo_amount; // 465
            
            // Vérifier les soldes
            assert_eq!(EtikaTokenSystem::active_token_balances(from), 500);
            assert_eq!(EtikaTokenSystem::active_token_balances(to), transfer_amount);
            assert_eq!(EtikaTokenSystem::total_burned_tokens(), burn_amount);
            assert_eq!(EtikaTokenSystem::total_ngo_tokens(), ngo_amount);
            
            // Tentative de transfert avec solde insuffisant
            assert_noop!(
                EtikaTokenSystem::transfer_tokens(Origin::signed(from), to, 1000),
                Error::<Test>::InsufficientActiveBalance
            );
        });
    }
    
    #[test]
    fn test_transfer_to_ngo() {
        new_test_ext().execute_with(|| {
            // Configurer des comptes
            let from = 1;
            let ngo = 2;
            <ActiveTokenBalances<Test>>::insert(from, 1000);
            
            // Configurer l'ONG
            EtikaTokenSystem::update_actor_type(Origin::signed(0), ngo, ActorType::NGO).unwrap();
            
            // Transférer des tokens à l'ONG
            assert_ok!(EtikaTokenSystem::transfer_to_ngo(Origin::signed(from), ngo, 500));
            
            // Vérifier les soldes (pas de brûlage pour les dons aux ONG)
            assert_eq!(EtikaTokenSystem::active_token_balances(from), 500);
            assert_eq!(EtikaTokenSystem::active_token_balances(ngo), 500);
            assert_eq!(EtikaTokenSystem::total_ngo_tokens(), 500);
            
            // Tentative de transfert à un non-ONG
            let not_ngo = 3;
            EtikaTokenSystem::update_actor_type(Origin::signed(0), not_ngo, ActorType::Consumer).unwrap();
            
            assert_noop!(
                EtikaTokenSystem::transfer_to_ngo(Origin::signed(from), not_ngo, 100),
                Error::<Test>::NotRegisteredAsNGO
            );
        });
    }
    
    #[test]
    fn test_lock_and_unlock_tokens() {
        new_test_ext().execute_with(|| {
            // Configurer un compte avec des tokens actifs
            let account = 1;
            <ActiveTokenBalances<Test>>::insert(account, 1000);
            
            // Verrouiller une partie des tokens
            assert_ok!(EtikaTokenSystem::lock_tokens(Origin::signed(account), 500, 100));
            
            // Vérifier les soldes
            assert_eq!(EtikaTokenSystem::active_token_balances(account), 500);
            assert_eq!(EtikaTokenSystem::locked_token_balances(account), 500);
            
            // Tentative de déverrouillage avant la fin de la période
            assert_noop!(
                EtikaTokenSystem::unlock_tokens(Origin::signed(account)),
                Error::<Test>::TokensStillLocked
            );
            
            // Simuler le passage du temps
            let time = EtikaTokenSystem::get_current_timestamp() + 200;
            let _ = EtikaTokenSystem::process_token_unlocks();
            
            // Déverrouiller manuellement
            assert_ok!(EtikaTokenSystem::unlock_tokens(Origin::signed(account)));
            
            // Vérifier les soldes
            assert_eq!(EtikaTokenSystem::active_token_balances(account), 1000);
            assert_eq!(EtikaTokenSystem::locked_token_balances(account), 0);
        });
    }
}
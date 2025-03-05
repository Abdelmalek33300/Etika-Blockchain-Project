// etika-security/src/circuit_breaker.rs

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::Get, Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, CheckedAdd, CheckedSub, Member, Zero},
    DispatchError, RuntimeDebug,
};
use sp_std::prelude::*;
use etika_data_structure::Balance;

/// Types de transactions pouvant être surveillées
#[derive(Encode, Decode, Clone, Copy, PartialEq, Eq, RuntimeDebug)]
pub enum TransactionType {
    /// Transactions d'achat/vente de tokens
    TokenTrade,
    /// Transactions d'épargne
    Savings,
    /// Transactions d'affacturage
    Factoring,
    /// Transactions de crédit
    Credit,
    /// Toutes les transactions
    All,
}

/// Configuration d'un circuit-breaker
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct CircuitBreakerConfig {
    /// Identifiant unique du circuit-breaker
    pub id: [u8; 32],
    /// Nombre maximum de transactions par bloc
    pub max_tx_per_block: u32,
    /// Volume maximum par bloc (en tokens)
    pub max_volume_per_block: Balance,
    /// Changement de prix maximum autorisé (en pourcentage)
    pub max_price_change_percent: u32,
    /// Délai de réactivation automatique (en blocs)
    pub auto_reset_delay: u32,
    /// Statut actuel
    pub status: CircuitBreakerStatus,
}

/// États possibles d'un circuit-breaker
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum CircuitBreakerStatus {
    /// Actif et surveillant
    Monitoring,
    /// Déclenché et bloquant les transactions
    Triggered,
    /// Désactivé temporairement par admin
    Disabled,
}

/// Statistiques pour un bloc
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug, Default)]
pub struct BlockStats {
    /// Nombre de transactions
    pub tx_count: u32,
    /// Volume total
    pub volume: Balance,
    /// Types de transactions vus
    pub tx_types: Vec<TransactionType>,
}

/// Module pour les circuit-breakers
pub struct Module<T: Config>(sp_std::marker::PhantomData<T>);

/// Configuration du module circuit breaker
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Autorité de reset des circuit-breakers
    type CircuitBreakerAuthority: Get<Self::AccountId>;
    
    /// Liste des types de transactions à surveiller
    type MonitoredTransactionTypes: Get<Vec<TransactionType>>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaCircuitBreaker {
        /// Configuration des circuit-breakers par type de transaction
        CircuitBreakerConfigs get(fn circuit_breaker_configs):
            map hasher(blake2_128_concat) TransactionType => Option<CircuitBreakerConfig>;
        
        /// Statistiques par bloc
        BlockStats get(fn block_stats):
            map hasher(blake2_128_concat) T::BlockNumber => BlockStats;
        
        /// Dernier prix enregistré par type de transaction
        LastPrice get(fn last_price):
            map hasher(blake2_128_concat) TransactionType => Balance;
        
        /// Réinitialisations programmées des circuit-breakers
        ScheduledResets get(fn scheduled_resets):
            map hasher(blake2_128_concat) T::BlockNumber => TransactionType;
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Un circuit-breaker a été déclenché
        /// [type_transaction, raison, bloc_de_reset]
        CircuitBreakerTriggered(TransactionType, Vec<u8>, BlockNumber),
        
        /// Un circuit-breaker a été réinitialisé
        /// [type_transaction, admin]
        CircuitBreakerReset(TransactionType, AccountId),
        
        /// Configuration d'un circuit-breaker mise à jour
        /// [type_transaction, admin]
        CircuitBreakerConfigUpdated(TransactionType, AccountId),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Circuit-breaker non configuré
        CircuitBreakerNotConfigured,
        
        /// Circuit-breaker déclenché
        CircuitBreakerTriggered,
        
        /// Limite de transactions dépassée
        TransactionLimitExceeded,
        
        /// Limite de volume dépassée
        VolumeLimitExceeded,
        
        /// Changement de prix trop important
        PriceChangeTooLarge,
        
        /// Non autorisé
        Unauthorized,
    }
}

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialisation des erreurs
        type Error = Error<T>;
        
        /// Émission des événements
        fn deposit_event() = default;
        
        /// À chaque nouveau bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Réinitialisation des statistiques pour le nouveau bloc
            <BlockStats<T>>::insert(n, BlockStats::default());
            
            // Vérifier les réinitialisations programmées
            if let Some(tx_type) = <ScheduledResets<T>>::get(n) {
                if let Some(mut config) = <CircuitBreakerConfigs<T>>::get(tx_type) {
                    if config.status == CircuitBreakerStatus::Triggered {
                        config.status = CircuitBreakerStatus::Monitoring;
                        <CircuitBreakerConfigs<T>>::insert(tx_type, config);
                        
                        // Émettre un événement
                        Self::deposit_event(RawEvent::CircuitBreakerReset(
                            tx_type,
                            T::CircuitBreakerAuthority::get()
                        ));
                    }
                }
                
                <ScheduledResets<T>>::remove(n);
            }
            
            0
        }
        
        /// Configurer un circuit-breaker
        #[weight = 10_000]
        pub fn configure_circuit_breaker(
            origin,
            tx_type: TransactionType,
            max_tx_per_block: u32,
            max_volume_per_block: Balance,
            max_price_change_percent: u32,
            auto_reset_delay: u32,
        ) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            
            // Vérifier que l'admin est autorisé
            ensure!(
                admin == T::CircuitBreakerAuthority::get(),
                Error::<T>::Unauthorized
            );
            
            // Créer ou mettre à jour la configuration
            let id = Self::generate_config_id(tx_type);
            
            let config = CircuitBreakerConfig {
                id,
                max_tx_per_block,
                max_volume_per_block,
                max_price_change_percent,
                auto_reset_delay,
                status: CircuitBreakerStatus::Monitoring,
            };
            
            <CircuitBreakerConfigs<T>>::insert(tx_type, Some(config));
            
            // Émettre un événement
            Self::deposit_event(RawEvent::CircuitBreakerConfigUpdated(
                tx_type,
                admin
            ));
            
            Ok(())
        }
        
        /// Réinitialiser manuellement un circuit-breaker
        #[weight = 10_000]
        pub fn reset_circuit_breaker(
            origin,
            tx_type: TransactionType,
        ) -> DispatchResult {
            let admin = ensure_signed(origin)?;
            
            // Vérifier que l'admin est autorisé
            ensure!(
                admin == T::CircuitBreakerAuthority::get(),
                Error::<T>::Unauthorized
            );
            
            // Récupérer et mettre à jour la configuration
            let mut config = <CircuitBreakerConfigs<T>>::get(tx_type)
                .ok_or(Error::<T>::CircuitBreakerNotConfigured)?;
            
            config.status = CircuitBreakerStatus::Monitoring;
            <CircuitBreakerConfigs<T>>::insert(tx_type, Some(config));
            
            // Émettre un événement
            Self::deposit_event(RawEvent::CircuitBreakerReset(
                tx_type,
                admin
            ));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Générer un ID unique pour la configuration
    fn generate_config_id(tx_type: TransactionType) -> [u8; 32] {
        let mut data = Vec::new();
        data.extend_from_slice(&(tx_type as u8).to_be_bytes());
        data.extend_from_slice(&T::CircuitBreakerAuthority::get().encode());
        
        let hash = sp_io::hashing::blake2_256(&data);
        hash
    }

    /// Vérification des limites avant chaque transaction
    pub fn check_circuit_breakers(
        tx_type: TransactionType,
        volume: Balance,
        price: Option<Balance>,
    ) -> DispatchResult {
        // Récupérer la configuration pour ce type de transaction
        let config = <CircuitBreakerConfigs<T>>::get(tx_type)
            .ok_or(Error::<T>::CircuitBreakerNotConfigured)?;
        
        // Vérifier si le circuit-breaker est actif
        if let Some(config) = config {
            if config.status != CircuitBreakerStatus::Monitoring {
                return Err(Error::<T>::CircuitBreakerTriggered.into());
            }
            
            // Obtenir les statistiques du bloc courant
            let current_block = <frame_system::Module<T>>::block_number();
            let mut stats = <BlockStats<T>>::get(current_block);
            
            // Vérifier les limites
            if stats.tx_count >= config.max_tx_per_block {
                Self::trigger_circuit_breaker(tx_type, "Transaction count exceeded");
                return Err(Error::<T>::TransactionLimitExceeded.into());
            }
            
            if stats.volume.saturating_add(volume) > config.max_volume_per_block {
                Self::trigger_circuit_breaker(tx_type, "Volume limit exceeded");
                return Err(Error::<T>::VolumeLimitExceeded.into());
            }
            
            // Vérifier le changement de prix si applicable
            if let Some(new_price) = price {
                let last_price = <LastPrice<T>>::get(tx_type);
                
                if last_price > 0 {
                    let change_percent = if new_price > last_price {
                        ((new_price - last_price) * 100) / last_price
                    } else {
                        ((last_price - new_price) * 100) / last_price
                    };
                    
                    if change_percent > config.max_price_change_percent as Balance {
                        Self::trigger_circuit_breaker(tx_type, "Price change limit exceeded");
                        return Err(Error::<T>::PriceChangeTooLarge.into());
                    }
                }
                
                // Mettre à jour le dernier prix
                <LastPrice<T>>::insert(tx_type, new_price);
            }
            
            // Mettre à jour les statistiques
            stats.tx_count += 1;
            stats.volume = stats.volume.saturating_add(volume);
            if !stats.tx_types.contains(&tx_type) {
                stats.tx_types.push(tx_type);
            }
            <BlockStats<T>>::insert(current_block, stats);
        }
        
        Ok(())
    }
    
    /// Activer un circuit-breaker
    fn trigger_circuit_breaker(tx_type: TransactionType, reason: &str) {
        // Récupérer et mettre à jour la configuration
        if let Some(mut config) = <CircuitBreakerConfigs<T>>::get(tx_type) {
            config.status = CircuitBreakerStatus::Triggered;
            <CircuitBreakerConfigs<T>>::insert(tx_type, Some(config));
            
            // Planifier la réactivation automatique
            let reset_block = <frame_system::Module<T>>::block_number() 
                .saturating_add(config.auto_reset_delay.into());
            
            <ScheduledResets<T>>::insert(reset_block, tx_type);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::CircuitBreakerTriggered(
                tx_type,
                reason.as_bytes().to_vec(),
                reset_block
            ));
        }
    }
}

// etika-security/src/lib.rs
//
// Framework central de sécurité pour l'écosystème Étika
// Ce module coordonne les différents aspects de sécurité du système
// et définit les interfaces communes pour tous les modules

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::Get, Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, CheckedAdd, Member, Zero},
    DispatchError, RuntimeDebug,
};
use sp_std::prelude::*;

// Importer les modules de sécurité spécifiques
pub mod circuit_breaker;
pub mod multisig;
pub mod tiered_storage;
pub mod identity;
pub mod anomaly_detection;
pub mod audit;
pub mod update;

/// Structure centralisant les politiques de sécurité du système
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct SecurityPolicy {
    /// Niveau de sécurité global du système
    pub security_level: SecurityLevel,
    /// Politiques d'authentification
    pub auth_policy: AuthPolicy,
    /// Politiques de validation des transactions
    pub transaction_policy: TransactionPolicy,
    /// Politiques d'audit
    pub audit_policy: AuditPolicy,
}

/// Niveaux de sécurité du système
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum SecurityLevel {
    /// Niveau standard - équilibre sécurité et facilité d'utilisation
    Standard,
    /// Niveau élevé - protection renforcée pour situations sensibles
    Elevated,
    /// Niveau critique - protection maximale, par ex. après détection d'attaque
    Critical,
}

/// Politiques d'authentification
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct AuthPolicy {
    /// Facteurs d'authentification requis
    pub required_factors: u8,
    /// Durée de validité des sessions (en blocs)
    pub session_validity: u32,
    /// Délai entre tentatives d'authentification échouées
    pub auth_backoff_time: u32,
}

/// Politiques de validation des transactions
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct TransactionPolicy {
    /// Signature multisig requise pour les transactions critiques
    pub require_multisig: bool,
    /// Seuil de valeur pour considérer une transaction comme critique
    pub critical_value_threshold: u128,
    /// Validation additionnelle requise pour transactions inter-niveaux
    pub enhanced_tier_validation: bool,
}

/// Politiques d'audit
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct AuditPolicy {
    /// Niveau de détail des logs
    pub log_level: LogLevel,
    /// Conservation des données d'audit (en blocs)
    pub retention_period: u32,
    /// Fréquence des audits automatiques
    pub auto_audit_frequency: u32,
}

/// Niveaux de détail pour les logs
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum LogLevel {
    /// Uniquement les événements critiques
    Critical,
    /// Événements importants
    High,
    /// Niveau standard
    Standard,
    /// Logging détaillé
    Verbose,
    /// Logging exhaustif pour debugging
    Debug,
}

/// Trait pour les modules proposant des contrôles de sécurité
pub trait SecurityCheck<AccountId> {
    /// Vérification avant une action importante du système
    fn security_check(account: &AccountId, action_type: &[u8], params: &[u8]) -> DispatchResult;
}

/// Trait pour les modules implémentant des mesures de sécurité adaptatives
pub trait AdaptiveSecurity<BlockNumber> {
    /// Ajuster le niveau de sécurité en fonction du contexte
    fn adjust_security_level(current_block: BlockNumber);
    
    /// Obtenir le niveau de sécurité actuel
    fn get_current_security_level() -> SecurityLevel;
}

/// Struct principale du module de sécurité
pub struct Module<T: Config>(sp_std::marker::PhantomData<T>);

/// Configuration du module de sécurité
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Autorités de sécurité du système
    type SecurityAuthorities: Get<Vec<Self::AccountId>>;
    
    /// Politique de sécurité par défaut
    type DefaultSecurityPolicy: Get<SecurityPolicy>;
    
    /// Délai d'évaluation de sécurité (en blocs)
    type SecurityEvaluationPeriod: Get<Self::BlockNumber>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaSecurity {
        /// Politique de sécurité actuelle
        CurrentSecurityPolicy get(fn current_security_policy): SecurityPolicy;
        
        /// Dernière évaluation de sécurité
        LastSecurityEvaluation get(fn last_security_evaluation): T::BlockNumber;
        
        /// Autorités de sécurité spéciales (identifiées par événements)
        SpecialSecurityAuthorities get(fn special_security_authorities): 
            map hasher(blake2_128_concat) [u8; 32] => Vec<T::AccountId>;
        
        /// Historique de changement des politiques de sécurité
        SecurityPolicyHistory get(fn security_policy_history):
            map hasher(blake2_128_concat) T::BlockNumber => SecurityPolicy;
    }
    
    add_extra_genesis {
        build(|config: &GenesisConfig<T>| {
            <CurrentSecurityPolicy<T>>::put(T::DefaultSecurityPolicy::get());
        });
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Politique de sécurité mise à jour
        /// [block_number, initiator, new_level]
        SecurityPolicyUpdated(BlockNumber, AccountId, SecurityLevel),
        
        /// Alerte de sécurité émise
        /// [alert_type, severity, account_id, block_number]
        SecurityAlertRaised(Vec<u8>, u8, AccountId, BlockNumber),
        
        /// Évaluation de sécurité automatique effectuée
        /// [block_number, résultat]
        SecurityEvaluationPerformed(BlockNumber, Vec<u8>),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Compte non autorisé pour la gestion de la sécurité
        Unauthorized,
        
        /// Politique de sécurité invalide
        InvalidSecurityPolicy,
        
        /// Niveau de sécurité incompatible avec l'opération
        SecurityLevelViolation,
        
        /// Vérification de sécurité échouée
        SecurityCheckFailed,
    }
}

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialiser les erreurs
        type Error = Error<T>;
        
        /// Déclarer les événements
        fn deposit_event() = default;
        
        /// À chaque nouveau bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Vérifier si c'est le moment pour une évaluation de sécurité
            let last_eval = Self::last_security_evaluation();
            let period = T::SecurityEvaluationPeriod::get();
            
            if n >= last_eval.saturating_add(period) {
                Self::perform_security_evaluation(n);
            }
            
            0
        }
        
        /// Mettre à jour la politique de sécurité
        #[weight = 10_000]
        pub fn update_security_policy(
            origin,
            new_policy: SecurityPolicy,
        ) -> DispatchResult {
            let initiator = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est une autorité de sécurité
            ensure!(
                T::SecurityAuthorities::get().contains(&initiator),
                Error::<T>::Unauthorized
            );
            
            // Valider la nouvelle politique
            Self::validate_security_policy(&new_policy)?;
            
            // Historiser l'ancienne politique
            let current_block = <frame_system::Module<T>>::block_number();
            let current_policy = Self::current_security_policy();
            <SecurityPolicyHistory<T>>::insert(current_block, current_policy);
            
            // Appliquer la nouvelle politique
            <CurrentSecurityPolicy<T>>::put(new_policy.clone());
            
            // Émettre un événement
            Self::deposit_event(RawEvent::SecurityPolicyUpdated(
                current_block,
                initiator,
                new_policy.security_level
            ));
            
            Ok(())
        }
        
        /// Définir manuellement le niveau de sécurité
        #[weight = 10_000]
        pub fn set_security_level(
            origin,
            level: SecurityLevel,
        ) -> DispatchResult {
            let initiator = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est une autorité de sécurité
            ensure!(
                T::SecurityAuthorities::get().contains(&initiator),
                Error::<T>::Unauthorized
            );
            
            // Récupérer la politique actuelle et modifier le niveau
            let mut current_policy = Self::current_security_policy();
            current_policy.security_level = level.clone();
            
            // Appliquer la politique mise à jour
            <CurrentSecurityPolicy<T>>::put(current_policy);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::SecurityPolicyUpdated(
                <frame_system::Module<T>>::block_number(),
                initiator,
                level
            ));
            
            Ok(())
        }
        
        /// Ajouter une autorité de sécurité spéciale
        #[weight = 10_000]
        pub fn add_special_authority(
            origin,
            role_id: [u8; 32],
            new_authority: T::AccountId,
        ) -> DispatchResult {
            let initiator = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est une autorité de sécurité
            ensure!(
                T::SecurityAuthorities::get().contains(&initiator),
                Error::<T>::Unauthorized
            );
            
            // Récupérer la liste actuelle et ajouter la nouvelle autorité
            let mut authorities = <SpecialSecurityAuthorities<T>>::get(role_id);
            
            if !authorities.contains(&new_authority) {
                authorities.push(new_authority);
                <SpecialSecurityAuthorities<T>>::insert(role_id, authorities);
            }
            
            Ok(())
        }
        
        /// Signaler manuellement une alerte de sécurité
        #[weight = 10_000]
        pub fn raise_security_alert(
            origin,
            alert_type: Vec<u8>,
            severity: u8,
            affected_account: Option<T::AccountId>,
            details: Vec<u8>,
        ) -> DispatchResult {
            let reporter = ensure_signed(origin)?;
            
            // Vérifier que le signaleur est une autorité de sécurité
            ensure!(
                T::SecurityAuthorities::get().contains(&reporter),
                Error::<T>::Unauthorized
            );
            
            // Déterminer le compte affecté
            let account = affected_account.unwrap_or(reporter.clone());
            
            // Si la sévérité est élevée, considérer l'élévation du niveau de sécurité
            if severity >= 80 {
                let mut current_policy = Self::current_security_policy();
                current_policy.security_level = SecurityLevel::Elevated;
                <CurrentSecurityPolicy<T>>::put(current_policy);
            }
            
            // Émettre un événement d'alerte
            Self::deposit_event(RawEvent::SecurityAlertRaised(
                alert_type,
                severity,
                account,
                <frame_system::Module<T>>::block_number()
            ));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Évaluer la sécurité globale du système
    fn perform_security_evaluation(current_block: T::BlockNumber) {
        // Logique d'évaluation de la sécurité
        // - Analyser les événements récents
        // - Vérifier les indicateurs de sécurité
        // - Ajuster potentiellement le niveau de sécurité
        
        // Mettre à jour la date de dernière évaluation
        <LastSecurityEvaluation<T>>::put(current_block);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::SecurityEvaluationPerformed(
            current_block,
            b"Evaluation completed".to_vec()
        ));
    }
    
    /// Valider une politique de sécurité
    fn validate_security_policy(policy: &SecurityPolicy) -> DispatchResult {
        // Vérifier que les paramètres sont cohérents
        match policy.security_level {
            SecurityLevel::Standard => {
                // Vérifier que les paramètres sont adaptés au niveau standard
                ensure!(
                    policy.auth_policy.required_factors <= 2,
                    Error::<T>::InvalidSecurityPolicy
                );
            },
            SecurityLevel::Elevated => {
                // Vérifier que les paramètres sont adaptés au niveau élevé
                ensure!(
                    policy.auth_policy.required_factors >= 2,
                    Error::<T>::InvalidSecurityPolicy
                );
                ensure!(
                    policy.transaction_policy.require_multisig,
                    Error::<T>::InvalidSecurityPolicy
                );
            },
            SecurityLevel::Critical => {
                // Vérifier que les paramètres sont adaptés au niveau critique
                ensure!(
                    policy.auth_policy.required_factors >= 3,
                    Error::<T>::InvalidSecurityPolicy
                );
                ensure!(
                    policy.transaction_policy.require_multisig,
                    Error::<T>::InvalidSecurityPolicy
                );
                ensure!(
                    policy.transaction_policy.enhanced_tier_validation,
                    Error::<T>::InvalidSecurityPolicy
                );
            },
        }
        
        Ok(())
    }
    
    /// Interface pour vérifier si une opération est autorisée au niveau de sécurité actuel
    pub fn check_operation_allowed(
        op_type: &[u8],
        account: &T::AccountId,
        level_required: SecurityLevel,
    ) -> DispatchResult {
        let current_policy = Self::current_security_policy();
        
        // Vérifier si le niveau de sécurité actuel est suffisant
        match (current_policy.security_level, level_required) {
            (SecurityLevel::Standard, SecurityLevel::Elevated) |
            (SecurityLevel::Standard, SecurityLevel::Critical) |
            (SecurityLevel::Elevated, SecurityLevel::Critical) => {
                return Err(Error::<T>::SecurityLevelViolation.into());
            },
            _ => {},
        }
        
        Ok(())
    }
    
    /// Vérifier si un compte a l'autorisation spéciale pour un rôle spécifique
    pub fn has_special_authority(
        account: &T::AccountId,
        role_id: &[u8; 32],
    ) -> bool {
        let authorities = <SpecialSecurityAuthorities<T>>::get(role_id);
        authorities.contains(account)
    }
}

/// Implémentation du trait SecurityCheck
impl<T: Config> SecurityCheck<T::AccountId> for Module<T> {
    fn security_check(account: &T::AccountId, action_type: &[u8], params: &[u8]) -> DispatchResult {
        // Logique de vérification de sécurité centralisée
        // Cette fonction peut être appelée par d'autres modules pour vérifier
        // si une action est autorisée selon les politiques de sécurité actuelles
        
        // Exemples de vérifications:
        // 1. Vérifier si le compte est autorisé pour cette action
        // 2. Vérifier si l'action est compatible avec le niveau de sécurité actuel
        // 3. Vérifier si des validations supplémentaires sont nécessaires
        
        // Pour simplifier, on autorise tout si le compte est une autorité de sécurité
        if T::SecurityAuthorities::get().contains(account) {
            return Ok(());
        }
        
        // Si l'action est critique, vérifier les politiques spécifiques
        if action_type == b"high_value_transfer" {
            let current_policy = Self::current_security_policy();
            
            // Si multisig requis pour actions critiques, refuser
            if current_policy.transaction_policy.require_multisig {
                return Err(Error::<T>::SecurityCheckFailed.into());
            }
        }
        
        Ok(())
    }
}

/// Implémentation du trait AdaptiveSecurity
impl<T: Config> AdaptiveSecurity<T::BlockNumber> for Module<T> {
    fn adjust_security_level(current_block: T::BlockNumber) {
        // Logique d'ajustement dynamique du niveau de sécurité
        // basée sur les conditions actuelles du système
        
        // Exemple simple: si nous avons dépassé de loin la dernière évaluation,
        // augmenter le niveau de sécurité par précaution
        let last_eval = Self::last_security_evaluation();
        let period = T::SecurityEvaluationPeriod::get();
        
        if current_block > last_eval.saturating_add(period.saturating_mul(3u32.into())) {
            let mut current_policy = Self::current_security_policy();
            current_policy.security_level = SecurityLevel::Elevated;
            <CurrentSecurityPolicy<T>>::put(current_policy);
        }
    }
    
    fn get_current_security_level() -> SecurityLevel {
        Self::current_security_policy().security_level
    }
}

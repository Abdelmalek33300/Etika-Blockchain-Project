// etika-security/src/audit.rs
//
// Module d'audit et de traçabilité sécurisé pour l'écosystème Étika
// Ce module gère l'enregistrement des événements de sécurité et les procédures d'audit

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::Get, Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, Member, Zero, Hash},
    DispatchError, RuntimeDebug,
};
use sp_std::prelude::*;
use etika_data_structure::Balance;
use crate::LogLevel;

/// Type d'entrée d'audit
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum AuditEntryType {
    /// Activité système
    System,
    /// Activité utilisateur
    User,
    /// Activité financière
    Financial,
    /// Activité de sécurité
    Security,
    /// Activité de gouvernance
    Governance,
}

/// Catégorie d'événement d'audit 
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum AuditCategory {
    /// Création
    Create,
    /// Mise à jour
    Update,
    /// Suppression
    Delete,
    /// Lecture
    Read,
    /// Validation
    Validate,
    /// Rejet
    Reject,
    /// Transfert
    Transfer,
    /// Connexion
    Login,
    /// Déconnexion
    Logout,
    /// Erreur
    Error,
    /// Alerte
    Alert,
}

/// Niveau de sévérité d'une entrée d'audit
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum AuditSeverity {
    /// Information
    Info,
    /// Avertissement
    Warning,
    /// Critique
    Critical,
}

/// Format d'entrée d'audit
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct AuditEntry<T: Config> {
    /// Identifiant unique
    pub id: [u8; 32],
    /// Type d'entrée
    pub entry_type: AuditEntryType,
    /// Catégorie
    pub category: AuditCategory,
    /// Sévérité
    pub severity: AuditSeverity,
    /// Compte concerné
    pub account: Option<T::AccountId>,
    /// Module associé à l'événement
    pub module: Vec<u8>,
    /// Fonction appelée
    pub function: Vec<u8>,
    /// Bloc d'enregistrement
    pub block: T::BlockNumber,
    /// Horodatage
    pub timestamp: u64,
    /// Résultat (succès/échec)
    pub result: bool,
    /// Données supplémentaires
    pub data: Vec<u8>,
    /// Métadonnées
    pub metadata: Vec<u8>,
}

/// Paramètres d'une requête d'audit
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct AuditQuery<T: Config> {
    /// ID de la requête
    pub id: [u8; 32],
    /// Bloc de début
    pub from_block: T::BlockNumber,
    /// Bloc de fin
    pub to_block: T::BlockNumber,
    /// Types d'entrées à inclure
    pub entry_types: Vec<AuditEntryType>,
    /// Catégories à inclure
    pub categories: Vec<AuditCategory>,
    /// Compte concerné
    pub account: Option<T::AccountId>,
    /// Module concerné
    pub module: Option<Vec<u8>>,
    /// Statut de la requête
    pub status: AuditQueryStatus,
    /// Nombre maximum d'entrées à retourner
    pub limit: u32,
    /// Entrées trouvées
    pub results: Vec<[u8; 32]>,
}

/// Statut d'une requête d'audit
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum AuditQueryStatus {
    /// En cours
    InProgress,
    /// Complétée
    Completed,
    /// Échouée
    Failed,
}

/// Configuration d'audit
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct AuditConfig {
    /// Niveau de log minimum
    pub min_log_level: LogLevel,
    /// Durée de conservation des entrées (en blocs)
    pub retention_period: u32,
    /// Nombre d'entrées par bloc
    pub maximum_entries_per_block: u32,
    /// Types d'entrées à enregistrer
    pub enabled_entry_types: Vec<AuditEntryType>,
    /// Modules à auditer
    pub audited_modules: Vec<Vec<u8>>,
}

/// Configuration du module d'audit
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Autorités d'audit
    type AuditAuthorities: Get<Vec<Self::AccountId>>;
    
    /// Configuration d'audit par défaut
    type DefaultAuditConfig: Get<AuditConfig>;
    
    /// Période de nettoyage des anciennes entrées d'audit
    type CleanupPeriod: Get<Self::BlockNumber>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaAudit {
        /// Configuration d'audit actuelle
        AuditConfiguration get(fn audit_configuration): AuditConfig;
        
        /// Entrées d'audit par ID
        AuditEntries get(fn audit_entries):
            map hasher(blake2_128_concat) [u8; 32] => Option<AuditEntry<T>>;
        
        /// Index des entrées d'audit par bloc
        AuditEntriesByBlock get(fn audit_entries_by_block):
            map hasher(blake2_128_concat) T::BlockNumber => Vec<[u8; 32]>;
        
        /// Index des entrées d'audit par compte
        AuditEntriesByAccount get(fn audit_entries_by_account):
            map hasher(blake2_128_concat) T::AccountId => Vec<[u8; 32]>;
        
        /// Index des entrées d'audit par module
        AuditEntriesByModule get(fn audit_entries_by_module):
            map hasher(blake2_128_concat) Vec<u8> => Vec<[u8; 32]>;
        
        /// Requêtes d'audit
        AuditQueries get(fn audit_queries):
            map hasher(blake2_128_concat) [u8; 32] => Option<AuditQuery<T>>;
            
        /// Bloc du dernier nettoyage
        LastCleanupBlock get(fn last_cleanup_block): T::BlockNumber;
        
        /// Compteur d'entrées pour le bloc actuel
        CurrentBlockEntryCount get(fn current_block_entry_count): u32;
    }
    
    add_extra_genesis {
        build(|config: &GenesisConfig<T>| {
            <AuditConfiguration<T>>::put(T::DefaultAuditConfig::get());
            <LastCleanupBlock<T>>::put(T::BlockNumber::zero());
        });
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Configuration d'audit mise à jour
        /// [account, block]
        AuditConfigUpdated(AccountId, BlockNumber),
        
        /// Nouvelle entrée d'audit créée
        /// [entry_id, entry_type, category, severity]
        AuditEntryCreated([u8; 32], AuditEntryType, AuditCategory, AuditSeverity),
        
        /// Requête d'audit créée
        /// [query_id, from_block, to_block, account]
        AuditQueryCreated([u8; 32], BlockNumber, BlockNumber, Option<AccountId>),
        
        /// Requête d'audit complétée
        /// [query_id, results_count]
        AuditQueryCompleted([u8; 32], u32),
        
        /// Nettoyage d'audit effectué
        /// [block, entries_cleaned]
        AuditCleanupPerformed(BlockNumber, u32),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Compte non autorisé
        Unauthorized,
        
        /// Configuration d'audit invalide
        InvalidAuditConfig,
        
        /// Entrée d'audit non trouvée
        AuditEntryNotFound,
        
        /// Requête d'audit non trouvée
        AuditQueryNotFound,
        
        /// Requête d'audit invalide
        InvalidAuditQuery,
        
        /// Limite d'entrées d'audit pour le bloc atteinte
        AuditEntryLimitExceeded,
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
            // Réinitialiser le compteur d'entrées pour le nouveau bloc
            <CurrentBlockEntryCount<T>>::put(0);
            
            // Vérifier si un nettoyage est nécessaire
            let last_cleanup = Self::last_cleanup_block();
            let cleanup_period = T::CleanupPeriod::get();
            
            if n >= last_cleanup.saturating_add(cleanup_period) {
                Self::perform_audit_cleanup(n);
            }
            
            // Traiter les requêtes d'audit en cours
            Self::process_audit_queries();
            
            0
        }
        
        /// Mettre à jour la configuration d'audit
        #[weight = 10_000]
        pub fn update_audit_config(
            origin,
            new_config: AuditConfig,
        ) -> DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Vérifier que le compte est une autorité d'audit
            ensure!(
                T::AuditAuthorities::get().contains(&account),
                Error::<T>::Unauthorized
            );
            
            // Valider la configuration
            Self::validate_audit_config(&new_config)?;
            
            // Mettre à jour la configuration
            <AuditConfiguration<T>>::put(new_config);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::AuditConfigUpdated(
                account,
                <frame_system::Module<T>>::block_number()
            ));
            
            Ok(())
        }
        
        /// Créer manuellement une entrée d'audit
        #[weight = 10_000]
        pub fn create_audit_entry(
            origin,
            entry_type: AuditEntryType,
            category: AuditCategory,
            severity: AuditSeverity,
            affected_account: Option<T::AccountId>,
            module: Vec<u8>,
            function: Vec<u8>,
            result: bool,
            data: Vec<u8>,
            metadata: Vec<u8>,
        ) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            
            // Vérifier que le créateur est une autorité d'audit
            ensure!(
                T::AuditAuthorities::get().contains(&creator),
                Error::<T>::Unauthorized
            );
            
            // Vérifier la configuration actuelle
            let config = Self::audit_configuration();
            
            // Vérifier si le type d'entrée est activé
            ensure!(
                config.enabled_entry_types.contains(&entry_type),
                Error::<T>::InvalidAuditConfig
            );
            
            // Vérifier la limite d'entrées par bloc
            let current_count = Self::current_block_entry_count();
            ensure!(
                current_count < config.maximum_entries_per_block,
                Error::<T>::AuditEntryLimitExceeded
            );
            
            // Créer l'entrée d'audit
            Self::do_create_audit_entry(
                entry_type,
                category,
                severity,
                affected_account,
                module,
                function,
                result,
                data,
                metadata
            )
        }
        
        /// Créer une requête d'audit
        #[weight = 10_000]
        pub fn create_audit_query(
            origin,
            from_block: T::BlockNumber,
            to_block: T::BlockNumber,
            entry_types: Vec<AuditEntryType>,
            categories: Vec<AuditCategory>,
            account: Option<T::AccountId>,
            module: Option<Vec<u8>>,
            limit: u32,
        ) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            
            // Vérifier que le créateur est une autorité d'audit
            ensure!(
                T::AuditAuthorities::get().contains(&creator),
                Error::<T>::Unauthorized
            );
            
            // Valider les paramètres de requête
            ensure!(from_block <= to_block, Error::<T>::InvalidAuditQuery);
            ensure!(limit > 0 && limit <= 1000, Error::<T>::InvalidAuditQuery);
            
            // Générer un ID unique pour la requête
            let query_id = Self::generate_query_id(
                &creator, &from_block, &to_block, &account
            );
            
            // Créer la requête
            let query = AuditQuery {
                id: query_id,
                from_block,
                to_block,
                entry_types,
                categories,
                account: account.clone(),
                module,
                status: AuditQueryStatus::InProgress,
                limit,
                results: Vec::new(),
            };
            
            // Stocker la requête
            <AuditQueries<T>>::insert(query_id, query);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::AuditQueryCreated(
                query_id,
                from_block,
                to_block,
                account
            ));
            
            Ok(())
        }
        
        /// Récupérer les résultats d'une requête d'audit
        #[weight = 10_000]
        pub fn get_audit_query_results(
            origin,
            query_id: [u8; 32],
        ) -> DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Vérifier que le compte est une autorité d'audit
            ensure!(
                T::AuditAuthorities::get().contains(&account),
                Error::<T>::Unauthorized
            );
            
            // Vérifier que la requête existe
            ensure!(
                <AuditQueries<T>>::contains_key(query_id),
                Error::<T>::AuditQueryNotFound
            );
            
            // La requête existe, mais les résultats sont déjà disponibles
            // dans le stockage. Cette fonction est juste un point d'accès
            // pour vérifier que l'accès est autorisé.
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Valider une configuration d'audit
    fn validate_audit_config(config: &AuditConfig) -> DispatchResult {
        // Vérifier les valeurs
        ensure!(
            config.maximum_entries_per_block > 0,
            Error::<T>::InvalidAuditConfig
        );
        
        ensure!(
            !config.enabled_entry_types.is_empty(),
            Error::<T>::InvalidAuditConfig
        );
        
        Ok(())
    }
    
    /// Créer une entrée d'audit
    pub fn do_create_audit_entry(
        entry_type: AuditEntryType,
        category: AuditCategory,
        severity: AuditSeverity,
        account: Option<T::AccountId>,
        module: Vec<u8>,
        function: Vec<u8>,
        result: bool,
        data: Vec<u8>,
        metadata: Vec<u8>,
    ) -> DispatchResult {
        // Incrémenter le compteur d'entrées pour le bloc
        let current_count = Self::current_block_entry_count();
        <CurrentBlockEntryCount<T>>::put(current_count + 1);
        
        // Générer un ID unique
        let entry_id = Self::generate_entry_id(
            &entry_type, &category, &module, &function, &data
        );
        
        // Créer l'entrée
        let current_block = <frame_system::Module<T>>::block_number();
        let entry = AuditEntry {
            id: entry_id,
            entry_type: entry_type.clone(),
            category: category.clone(),
            severity,
            account: account.clone(),
            module: module.clone(),
            function,
            block: current_block,
            timestamp: Self::get_timestamp(),
            result,
            data,
            metadata,
        };
        
        // Stocker l'entrée
        <AuditEntries<T>>::insert(entry_id, entry);
        
        // Mettre à jour les index
        let mut block_entries = <AuditEntriesByBlock<T>>::get(current_block);
        block_entries.push(entry_id);
        <AuditEntriesByBlock<T>>::insert(current_block, block_entries);
        
        if let Some(acc) = account {
            let mut account_entries = <AuditEntriesByAccount<T>>::get(&acc);
            account_entries.push(entry_id);
            <AuditEntriesByAccount<T>>::insert(&acc, account_entries);
        }
        
        let mut module_entries = <AuditEntriesByModule<T>>::get(&module);
        module_entries.push(entry_id);
        <AuditEntriesByModule<T>>::insert(&module, module_entries);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::AuditEntryCreated(
            entry_id,
            entry_type,
            category,
            severity
        ));
        
        Ok(())
    }
    
    /// Nettoyer les anciennes entrées d'audit
    fn perform_audit_cleanup(current_block: T::BlockNumber) {
        // Récupérer la configuration
        let config = Self::audit_configuration();
        
        // Déterminer le bloc le plus ancien à conserver
        let retention_period = config.retention_period;
        let oldest_block_to_keep = current_block.saturating_sub(retention_period.into());
        
        // Compteur d'entrées nettoyées
        let mut cleaned_count: u32 = 0;
        
        // Nettoyer les blocs plus anciens
        for block in 0..oldest_block_to_keep.saturated_into::<u32>() {
            let block_number = T::BlockNumber::from(block);
            let entries = <AuditEntriesByBlock<T>>::get(block_number);
            
            // Supprimer chaque entrée
            for entry_id in &entries {
                if let Some(entry) = <AuditEntries<T>>::get(entry_id) {
                    // Nettoyer les index
                    if let Some(ref account) = entry.account {
                        let mut account_entries = <AuditEntriesByAccount<T>>::get(account);
                        account_entries.retain(|id| id != entry_id);
                        <AuditEntriesByAccount<T>>::insert(account, account_entries);
                    }
                    
                    let mut module_entries = <AuditEntriesByModule<T>>::get(&entry.module);
                    module_entries.retain(|id| id != entry_id);
                    <AuditEntriesByModule<T>>::insert(&entry.module, module_entries);
                    
                    // Supprimer l'entrée
                    <AuditEntries<T>>::remove(entry_id);
                    cleaned_count += 1;
                }
            }
            
            // Supprimer l'index du bloc
            <AuditEntriesByBlock<T>>::remove(block_number);
        }
        
        // Mettre à jour le bloc de dernier nettoyage
        <LastCleanupBlock<T>>::put(current_block);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::AuditCleanupPerformed(
            current_block,
            cleaned_count
        ));
    }
    
    /// Traiter les requêtes d'audit en cours
    fn process_audit_queries() {
        let mut completed_queries: Vec<[u8; 32]> = Vec::new();
        
        // Parcourir les requêtes en cours
        for (query_id, mut query) in <AuditQueries<T>>::iter() {
            if query.status == AuditQueryStatus::InProgress {
                // Exécuter la requête
                let results = Self::execute_audit_query(&query);
                
                // Mettre à jour la requête avec les résultats
                query.results = results.clone();
                query.status = AuditQueryStatus::Completed;
                <AuditQueries<T>>::insert(query_id, query.clone());
                
                // Ajouter à la liste des requêtes complétées
                completed_queries.push(query_id);
                
                // Émettre un événement
                Self::deposit_event(RawEvent::AuditQueryCompleted(
                    query_id,
                    results.len() as u32
                ));
            }
        }
    }
    
    /// Exécuter une requête d'audit et retourner les résultats
    fn execute_audit_query(query: &AuditQuery<T>) -> Vec<[u8; 32]> {
        let mut results = Vec::new();
        
        // Parcourir les blocs concernés
        for block in query.from_block.saturated_into::<u32>()..=query.to_block.saturated_into::<u32>() {
            let block_number = T::BlockNumber::from(block);
            let entries = <AuditEntriesByBlock<T>>::get(block_number);
            
            // Filtrer les entrées selon les critères
            for entry_id in entries {
                if let Some(entry) = <AuditEntries<T>>::get(entry_id) {
                    // Vérifier le type d'entrée
                    if !query.entry_types.is_empty() && !query.entry_types.contains(&entry.entry_type) {
                        continue;
                    }
                    
                    // Vérifier la catégorie
                    if !query.categories.is_empty() && !query.categories.contains(&entry.category) {
                        continue;
                    }
                    
                    // Vérifier le compte
                    if let Some(ref account) = query.account {
                        if entry.account.as_ref() != Some(account) {
                            continue;
                        }
                    }
                    
                    // Vérifier le module
                    if let Some(ref module) = query.module {
                        if &entry.module != module {
                            continue;
                        }
                    }
                    
                    // Ajouter aux résultats
                    results.push(entry_id);
                    
                    // Vérifier la limite
                    if results.len() >= query.limit as usize {
                        return results;
                    }
                }
            }
        }
        
        results
    }
    
    /// Générer un ID unique pour une entrée d'audit
    fn generate_entry_id(
        entry_type: &AuditEntryType,
        category: &AuditCategory,
        module: &[u8],
        function: &[u8],
        data: &[u8],
    ) -> [u8; 32] {
        let mut input = Vec::new();
        input.extend_from_slice(&(*entry_type as u8).to_be_bytes());
        input.extend_from_slice(&(*category as u8).to_be_bytes());
        input.extend_from_slice(module);
        input.extend_from_slice(function);
        input.extend_from_slice(&Self::get_timestamp().to_be_bytes());
        input.extend_from_slice(&<frame_system::Module<T>>::block_number().encode());
        input.extend_from_slice(&data[0..core::cmp::min(data.len(), 64)]);
        
        sp_io::hashing::blake2_256(&input)
    }
    
    /// Générer un ID unique pour une requête d'audit
    fn generate_query_id(
        creator: &T::AccountId,
        from_block: &T::BlockNumber,
        to_block: &T::BlockNumber,
        account: &Option<T::AccountId>,
    ) -> [u8; 32] {
        let mut input = Vec::new();
        input.extend_from_slice(&creator.encode());
        input.extend_from_slice(&from_block.encode());
        input.extend_from_slice(&to_block.encode());
        
        if let Some(ref acc) = account {
            input.extend_from_slice(&acc.encode());
        }
        
        input.extend_from_slice(&Self::get_timestamp().to_be_bytes());
        
        sp_io::hashing::blake2_256(&input)
    }
    
    /// Obtenir un timestamp
    fn get_timestamp() -> u64 {
        let block_number: u64 = <frame_system::Module<T>>::block_number().saturated_into();
        block_number * 6000 // Estimer 6 secondes par bloc
    }
    
    /// Interface publique pour créer une entrée d'audit depuis d'autres modules
    pub fn record_event(
        entry_type: AuditEntryType,
        category: AuditCategory,
        severity: AuditSeverity,
        account: Option<T::AccountId>,
        module: Vec<u8>,
        function: Vec<u8>,
        result: bool,
        data: Vec<u8>,
    ) -> DispatchResult {
        // Vérifier la configuration actuelle
        let config = Self::audit_configuration();
        
        // Vérifier le niveau de log minimum
        let min_level = &config.min_log_level;
        
        let entry_level = match severity {
            AuditSeverity::Info => LogLevel::Standard,
            AuditSeverity::Warning => LogLevel::High,
            AuditSeverity::Critical => LogLevel::Critical,
        };
        
        // Ignorer les entrées de niveau inférieur
        match (min_level, &entry_level) {
            (LogLevel::Critical, LogLevel::High) |
            (LogLevel::Critical, LogLevel::Standard) |
            (LogLevel::Critical, LogLevel::Verbose) |
            (LogLevel::Critical, LogLevel::Debug) |
            (LogLevel::High, LogLevel::Standard) |
            (LogLevel::High, LogLevel::Verbose) |
            (LogLevel::High, LogLevel::Debug) |
            (LogLevel::Standard, LogLevel::Verbose) |
            (LogLevel::Standard, LogLevel::Debug) |
            (LogLevel::Verbose, LogLevel::Debug) => {
                return Ok(());
            },
            _ => {},
        }
        
        // Vérifier si le type d'entrée est activé
        if !config.enabled_entry_types.contains(&entry_type) {
            return Ok(());
        }
        
        // Vérifier si le module est audité
        if !config.audited_modules.is_empty() && !config.audited_modules.contains(&module) {
            return Ok(());
        }
        
        // Vérifier la limite d'entrées par bloc
        let current_count = Self::current_block_entry_count();
        if current_count >= config.maximum_entries_per_block {
            return Ok(());
        }
        
        // Créer l'entrée
        Self::do_create_audit_entry(
            entry_type,
            category,
            severity,
            account,
            module,
            function,
            result,
            data,
            Vec::new() // Pas de métadonnées pour les entrées automatiques
        )
    }
}

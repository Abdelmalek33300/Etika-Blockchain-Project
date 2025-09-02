// etika-security/src/update.rs
//
// Module de gestion des mises à jour sécurisées pour l'écosystème Étika
// Ce module gère le processus de mise à jour des composants du système de manière sécurisée

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::Get, Parameter,
};
use frame_system::{self as system, ensure_signed, ensure_root};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, Member, Zero, Hash, Verify},
    DispatchError, RuntimeDebug, MultiSignature,
};
use sp_std::prelude::*;
use crate::audit::{AuditEntryType, AuditCategory, AuditSeverity};

/// Type d'une mise à jour
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum UpdateType {
    /// Mise à jour du runtime
    Runtime,
    /// Mise à jour d'un module spécifique
    Module,
    /// Mise à jour des paramètres de configuration
    Config,
    /// Mise à jour des accès de sécurité
    SecurityAccess,
    /// Mise à jour d'urgence
    Emergency,
}

/// Statut d'une mise à jour
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum UpdateStatus {
    /// Proposée
    Proposed,
    /// En cours de revue
    InReview,
    /// Approuvée
    Approved,
    /// Rejetée
    Rejected,
    /// En cours de déploiement
    Deploying,
    /// Déployée
    Deployed,
    /// Échouée
    Failed,
    /// Annulée
    Cancelled,
    /// Mise en pause
    Paused,
}

/// Informations sur une mise à jour
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct UpdateInfo<T: Config> {
    /// Identifiant unique de la mise à jour
    pub id: [u8; 32],
    /// Type de mise à jour
    pub update_type: UpdateType,
    /// Version actuelle
    pub current_version: Vec<u8>,
    /// Nouvelle version
    pub new_version: Vec<u8>,
    /// Description de la mise à jour
    pub description: Vec<u8>,
    /// Hash IPFS ou autre référence du code de mise à jour
    pub code_reference: Vec<u8>,
    /// Hash de vérification du code
    pub code_hash: [u8; 32],
    /// Signature cryptographique du code
    pub code_signature: Vec<u8>,
    /// Proposant de la mise à jour
    pub proposer: T::AccountId,
    /// Niveau d'urgence (0-100)
    pub urgency_level: u8,
    /// Statut actuel
    pub status: UpdateStatus,
    /// Moment de proposition
    pub proposed_at: T::BlockNumber,
    /// Moment prévu pour le déploiement
    pub scheduled_at: Option<T::BlockNumber>,
    /// Bloc d'expiration automatique
    pub expires_at: T::BlockNumber,
    /// Approbateurs
    pub approvers: Vec<T::AccountId>,
    /// Nombre d'approbations requises
    pub required_approvals: u32,
    /// Modules impactés
    pub affected_modules: Vec<Vec<u8>>,
    /// Nécessite un arrêt du système
    pub requires_downtime: bool,
    /// Notes de changement
    pub changelog: Vec<u8>,
    /// Possibilité de rollback
    pub can_rollback: bool,
    /// Dépendances
    pub dependencies: Vec<[u8; 32]>,
}

/// Plan de déploiement d'une mise à jour
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct DeploymentPlan {
    /// Étapes du déploiement
    pub steps: Vec<DeploymentStep>,
    /// Étape actuelle
    pub current_step: u32,
    /// Statut du déploiement
    pub deployment_status: DeploymentStatus,
    /// Début du déploiement
    pub started_at: u64,
    /// Fin du déploiement
    pub completed_at: Option<u64>,
    /// Logs du déploiement
    pub logs: Vec<Vec<u8>>,
}

/// Étape de déploiement
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct DeploymentStep {
    /// Description de l'étape
    pub description: Vec<u8>,
    /// Statut de l'étape
    pub status: DeploymentStepStatus,
    /// Fonction à exécuter
    pub function: Vec<u8>,
    /// Paramètres
    pub parameters: Vec<u8>,
    /// Résultat
    pub result: Option<Vec<u8>>,
    /// Début de l'étape
    pub started_at: Option<u64>,
    /// Fin de l'étape
    pub completed_at: Option<u64>,
}

/// Statut d'une étape de déploiement
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum DeploymentStepStatus {
    /// En attente
    Pending,
    /// En cours
    InProgress,
    /// Réussie
    Successful,
    /// Échouée
    Failed,
    /// Annulée
    Cancelled,
}

/// Statut global du déploiement
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum DeploymentStatus {
    /// Préparation
    Preparing,
    /// En cours
    InProgress,
    /// Réussi
    Successful,
    /// Échoué
    Failed,
    /// Annulé
    Cancelled,
    /// En pause
    Paused,
}

/// Configuration des mises à jour
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct UpdateConfig {
    /// Délai minimal entre proposition et déploiement (en blocs)
    pub min_review_period: u32,
    /// Délai d'expiration par défaut (en blocs)
    pub default_expiry_period: u32,
    /// Autorités de signature de code valides
    pub valid_code_signers: Vec<Vec<u8>>,
    /// Modules nécessitant une approbation renforcée
    pub critical_modules: Vec<Vec<u8>>,
    /// Nombre d'approbations par défaut
    pub default_required_approvals: u32,
    /// Nombre d'approbations pour modules critiques
    pub critical_required_approvals: u32,
    /// Autorisation des mises à jour d'urgence
    pub allow_emergency_updates: bool,
}

/// Configuration du module
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Autorités de mise à jour
    type UpdateAuthorities: Get<Vec<Self::AccountId>>;
    
    /// Configuration par défaut des mises à jour
    type DefaultUpdateConfig: Get<UpdateConfig>;
    
    /// Durée maximale d'une mise à jour en cours (en blocs)
    type MaxDeploymentDuration: Get<Self::BlockNumber>;
    
    /// Module d'audit pour enregistrer les événements de mise à jour
    type AuditModule: crate::audit::AuditInspector<Self::AccountId, Self::BlockNumber>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaUpdate {
        /// Configuration de mise à jour actuelle
        UpdateConfiguration get(fn update_configuration): UpdateConfig;
        
        /// Mises à jour proposées
        UpdateProposals get(fn update_proposals):
            map hasher(blake2_128_concat) [u8; 32] => Option<UpdateInfo<T>>;
        
        /// Plans de déploiement
        DeploymentPlans get(fn deployment_plans):
            map hasher(blake2_128_concat) [u8; 32] => Option<DeploymentPlan>;
        
        /// Mises à jour en cours de déploiement
        ActiveDeployments get(fn active_deployments): Vec<[u8; 32]>;
        
        /// Historique des mises à jour par version
        UpdateHistory get(fn update_history):
            map hasher(blake2_128_concat) Vec<u8> => Vec<[u8; 32]>;
        
        /// Dernière mise à jour par module
        LastModuleUpdate get(fn last_module_update):
            map hasher(blake2_128_concat) Vec<u8> => [u8; 32];
            
        /// Nombre total de mises à jour déployées
        TotalUpdatesDeployed get(fn total_updates_deployed): u32;
        
        /// Version actuelle du système
        CurrentSystemVersion get(fn current_system_version): Vec<u8>;
    }
    
    add_extra_genesis {
        build(|config: &GenesisConfig<T>| {
            <UpdateConfiguration<T>>::put(T::DefaultUpdateConfig::get());
            <CurrentSystemVersion<T>>::put(b"1.0.0".to_vec());
            <TotalUpdatesDeployed<T>>::put(0);
        });
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Mise à jour proposée
        /// [update_id, proposer, update_type]
        UpdateProposed([u8; 32], AccountId, UpdateType),
        
        /// Mise à jour approuvée
        /// [update_id, approver, current_approvals, required_approvals]
        UpdateApproved([u8; 32], AccountId, u32, u32),
        
        /// Mise à jour rejetée
        /// [update_id, rejector]
        UpdateRejected([u8; 32], AccountId),
        
        /// Déploiement commencé
        /// [update_id, block_number]
        DeploymentStarted([u8; 32], BlockNumber),
        
        /// Étape de déploiement terminée
        /// [update_id, step_number, status]
        DeploymentStepCompleted([u8; 32], u32, DeploymentStepStatus),
        
        /// Déploiement terminé
        /// [update_id, status]
        DeploymentCompleted([u8; 32], DeploymentStatus),
        
        /// Mise à jour annulée
        /// [update_id, account]
        UpdateCancelled([u8; 32], AccountId),
        
        /// Configuration de mise à jour modifiée
        /// [account]
        UpdateConfigChanged(AccountId),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Compte non autorisé
        Unauthorized,
        
        /// Configuration de mise à jour invalide
        InvalidUpdateConfig,
        
        /// Mise à jour non trouvée
        UpdateNotFound,
        
        /// Statut de mise à jour invalide
        InvalidUpdateStatus,
        
        /// Signature de code invalide
        InvalidCodeSignature,
        
        /// Période de revue insuffisante
        InsufficientReviewPeriod,
        
        /// Approbation déjà donnée
        AlreadyApproved,
        
        /// Approbations insuffisantes
        InsufficientApprovals,
        
        /// Déploiement déjà en cours
        DeploymentAlreadyInProgress,
        
        /// Déploiement non trouvé
        DeploymentNotFound,
        
        /// Étape de déploiement invalide
        InvalidDeploymentStep,
        
        /// Mise à jour expirée
        UpdateExpired,
        
        /// Dépendances de mise à jour non satisfaites
        UnsatisfiedDependencies,
        
        /// Mises à jour d'urgence non autorisées
        EmergencyUpdatesNotAllowed,
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
            // Vérifier les mises à jour expirées
            Self::clean_expired_updates(n);
            
            // Traiter les déploiements actifs
            Self::process_active_deployments(n);
            
            0
        }
        
        /// Proposer une mise à jour
        #[weight = 10_000]
        pub fn propose_update(
            origin,
            update_type: UpdateType,
            current_version: Vec<u8>,
            new_version: Vec<u8>,
            description: Vec<u8>,
            code_reference: Vec<u8>,
            code_hash: [u8; 32],
            code_signature: Vec<u8>,
            urgency_level: u8,
            affected_modules: Vec<Vec<u8>>,
            requires_downtime: bool,
            changelog: Vec<u8>,
            can_rollback: bool,
            dependencies: Vec<[u8; 32]>,
        ) -> DispatchResult {
            let proposer = ensure_signed(origin)?;
            
            // Vérifier que le proposant est une autorité de mise à jour
            ensure!(
                T::UpdateAuthorities::get().contains(&proposer),
                Error::<T>::Unauthorized
            );
            
            // Récupérer la configuration
            let config = Self::update_configuration();
            
            // Vérifier les mises à jour d'urgence
            if update_type == UpdateType::Emergency {
                ensure!(
                    config.allow_emergency_updates,
                    Error::<T>::EmergencyUpdatesNotAllowed
                );
            }
            
            // Vérifier la signature du code (simplifié)
            // Une vérification réelle utiliserait la cryptographie adéquate
            Self::verify_code_signature(&code_reference, &code_hash, &code_signature)?;
            
            // Vérifier les dépendances
            Self::check_dependencies(&dependencies)?;
            
            // Déterminer le nombre d'approbations requises
            let required_approvals = if affected_modules.iter().any(|m| config.critical_modules.contains(m)) {
                config.critical_required_approvals
            } else {
                config.default_required_approvals
            };
            
            // Générer un ID unique
            let update_id = Self::generate_update_id(
                &proposer, 
                &update_type, 
                &current_version, 
                &new_version
            );
            
            // Calculer l'expiration
            let current_block = <frame_system::Module<T>>::block_number();
            let expires_at = current_block.saturating_add(config.default_expiry_period.into());
            
            // Créer l'info de mise à jour
            let update_info = UpdateInfo {
                id: update_id,
                update_type: update_type.clone(),
                current_version,
                new_version: new_version.clone(),
                description: description.clone(),
                code_reference,
                code_hash,
                code_signature,
                proposer: proposer.clone(),
                urgency_level,
                status: UpdateStatus::Proposed,
                proposed_at: current_block,
                scheduled_at: None,
                expires_at,
                approvers: vec![proposer.clone()], // Le proposant est le premier approbateur
                required_approvals,
                affected_modules: affected_modules.clone(),
                requires_downtime,
                changelog,
                can_rollback,
                dependencies,
            };
            
            // Stocker la mise à jour
            <UpdateProposals<T>>::insert(update_id, update_info);
            
            // Mettre à jour l'historique
            let mut history = <UpdateHistory<T>>::get(&new_version);
            history.push(update_id);
            <UpdateHistory<T>>::insert(&new_version, history);
            
            // Enregistrer un événement d'audit
            if let Some(audit) = T::AuditModule::get() {
                let _ = audit.record_event(
                    AuditEntryType::Governance,
                    AuditCategory::Create,
                    AuditSeverity::Info,
                    Some(proposer.clone()),
                    b"update".to_vec(),
                    b"propose_update".to_vec(),
                    true,
                    description,
                );
            }
            
            // Émettre un événement
            Self::deposit_event(RawEvent::UpdateProposed(
                update_id,
                proposer,
                update_type
            ));
            
            Ok(())
        }
        
        /// Approuver une mise à jour
        #[weight = 10_000]
        pub fn approve_update(
            origin,
            update_id: [u8; 32],
        ) -> DispatchResult {
            let approver = ensure_signed(origin)?;
            
            // Vérifier que l'approbateur est une autorité de mise à jour
            ensure!(
                T::UpdateAuthorities::get().contains(&approver),
                Error::<T>::Unauthorized
            );
            
            // Récupérer l'info de mise à jour
            let mut update_info = <UpdateProposals<T>>::get(update_id)
                .ok_or(Error::<T>::UpdateNotFound)?;
            
            // Vérifier le statut
            ensure!(
                update_info.status == UpdateStatus::Proposed || 
                update_info.status == UpdateStatus::InReview,
                Error::<T>::InvalidUpdateStatus
            );
            
            // Vérifier l'expiration
            let current_block = <frame_system::Module<T>>::block_number();
            ensure!(
                current_block <= update_info.expires_at,
                Error::<T>::UpdateExpired
            );
            
            // Vérifier que l'approbateur n'a pas déjà approuvé
            ensure!(
                !update_info.approvers.contains(&approver),
                Error::<T>::AlreadyApproved
            );
            
            // Ajouter l'approbation
            update_info.approvers.push(approver.clone());
            
            // Mettre à jour le statut si nécessaire
            if update_info.status == UpdateStatus::Proposed {
                update_info.status = UpdateStatus::InReview;
            }
            
            // Vérifier si le seuil d'approbation est atteint
            if update_info.approvers.len() >= update_info.required_approvals as usize {
                update_info.status = UpdateStatus::Approved;
                
                // Planifier le déploiement
                let config = Self::update_configuration();
                let min_deploy_block = update_info.proposed_at
                    .saturating_add(config.min_review_period.into());
                
                // Si la période de revue minimale est passée, déployer immédiatement
                if current_block >= min_deploy_block {
                    update_info.scheduled_at = Some(current_block);
                } else {
                    update_info.scheduled_at = Some(min_deploy_block);
                }
            }
            
            // Mettre à jour le stockage
            <UpdateProposals<T>>::insert(update_id, update_info.clone());
            
            // Émettre un événement
            Self::deposit_event(RawEvent::UpdateApproved(
                update_id,
                approver.clone(),
                update_info.approvers.len() as u32,
                update_info.required_approvals
            ));
            
            // Enregistrer un événement d'audit
            if let Some(audit) = T::AuditModule::get() {
                let _ = audit.record_event(
                    AuditEntryType::Governance,
                    AuditCategory::Validate,
                    AuditSeverity::Info,
                    Some(approver),
                    b"update".to_vec(),
                    b"approve_update".to_vec(),
                    true,
                    update_id.to_vec(),
                );
            }
            
            Ok(())
        }
        
        /// Rejeter une mise à jour
        #[weight = 10_000]
        pub fn reject_update(
            origin,
            update_id: [u8; 32],
            reason: Vec<u8>,
        ) -> DispatchResult {
            let rejector = ensure_signed(origin)?;
            
            // Vérifier que le rejeteur est une autorité de mise à jour
            ensure!(
                T::UpdateAuthorities::get().contains(&rejector),
                Error::<T>::Unauthorized
            );
            
            // Récupérer l'info de mise à jour
            let mut update_info = <UpdateProposals<T>>::get(update_id)
                .ok_or(Error::<T>::UpdateNotFound)?;
            
            // Vérifier le statut
            ensure!(
                update_info.status == UpdateStatus::Proposed || 
                update_info.status == UpdateStatus::InReview,
                Error::<T>::InvalidUpdateStatus
            );
            
            // Marquer comme rejetée
            update_info.status = UpdateStatus::Rejected;
            <UpdateProposals<T>>::insert(update_id, update_info);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::UpdateRejected(
                update_id,
                rejector.clone()
            ));
            
            // Enregistrer un événement d'audit
            if let Some(audit) = T::AuditModule::get() {
                let _ = audit.record_event(
                    AuditEntryType::Governance,
                    AuditCategory::Reject,
                    AuditSeverity::Warning,
                    Some(rejector),
                    b"update".to_vec(),
                    b"reject_update".to_vec(),
                    true,
                    reason,
                );
            }
            
            Ok(())
        }
        
        /// Créer un plan de déploiement
        #[weight = 10_000]
        pub fn create_deployment_plan(
            origin,
            update_id: [u8; 32],
            steps: Vec<DeploymentStep>,
        ) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            
            // Vérifier que le créateur est une autorité de mise à jour
            ensure!(
                T::UpdateAuthorities::get().contains(&creator),
                Error::<T>::Unauthorized
            );
            
            // Récupérer l'info de mise à jour
            let update_info = <UpdateProposals<T>>::get(update_id)
                .ok_or(Error::<T>::UpdateNotFound)?;
            
            // Vérifier le statut
            ensure!(
                update_info.status == UpdateStatus::Approved,
                Error::<T>::InvalidUpdateStatus
            );
            
            // Vérifier que le déploiement n'est pas déjà en cours
            ensure!(
                !<DeploymentPlans<T>>::contains_key(update_id),
                Error::<T>::DeploymentAlreadyInProgress
            );
            
            // Créer le plan
            let plan = DeploymentPlan {
                steps,
                current_step: 0,
                deployment_status: DeploymentStatus::Preparing,
                started_at: Self::get_timestamp(),
                completed_at: None,
                logs: Vec::new(),
            };
            
            // Stocker le plan
            <DeploymentPlans<T>>::insert(update_id, plan);
            
            Ok(())
        }
        
        /// Démarrer un déploiement
        #[weight = 10_000]
        pub fn start_deployment(
            origin,
            update_id: [u8; 32],
        ) -> DispatchResult {
            let initiator = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est une autorité de mise à jour
            ensure!(
                T::UpdateAuthorities::get().contains(&initiator),
                Error::<T>::Unauthorized
            );
            
            // Récupérer l'info de mise à jour
            let mut update_info = <UpdateProposals<T>>::get(update_id)
                .ok_or(Error::<T>::UpdateNotFound)?;
            
            // Vérifier le statut
            ensure!(
                update_info.status == UpdateStatus::Approved,
                Error::<T>::InvalidUpdateStatus
            );
            
            // Récupérer le plan de déploiement
            let mut plan = <DeploymentPlans<T>>::get(update_id)
                .ok_or(Error::<T>::DeploymentNotFound)?;
            
            // Vérifier le statut du plan
            ensure!(
                plan.deployment_status == DeploymentStatus::Preparing,
                Error::<T>::InvalidDeploymentStep
            );
            
            // Mettre à jour les statuts
            update_info.status = UpdateStatus::Deploying;
            plan.deployment_status = DeploymentStatus::InProgress;
            plan.started_at = Self::get_timestamp();
            
            // Mettre à jour le premier pas
            if !plan.steps.is_empty() {
                plan.steps[0].status = DeploymentStepStatus::InProgress;
                plan.steps[0].started_at = Some(Self::get_timestamp());
            }
            
            // Mettre à jour le stockage
            <UpdateProposals<T>>::insert(update_id, update_info);
            <DeploymentPlans<T>>::insert(update_id, plan);
            
            // Ajouter aux déploiements actifs
            let mut active = <ActiveDeployments<T>>::get();
            active.push(update_id);
            <ActiveDeployments<T>>::put(active);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::DeploymentStarted(
                update_id,
                <frame_system::Module<T>>::block_number()
            ));
            
            // Enregistrer un événement d'audit
            if let Some(audit) = T::AuditModule::get() {
                let _ = audit.record_event(
                    AuditEntryType::Governance,
                    AuditCategory::Update,
                    AuditSeverity::Critical,
                    Some(initiator),
                    b"update".to_vec(),
                    b"start_deployment".to_vec(),
                    true,
                    update_id.to_vec(),
                );
            }
            
            Ok(())
        }
        
        /// Mettre à jour le statut d'une étape de déploiement
        #[weight = 10_000]
        pub fn update_deployment_step(
            origin,
            update_id: [u8; 32],
            step_index: u32,
            new_status: DeploymentStepStatus,
            result: Option<Vec<u8>>,
        ) -> DispatchResult {
            let updater = ensure_signed(origin)?;
            
            // Vérifier que le metteur à jour est une autorité de mise à jour
            ensure!(
                T::UpdateAuthorities::get().contains(&updater),
                Error::<T>::Unauthorized
            );
            
            // Récupérer le plan de déploiement
            let mut plan = <DeploymentPlans<T>>::get(update_id)
                .ok_or(Error::<T>::DeploymentNotFound)?;
            
            // Vérifier que l'étape existe
            ensure!(
                (step_index as usize) < plan.steps.len(),
                Error::<T>::InvalidDeploymentStep
            );
            
            // Vérifier le statut actuel de l'étape
            ensure!(
                plan.steps[step_index as usize].status == DeploymentStepStatus::InProgress,
                Error::<T>::InvalidDeploymentStep
            );
            
            // Mettre à jour le statut de l'étape
            plan.steps[step_index as usize].status = new_status.clone();
            plan.steps[step_index as usize].result = result;
            plan.steps[step_index as usize].completed_at = Some(Self::get_timestamp());
            
            // Émettre un événement
            Self::deposit_event(RawEvent::DeploymentStepCompleted(
                update_id,
                step_index,
                new_status.clone()
            ));
            
            // Si c'est la dernière étape ou si elle a échoué, mettre à jour le statut du déploiement
            if new_status == DeploymentStepStatus::Failed {
                plan.deployment_status = DeploymentStatus::Failed;
                plan.completed_at = Some(Self::get_timestamp());
                
                // Mettre à jour la mise à jour
                if let Some(mut update_info) = <UpdateProposals<T>>::get(update_id) {
                    update_info.status = UpdateStatus::Failed;
                    <UpdateProposals<T>>::insert(update_id, update_info);
                }
                
                // Retirer des déploiements actifs
                let mut active = <ActiveDeployments<T>>::get();
                active.retain(|id| *id != update_id);
                <ActiveDeployments<T>>::put(active);
                
                // Émettre un événement de fin de déploiement
                Self::deposit_event(RawEvent::DeploymentCompleted(
                    update_id,
                    DeploymentStatus::Failed
                ));
            } else if new_status == DeploymentStepStatus::Successful && step_index as usize == plan.steps.len() - 1 {
                // Dernière étape réussie = déploiement terminé
                plan.deployment_status = DeploymentStatus::Successful;
                plan.completed_at = Some(Self::get_timestamp());
                
                // Mettre à jour la mise à jour
                if let Some(mut update_info) = <UpdateProposals<T>>::get(update_id) {
                    update_info.status = UpdateStatus::Deployed;
                    <UpdateProposals<T>>::insert(update_id, update_info.clone());
                    
                    // Mettre à jour les informations système
                    if update_info.update_type == UpdateType::Runtime {
                        <CurrentSystemVersion<T>>::put(update_info.new_version.clone());
                    }
                    
                    // Mettre à jour la dernière mise à jour par module
                    for module in update_info.affected_modules {
                        <LastModuleUpdate<T>>::insert(&module, update_id);
                    }
                    
                    // Incrémenter le compteur total
                    let count = <TotalUpdatesDeployed<T>>::get();
                    <TotalUpdatesDeployed<T>>::put(count + 1);
                }
                
                // Retirer des déploiements actifs
                let mut active = <ActiveDeployments<T>>::get();
                active.retain(|id| *id != update_id);
                <ActiveDeployments<T>>::put(active);
                
                // Émettre un événement de fin de déploiement
                Self::deposit_event(RawEvent::DeploymentCompleted(
                    update_id,
                    DeploymentStatus::Successful
                ));
            } else if new_status == DeploymentStepStatus::Successful {
                // Passer à l'étape suivante
                plan.current_step = step_index + 1;
                
                if (plan.current_step as usize) < plan.steps.len() {
                    plan.steps[plan.current_step as usize].status = DeploymentStepStatus::InProgress;
                    plan.steps[plan.current_step as usize].started_at = Some(Self::get_timestamp());
                }
            }
            
            // Mettre à jour le plan
            <DeploymentPlans<T>>::insert(update_id, plan);
            
            Ok(())
        }
        
        /// Annuler une mise à jour
        #[weight = 10_000]
        pub fn cancel_update(
            origin,
            update_id: [u8; 32],
            reason: Vec<u8>,
        ) -> DispatchResult {
            let canceller = ensure_signed(origin)?;
            
            // Vérifier que l'annuleur est une autorité de mise à jour
            ensure!(
                T::UpdateAuthorities::get().contains(&canceller),
                Error::<T>::Unauthorized
            );
            
            // Récupérer l'info de mise à jour
            let mut update_info = <UpdateProposals<T>>::get(update_id)
                .ok_or(Error::<T>::UpdateNotFound)?;
            
            // Vérifier le statut
            ensure!(
                update_info.status != UpdateStatus::Deployed && 
                update_info.status != UpdateStatus::Failed && 
                update_info.status != UpdateStatus::Cancelled,
                Error::<T>::InvalidUpdateStatus
            );
            
            // Si un déploiement est en cours, l'annuler aussi
            if update_info.status == UpdateStatus::Deploying {
                if let Some(mut plan) = <DeploymentPlans<T>>::get(update_id) {
                    plan.deployment_status = DeploymentStatus::Cancelled;
                    plan.completed_at = Some(Self::get_timestamp());
                    <DeploymentPlans<T>>::insert(update_id, plan);
                    
                    // Retirer des déploiements actifs
                    let mut active = <ActiveDeployments<T>>::get();
                    active.retain(|id| *id != update_id);
                    <ActiveDeployments<T>>::put(active);
                }
            }
            
            // Marquer comme annulée
            update_info.status = UpdateStatus::Cancelled;
            <UpdateProposals<T>>::insert(update_id, update_info);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::UpdateCancelled(
                update_id,
                canceller.clone()
            ));
            
            // Enregistrer un événement d'audit
            if let Some(audit) = T::AuditModule::get() {
                let _ = audit.record_event(
                    AuditEntryType::Governance,
                    AuditCategory::Delete,
                    AuditSeverity::Warning,
                    Some(canceller),
                    b"update".to_vec(),
                    b"cancel_update".to_vec(),
                    true,
                    reason,
                );
            }
            
            Ok(())
        }
        
        /// Mettre à jour la configuration de mise à jour
        #[weight = 10_000]
        pub fn update_config(
            origin,
            new_config: UpdateConfig,
        ) -> DispatchResult {
            let updater = ensure_root(origin)?;
            
            // Valider la configuration
            ensure!(
                new_config.min_review_period > 0,
                Error::<T>::InvalidUpdateConfig
            );
            
            ensure!(
                new_config.default_required_approvals > 0 && 
                new_config.critical_required_approvals >= new_config.default_required_approvals,
                Error::<T>::InvalidUpdateConfig
            );
            
            // Mettre à jour la configuration
            <UpdateConfiguration<T>>::put(new_config);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::UpdateConfigChanged(updater));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Nettoyer les mises à jour expirées
    fn clean_expired_updates(current_block: T::BlockNumber) {
        for (id, update_info) in <UpdateProposals<T>>::iter() {
            if (update_info.status == UpdateStatus::Proposed || 
                update_info.status == UpdateStatus::InReview) && 
                current_block > update_info.expires_at {
                
                // Marquer comme expirée (utilisons Cancelled pour simplifier)
                let mut updated_info = update_info;
                updated_info.status = UpdateStatus::Cancelled;
                <UpdateProposals<T>>::insert(id, updated_info);
                
                // Émettre un événement
                Self::deposit_event(RawEvent::UpdateCancelled(
                    id,
                    T::AccountId::default() // Utilisez une valeur par défaut pour indiquer expiration système
                ));
            }
        }
    }
    
    /// Traiter les déploiements actifs
    fn process_active_deployments(current_block: T::BlockNumber) {
        let active = <ActiveDeployments<T>>::get();
        
        for update_id in active.iter() {
            if let Some(update_info) = <UpdateProposals<T>>::get(update_id) {
                // Vérifier si le déploiement doit commencer
                if update_info.status == UpdateStatus::Approved && 
                   update_info.scheduled_at.is_some() && 
                   current_block >= update_info.scheduled_at.unwrap() {
                    
                    // Démarrer automatiquement le déploiement si un plan existe
                    if <DeploymentPlans<T>>::contains_key(update_id) {
                        let _ = Self::start_deployment(
                            frame_system::RawOrigin::Signed(T::UpdateAuthorities::get()[0].clone()).into(),
                            *update_id
                        );
                    }
                }
            }
        }
    }
    
    /// Vérifier la signature du code
    fn verify_code_signature(
        code_reference: &[u8],
        code_hash: &[u8; 32],
        code_signature: &[u8],
    ) -> DispatchResult {
        // Note: Cette fonction devrait implémenter une vérification cryptographique réelle
        // Pour simplifier, nous supposons que toute signature non vide est valide
        if code_signature.is_empty() {
            return Err(Error::<T>::InvalidCodeSignature.into());
        }
        
        // En pratique, vous utiliseriez une bibliothèque cryptographique
        // pour vérifier que la signature correspond au hash du code
        
        Ok(())
    }
    
    /// Vérifier les dépendances d'une mise à jour
    fn check_dependencies(dependencies: &[[u8; 32]]) -> DispatchResult {
        for dep_id in dependencies {
            if let Some(dep_update) = <UpdateProposals<T>>::get(dep_id) {
                // Vérifier que la dépendance est déployée
                if dep_update.status != UpdateStatus::Deployed {
                    return Err(Error::<T>::UnsatisfiedDependencies.into());
                }
            } else {
                return Err(Error::<T>::UnsatisfiedDependencies.into());
            }
        }
        
        Ok(())
    }
    
    /// Générer un ID unique pour une mise à jour
    fn generate_update_id(
        proposer: &T::AccountId,
        update_type: &UpdateType,
        current_version: &[u8],
        new_version: &[u8],
    ) -> [u8; 32] {
        let mut input = Vec::new();
        input.extend_from_slice(&proposer.encode());
        input.extend_from_slice(&(*update_type as u8).to_be_bytes());
        input.extend_from_slice(current_version);
        input.extend_from_slice(new_version);
        input.extend_from_slice(&Self::get_timestamp().to_be_bytes());
        
        sp_io::hashing::blake2_256(&input)
    }
    
    /// Obtenir un timestamp
    fn get_timestamp() -> u64 {
        let block_number: u64 = <frame_system::Module<T>>::block_number().saturated_into();
        block_number * 6000 // Estimer 6 secondes par bloc
    }
}

/// Trait pour exposer les fonctionnalités de mise à jour à d'autres modules
pub trait UpdateInspector<AccountId, BlockNumber> {
    /// Vérifier si une mise à jour est en cours
    fn is_update_in_progress() -> bool;
    
    /// Obtenir la version actuelle du système
    fn get_current_version() -> Vec<u8>;
    
    /// Vérifier si un module est en cours de mise à jour
    fn is_module_updating(module: &[u8]) -> bool;
}

/// Implémentation du trait UpdateInspector
impl<T: Config> UpdateInspector<T::AccountId, T::BlockNumber> for Module<T> {
    fn is_update_in_progress() -> bool {
        !<ActiveDeployments<T>>::get().is_empty()
    }
    
    fn get_current_version() -> Vec<u8> {
        <CurrentSystemVersion<T>>::get()
    }
    
    fn is_module_updating(module: &[u8]) -> bool {
        for update_id in <ActiveDeployments<T>>::get() {
            if let Some(update_info) = <UpdateProposals<T>>::get(update_id) {
                if update_info.affected_modules.contains(&module.to_vec()) {
                    return true;
                }
            }
        }
        false
    }
}
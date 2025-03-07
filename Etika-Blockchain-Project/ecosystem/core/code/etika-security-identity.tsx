// etika-security/src/identity.rs
//
// Module de gestion d'identité sécurisée pour l'écosystème Étika
// Ce module gère l'authentification à facteurs multiples et la gestion des identités

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::Get, Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, Member, Zero, Hash, Verify},
    DispatchError, RuntimeDebug, MultiSignature,
};
use sp_std::prelude::*;

/// Types de facteurs d'authentification
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum AuthFactor {
    /// Clé privée standard
    PrivateKey,
    /// Authentificateur externe (TOTP, FIDO, etc.)
    Authenticator,
    /// Récupération à base de tuteurs
    Recovery,
    /// Biométrique (empreinte digitale, reconnaissance faciale)
    Biometric,
    /// Réseau social vérifiable (pour certains contextes)
    SocialRecovery,
}

/// Statut d'une session
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum SessionStatus {
    /// Session active
    Active,
    /// Session verrouillée (nécessite réauthentification)
    Locked,
    /// Session expirée
    Expired,
    /// Session révoquée
    Revoked,
}

/// Méthode de récupération de compte
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum RecoveryMethod {
    /// Récupération par tuteurs désignés
    SocialRecovery(Vec<u8>),
    /// Clé de secours
    BackupKey(Vec<u8>),
    /// Phrase mnémonique
    Mnemonic(Vec<u8>),
    /// Autre méthode spécifiée
    Other(Vec<u8>),
}

/// Données de session d'authentification
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct AuthSession<T: Config> {
    /// Identifiant unique de la session
    pub id: [u8; 32],
    /// Compte associé
    pub account: T::AccountId,
    /// Facteurs d'authentification utilisés
    pub factors_used: Vec<AuthFactor>,
    /// Statut de la session
    pub status: SessionStatus,
    /// Moment de création
    pub created_at: T::BlockNumber,
    /// Moment d'expiration
    pub expires_at: T::BlockNumber,
    /// Adresse IP (ou équivalent) d'origine
    pub origin: Vec<u8>,
}

/// Profil d'identité d'un utilisateur
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct IdentityProfile<T: Config> {
    /// Compte principal
    pub account: T::AccountId,
    /// Facteurs d'authentification configurés
    pub available_factors: Vec<AuthFactor>,
    /// Méthodes de récupération configurées
    pub recovery_methods: Vec<RecoveryMethod>,
    /// Niveau de vérification de l'identité
    pub verification_level: VerificationLevel,
    /// Timestamp de dernière mise à jour
    pub last_updated: T::BlockNumber,
    /// Sessions actives
    pub active_sessions: Vec<[u8; 32]>,
    /// Nombre de tentatives d'authentification échouées
    pub failed_attempts: u32,
    /// Contacts de récupération (tuteurs)
    pub recovery_contacts: Vec<T::AccountId>,
}

/// Niveau de vérification d'identité
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum VerificationLevel {
    /// Niveau de base (email vérifié)
    Basic,
    /// Niveau standard (téléphone vérifié)
    Standard,
    /// Niveau avancé (identité vérifiée)
    Advanced,
    /// Niveau élevé (KYC complet)
    Enhanced,
}

/// Données de dispositif d'authentification
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct AuthDevice {
    /// Identifiant unique du dispositif
    pub id: [u8; 32],
    /// Type de dispositif
    pub device_type: AuthDeviceType,
    /// Données de clé publique
    pub public_key: Vec<u8>,
    /// Nom convivial du dispositif
    pub name: Vec<u8>,
    /// Moment d'enregistrement
    pub registered_at: u64,
    /// Dernière utilisation
    pub last_used: u64,
}

/// Types de dispositifs d'authentification
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum AuthDeviceType {
    /// Authentificateur FIDO/FIDO2
    FIDO,
    /// Authentificateur TOTP
    TOTP,
    /// Authentificateur SMS
    SMS,
    /// Authentificateur Email
    Email,
    /// Autre authentificateur
    Other,
}

/// Opération de récupération de compte
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct RecoveryOperation<T: Config> {
    /// Identifiant de l'opération
    pub id: [u8; 32],
    /// Compte à récupérer
    pub account: T::AccountId,
    /// Nouveau compte (optionnel)
    pub new_account: Option<T::AccountId>,
    /// Méthode de récupération utilisée
    pub method: RecoveryMethod,
    /// Approbations reçues (pour récupération sociale)
    pub approvals: Vec<T::AccountId>,
    /// Preuves fournies
    pub proofs: Vec<Vec<u8>>,
    /// Statut de l'opération
    pub status: RecoveryStatus,
    /// Moment d'initialisation
    pub initiated_at: T::BlockNumber,
    /// Moment d'expiration
    pub expires_at: T::BlockNumber,
}

/// Statut d'une opération de récupération
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum RecoveryStatus {
    /// En attente d'approbations
    Pending,
    /// Approuvée mais non exécutée
    Approved,
    /// Exécutée avec succès
    Executed,
    /// Expirée
    Expired,
    /// Rejetée
    Rejected,
}

/// Configuration du module identité
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Autorités de gestion des identités
    type IdentityAuthorities: Get<Vec<Self::AccountId>>;
    
    /// Durée maximale d'une session (en blocs)
    type MaxSessionDuration: Get<Self::BlockNumber>;
    
    /// Nombre maximal de tentatives d'authentification avant verrouillage
    type MaxAuthAttempts: Get<u32>;
    
    /// Délai de verrouillage après tentatives échouées (en blocs)
    type LockoutPeriod: Get<Self::BlockNumber>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaIdentity {
        /// Profils d'identité des utilisateurs
        IdentityProfiles get(fn identity_profiles):
            map hasher(blake2_128_concat) T::AccountId => Option<IdentityProfile<T>>;
        
        /// Sessions d'authentification actives
        AuthSessions get(fn auth_sessions):
            map hasher(blake2_128_concat) [u8; 32] => Option<AuthSession<T>>;
        
        /// Dispositifs d'authentification enregistrés par compte
        AuthDevices get(fn auth_devices):
            map hasher(blake2_128_concat) T::AccountId => Vec<AuthDevice>;
        
        /// Opérations de récupération en cours
        RecoveryOperations get(fn recovery_operations):
            map hasher(blake2_128_concat) [u8; 32] => Option<RecoveryOperation<T>>;
        
        /// Relations de tutelle pour récupération
        RecoveryRelationships get(fn recovery_relationships):
            map hasher(blake2_128_concat) T::AccountId => Vec<T::AccountId>;
            
        /// Comptes verrouillés et moment de déverrouillage
        LockedAccounts get(fn locked_accounts):
            map hasher(blake2_128_concat) T::AccountId => T::BlockNumber;
    }
}

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Profil d'identité non trouvé
        IdentityProfileNotFound,
        
        /// Session d'authentification non trouvée
        AuthSessionNotFound,
        
        /// Session d'authentification expirée
        AuthSessionExpired,
        
        /// Session d'authentification révoquée
        AuthSessionRevoked,
        
        /// Facteurs d'authentification insuffisants
        InsufficientAuthFactors,
        
        /// Dispositif d'authentification non trouvé
        AuthDeviceNotFound,
        
        /// Compte verrouillé
        AccountLocked,
        
        /// Opération de récupération non trouvée
        RecoveryNotFound,
        
        /// Méthode de récupération invalide
        InvalidRecoveryMethod,
        
        /// Pas un tuteur autorisé
        NotARecoveryContact,
        
        /// Déjà approuvé
        AlreadyApproved,
        
        /// Preuve de récupération invalide
        InvalidRecoveryProof,
        
        /// Trop de dispositifs d'authentification
        TooManyAuthDevices,
        
        /// Opération non autorisée
        Unauthorized,
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Nouvelle session d'authentification créée
        /// [session_id, account, factors_count]
        AuthSessionCreated([u8; 32], AccountId, u32),
        
        /// Session d'authentification expirée
        /// [session_id, account]
        AuthSessionExpired([u8; 32], AccountId),
        
        /// Session d'authentification révoquée
        /// [session_id, account, revoker]
        AuthSessionRevoked([u8; 32], AccountId, AccountId),
        
        /// Nouveau dispositif d'authentification enregistré
        /// [account, device_id, device_type]
        AuthDeviceRegistered(AccountId, [u8; 32], AuthDeviceType),
        
        /// Dispositif d'authentification supprimé
        /// [account, device_id]
        AuthDeviceRemoved(AccountId, [u8; 32]),
        
        /// Opération de récupération initiée
        /// [recovery_id, account, method_type]
        RecoveryInitiated([u8; 32], AccountId, Vec<u8>),
        
        /// Opération de récupération approuvée par un tuteur
        /// [recovery_id, account, approver]
        RecoveryApproved([u8; 32], AccountId, AccountId),
        
        /// Opération de récupération exécutée
        /// [recovery_id, account, new_account]
        RecoveryExecuted([u8; 32], AccountId, Option<AccountId>),
        
        /// Profil d'identité mis à jour
        /// [account, verification_level]
        IdentityUpdated(AccountId, VerificationLevel),
        
        /// Compte verrouillé après trop de tentatives
        /// [account, unlock_block]
        AccountLocked(AccountId, BlockNumber),
        
        /// Compte déverrouillé
        /// [account]
        AccountUnlocked(AccountId),
        
        /// Tentative d'authentification échouée
        /// [account, attempts, max_attempts]
        AuthAttemptFailed(AccountId, u32, u32),
    }
);

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialiser les erreurs
        type Error = Error<T>;
        
        /// Déclarer les événements
        fn deposit_event() = default;
        
        /// À chaque nouveau bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Nettoyer les sessions expirées
            Self::clean_expired_sessions(n);
            
            // Nettoyer les opérations de récupération expirées
            Self::clean_expired_recoveries(n);
            
            // Déverrouiller les comptes qui ont purgé leur période de blocage
            Self::unlock_accounts(n);
            
            0
        }
        
        /// Créer un nouveau profil d'identité
        #[weight = 10_000]
        pub fn create_identity_profile(
            origin,
            verification_level: VerificationLevel,
        ) -> DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Vérifier si un profil existe déjà
            ensure!(
                !<IdentityProfiles<T>>::contains_key(&account),
                Error::<T>::Unauthorized
            );
            
            // Création d'un profil de base
            let profile = IdentityProfile {
                account: account.clone(),
                available_factors: vec![AuthFactor::PrivateKey], // Facteur de base
                recovery_methods: Vec::new(),
                verification_level,
                last_updated: <frame_system::Module<T>>::block_number(),
                active_sessions: Vec::new(),
                failed_attempts: 0,
                recovery_contacts: Vec::new(),
            };
            
            // Stocker le profil
            <IdentityProfiles<T>>::insert(&account, profile);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::IdentityUpdated(
                account,
                verification_level
            ));
            
            Ok(())
        }
        
        /// Mettre à jour le niveau de vérification d'identité
        #[weight = 10_000]
        pub fn update_verification_level(
            origin,
            account: T::AccountId,
            new_level: VerificationLevel,
        ) -> DispatchResult {
            let authority = ensure_signed(origin)?;
            
            // Vérifier que l'appelant est une autorité de gestion des identités
            ensure!(
                T::IdentityAuthorities::get().contains(&authority),
                Error::<T>::Unauthorized
            );
            
            // Récupérer et mettre à jour le profil
            let mut profile = <IdentityProfiles<T>>::get(&account)
                .ok_or(Error::<T>::IdentityProfileNotFound)?;
            
            profile.verification_level = new_level;
            profile.last_updated = <frame_system::Module<T>>::block_number();
            
            <IdentityProfiles<T>>::insert(&account, profile);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::IdentityUpdated(
                account,
                new_level
            ));
            
            Ok(())
        }
        
        /// Ajouter un dispositif d'authentification
        #[weight = 10_000]
        pub fn register_auth_device(
            origin,
            device_type: AuthDeviceType,
            public_key: Vec<u8>,
            name: Vec<u8>,
        ) -> DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Récupérer le profil d'identité
            let mut profile = <IdentityProfiles<T>>::get(&account)
                .ok_or(Error::<T>::IdentityProfileNotFound)?;
            
            // Récupérer les dispositifs existants
            let mut devices = <AuthDevices<T>>::get(&account);
            
            // Limiter le nombre de dispositifs
            ensure!(devices.len() < 5, Error::<T>::TooManyAuthDevices);
            
            // Générer un ID unique pour le dispositif
            let id = Self::generate_device_id(&account, &device_type, &public_key);
            
            // Créer le nouveau dispositif
            let device = AuthDevice {
                id,
                device_type: device_type.clone(),
                public_key,
                name,
                registered_at: Self::get_timestamp(),
                last_used: 0,
            };
            
            // Ajouter le dispositif
            devices.push(device);
            <AuthDevices<T>>::insert(&account, devices);
            
            // Mettre à jour les facteurs disponibles
            let factor = match device_type {
                AuthDeviceType::FIDO => AuthFactor::Authenticator,
                AuthDeviceType::TOTP => AuthFactor::Authenticator,
                AuthDeviceType::SMS => AuthFactor::Authenticator,
                AuthDeviceType::Email => AuthFactor::Authenticator,
                AuthDeviceType::Other => AuthFactor::Authenticator,
            };
            
            if !profile.available_factors.contains(&factor) {
                profile.available_factors.push(factor);
                <IdentityProfiles<T>>::insert(&account, profile);
            }
            
            // Émettre un événement
            Self::deposit_event(RawEvent::AuthDeviceRegistered(
                account,
                id,
                device_type
            ));
            
            Ok(())
        }
        
        /// Supprimer un dispositif d'authentification
        #[weight = 10_000]
        pub fn remove_auth_device(
            origin,
            device_id: [u8; 32],
        ) -> DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Récupérer les dispositifs
            let mut devices = <AuthDevices<T>>::get(&account);
            
            // Vérifier que le dispositif existe
            let device_index = devices.iter().position(|d| d.id == device_id)
                .ok_or(Error::<T>::AuthDeviceNotFound)?;
            
            // Supprimer le dispositif
            devices.remove(device_index);
            <AuthDevices<T>>::insert(&account, devices);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::AuthDeviceRemoved(
                account,
                device_id
            ));
            
            Ok(())
        }
        
        /// Créer une session d'authentification
        #[weight = 10_000]
        pub fn create_auth_session(
            origin,
            factors: Vec<AuthFactor>,
            origin_info: Vec<u8>,
        ) -> DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Vérifier que le compte n'est pas verrouillé
            Self::ensure_account_not_locked(&account)?;
            
            // Récupérer le profil d'identité
            let mut profile = <IdentityProfiles<T>>::get(&account)
                .ok_or(Error::<T>::IdentityProfileNotFound)?;
            
            // Vérifier que les facteurs sont suffisants
            ensure!(!factors.is_empty(), Error::<T>::InsufficientAuthFactors);
            
            // Vérifier que tous les facteurs sont disponibles pour ce compte
            for factor in &factors {
                ensure!(
                    profile.available_factors.contains(factor),
                    Error::<T>::InsufficientAuthFactors
                );
            }
            
            // Générer un ID unique de session
            let session_id = Self::generate_session_id(&account, &factors);
            
            // Calculer l'expiration
            let current_block = <frame_system::Module<T>>::block_number();
            let expires_at = current_block.saturating_add(T::MaxSessionDuration::get());
            
            // Créer la session
            let session = AuthSession {
                id: session_id,
                account: account.clone(),
                factors_used: factors.clone(),
                status: SessionStatus::Active,
                created_at: current_block,
                expires_at,
                origin: origin_info,
            };
            
            // Stocker la session
            <AuthSessions<T>>::insert(session_id, session);
            
            // Ajouter la session au profil
            profile.active_sessions.push(session_id);
            profile.failed_attempts = 0; // Réinitialiser les tentatives échouées
            <IdentityProfiles<T>>::insert(&account, profile);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::AuthSessionCreated(
                session_id,
                account,
                factors.len() as u32
            ));
            
            Ok(())
        }
        
        /// Révoquer une session d'authentification
        #[weight = 10_000]
        pub fn revoke_auth_session(
            origin,
            session_id: [u8; 32],
        ) -> DispatchResult {
            let revoker = ensure_signed(origin)?;
            
            // Récupérer la session
            let mut session = <AuthSessions<T>>::get(session_id)
                .ok_or(Error::<T>::AuthSessionNotFound)?;
            
            // Vérifier que le révocateur est le propriétaire ou une autorité
            ensure!(
                session.account == revoker || T::IdentityAuthorities::get().contains(&revoker),
                Error::<T>::Unauthorized
            );
            
            // Mettre à jour le statut
            session.status = SessionStatus::Revoked;
            <AuthSessions<T>>::insert(session_id, session.clone());
            
            // Mettre à jour le profil
            if let Some(mut profile) = <IdentityProfiles<T>>::get(&session.account) {
                profile.active_sessions.retain(|&id| id != session_id);
                <IdentityProfiles<T>>::insert(&session.account, profile);
            }
            
            // Émettre un événement
            Self::deposit_event(RawEvent::AuthSessionRevoked(
                session_id,
                session.account,
                revoker
            ));
            
            Ok(())
        }
        
        /// Initier une opération de récupération
        #[weight = 10_000]
        pub fn initiate_recovery(
            origin,
            account: T::AccountId,
            new_account: Option<T::AccountId>,
            method: RecoveryMethod,
            proof: Vec<u8>,
        ) -> DispatchResult {
            let initiator = ensure_signed(origin)?;
            
            // Vérifier que le compte à récupérer existe
            ensure!(
                <IdentityProfiles<T>>::contains_key(&account),
                Error::<T>::IdentityProfileNotFound
            );
            
            // Vérifier la méthode de récupération
            match &method {
                RecoveryMethod::SocialRecovery(_) => {
                    // Vérifier que l'initiateur est un tuteur autorisé
                    let recovery_contacts = <RecoveryRelationships<T>>::get(&account);
                    ensure!(
                        recovery_contacts.contains(&initiator),
                        Error::<T>::NotARecoveryContact
                    );
                },
                RecoveryMethod::BackupKey(_) | RecoveryMethod::Mnemonic(_) | RecoveryMethod::Other(_) => {
                    // Ces méthodes nécessitent une preuve valide
                    // La validation spécifique dépend de l'implémentation
                },
            }
            
            // Générer un ID unique pour l'opération
            let op_id = Self::generate_recovery_id(&account, &initiator, &method);
            
            // Calculer l'expiration
            let current_block = <frame_system::Module<T>>::block_number();
            let expires_at = current_block.saturating_add(1000u32.into()); // 1000 blocs ~ 2 heures
            
            // Créer l'opération
            let operation = RecoveryOperation {
                id: op_id,
                account: account.clone(),
                new_account: new_account.clone(),
                method: method.clone(),
                approvals: vec![initiator.clone()], // L'initiateur est le premier approbateur
                proofs: vec![proof],
                status: RecoveryStatus::Pending,
                initiated_at: current_block,
                expires_at,
            };
            
            // Stocker l'opération
            <RecoveryOperations<T>>::insert(op_id, operation);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::RecoveryInitiated(
                op_id,
                account,
                Self::method_to_bytes(&method)
            ));
            
            Ok(())
        }
        
        /// Approuver une opération de récupération
        #[weight = 10_000]
        pub fn approve_recovery(
            origin,
            recovery_id: [u8; 32],
        ) -> DispatchResult {
            let approver = ensure_signed(origin)?;
            
            // Récupérer l'opération
            let mut operation = <RecoveryOperations<T>>::get(recovery_id)
                .ok_or(Error::<T>::RecoveryNotFound)?;
            
            // Vérifier le statut
            ensure!(
                operation.status == RecoveryStatus::Pending,
                Error::<T>::InvalidRecoveryMethod
            );
            
            // Vérifier que l'approbateur est un tuteur autorisé
            let recovery_contacts = <RecoveryRelationships<T>>::get(&operation.account);
            ensure!(
                recovery_contacts.contains(&approver),
                Error::<T>::NotARecoveryContact
            );
            
            // Vérifier que l'approbateur n'a pas déjà approuvé
            ensure!(
                !operation.approvals.contains(&approver),
                Error::<T>::AlreadyApproved
            );
            
            // Ajouter l'approbation
            operation.approvals.push(approver.clone());
            
            // Si nous avons assez d'approbations, marquer comme approuvée
            if operation.approvals.len() >= 2 { // Seuil arbitraire, à ajuster
                operation.status = RecoveryStatus::Approved;
            }
            
            // Mettre à jour l'opération
            <RecoveryOperations<T>>::insert(recovery_id, operation.clone());
            
            // Émettre un événement
            Self::deposit_event(RawEvent::RecoveryApproved(
                recovery_id,
                operation.account.clone(),
                approver
            ));
            
            // Si approuvée, exécuter la récupération
            if operation.status == RecoveryStatus::Approved {
                Self::execute_recovery(recovery_id)?;
            }
            
            Ok(())
        }
        
        /// Ajouter un contact de récupération (tuteur)
        #[weight = 10_000]
        pub fn add_recovery_contact(
            origin,
            contact: T::AccountId,
        ) -> DispatchResult {
            let account = ensure_signed(origin)?;
            
            // Récupérer le profil
            let mut profile = <IdentityProfiles<T>>::get(&account)
                .ok_or(Error::<T>::IdentityProfileNotFound)?;
            
            // Ajouter le contact s'il n'existe pas déjà
            if !profile.recovery_contacts.contains(&contact) {
                profile.recovery_contacts.push(contact.clone());
                <IdentityProfiles<T>>::insert(&account, profile);
            }
            
            // Mettre à jour les relations de tutelle
            let mut relationships = <RecoveryRelationships<T>>::get(&account);
            if !relationships.contains(&contact) {
                relationships.push(contact);
                <RecoveryRelationships<T>>::insert(&account, relationships);
            }
            
            Ok(())
        }
        
        /// Signaler une tentative d'authentification échouée
        #[weight = 10_000]
        pub fn report_failed_auth(
            origin,
            account: T::AccountId,
        ) -> DispatchResult {
            let reporter = ensure_signed(origin)?;
            
            // Vérifier que le signaleur est une autorité
            ensure!(
                T::IdentityAuthorities::get().contains(&reporter),
                Error::<T>::Unauthorized
            );
            
            // Récupérer le profil
            let mut profile = <IdentityProfiles<T>>::get(&account)
                .ok_or(Error::<T>::IdentityProfileNotFound)?;
            
            // Incrémenter les tentatives échouées
            profile.failed_attempts += 1;
            
            // Vérifier si le compte doit être verrouillé
            let max_attempts = T::MaxAuthAttempts::get();
            if profile.failed_attempts >= max_attempts {
                // Verrouiller le compte
                let current_block = <frame_system::Module<T>>::block_number();
                let unlock_at = current_block.saturating_add(T::LockoutPeriod::get());
                <LockedAccounts<T>>::insert(&account, unlock_at);
                
                // Révoquer toutes les sessions actives
                for session_id in &profile.active_sessions {
                    if let Some(mut session) = <AuthSessions<T>>::get(session_id) {
                        session.status = SessionStatus::Revoked;
                        <AuthSessions<T>>::insert(session_id, session);
                    }
                }
                
                profile.active_sessions.clear();
                
                // Émettre un événement
                Self::deposit_event(RawEvent::AccountLocked(
                    account.clone(),
                    unlock_at
                ));
            }
            
            // Mettre à jour le profil
            <IdentityProfiles<T>>::insert(&account, profile);
            
            // Émettre un événement de tentative échouée
            Self::deposit_event(RawEvent::AuthAttemptFailed(
                account,
                profile.failed_attempts,
                max_attempts
            ));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Nettoyer les sessions expirées
    fn clean_expired_sessions(current_block: T::BlockNumber) {
        let mut expired_sessions = Vec::new();
        
        // Collecter les sessions expirées
        for (id, session) in <AuthSessions<T>>::iter() {
            if session.status == SessionStatus::Active && current_block > session.expires_at {
                expired_sessions.push((id, session.account.clone()));
                
                // Mettre à jour le statut
                let mut updated_session = session;
                updated_session.status = SessionStatus::Expired;
                <AuthSessions<T>>::insert(id, updated_session);
            }
        }
        
        // Mettre à jour les profils
        for (session_id, account) in expired_sessions {
            if let Some(mut profile) = <IdentityProfiles<T>>::get(&account) {
                profile.active_sessions.retain(|&id| id != session_id);
                <IdentityProfiles<T>>::insert(&account, profile);
                
                // Émettre un événement
                Self::deposit_event(RawEvent::AuthSessionExpired(
                    session_id,
                    account
                ));
            }
        }
    }
    
    /// Nettoyer les opérations de récupération expirées
    fn clean_expired_recoveries(current_block: T::BlockNumber) {
        for (id, operation) in <RecoveryOperations<T>>::iter() {
            if operation.status == RecoveryStatus::Pending && current_block > operation.expires_at {
                // Marquer comme expirée
                let mut updated_op = operation;
                updated_op.status = RecoveryStatus::Expired;
                <RecoveryOperations<T>>::insert(id, updated_op);
            }
        }
    }
    
    /// Déverrouiller les comptes
    fn unlock_accounts(current_block: T::BlockNumber) {
        let mut to_unlock = Vec::new();
        
        // Collecter les comptes à déverrouiller
        for (account, unlock_at) in <LockedAccounts<T>>::iter() {
            if current_block >= unlock_at {
                to_unlock.push(account);
            }
        }
        
        // Déverrouiller les comptes
        for account in to_unlock {
            <LockedAccounts<T>>::remove(&account);
            
            // Réinitialiser les tentatives échouées
            if let Some(mut profile) = <IdentityProfiles<T>>::get(&account) {
                profile.failed_attempts = 0;
                <IdentityProfiles<T>>::insert(&account, profile);
            }
            
            // Émettre un événement
            Self::deposit_event(RawEvent::AccountUnlocked(account));
        }
    }
    
    /// Vérifier qu'un compte n'est pas verrouillé
    fn ensure_account_not_locked(account: &T::AccountId) -> DispatchResult {
        if <LockedAccounts<T>>::contains_key(account) {
            return Err(Error::<T>::AccountLocked.into());
        }
        Ok(())
    }
    
    /// Exécuter une opération de récupération
    fn execute_recovery(recovery_id: [u8; 32]) -> DispatchResult {
        // Récupérer l'opération
        let mut operation = <RecoveryOperations<T>>::get(recovery_id)
            .ok_or(Error::<T>::RecoveryNotFound)?;
        
        // Vérifier le statut
        ensure!(
            operation.status == RecoveryStatus::Approved,
            Error::<T>::InvalidRecoveryMethod
        );
        
        // Exécuter selon le type de récupération
        match operation.method {
            RecoveryMethod::SocialRecovery(_) => {
                // Pour une récupération sociale, transférer l'identité si un nouveau compte est spécifié
                if let Some(ref new_account) = operation.new_account {
                    if let Some(profile) = <IdentityProfiles<T>>::get(&operation.account) {
                        // Créer un nouveau profil pour le nouveau compte
                        let new_profile = IdentityProfile {
                            account: new_account.clone(),
                            available_factors: profile.available_factors,
                            recovery_methods: profile.recovery_methods,
                            verification_level: profile.verification_level,
                            last_updated: <frame_system::Module<T>>::block_number(),
                            active_sessions: Vec::new(),
                            failed_attempts: 0,
                            recovery_contacts: profile.recovery_contacts,
                        };
                        
                        // Stocker le nouveau profil
                        <IdentityProfiles<T>>::insert(new_account, new_profile);
                        
                        // Supprimer l'ancien profil
                        <IdentityProfiles<T>>::remove(&operation.account);
                        
                        // Transférer les relations de tutelle
                        let relationships = <RecoveryRelationships<T>>::get(&operation.account);
                        <RecoveryRelationships<T>>::insert(new_account, relationships);
                        <RecoveryRelationships<T>>::remove(&operation.account);
                    }
                } else {
                    // Sinon, juste déverrouiller le compte
                    <LockedAccounts<T>>::remove(&operation.account);
                    
                    if let Some(mut profile) = <IdentityProfiles<T>>::get(&operation.account) {
                        profile.failed_attempts = 0;
                        <IdentityProfiles<T>>::insert(&operation.account, profile);
                    }
                }
            },
            // Autres méthodes...
            _ => {
                // Pour l'instant, même traitement
                <LockedAccounts<T>>::remove(&operation.account);
            }
        }
        
        // Marquer l'opération comme exécutée
        operation.status = RecoveryStatus::Executed;
        <RecoveryOperations<T>>::insert(recovery_id, operation.clone());
        
        // Émettre un événement
        Self::deposit_event(RawEvent::RecoveryExecuted(
            recovery_id,
            operation.account,
            operation.new_account
        ));
        
        Ok(())
    }
    
    /// Générer un ID unique pour une session
    fn generate_session_id(account: &T::AccountId, factors: &[AuthFactor]) -> [u8; 32] {
        let mut data = Vec::new();
        data.extend_from_slice(&account.encode());
        
        for factor in factors {
            data.extend_from_slice(&(*factor as u8).to_be_bytes());
        }
        
        data.extend_from_slice(&Self::get_timestamp().to_be_bytes());
        
        sp_io::hashing::blake2_256(&data)
    }
    
    /// Générer un ID unique pour un dispositif
    fn generate_device_id(account: &T::AccountId, device_type: &AuthDeviceType, public_key: &[u8]) -> [u8; 32] {
        let mut data = Vec::new();
        data.extend_from_slice(&account.encode());
        data.extend_from_slice(&(*device_type as u8).to_be_bytes());
        data.extend_from_slice(public_key);
        
        sp_io::hashing::blake2_256(&data)
    }
    
    /// Générer un ID unique pour une opération de récupération
    fn generate_recovery_id(account: &T::AccountId, initiator: &T::AccountId, method: &RecoveryMethod) -> [u8; 32] {
        let mut data = Vec::new();
        data.extend_from_slice(&account.encode());
        data.extend_from_slice(&initiator.encode());
        data.extend_from_slice(&Self::method_to_bytes(method));
        data.extend_from_slice(&Self::get_timestamp().to_be_bytes());
        
        sp_io::hashing::blake2_256(&data)
    }
    
    /// Convertir une méthode de récupération en bytes
    fn method_to_bytes(method: &RecoveryMethod) -> Vec<u8> {
        match method {
            RecoveryMethod::SocialRecovery(data) => {
                let mut result = Vec::new();
                result.push(1); // code pour social
                result.extend_from_slice(data);
                result
            },
            RecoveryMethod::BackupKey(data) => {
                let mut result = Vec::new();
                result.push(2); // code pour backup
                result.extend_from_slice(data);
                result
            },
            RecoveryMethod::Mnemonic(data) => {
                let mut result = Vec::new();
                result.push(3); // code pour mnemonic
                result.extend_from_slice(data);
                result
            },
            RecoveryMethod::Other(data) => {
                let mut result = Vec::new();
                result.push(4); // code pour other
                result.extend_from_slice(data);
                result
            },
        }
    }
    
    /// Obtenir un timestamp (à remplacer par une implémentation fiable)
    fn get_timestamp() -> u64 {
        let block_number: u64 = <frame_system::Module<T>>::block_number().saturated_into();
        block_number
    }
}
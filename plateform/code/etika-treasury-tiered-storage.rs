// etika-treasury/src/tiered_storage.rs

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::{Currency, ExistenceRequirement, Get}, Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, CheckedAdd, CheckedSub, Member, Zero},
    DispatchError, RuntimeDebug,
};
use sp_std::prelude::*;
use etika_data_structure::Balance;

/// Niveaux de stockage des fonds
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum StorageTier {
    /// Hot wallet pour opérations quotidiennes
    Hot,
    /// Warm wallet pour opérations hebdomadaires
    Warm,
    /// Cold storage pour sécurité maximale
    Cold,
}

/// Structure de compte multisignature
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct MultisigAccount<T: Config> {
    /// Identifiant du compte multisignature
    pub account_id: T::AccountId,
    /// Signataires autorisés
    pub signatories: Vec<T::AccountId>,
    /// Seuil de signatures requis
    pub threshold: u32,
}

/// Structure de gestion du trésor
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct TreasuryVault<T: Config> {
    /// Compte du hot wallet
    pub hot_wallet: T::AccountId,
    /// Compte du warm wallet
    pub warm_wallet: T::AccountId,
    /// Multisignature du cold storage
    pub cold_storage: MultisigAccount<T>,
    /// Seuil de recharge du hot wallet (en pourcentage)
    pub hot_replenish_threshold: u8,
    /// Montant cible du hot wallet
    pub hot_target_balance: Balance,
    /// Seuil de recharge du warm wallet (en pourcentage)
    pub warm_replenish_threshold: u8,
    /// Montant cible du warm wallet
    pub warm_target_balance: Balance,
}

/// Structure d'historique des transferts entre niveaux
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct TierTransferRecord<T: Config> {
    /// Identifiant unique du transfert
    pub id: [u8; 32],
    /// Niveau source
    pub from_tier: StorageTier,
    /// Niveau destination
    pub to_tier: StorageTier,
    /// Montant transféré
    pub amount: Balance,
    /// Moment du transfert
    pub timestamp: T::BlockNumber,
    /// Initiateur du transfert
    pub initiator: T::AccountId,
    /// Raison du transfert
    pub reason: Vec<u8>,
}

/// Structure pour les transferts en attente de validation
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub struct PendingTierTransfer<T: Config> {
    /// Détails du transfert proposé
    pub transfer: TierTransferRecord<T>,
    /// Signataires qui ont approuvé
    pub approvals: Vec<T::AccountId>,
    /// Statut actuel
    pub status: PendingTransferStatus,
    /// Date d'expiration
    pub expiry: T::BlockNumber,
}

/// États possibles d'un transfert en attente
#[derive(Encode, Decode, Clone, PartialEq, Eq, RuntimeDebug)]
pub enum PendingTransferStatus {
    /// En attente d'approbations
    AwaitingApprovals,
    /// Prêt à être exécuté
    ReadyToExecute,
    /// A été exécuté
    Executed,
    /// A été rejeté
    Rejected,
    /// A expiré
    Expired,
}

/// Configuration du module
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Type de monnaie utilisé
    type Currency: Currency<Self::AccountId>;
    
    /// Autorités de gestion du trésor
    type TreasuryAuthorities: Get<Vec<Self::AccountId>>;
    
    /// Délai entre les vérifications automatiques (en blocs)
    type AutoCheckPeriod: Get<Self::BlockNumber>;
    
    /// Limite maximale pour les transferts hot->warm
    type MaxHotToWarmTransfer: Get<Balance>;
    
    /// Limite maximale pour les transferts warm->hot
    type MaxWarmToHotTransfer: Get<Balance>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaTreasury {
        /// Configuration du vault du trésor
        TreasuryVault get(fn treasury_vault): TreasuryVault<T>;
        
        /// Historique des transferts entre niveaux
        TierTransfers get(fn tier_transfers): 
            map hasher(blake2_128_concat) [u8; 32] => TierTransferRecord<T>;
        
        /// Index des transferts récents
        RecentTransfers get(fn recent_transfers): Vec<[u8; 32]>;
        
        /// Transferts en attente de validation multisignature
        PendingTransfers get(fn pending_transfers):
            map hasher(blake2_128_concat) [u8; 32] => PendingTierTransfer<T>;
            
        /// Prochaine vérification automatique planifiée
        NextAutoCheck get(fn next_auto_check): T::BlockNumber;
        
        /// Statistiques des niveaux de trésor
        TierStats get(fn tier_stats): map hasher(blake2_128_concat) StorageTier => Balance;
    }
    
    add_extra_genesis {
        config(initial_hot_wallet): T::AccountId;
        config(initial_warm_wallet): T::AccountId;
        config(initial_cold_signatories): Vec<T::AccountId>;
        config(initial_cold_threshold): u32;
        
        build(|config: &GenesisConfig<T>| {
            // Créer le compte multisig pour le cold storage
            let cold_account_id = T::AccountId::default(); // À remplacer par méthode correcte
            
            let cold_storage = MultisigAccount {
                account_id: cold_account_id,
                signatories: config.initial_cold_signatories.clone(),
                threshold: config.initial_cold_threshold,
            };
            
            // Initialiser le vault
            let vault = TreasuryVault {
                hot_wallet: config.initial_hot_wallet.clone(),
                warm_wallet: config.initial_warm_wallet.clone(),
                cold_storage,
                hot_replenish_threshold: 20, // 20%
                hot_target_balance: 1_000_000, // à ajuster
                warm_replenish_threshold: 30, // 30%
                warm_target_balance: 10_000_000, // à ajuster
            };
            
            <TreasuryVault<T>>::put(vault);
            
            // Initialiser la prochaine vérification
            let next_check = <frame_system::Module<T>>::block_number()
                .saturating_add(T::AutoCheckPeriod::get());
            <NextAutoCheck<T>>::put(next_check);
        });
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
        Balance = Balance,
    {
        /// Un transfert entre niveaux a été initié
        /// [transfer_id, from_tier, to_tier, amount, initiator]
        TierTransferInitiated([u8; 32], StorageTier, StorageTier, Balance, AccountId),
        
        /// Un transfert a été approuvé par un signataire
        /// [transfer_id, approver, current_approvals, threshold]
        TierTransferApproved([u8; 32], AccountId, u32, u32),
        
        /// Un transfert a été exécuté
        /// [transfer_id, from_tier, to_tier, amount]
        TierTransferExecuted([u8; 32], StorageTier, StorageTier, Balance),
        
        /// Un transfert a été rejeté
        /// [transfer_id, rejector]
        TierTransferRejected([u8; 32], AccountId),
        
        /// Un transfert a expiré
        /// [transfer_id]
        TierTransferExpired([u8; 32]),
        
        /// Vérification automatique effectuée
        /// [block_number, hot_balance, warm_balance]
        AutoCheckPerformed(BlockNumber, Balance, Balance),
        
        /// Recharge automatique du hot wallet
        /// [amount]
        HotWalletReplenished(Balance),
        
        /// Recharge automatique du warm wallet
        /// [amount]
        WarmWalletReplenished(Balance),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Montant invalide pour le transfert
        InvalidTransferAmount,
        
        /// Niveau de source ou destination invalide
        InvalidTierCombination,
        
        /// Transfert en attente non trouvé
        PendingTransferNotFound,
        
        /// Limite de transfert dépassée
        TransferLimitExceeded,
        
        /// Compte non autorisé
        Unauthorized,
        
        /// Le compte a déjà approuvé
        AlreadyApproved,
        
        /// Statut de transfert invalide
        InvalidTransferStatus,
        
        /// Fonds insuffisants dans le niveau source
        InsufficientFunds,
        
        /// Échec lors de l'opération de monnaie
        CurrencyOperationFailed,
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
            // Vérifier si c'est le moment pour un auto-check
            if n >= Self::next_auto_check() {
                Self::perform_auto_check();
                
                // Planifier la prochaine vérification
                let next_check = n.saturating_add(T::AutoCheckPeriod::get());
                <NextAutoCheck<T>>::put(next_check);
            }
            
            // Nettoyer les transferts expirés
            Self::clean_expired_transfers(n);
            
            0
        }
        
        /// Proposer un transfert entre niveaux
        #[weight = 10_000]
        pub fn propose_tier_transfer(
            origin,
            from_tier: StorageTier,
            to_tier: StorageTier,
            amount: Balance,
            reason: Vec<u8>,
            expiry_blocks: T::BlockNumber,
        ) -> DispatchResult {
            let initiator = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est autorisé
            ensure!(
                T::TreasuryAuthorities::get().contains(&initiator),
                Error::<T>::Unauthorized
            );
            
            // Vérifier que la combinaison de niveaux est valide
            Self::ensure_valid_tier_transfer(from_tier.clone(), to_tier.clone())?;
            
            // Vérifier le montant
            ensure!(amount > 0, Error::<T>::InvalidTransferAmount);
            
            // Vérifier les limites
            match (from_tier.clone(), to_tier.clone()) {
                (StorageTier::Hot, StorageTier::Warm) => {
                    ensure!(
                        amount <= T::MaxHotToWarmTransfer::get(),
                        Error::<T>::TransferLimitExceeded
                    );
                },
                (StorageTier::Warm, StorageTier::Hot) => {
                    ensure!(
                        amount <= T::MaxWarmToHotTransfer::get(),
                        Error::<T>::TransferLimitExceeded
                    );
                },
                _ => {},
            }
            
            // Générer ID unique
            let id = Self::generate_transfer_id(&initiator, &from_tier, &to_tier, amount);
            
            // Calculer expiration
            let current_block = <frame_system::Module<T>>::block_number();
            let expiry = current_block.saturating_add(expiry_blocks);
            
            // Créer l'enregistrement de transfert
            let transfer = TierTransferRecord {
                id: id.clone(),
                from_tier: from_tier.clone(),
                to_tier: to_tier.clone(),
                amount,
                timestamp: current_block,
                initiator: initiator.clone(),
                reason,
            };
            
            // Déterminer le seuil d'approbation et les signataires requis
            let (threshold, signatories) = Self::get_approval_requirements(&from_tier, &to_tier);
            
            // Créer le transfert en attente
            let pending_transfer = PendingTierTransfer {
                transfer: transfer.clone(),
                approvals: vec![initiator.clone()], // L'initiateur compte comme première approbation
                status: PendingTransferStatus::AwaitingApprovals,
                expiry,
            };
            
            // Stocker le transfert en attente
            <PendingTransfers<T>>::insert(id, pending_transfer);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TierTransferInitiated(
                id,
                from_tier,
                to_tier,
                amount,
                initiator
            ));
            
            Ok(())
        }
        
        /// Approuver un transfert en attente
        #[weight = 10_000]
        pub fn approve_tier_transfer(
            origin,
            transfer_id: [u8; 32],
        ) -> DispatchResult {
            let approver = ensure_signed(origin)?;
            
            // Vérifier que l'approbateur est autorisé
            ensure!(
                T::TreasuryAuthorities::get().contains(&approver),
                Error::<T>::Unauthorized
            );
            
            // Récupérer le transfert en attente
            let mut pending = <PendingTransfers<T>>::get(transfer_id)
                .ok_or(Error::<T>::PendingTransferNotFound)?;
            
            // Vérifier le statut
            ensure!(
                pending.status == PendingTransferStatus::AwaitingApprovals,
                Error::<T>::InvalidTransferStatus
            );
            
            // Vérifier que l'approbateur n'a pas déjà approuvé
            ensure!(
                !pending.approvals.contains(&approver),
                Error::<T>::AlreadyApproved
            );
            
            // Ajouter l'approbation
            pending.approvals.push(approver.clone());
            
            // Déterminer le seuil d'approbation
            let (threshold, _) = Self::get_approval_requirements(
                &pending.transfer.from_tier,
                &pending.transfer.to_tier
            );
            
            // Vérifier si le seuil est atteint
            if pending.approvals.len() >= threshold as usize {
                pending.status = PendingTransferStatus::ReadyToExecute;
            }
            
            // Mettre à jour le stockage
            <PendingTransfers<T>>::insert(transfer_id, pending.clone());
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TierTransferApproved(
                transfer_id,
                approver,
                pending.approvals.len() as u32,
                threshold
            ));
            
            // Si prêt à exécuter, le faire
            if pending.status == PendingTransferStatus::ReadyToExecute {
                Self::execute_tier_transfer(transfer_id)?;
            }
            
            Ok(())
        }
        
        /// Rejeter un transfert en attente
        #[weight = 10_000]
        pub fn reject_tier_transfer(
            origin,
            transfer_id: [u8; 32],
        ) -> DispatchResult {
            let rejector = ensure_signed(origin)?;
            
            // Vérifier que le rejeteur est autorisé
            ensure!(
                T::TreasuryAuthorities::get().contains(&rejector),
                Error::<T>::Unauthorized
            );
            
            // Récupérer le transfert en attente
            let mut pending = <PendingTransfers<T>>::get(transfer_id)
                .ok_or(Error::<T>::PendingTransferNotFound)?;
            
            // Vérifier le statut
            ensure!(
                pending.status == PendingTransferStatus::AwaitingApprovals,
                Error::<T>::InvalidTransferStatus
            );
            
            // Marquer comme rejeté
            pending.status = PendingTransferStatus::Rejected;
            <PendingTransfers<T>>::insert(transfer_id, pending);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TierTransferRejected(
                transfer_id,
                rejector
            ));
            
            Ok(())
        }
        
        /// Forcer l'exécution d'un transfert prêt
        #[weight = 10_000]
        pub fn force_execute_transfer(
            origin,
            transfer_id: [u8; 32],
        ) -> DispatchResult {
            let executor = ensure_signed(origin)?;
            
            // Vérifier que l'exécuteur est autorisé
            ensure!(
                T::TreasuryAuthorities::get().contains(&executor),
                Error::<T>::Unauthorized
            );
            
            // Vérifier le statut
            let pending = <PendingTransfers<T>>::get(transfer_id)
                .ok_or(Error::<T>::PendingTransferNotFound)?;
            
            ensure!(
                pending.status == PendingTransferStatus::ReadyToExecute,
                Error::<T>::InvalidTransferStatus
            );
            
            // Exécuter le transfert
            Self::execute_tier_transfer(transfer_id)
        }
    }
}

impl<T: Config> Module<T> {
    /// Exécution d'un transfert entre niveaux
    fn execute_tier_transfer(transfer_id: [u8; 32]) -> DispatchResult {
        // Récupérer le transfert en attente
        let mut pending = <PendingTransfers<T>>::get(transfer_id)
            .ok_or(Error::<T>::PendingTransferNotFound)?;
        
        let transfer = &pending.transfer;
        let vault = Self::treasury_vault();
        
        // Obtenir les comptes source et destination
        let (source_account, dest_account) = match (transfer.from_tier.clone(), transfer.to_tier.clone()) {
            (StorageTier::Hot, StorageTier::Warm) => (vault.hot_wallet.clone(), vault.warm_wallet.clone()),
            (StorageTier::Warm, StorageTier::Hot) => (vault.warm_wallet.clone(), vault.hot_wallet.clone()),
            (StorageTier::Warm, StorageTier::Cold) => (vault.warm_wallet.clone(), vault.cold_storage.account_id.clone()),
            (StorageTier::Cold, StorageTier::Warm) => (vault.cold_storage.account_id.clone(), vault.warm_wallet.clone()),
            _ => return Err(Error::<T>::InvalidTierCombination.into()),
        };
        
        // Effectuer le transfert
        <T as Config>::Currency::transfer(
            &source_account,
            &dest_account,
            transfer.amount.into(),
            ExistenceRequirement::KeepAlive
        ).map_err(|_| Error::<T>::CurrencyOperationFailed)?;
        
        // Mettre à jour les statistiques des niveaux
        let from_balance = <TierStats<T>>::get(transfer.from_tier.clone());
        let to_balance = <TierStats<T>>::get(transfer.to_tier.clone());
        
        <TierStats<T>>::insert(
            transfer.from_tier.clone(),
            from_balance.saturating_sub(transfer.amount)
        );
        
        <TierStats<T>>::insert(
            transfer.to_tier.clone(),
            to_balance.saturating_add(transfer.amount)
        );
        
        // Mettre à jour le statut
        pending.status = PendingTransferStatus::Executed;
        <PendingTransfers<T>>::insert(transfer_id, pending);
        
        // Archiver le transfert
        <TierTransfers<T>>::insert(transfer_id, transfer.clone());
        
        // Ajouter à la liste des transferts récents
        let mut recent = <RecentTransfers<T>>::get();
        if recent.len() >= 50 {
            recent.remove(0);
        }
        recent.push(transfer_id);
        <RecentTransfers<T>>::put(recent);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::TierTransferExecuted(
            transfer_id,
            transfer.from_tier.clone(),
            transfer.to_tier.clone(),
            transfer.amount
        ));
        
        Ok(())
    }
    
    /// Nettoyer les transferts expirés
    fn clean_expired_transfers(current_block: T::BlockNumber) {
        for (id, transfer) in <PendingTransfers<T>>::iter() {
            if transfer.status == PendingTransferStatus::AwaitingApprovals 
               && current_block > transfer.expiry {
                // Marquer comme expiré
                let mut updated = transfer;
                updated.status = PendingTransferStatus::Expired;
                <PendingTransfers<T>>::insert(id, updated);
                
                // Émettre un événement
                Self::deposit_event(RawEvent::TierTransferExpired(id));
            }
        }
    }
    
    /// Vérification automatique des niveaux
    fn perform_auto_check() {
        let vault = Self::treasury_vault();
        
        // Récupérer les soldes actuels
        let hot_balance = <TierStats<T>>::get(StorageTier::Hot);
        let warm_balance = <TierStats<T>>::get(StorageTier::Warm);
        
        // Calculer les seuils
        let hot_threshold = (vault.hot_target_balance * vault.hot_replenish_threshold as Balance) / 100;
        let warm_threshold = (vault.warm_target_balance * vault.warm_replenish_threshold as Balance) / 100;
        
        // Vérifier et potentiellement recharger les hot/warm wallets
        if hot_balance < hot_threshold && warm_balance >= (vault.hot_target_balance - hot_balance) {
            // Initier un transfert automatique warm->hot
            let amount = vault.hot_target_balance - hot_balance;
            
            // Générer un ID pour le transfert automatique
            let auto_id = Self::generate_auto_transfer_id(StorageTier::Warm, StorageTier::Hot, amount);
            
            // Créer et exécuter directement le transfert
            let current_block = <frame_system::Module<T>>::block_number();
            
            let transfer = TierTransferRecord {
                id: auto_id,
                from_tier: StorageTier::Warm,
                to_tier: StorageTier::Hot,
                amount,
                timestamp: current_block,
                initiator: vault.hot_wallet.clone(), // Utiliser le hot wallet comme initiateur automatique
                reason: b"Auto replenishment".to_vec(),
            };
            
            // Archiver le transfert
            <TierTransfers<T>>::insert(auto_id, transfer);
            
            // Effectuer le transfert
            let _ = <T as Config>::Currency::transfer(
                &vault.warm_wallet,
                &vault.hot_wallet,
                amount.into(),
                ExistenceRequirement::KeepAlive
            );
            
            // Mettre à jour les statistiques
            <TierStats<T>>::insert(
                StorageTier::Warm,
                warm_balance.saturating_sub(amount)
            );
            
            <TierStats<T>>::insert(
                StorageTier::Hot,
                hot_balance.saturating_add(amount)
            );
            
            // Émettre un événement
            Self::deposit_event(RawEvent::HotWalletReplenished(amount));
        }
        
        // De même pour warm->cold si nécessaire
        // ...
        
        // Émettre un événement de vérification
        Self::deposit_event(RawEvent::AutoCheckPerformed(
            <frame_system::Module<T>>::block_number(),
            hot_balance,
            warm_balance
        ));
    }
    
    /// Générer un ID pour un transfert
    fn generate_transfer_id(
        initiator: &T::AccountId,
        from_tier: &StorageTier,
        to_tier: &StorageTier,
        amount: Balance,
    ) -> [u8; 32] {
        let mut data = Vec::new();
        data.extend_from_slice(&initiator.encode());
        data.extend_from_slice(&(from_tier.clone() as u8).to_be_bytes());
        data.extend_from_slice(&(to_tier.clone() as u8).to_be_bytes());
        data.extend_from_slice(&amount.to_be_bytes());
        data.extend_from_slice(&<frame_system::Module<T>>::block_number().encode());
        
        sp_io::hashing::blake2_256(&data)
    }
    
    /// Générer un ID pour un transfert automatique
    fn generate_auto_transfer_id(
        from_tier: StorageTier,
        to_tier: StorageTier,
        amount: Balance,
    ) -> [u8; 32] {
        let mut data = Vec::new();
        data.extend_from_slice(b"auto");
        data.extend_from_slice(&(from_tier as u8).to_be_bytes());
        data.extend_from_slice(&(to_tier as u8).to_be_bytes());
        data.extend_from_slice(&amount.to_be_bytes());
        data.extend_from_slice(&<frame_system::Module<T>>::block_number().encode());
        
        sp_io::hashing::blake2_256(&data)
    }
    
    /// Vérifier si un transfert entre niveaux est valide
    fn ensure_valid_tier_transfer(
        from_tier: StorageTier,
        to_tier: StorageTier,
    ) -> DispatchResult {
        match (from_tier, to_tier) {
            (StorageTier::Hot, StorageTier::Warm) => Ok(()),
            (StorageTier::Warm, StorageTier::Hot) => Ok(()),
            (StorageTier::Warm, StorageTier::Cold) => Ok(()),
            (StorageTier::Cold, StorageTier::Warm) => Ok(()),
            _ => Err(Error::<T>::InvalidTierCombination.into()),
        }
    }
    
    /// Déterminer les exigences d'approbation pour un transfert
    fn get_approval_requirements(
        from_tier: &StorageTier,
        to_tier: &StorageTier,
    ) -> (u32, Vec<T::AccountId>) {
        let authorities = T::TreasuryAuthorities::get();
        
        match (from_tier, to_tier) {
            (StorageTier::Hot, StorageTier::Warm) => (2, authorities.clone()),
            (StorageTier::Warm, StorageTier::Hot) => (2, authorities.clone()),
            (StorageTier::Warm, StorageTier::Cold) => (3, authorities.clone()),
            (StorageTier::Cold, StorageTier::Warm) => (4, authorities.clone()),
            _ => (2, authorities.clone()), // Défaut
        }
    }
}

// etika-consumer-fund/src/lib.rs
//
// Ce module implémente le fonds des consommateurs de l'écosystème Étika, incluant:
// - La gestion de l'épargne des consommateurs (80% long terme, 20% projets personnels)
// - Le calcul des taux de crédit avantageux selon l'ancienneté
// - La gestion des contributions des entreprises partenaires
// - Le système de gouvernance DAO pour les décisions du fonds

#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::{Currency, Get, ReservableCurrency}, Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, CheckedAdd, CheckedSub, Member, Zero},
    DispatchError, Perbill, RuntimeDebug,
};
use sp_std::prelude::*;

// Import des structures de données définies dans etika-data-structure
use etika_data_structure::{
    AccountId, Balance, ConsumerSavings, Moment, ActorProfile, ActorType, LoyaltyTier, ConsumerFund,
    PoPTransaction,
};

/// Type monétaire utilisé pour le module
type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

/// Configuration du module consumer fund
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Type de monnaie utilisé par le fonds
    type Currency: ReservableCurrency<Self::AccountId>;
    
    /// Ratio d'épargne à long terme (en pourcentage)
    type LongTermSavingsRatio: Get<u8>;
    
    /// Montant minimum pour les contributions d'épargne
    type MinContributionAmount: Get<BalanceOf<Self>>;
    
    /// Période minimale pour le verrouillage de l'épargne à long terme (en blocs)
    type MinLongTermLockPeriod: Get<Self::BlockNumber>;
    
    /// Nombre de blocs entre les mises à jour des taux de crédit
    type CreditRateUpdatePeriod: Get<Self::BlockNumber>;
    
    /// Contribution minimale pour avoir accès au crédit
    type MinCreditContribution: Get<BalanceOf<Self>>;
    
    /// Taux de crédit de base (en centièmes de pourcentage, e.g. 500 = 5.00%)
    type BaseCreditRate: Get<u32>;
    
    /// Réduction maximale du taux de crédit (en centièmes de pourcentage)
    type MaxCreditRateReduction: Get<u32>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaConsumerFund {
        /// Mapping des comptes d'épargne des consommateurs
        ConsumerSavingsAccounts get(fn consumer_savings_accounts): 
            map hasher(blake2_128_concat) T::AccountId => ConsumerSavings;
        
        /// Solde total de l'épargne à long terme dans le fonds
        TotalLongTermSavings get(fn total_long_term_savings): BalanceOf<T>;
        
        /// Solde total de l'épargne pour projets personnels dans le fonds
        TotalPersonalProjectsSavings get(fn total_personal_projects_savings): BalanceOf<T>;
        
        /// Montant total des contributions par entreprise partenaire
        PartnerContributions get(fn partner_contributions): 
            map hasher(blake2_128_concat) T::AccountId => BalanceOf<T>;
        
        /// Taux de crédit pour chaque consommateur
        CreditRates get(fn credit_rates): 
            map hasher(blake2_128_concat) T::AccountId => u32; // En centièmes de pourcentage
        
        /// Dernier bloc où les taux de crédit ont été mis à jour
        LastCreditRateUpdateBlock get(fn last_credit_rate_update_block): T::BlockNumber;
        
        /// Niveau de fidélité/ancienneté des consommateurs
        ConsumerLoyaltyTiers get(fn consumer_loyalty_tiers): 
            map hasher(blake2_128_concat) T::AccountId => LoyaltyTier;
        
        /// Seuils d'épargne pour chaque niveau de fidélité (en tokens)
        LoyaltyTierThresholds get(fn loyalty_tier_thresholds): map hasher(blake2_128_concat) LoyaltyTier => BalanceOf<T>;
        
        /// Comptes autorisés à proposer des votes dans la DAO
        DaoMembers get(fn dao_members): map hasher(blake2_128_concat) T::AccountId => bool;
        
        /// Nombre total de membres de la DAO
        TotalDaoMembers get(fn total_dao_members): u32;
        
        /// Propositions de vote actuelles dans la DAO
        DaoProposals get(fn dao_proposals): 
            map hasher(blake2_128_concat) T::Hash => (Vec<u8>, T::BlockNumber, BalanceOf<T>);
        
        /// Votes pour chaque proposition
        ProposalVotes get(fn proposal_votes): 
            double_map hasher(blake2_128_concat) T::Hash, hasher(blake2_128_concat) T::AccountId => bool;
        
        /// Nombre de votes positifs pour chaque proposition
        ProposalApprovals get(fn proposal_approvals): map hasher(blake2_128_concat) T::Hash => u32;
        
        /// Nombre de votes négatifs pour chaque proposition
        ProposalRejections get(fn proposal_rejections): map hasher(blake2_128_concat) T::Hash => u32;
    }
    
    add_extra_genesis {
        config(loyalty_tier_thresholds): Vec<(LoyaltyTier, BalanceOf<T>)>;
        
        build(|config: &GenesisConfig<T>| {
            // Initialiser les seuils de niveaux de fidélité
            for (tier, threshold) in &config.loyalty_tier_thresholds {
                <LoyaltyTierThresholds<T>>::insert(tier, threshold);
            }
        });
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        Balance = BalanceOf<T>,
        Hash = <T as frame_system::Config>::Hash,
    {
        /// Contribution d'épargne ajoutée pour un consommateur
        /// [compte consommateur, montant long terme, montant projets personnels, compte contributeur]
        SavingsContributionAdded(AccountId, Balance, Balance, AccountId),
        
        /// Taux de crédit mis à jour pour un consommateur
        /// [compte consommateur, nouveau taux]
        CreditRateUpdated(AccountId, u32),
        
        /// Niveau de fidélité mis à jour pour un consommateur
        /// [compte consommateur, nouveau niveau]
        LoyaltyTierUpdated(AccountId, LoyaltyTier),
        
        /// Retrait depuis l'épargne projets personnels
        /// [compte consommateur, montant]
        PersonalProjectsWithdrawal(AccountId, Balance),
        
        /// Nouvelle proposition DAO créée
        /// [hash de la proposition, créateur, description]
        DaoProposalCreated(Hash, AccountId, Vec<u8>),
        
        /// Vote sur une proposition DAO
        /// [hash de la proposition, votant, approbation]
        DaoProposalVoted(Hash, AccountId, bool),
        
        /// Proposition DAO finalisée
        /// [hash de la proposition, approuvée]
        DaoProposalFinalized(Hash, bool),
        
        /// Membre ajouté à la DAO
        /// [compte]
        DaoMemberAdded(AccountId),
        
        /// Membre retiré de la DAO
        /// [compte]
        DaoMemberRemoved(AccountId),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Montant de contribution trop faible
        ContributionTooSmall,
        
        /// Consommateur non trouvé
        ConsumerNotFound,
        
        /// Solde insuffisant pour le retrait
        InsufficientBalance,
        
        /// Période de verrouillage non écoulée
        LockPeriodNotExpired,
        
        /// Compte non autorisé pour cette opération
        Unauthorized,
        
        /// Proposition DAO non trouvée
        ProposalNotFound,
        
        /// Vote déjà soumis pour cette proposition
        AlreadyVoted,
        
        /// Proposition DAO expirée
        ProposalExpired,
        
        /// Demande de retrait supérieure au montant disponible
        WithdrawalExceedsAvailable,
        
        /// Dépassement arithmétique
        ArithmeticOverflow,
        
        /// Membre DAO déjà existant
        DaoMemberAlreadyExists,
        
        /// Membre DAO non trouvé
        DaoMemberNotFound,
    }
}

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialisation des erreurs
        type Error = Error<T>;
        
        /// Émission des événements
        fn deposit_event() = default;
        
        /// Mise à jour des taux de crédit au changement de bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Mettre à jour les taux de crédit périodiquement
            if n >= Self::last_credit_rate_update_block() + T::CreditRateUpdatePeriod::get() {
                Self::update_all_credit_rates();
                <LastCreditRateUpdateBlock<T>>::put(n);
            }
            
            0
        }
        
        /// Ajouter une contribution d'épargne pour un consommateur
        #[weight = 10_000]
        pub fn add_savings_contribution(
            origin,
            consumer: T::AccountId,
            total_amount: BalanceOf<T>,
        ) -> DispatchResult {
            let contributor = ensure_signed(origin)?;
            
            // Vérifier que le montant est suffisant
            ensure!(total_amount >= T::MinContributionAmount::get(), Error::<T>::ContributionTooSmall);
            
            // Calculer la répartition 80/20
            let long_term_amount = Perbill::from_percent(T::LongTermSavingsRatio::get().into()) * total_amount;
            let personal_projects_amount = total_amount.saturating_sub(long_term_amount);
            
            // Réserver les fonds du contributeur
            T::Currency::reserve(&contributor, total_amount)?;
            
            // Mettre à jour les compteurs globaux
            <TotalLongTermSavings<T>>::mutate(|total| {
                *total = total.saturating_add(long_term_amount);
            });
            
            <TotalPersonalProjectsSavings<T>>::mutate(|total| {
                *total = total.saturating_add(personal_projects_amount);
            });
            
            // Mettre à jour les contributions du partenaire
            <PartnerContributions<T>>::mutate(&contributor, |total| {
                *total = total.saturating_add(total_amount);
            });
            
            // Récupérer ou créer le compte d'épargne du consommateur
            let mut savings = <ConsumerSavingsAccounts<T>>::get(&consumer);
            
            if savings.consumer_id != consumer {
                // Initialiser un nouveau compte
                savings = ConsumerSavings {
                    consumer_id: consumer.clone(),
                    long_term_savings: Zero::zero(),
                    personal_projects_savings: Zero::zero(),
                    contribution_history: Vec::new(),
                    current_credit_rate: T::BaseCreditRate::get(),
                };
            }
            
            // Mettre à jour le compte d'épargne
            let new_long_term = savings.long_term_savings.saturating_add(long_term_amount);
            let new_personal = savings.personal_projects_savings.saturating_add(personal_projects_amount);
            
            savings.long_term_savings = new_long_term;
            savings.personal_projects_savings = new_personal;
            
            // Ajouter l'entrée dans l'historique des contributions
            let timestamp = Self::get_current_timestamp();
            savings.contribution_history.push((contributor.clone(), total_amount, timestamp));
            
            // Limiter la taille de l'historique
            if savings.contribution_history.len() > 20 {
                savings.contribution_history.remove(0);
            }
            
            // Enregistrer le compte d'épargne mis à jour
            <ConsumerSavingsAccounts<T>>::insert(&consumer, savings);
            
            // Mettre à jour le niveau de fidélité du consommateur
            Self::update_loyalty_tier(&consumer, new_long_term + new_personal);
            
            // Mettre à jour le taux de crédit
            Self::update_credit_rate(&consumer);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::SavingsContributionAdded(
                consumer,
                long_term_amount,
                personal_projects_amount,
                contributor,
            ));
            
            Ok(())
        }
        
        /// Retirer des fonds de l'épargne projets personnels
        #[weight = 10_000]
        pub fn withdraw_from_personal_projects(
            origin,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            let consumer = ensure_signed(origin)?;
            
            // Récupérer le compte d'épargne
            let mut savings = <ConsumerSavingsAccounts<T>>::get(&consumer);
            ensure!(savings.consumer_id == consumer, Error::<T>::ConsumerNotFound);
            
            // Vérifier que le solde est suffisant
            ensure!(savings.personal_projects_savings >= amount, Error::<T>::InsufficientBalance);
            
            // Mettre à jour le compte d'épargne
            savings.personal_projects_savings = savings.personal_projects_savings.saturating_sub(amount);
            <ConsumerSavingsAccounts<T>>::insert(&consumer, savings);
            
            // Mettre à jour le compteur global
            <TotalPersonalProjectsSavings<T>>::mutate(|total| {
                *total = total.saturating_sub(amount);
            });
            
            // Transférer les fonds au consommateur
            // Note: Dans un système réel, cela pourrait impliquer un mécanisme de transfert plus complexe
            // Pour l'instant, nous libérons simplement une partie des fonds réservés par les partenaires
            // selon une stratégie FIFO ou autre à déterminer
            
            // Émettre un événement
            Self::deposit_event(RawEvent::PersonalProjectsWithdrawal(consumer, amount));
            
            Ok(())
        }
        
        /// Créer une nouvelle proposition dans la DAO
        #[weight = 10_000]
        pub fn create_dao_proposal(
            origin,
            description: Vec<u8>,
            voting_period: T::BlockNumber,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            
            // Vérifier que le créateur est membre de la DAO
            ensure!(Self::dao_members(&creator), Error::<T>::Unauthorized);
            
            // Créer un hash unique pour la proposition
            let proposal_hash = T::Hashing::hash_of(&(creator.clone(), description.clone(), frame_system::Module::<T>::block_number()));
            
            // Calculer le bloc de fin de vote
            let end_block = frame_system::Module::<T>::block_number().saturating_add(voting_period);
            
            // Enregistrer la proposition
            <DaoProposals<T>>::insert(proposal_hash, (description.clone(), end_block, amount));
            <ProposalApprovals<T>>::insert(proposal_hash, 0);
            <ProposalRejections<T>>::insert(proposal_hash, 0);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::DaoProposalCreated(proposal_hash, creator, description));
            
            Ok(())
        }
        
        /// Voter sur une proposition DAO
        #[weight = 10_000]
        pub fn vote_on_proposal(
            origin,
            proposal_hash: T::Hash,
            approve: bool,
        ) -> DispatchResult {
            let voter = ensure_signed(origin)?;
            
            // Vérifier que le votant est membre de la DAO
            ensure!(Self::dao_members(&voter), Error::<T>::Unauthorized);
            
            // Vérifier que la proposition existe
            ensure!(<DaoProposals<T>>::contains_key(proposal_hash), Error::<T>::ProposalNotFound);
            
            // Vérifier que le membre n'a pas déjà voté
            ensure!(!<ProposalVotes<T>>::contains_key(proposal_hash, &voter), Error::<T>::AlreadyVoted);
            
            // Vérifier que la proposition n'est pas expirée
            let (_, end_block, _) = <DaoProposals<T>>::get(proposal_hash);
            ensure!(frame_system::Module::<T>::block_number() <= end_block, Error::<T>::ProposalExpired);
            
            // Enregistrer le vote
            <ProposalVotes<T>>::insert(proposal_hash, &voter, approve);
            
            // Mettre à jour les compteurs
            if approve {
                <ProposalApprovals<T>>::mutate(proposal_hash, |count| *count += 1);
            } else {
                <ProposalRejections<T>>::mutate(proposal_hash, |count| *count += 1);
            }
            
            // Émettre un événement
            Self::deposit_event(RawEvent::DaoProposalVoted(proposal_hash, voter, approve));
            
            // Vérifier si la proposition peut être finalisée
            let total_votes = Self::proposal_approvals(proposal_hash) + Self::proposal_rejections(proposal_hash);
            
            if total_votes == Self::total_dao_members() {
                // Tous les membres ont voté, finaliser la proposition
                Self::finalize_proposal(proposal_hash)?;
            }
            
            Ok(())
        }
        
        /// Finaliser une proposition expirée
        #[weight = 10_000]
        pub fn finalize_expired_proposal(
            origin,
            proposal_hash: T::Hash,
        ) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            
            // Vérifier que la proposition existe
            ensure!(<DaoProposals<T>>::contains_key(proposal_hash), Error::<T>::ProposalNotFound);
            
            // Vérifier que la proposition est expirée
            let (_, end_block, _) = <DaoProposals<T>>::get(proposal_hash);
            ensure!(frame_system::Module::<T>::block_number() > end_block, Error::<T>::ProposalExpired);
            
            // Finaliser la proposition
            Self::finalize_proposal(proposal_hash)?;
            
            Ok(())
        }
        
        /// Ajouter un membre à la DAO
        #[weight = 10_000]
        pub fn add_dao_member(
            origin,
            member: T::AccountId,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;
            
            // Vérifier que l'appelant est autorisé
            // Dans un système complet, cela pourrait impliquer un vote ou autre mécanisme de gouvernance
            // Pour l'instant, nous permettons à tout membre existant d'ajouter d'autres membres
            ensure!(Self::dao_members(&caller), Error::<T>::Unauthorized);
            
            // Vérifier que le membre n'est pas déjà présent
            ensure!(!Self::dao_members(&member), Error::<T>::DaoMemberAlreadyExists);
            
            // Ajouter le membre
            <DaoMembers<T>>::insert(&member, true);
            <TotalDaoMembers>::mutate(|count| *count += 1);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::DaoMemberAdded(member));
            
            Ok(())
        }
        
        /// Retirer un membre de la DAO
        #[weight = 10_000]
        pub fn remove_dao_member(
            origin,
            member: T::AccountId,
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;
            
            // Vérifier que l'appelant est autorisé
            ensure!(Self::dao_members(&caller), Error::<T>::Unauthorized);
            
            // Vérifier que le membre existe
            ensure!(Self::dao_members(&member), Error::<T>::DaoMemberNotFound);
            
            // Retirer le membre
            <DaoMembers<T>>::remove(&member);
            <TotalDaoMembers>::mutate(|count| *count -= 1);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::DaoMemberRemoved(member));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Mettre à jour le niveau de fidélité d'un consommateur
    fn update_loyalty_tier(consumer: &T::AccountId, total_savings: BalanceOf<T>) {
        // Obtenir le niveau actuel
        let current_tier = <ConsumerLoyaltyTiers<T>>::get(consumer);
        
        // Déterminer le nouveau niveau en fonction du total des économies
        let mut new_tier = LoyaltyTier::Bronze;
        
        if total_savings >= <LoyaltyTierThresholds<T>>::get(LoyaltyTier::Diamond) {
            new_tier = LoyaltyTier::Diamond;
        } else if total_savings >= <LoyaltyTierThresholds<T>>::get(LoyaltyTier::Platinum) {
            new_tier = LoyaltyTier::Platinum;
        } else if total_savings >= <LoyaltyTierThresholds<T>>::get(LoyaltyTier::Gold) {
            new_tier = LoyaltyTier::Gold;
        } else if total_savings >= <LoyaltyTierThresholds<T>>::get(LoyaltyTier::Silver) {
            new_tier = LoyaltyTier::Silver;
        }
        
        // Ne mettre à jour que si le niveau change
        if new_tier != current_tier {
            <ConsumerLoyaltyTiers<T>>::insert(consumer, new_tier);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::LoyaltyTierUpdated(consumer.clone(), new_tier));
            
            // Mettre à jour le taux de crédit en fonction du nouveau niveau
            Self::update_credit_rate(consumer);
        }
    }
    
    /// Mettre à jour le taux de crédit d'un consommateur
    fn update_credit_rate(consumer: &T::AccountId) {
        // Récupérer le compte d'épargne
        let savings = <ConsumerSavingsAccounts<T>>::get(consumer);
        
        // Vérifier que le consommateur a contribué suffisamment pour avoir accès au crédit
        if savings.long_term_savings.saturating_add(savings.personal_projects_savings) < T::MinCreditContribution::get() {
            return;
        }
        
        // Obtenir le niveau de fidélité
        let loyalty_tier = <ConsumerLoyaltyTiers<T>>::get(consumer);
        
        // Calculer la réduction de taux en fonction du niveau
        let base_rate = T::BaseCreditRate::get();
        let max_reduction = T::MaxCreditRateReduction::get();
        
        let tier_reduction = match loyalty_tier {
            LoyaltyTier::Bronze => max_reduction / 5,
            LoyaltyTier::Silver => max_reduction * 2 / 5,
            LoyaltyTier::Gold => max_reduction * 3 / 5,
            LoyaltyTier::Platinum => max_reduction * 4 / 5,
            LoyaltyTier::Diamond => max_reduction,
        };
        
        // Calculer le nouveau taux (avec plancher à 0)
        let new_rate = if base_rate > tier_reduction {
            base_rate - tier_reduction
        } else {
            0
        };
        
        // Mettre à jour le taux
        <CreditRates<T>>::insert(consumer, new_rate);
        
        // Mettre à jour le taux dans le compte d'épargne
        let mut updated_savings = savings;
        updated_savings.current_credit_rate = new_rate;
        <ConsumerSavingsAccounts<T>>::insert(consumer, updated_savings);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::CreditRateUpdated(consumer.clone(), new_rate));
    }
    
    /// Mettre à jour les taux de crédit pour tous les consommateurs
    fn update_all_credit_rates() {
        for (consumer, _) in <ConsumerSavingsAccounts<T>>::iter() {
            Self::update_credit_rate(&consumer);
        }
    }
    
    /// Finaliser une proposition DAO
    fn finalize_proposal(proposal_hash: T::Hash) -> DispatchResult {
        // Vérifier que la proposition existe
        ensure!(<DaoProposals<T>>::contains_key(proposal_hash), Error::<T>::ProposalNotFound);
        
        // Récupérer les votes
        let approvals = Self::proposal_approvals(proposal_hash);
        let rejections = Self::proposal_rejections(proposal_hash);
        
        // Déterminer si la proposition est approuvée (majorité simple)
        let approved = approvals > rejections;
        
        // Si approuvée, exécuter l'action associée
        if approved {
            let (_, _, amount) = <DaoProposals<T>>::get(proposal_hash);
            // Ici, on pourrait exécuter différentes actions selon le type de proposition
            // Pour l'instant, c'est simplement une approbation de principe
        }
        
        // Nettoyer les données
        <DaoProposals<T>>::remove(proposal_hash);
        <ProposalApprovals<T>>::remove(proposal_hash);
        <ProposalRejections<T>>::remove(proposal_hash);
        
        // Émettre un événement
        Self::deposit_event(RawEvent::DaoProposalFinalized(proposal_hash, approved));
        
        Ok(())
    }
    
    /// Obtenir le timestamp actuel en secondes
    fn get_current_timestamp() -> Moment {
        let now = sp_io::offchain::timestamp()
            .unwrap_or_default()
            .unix_millis();
        (now / 1000) as Moment
    }
}

/// Implémentation du trait ConsumerFund pour le module consumer fund
impl<T: Config> ConsumerFund for Module<T> {
    fn add_savings(consumer: &T::AccountId, amount: Balance) -> Result<(), &'static str> {
        let amount_as_balance = amount.saturated_into::<BalanceOf<T>>();
        
        // Calculer la répartition 80/20
        let long_term_amount = Perbill::from_percent(T::LongTermSavingsRatio::get().into()) * amount_as_balance;
        let personal_projects_amount = amount_as_balance.saturating_sub(long_term_amount);
        
        // Mettre à jour les compteurs globaux
        <TotalLongTermSavings<T>>::mutate(|total| {
            *total = total.saturating_add(long_term_amount);
        });
        
        <TotalPersonalProjectsSavings<T>>::mutate(|total| {
            *total = total.saturating_add(personal_projects_amount);
        });
        
        // Récupérer ou créer le compte d'épargne du consommateur
        let mut savings = <ConsumerSavingsAccounts<T>>::get(consumer);
        
        if savings.consumer_id != *consumer {
            // Initialiser un nouveau compte
            savings = ConsumerSavings {
                consumer_id: consumer.clone(),
                long_term_savings: Zero::zero(),
                personal_projects_savings: Zero::zero(),
                contribution_history: Vec::new(),
                current_credit_rate: T::BaseCreditRate::get(),
            };
        }
        
        // Mettre à jour le compte d'épargne
        let new_long_term = savings.long_term_savings.saturating_add(long_term_amount.saturated_into::<Balance>());
        let new_personal = savings.personal_projects_savings.saturating_add(personal_projects_amount.saturated_into::<Balance>());
        
        savings.long_term_savings = new_long_term;
        savings.personal_projects_savings = new_personal;
        
        // Enregistrer le compte d'épargne mis à jour
        <ConsumerSavingsAccounts<T>>::insert(consumer, savings);
        
        // Mettre à jour le niveau de fidélité du consommateur
        Self::update_loyalty_tier(consumer, amount_as_balance);
        
        Ok(())
    }
    
    fn get_savings_balance(consumer: &T::AccountId) -> Result<(Balance, Balance), &'static str> {
        let savings = <ConsumerSavingsAccounts<T>>::get(consumer);
        
        if savings.consumer_id != *consumer {
            return Err("Consumer not found");
        }
        
        Ok((savings.long_term_savings, savings.personal_projects_savings))
    }
    
    fn calculate_credit_rate(consumer: &T::AccountId) -> Result<u32, &'static str> {
        Ok(<CreditRates<T>>::get(consumer))
    }
}

/// Tests pour le module consumer fund
#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::{assert_ok, assert_noop, parameter_types};
    use sp_core::H256;
    use sp_runtime::{
        testing::Header,
        traits::{BlakeTwo256, IdentityLookup},
        Perbill, ModuleId,
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
            Balances: pallet_balances::{Module, Call, Storage, Config<T>, Event<T>},
            EtikaConsumerFund: Module<Test>,
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
    
    parameter_types! {
        pub const LongTermSavingsRatio: u8 = 80;
        pub const MinContributionAmount: u64 = 100;
        pub const MinLongTermLockPeriod: u64 = 100;
        pub const CreditRateUpdatePeriod: u64 = 10;
        pub const MinCreditContribution: u64 = 1000;
        pub const BaseCreditRate: u32 = 1000; // 10.00%
        pub const MaxCreditRateReduction: u32 = 1000; // 10.00%
        pub const ConsumerFundModuleId: ModuleId = ModuleId(*b"etk/fund");
    }
    
    impl Config for Test {
        type Event = Event;
        type Currency = Balances;
        type LongTermSavingsRatio = LongTermSavingsRatio;
        type MinContributionAmount = MinContributionAmount;
        type MinLongTermLockPeriod = MinLongTermLockPeriod;
        type CreditRateUpdatePeriod = CreditRateUpdatePeriod;
        type MinCreditContribution = MinCreditContribution;
        type BaseCreditRate = BaseCreditRate;
        type MaxCreditRateReduction = MaxCreditRateReduction;
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
        
        let thresholds = vec![
            (LoyaltyTier::Bronze, 0),
            (LoyaltyTier::Silver, 5000),
            (LoyaltyTier::Gold, 10000),
            (LoyaltyTier::Platinum, 20000),
            (LoyaltyTier::Diamond, 50000),
        ];
        
        EtikaConsumerFundConfig {
            loyalty_tier_thresholds: thresholds,
        }
        .assimilate_storage(&mut t)
        .unwrap();
            
        t.into()
    }
    
    #[test]
    fn test_add_savings_contribution() {
        new_test_ext().execute_with(|| {
            // Configurer le test
            let consumer = 1;
            let contributor = 2;
            let contribution_amount = 1000;
            
            // Ajouter une contribution
            assert_ok!(EtikaConsumerFund::add_savings_contribution(
                Origin::signed(contributor),
                consumer,
                contribution_amount
            ));
            
            // Vérifier la répartition 80/20
            let long_term_amount = contribution_amount * 80 / 100;
            let personal_projects_amount = contribution_amount - long_term_amount;
            
            // Vérifier les soldes d'épargne
            let savings = EtikaConsumerFund::consumer_savings_accounts(consumer);
            assert_eq!(savings.long_term_savings, long_term_amount);
            assert_eq!(savings.personal_projects_savings, personal_projects_amount);
            
            // Vérifier les totaux
            assert_eq!(EtikaConsumerFund::total_long_term_savings(), long_term_amount);
            assert_eq!(EtikaConsumerFund::total_personal_projects_savings(), personal_projects_amount);
            
            // Vérifier les contributions du partenaire
            assert_eq!(EtikaConsumerFund::partner_contributions(contributor), contribution_amount);
            
            // Vérifier que le niveau de fidélité a été mis à jour
            assert_eq!(EtikaConsumerFund::consumer_loyalty_tiers(consumer), LoyaltyTier::Bronze);
            
            // Ajouter suffisamment pour atteindre le niveau Silver
            assert_ok!(EtikaConsumerFund::add_savings_contribution(
                Origin::signed(contributor),
                consumer,
                5000
            ));
            
            // Vérifier le nouveau niveau de fidélité
            assert_eq!(EtikaConsumerFund::consumer_loyalty_tiers(consumer), LoyaltyTier::Silver);
            
            // Vérifier que le taux de crédit a été mis à jour
            let expected_rate = BaseCreditRate::get() - (MaxCreditRateReduction::get() * 2 / 5);
            assert_eq!(EtikaConsumerFund::credit_rates(consumer), expected_rate);
        });
    }
    
    #[test]
    fn test_withdraw_from_personal_projects() {
        new_test_ext().execute_with(|| {
            // Configurer le test
            let consumer = 1;
            let contributor = 2;
            let contribution_amount = 1000;
            
            // Ajouter une contribution
            assert_ok!(EtikaConsumerFund::add_savings_contribution(
                Origin::signed(contributor),
                consumer,
                contribution_amount
            ));
            
            // Calculer le montant disponible pour les projets personnels
            let personal_projects_amount = contribution_amount * 20 / 100;
            
            // Essayer de retirer plus que disponible
            assert_noop!(
                EtikaConsumerFund::withdraw_from_personal_projects(
                    Origin::signed(consumer),
                    personal_projects_amount + 1
                ),
                Error::<Test>::InsufficientBalance
            );
            
            // Retirer un montant valide
            assert_ok!(EtikaConsumerFund::withdraw_from_personal_projects(
                Origin::signed(consumer),
                personal_projects_amount / 2
            ));
            
            // Vérifier le solde restant
            let savings = EtikaConsumerFund::consumer_savings_accounts(consumer);
            assert_eq!(savings.personal_projects_savings, personal_projects_amount / 2);
            
            // Vérifier le total
            assert_eq!(EtikaConsumerFund::total_personal_projects_savings(), personal_projects_amount / 2);
        });
    }
    
    #[test]
    fn test_dao_governance() {
        new_test_ext().execute_with(|| {
            // Configurer les membres de la DAO
            let admin = 1;
            let member1 = 2;
            let member2 = 3;
            
            // L'admin se désigne comme premier membre
            <DaoMembers<Test>>::insert(admin, true);
            <TotalDaoMembers>::put(1);
            
            // Ajouter d'autres membres
            assert_ok!(EtikaConsumerFund::add_dao_member(
                Origin::signed(admin),
                member1
            ));
            
            assert_ok!(EtikaConsumerFund::add_dao_member(
                Origin::signed(admin),
                member2
            ));
            
            // Vérifier le nombre total de membres
            assert_eq!(EtikaConsumerFund::total_dao_members(), 3);
            
            // Créer une proposition
            let description = b"Test proposal".to_vec();
            let voting_period = 100;
            let amount = 500;
            
            assert_ok!(EtikaConsumerFund::create_dao_proposal(
                Origin::signed(admin),
                description.clone(),
                voting_period,
                amount
            ));
            
            // Récupérer le hash de la proposition
            let proposal_hash = BlakeTwo256::hash_of(&(admin, description, 0u64));
            
            // Voter sur la proposition
            assert_ok!(EtikaConsumerFund::vote_on_proposal(
                Origin::signed(admin),
                proposal_hash,
                true
            ));
            
            assert_ok!(EtikaConsumerFund::vote_on_proposal(
                Origin::signed(member1),
                proposal_hash,
                true
            ));
            
            assert_ok!(EtikaConsumerFund::vote_on_proposal(
                Origin::signed(member2),
                proposal_hash,
                false
            ));
            
            // Vérifier les compteurs de votes
            assert_eq!(EtikaConsumerFund::proposal_approvals(proposal_hash), 2);
            assert_eq!(EtikaConsumerFund::proposal_rejections(proposal_hash), 1);
            
            // Finaliser la proposition (devrait être automatique puisque tous ont voté)
            // Mais nous l'appelons explicitement pour le test
            assert_ok!(EtikaConsumerFund::finalize_expired_proposal(
                Origin::signed(admin),
                proposal_hash
            ));
            
            // Vérifier que la proposition a été nettoyée
            assert!(!<DaoProposals<Test>>::contains_key(proposal_hash));
        });
    }
}
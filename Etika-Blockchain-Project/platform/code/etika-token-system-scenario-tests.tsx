// etika-token-system/tests/scenario_tests.rs
//
// Ce fichier contient des tests de scénarios d'utilisation réels pour le module etika-token-system

use codec::{Decode, Encode};
use frame_support::{
    assert_ok, assert_noop, parameter_types,
    traits::{OnFinalize, OnInitialize},
};
use sp_core::H256;
use sp_runtime::{
    testing::Header,
    traits::{BlakeTwo256, IdentityLookup},
    Perbill,
};

// Importer les modules nécessaires
use etika_token_system::{Module as TokenSystem, Config as TokenSystemConfig, Error};
use etika_data_structure::{
    AccountId, ActorProfile, ActorType, Balance, Moment, TokenState,
};

// Réutiliser l'environnement de test de l'intégration
type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<TestRuntime>;
type Block = frame_system::mocking::MockBlock<TestRuntime>;

// Construction du runtime de test
frame_support::construct_runtime!(
    pub enum TestRuntime where
        Block = Block,
        NodeBlock = Block,
        UncheckedExtrinsic = UncheckedExtrinsic,
    {
        System: frame_system::{Module, Call, Config, Storage, Event<T>},
        EtikaTokenSystem: etika_token_system::{Module, Call, Storage, Event<T>},
    }
);

// Paramètres du système
parameter_types! {
    pub const BlockHashCount: u64 = 250;
    pub const MaximumBlockWeight: u32 = 1024;
    pub const MaximumBlockLength: u32 = 2 * 1024;
    pub const AvailableBlockRatio: Perbill = Perbill::one();
}

// Configuration du système
impl frame_system::Config for TestRuntime {
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

// Paramètres du module token system
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

// Configuration du module token system
impl TokenSystemConfig for TestRuntime {
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
        .build_storage::<TestRuntime>()
        .unwrap();
        
    t.into()
}

// Structure pour représenter un acteur dans l'écosystème
struct TestActor {
    id: u64,
    actor_type: ActorType,
    name: &'static str,
}

// Fonction pour configurer un environnement de test réaliste
fn setup_realistic_environment() -> Vec<TestActor> {
    let admin = TestActor { id: 0, actor_type: ActorType::Admin, name: "Admin" };
    let consumer1 = TestActor { id: 1, actor_type: ActorType::Consumer, name: "Consumer 1" };
    let consumer2 = TestActor { id: 2, actor_type: ActorType::Consumer, name: "Consumer 2" };
    let merchant1 = TestActor { id: 3, actor_type: ActorType::Merchant, name: "Merchant 1" };
    let merchant2 = TestActor { id: 4, actor_type: ActorType::Merchant, name: "Merchant 2" };
    let supplier1 = TestActor { id: 5, actor_type: ActorType::Supplier, name: "Supplier 1" };
    let supplier2 = TestActor { id: 6, actor_type: ActorType::Supplier, name: "Supplier 2" };
    let ngo1 = TestActor { id: 7, actor_type: ActorType::NGO, name: "NGO 1" };
    let ngo2 = TestActor { id: 8, actor_type: ActorType::NGO, name: "NGO 2" };
    
    // Enregistrer tous les acteurs
    let actors = vec![
        admin,
        consumer1,
        consumer2,
        merchant1,
        merchant2,
        supplier1,
        supplier2,
        ngo1,
        ngo2,
    ];
    
    // Configurer les types d'acteurs
    for actor in &actors {
        EtikaTokenSystem::update_actor_type(Origin::signed(0), actor.id, actor.actor_type).unwrap();
    }
    
    // Configurer des soldes initiaux réalistes
    // Consommateurs: uniquement des tokens latents
    etika_token_system::LatentTokenBalances::<TestRuntime>::insert(1, 5000);
    etika_token_system::LatentTokenBalances::<TestRuntime>::insert(2, 7500);
    
    // Commerçants: principalement des tokens actifs
    etika_token_system::ActiveTokenBalances::<TestRuntime>::insert(3, 25000);
    etika_token_system::LatentTokenBalances::<TestRuntime>::insert(3, 5000);
    etika_token_system::ActiveTokenBalances::<TestRuntime>::insert(4, 30000);
    
    // Fournisseurs: uniquement des tokens actifs
    etika_token_system::ActiveTokenBalances::<TestRuntime>::insert(5, 15000);
    etika_token_system::ActiveTokenBalances::<TestRuntime>::insert(6, 20000);
    
    // ONG: quelques tokens actifs de dons précédents
    etika_token_system::ActiveTokenBalances::<TestRuntime>::insert(7, 5000);
    
    actors
}

// Tester le système de tokens dans divers scénarios réels
#[cfg(test)]
mod scenario_tests {
    use super::*;
    
    // Scénario 1: Cycle de vie complet des tokens (distribution -> activation -> transfert -> brûlage)
    #[test]
    fn test_token_lifecycle() {
        new_test_ext().execute_with(|| {
            // Configurer l'environnement de test
            let actors = setup_realistic_environment();
            
            // 1. Distribution périodique des tokens
            System::set_block_number(100);
            EtikaTokenSystem::on_initialize(100);
            
            // Vérifier que les tokens ont été distribués aux acteurs selon leur type
            assert_eq!(
                EtikaTokenSystem::latent_token_balances(1), 
                5000 + ConsumerDistributionAmount::get()
            );
            assert_eq!(
                EtikaTokenSystem::latent_token_balances(3), 
                5000 + MerchantDistributionAmount::get()
            );
            assert_eq!(
                EtikaTokenSystem::latent_token_balances(5), 
                0 + SupplierDistributionAmount::get()
            );
            
            // 2. Activation des tokens par un consommateur
            let consumer_id = 1;
            let activation_amount = 3000;
            
            assert_ok!(EtikaTokenSystem::activate_tokens(
                Origin::signed(consumer_id),
                activation_amount
            ));
            
            // Vérifier les nouveaux soldes
            assert_eq!(
                EtikaTokenSystem::latent_token_balances(consumer_id), 
                5000 + ConsumerDistributionAmount::get() - activation_amount
            );
            assert_eq!(
                EtikaTokenSystem::active_token_balances(consumer_id), 
                activation_amount
            );
            
            // 3. Transfert de tokens vers un commerçant (transaction d'achat)
            let merchant_id = 3;
            let purchase_amount = 2000;
            
            let merchant_balance_before = EtikaTokenSystem::active_token_balances(merchant_id);
            
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(consumer_id),
                merchant_id,
                purchase_amount
            ));
            
            // Calculer les montants attendus
            let burn_amount = purchase_amount * 5 / 100; // 100
            let ngo_amount = purchase_amount * 2 / 100;  // 40
            let transfer_amount = purchase_amount - burn_amount - ngo_amount; // 1860
            
            // Vérifier les soldes après transfert
            assert_eq!(
                EtikaTokenSystem::active_token_balances(consumer_id), 
                activation_amount - purchase_amount
            );
            assert_eq!(
                EtikaTokenSystem::active_token_balances(merchant_id), 
                merchant_balance_before + transfer_amount
            );
            
            // 4. Transfert du commerçant vers un fournisseur (paiement)
            let supplier_id = 5;
            let payment_amount = 1500;
            
            let supplier_balance_before = EtikaTokenSystem::active_token_balances(supplier_id);
            let merchant_balance_after_purchase = EtikaTokenSystem::active_token_balances(merchant_id);
            
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(merchant_id),
                supplier_id,
                payment_amount
            ));
            
            // Calculer les montants attendus
            let payment_burn = payment_amount * 5 / 100; // 75
            let payment_ngo = payment_amount * 2 / 100;  // 30
            let payment_transfer = payment_amount - payment_burn - payment_ngo; // 1395
            
            // Vérifier les soldes après paiement au fournisseur
            assert_eq!(
                EtikaTokenSystem::active_token_balances(merchant_id), 
                merchant_balance_after_purchase - payment_amount
            );
            assert_eq!(
                EtikaTokenSystem::active_token_balances(supplier_id), 
                supplier_balance_before + payment_transfer
            );
            
            // 5. Don à une ONG
            let ngo_id = 7;
            let donation_amount = 500;
            
            let ngo_balance_before = EtikaTokenSystem::active_token_balances(ngo_id);
            
            assert_ok!(EtikaTokenSystem::transfer_to_ngo(
                Origin::signed(merchant_id),
                ngo_id,
                donation_amount
            ));
            
            // Vérifier les soldes après donation
            assert_eq!(
                EtikaTokenSystem::active_token_balances(merchant_id), 
                merchant_balance_after_purchase - payment_amount - donation_amount
            );
            assert_eq!(
                EtikaTokenSystem::active_token_balances(ngo_id), 
                ngo_balance_before + donation_amount
            );
            
            // 6. Vérifier les totaux de brûlage et redistribution
            assert_eq!(
                EtikaTokenSystem::total_burned_tokens(),
                burn_amount + payment_burn
            );
            assert_eq!(
                EtikaTokenSystem::total_ngo_tokens(),
                ngo_amount + payment_ngo + donation_amount
            );
        });
    }
    
    // Scénario 2: Système d'épargne avec verrouillage/déverrouillage
    #[test]
    fn test_saving_system() {
        new_test_ext().execute_with(|| {
            // Configurer l'environnement de test
            let actors = setup_realistic_environment();
            
            // 1. Activer des tokens pour un consommateur
            let consumer_id = 1;
            let activation_amount = 3000;
            
            assert_ok!(EtikaTokenSystem::activate_tokens(
                Origin::signed(consumer_id),
                activation_amount
            ));
            
            // 2. Verrouiller une partie des tokens pour l'épargne (20% mobilisable, 80% long terme)
            let total_savings = 2000;
            let short_term_savings = total_savings * 20 / 100; // 400
            let long_term_savings = total_savings * 80 / 100;  // 1600
            
            // Verrouiller les économies à court terme (100 secondes)
            assert_ok!(EtikaTokenSystem::lock_tokens(
                Origin::signed(consumer_id),
                short_term_savings,
                100
            ));
            
            // Verrouiller les économies à long terme (10000 secondes)
            assert_ok!(EtikaTokenSystem::lock_tokens(
                Origin::signed(consumer_id),
                long_term_savings,
                10000
            ));
            
            // Vérifier les soldes après verrouillage
            assert_eq!(
                EtikaTokenSystem::active_token_balances(consumer_id), 
                activation_amount - total_savings
            );
            assert_eq!(
                EtikaTokenSystem::locked_token_balances(consumer_id), 
                total_savings
            );
            
            // 3. Tentative d'utilisation des tokens verrouillés (doit échouer)
            let merchant_id = 3;
            let attempt_amount = 1500;
            
            // Doit échouer car le solde actif est insuffisant
            assert_noop!(
                EtikaTokenSystem::transfer_tokens(
                    Origin::signed(consumer_id),
                    merchant_id,
                    attempt_amount
                ),
                Error::<TestRuntime>::InsufficientActiveBalance
            );
            
            // 4. Simuler le passage du temps pour les économies à court terme
            let current_time = EtikaTokenSystem::get_current_timestamp();
            let unlock_time_short = current_time - 1; // Passé de 1 seconde
            
            // Mettre à jour l'horloge de déverrouillage pour simuler le passage du temps
            <etika_token_system::TokenUnlockTime<TestRuntime>>::insert(consumer_id, unlock_time_short);
            
            // 5. Déverrouiller les tokens
            assert_ok!(EtikaTokenSystem::unlock_tokens(
                Origin::signed(consumer_id)
            ));
            
            // Vérifier les soldes après déverrouillage (tous déverrouillés car le système ne différencie pas actuellement)
            assert_eq!(
                EtikaTokenSystem::active_token_balances(consumer_id), 
                activation_amount
            );
            assert_eq!(
                EtikaTokenSystem::locked_token_balances(consumer_id), 
                0
            );
            
            // 6. Maintenant les tokens peuvent être utilisés
            assert_ok!(
                EtikaTokenSystem::transfer_tokens(
                    Origin::signed(consumer_id),
                    merchant_id,
                    1000
                )
            );
            
            // Vérifier les soldes après transfert
            assert_eq!(
                EtikaTokenSystem::active_token_balances(consumer_id), 
                activation_amount - 1000
            );
        });
    }
    
    // Scénario 3: Enchères de sponsors (simulation d'enchères pour devenir sponsor officiel)
    #[test]
    fn test_sponsor_auction() {
        new_test_ext().execute_with(|| {
            // Configurer l'environnement de test
            let actors = setup_realistic_environment();
            
            // Supposons que le modèle d'enchères est basé sur la quantité de tokens transférés à un compte spécial
            let auction_account_id = 9;
            EtikaTokenSystem::update_actor_type(Origin::signed(0), auction_account_id, ActorType::Admin).unwrap();
            
            // 1. Deux fournisseurs concurrents font des offres
            let supplier1_id = 5;
            let supplier2_id = 6;
            
            let bid1_amount = 5000;
            let bid2_amount = 6000;
            
            // Premier fournisseur fait une offre
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(supplier1_id),
                auction_account_id,
                bid1_amount
            ));
            
            // Deuxième fournisseur fait une offre plus élevée
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(supplier2_id),
                auction_account_id,
                bid2_amount
            ));
            
            // 2. Vérifier le montant collecté par le compte d'enchères
            // Calculer les montants attendus après brûlage et redistribution
            let bid1_burn = bid1_amount * 5 / 100;
            let bid1_ngo = bid1_amount * 2 / 100;
            let bid1_transfer = bid1_amount - bid1_burn - bid1_ngo;
            
            let bid2_burn = bid2_amount * 5 / 100;
            let bid2_ngo = bid2_amount * 2 / 100;
            let bid2_transfer = bid2_amount - bid2_burn - bid2_ngo;
            
            let total_expected = bid1_transfer + bid2_transfer;
            
            assert_eq!(
                EtikaTokenSystem::active_token_balances(auction_account_id),
                total_expected
            );
            
            // 3. Récompenser le gagnant (fournisseur 2) avec des privilèges spéciaux 
            // (simulés ici par un transfert de tokens du compte d'enchères)
            let reward_amount = 1000;
            
            let supplier2_balance_before = EtikaTokenSystem::active_token_balances(supplier2_id);
            
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(auction_account_id),
                supplier2_id,
                reward_amount
            ));
            
            // Calculer les montants attendus
            let reward_burn = reward_amount * 5 / 100;
            let reward_ngo = reward_amount * 2 / 100;
            let reward_transfer = reward_amount - reward_burn - reward_ngo;
            
            // Vérifier le solde du gagnant
            assert_eq!(
                EtikaTokenSystem::active_token_balances(supplier2_id),
                supplier2_balance_before + reward_transfer
            );
        });
    }
    
    // Scénario 4: Affacturage en temps réel
    #[test]
    fn test_real_time_factoring() {
        new_test_ext().execute_with(|| {
            // Configurer l'environnement de test
            let actors = setup_realistic_environment();
            
            // 1. Simuler un cycle d'achat avec paiement immédiat au fournisseur
            let consumer_id = 1;
            let merchant_id = 3;
            let supplier_id = 5;
            
            // Activer des tokens pour le consommateur
            assert_ok!(EtikaTokenSystem::activate_tokens(
                Origin::signed(consumer_id),
                4000
            ));
            
            // Montants initiaux
            let consumer_initial = EtikaTokenSystem::active_token_balances(consumer_id);
            let merchant_initial = EtikaTokenSystem::active_token_balances(merchant_id);
            let supplier_initial = EtikaTokenSystem::active_token_balances(supplier_id);
            
            // Transaction d'achat: consommateur -> commerçant
            let purchase_amount = 2000;
            
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(consumer_id),
                merchant_id,
                purchase_amount
            ));
            
            // Calculer la partie du montant qui va au commerçant
            let purchase_burn = purchase_amount * 5 / 100;
            let purchase_ngo = purchase_amount * 2 / 100;
            let purchase_transfer = purchase_amount - purchase_burn - purchase_ngo;
            
            // 2. Paiement immédiat du fournisseur (c'est vendu, c'est payé)
            // Le commerçant transfère immédiatement une partie du montant au fournisseur
            let factoring_percentage = 70; // 70% du prix va au fournisseur
            let factoring_amount = purchase_transfer * factoring_percentage / 100;
            
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(merchant_id),
                supplier_id,
                factoring_amount
            ));
            
            // Calculer la partie du montant qui va au fournisseur
            let factoring_burn = factoring_amount * 5 / 100;
            let factoring_ngo = factoring_amount * 2 / 100;
            let factoring_transfer = factoring_amount - factoring_burn - factoring_ngo;
            
            // 3. Vérifier les soldes finaux
            // Le consommateur a payé l'achat complet
            assert_eq!(
                EtikaTokenSystem::active_token_balances(consumer_id),
                consumer_initial - purchase_amount
            );
            
            // Le commerçant conserve une marge
            assert_eq!(
                EtikaTokenSystem::active_token_balances(merchant_id),
                merchant_initial + purchase_transfer - factoring_amount
            );
            
            // Le fournisseur a été payé immédiatement
            assert_eq!(
                EtikaTokenSystem::active_token_balances(supplier_id),
                supplier_initial + factoring_transfer
            );
        });
    }
    
    // Scénario 5: Cycle complet multi-acteurs avec distributions périodiques
    #[test]
    fn test_complete_multi_actor_cycle() {
        new_test_ext().execute_with(|| {
            // Configurer l'environnement de test
            let actors = setup_realistic_environment();
            
            // 1. Distribution initiale de tokens
            System::set_block_number(100);
            EtikaTokenSystem::on_initialize(100);
            
            // 2. Activation des tokens par les consommateurs
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(1), 3000));
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(2), 4000));
            
            // 3. Premier cycle d'achats
            // Consommateur 1 achète chez le commerçant 1
            assert_ok!(EtikaTokenSystem::transfer_tokens(Origin::signed(1), 3, 1500));
            
            // Consommateur 2 achète chez le commerçant 2
            assert_ok!(EtikaTokenSystem::transfer_tokens(Origin::signed(2), 4, 2000));
            
            // 4. Paiements aux fournisseurs
            // Commerçant 1 paie le fournisseur 1
            assert_ok!(EtikaTokenSystem::transfer_tokens(Origin::signed(3), 5, 1000));
            
            // Commerçant 2 paie le fournisseur 2
            assert_ok!(EtikaTokenSystem::transfer_tokens(Origin::signed(4), 6, 1500));
            
            // 5. Dons aux ONG
            // Commerçant 1 fait un don à l'ONG 1
            assert_ok!(EtikaTokenSystem::transfer_to_ngo(Origin::signed(3), 7, 300));
            
            // Consommateur 2 fait un don à l'ONG 2
            assert_ok!(EtikaTokenSystem::transfer_to_ngo(Origin::signed(2), 8, 500));
            
            // 6. Deuxième distribution de tokens
            System::set_block_number(200);
            EtikaTokenSystem::on_initialize(200);
            
            // 7. Second cycle d'achats
            // Consommateur 1 achète chez le commerçant 2 cette fois
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(1), 1000));
            assert_ok!(EtikaTokenSystem::transfer_tokens(Origin::signed(1), 4, 1000));
            
            // Consommateur 2 achète chez le commerçant 1
            assert_ok!(EtikaTokenSystem::transfer_tokens(Origin::signed(2), 3, 1000));
            
            // 8. Verrouillage de tokens pour épargne
            assert_ok!(EtikaTokenSystem::lock_tokens(Origin::signed(1), 500, 1000));
            
            // 9. Vérifier les statistiques globales
            let total_burned = EtikaTokenSystem::total_burned_tokens();
            let total_ngo = EtikaTokenSystem::total_ngo_tokens();
            let total_distributed = EtikaTokenSystem::total_distributed_tokens();
            
            // S'assurer que le système a effectué les opérations attendues
            assert!(total_burned > 0);
            assert!(total_ngo > 0);
            assert!(total_distributed > 0);
            
            // 10. Vérifier que l'historique des transferts contient des entrées
            let history_count1 = EtikaTokenSystem::transfer_history_counter(1);
            let history_count2 = EtikaTokenSystem::transfer_history_counter(2);
            
            assert!(history_count1 > 0);
            assert!(history_count2 > 0);
        });
    }
}
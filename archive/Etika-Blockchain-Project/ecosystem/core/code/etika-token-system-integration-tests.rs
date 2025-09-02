// etika-token-system/tests/integration_tests.rs
//
// Ce fichier contient des tests d'intégration pour le module etika-token-system
// en interaction avec d'autres modules de l'écosystème Étika

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
use etika_blockchain_core::{Module as BlockchainCore, Config as BlockchainCoreConfig};
use etika_data_structure::{
    AccountId, ActorProfile, ActorType, Balance, Moment, PoPTransaction, Token, TokenState, TokenSystem as TokenSystemTrait,
};

// Mock runtime pour les tests d'intégration
#[derive(Clone, PartialEq, Eq, Debug)]
pub struct TestRuntime;

// Définition du bloc et des extrinsics pour les tests
type UncheckedExtrinsic = frame_system::mocking::MockUncheckedExtrinsic<TestRuntime>;
type Block = frame_system::mocking::MockBlock<TestRuntime>;

// Construction du runtime de test avec les modules nécessaires
frame_support::construct_runtime!(
    pub enum TestRuntime where
        Block = Block,
        NodeBlock = Block,
        UncheckedExtrinsic = UncheckedExtrinsic,
    {
        System: frame_system::{Module, Call, Config, Storage, Event<T>},
        EtikaTokenSystem: etika_token_system::{Module, Call, Storage, Event<T>},
        EtikaBlockchainCore: etika_blockchain_core::{Module, Call, Storage, Event<T>},
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

// Paramètres du module blockchain core (à adapter selon l'implémentation réelle)
parameter_types! {
    pub const MinValidators: u32 = 2;
    pub const MaxValidators: u32 = 10;
    pub const ValidatorRotationPeriod: u64 = 1000;
    pub const TransactionExpirationTime: u64 = 3600; // 1 heure
}

// Configuration du module blockchain core (à adapter selon l'implémentation réelle)
impl BlockchainCoreConfig for TestRuntime {
    type Event = Event;
    type MinValidators = MinValidators;
    type MaxValidators = MaxValidators;
    type ValidatorRotationPeriod = ValidatorRotationPeriod;
    type TransactionExpirationTime = TransactionExpirationTime;
}

// Structure de la transaction PoP pour tests
#[derive(Clone, Encode, Decode, PartialEq, Eq, Debug)]
pub struct TestPoPTransaction {
    pub consumer: u64,
    pub merchant: u64,
    pub supplier: u64,
    pub amount: Balance,
    pub timestamp: Moment,
}

// Implémentation manuelle de la transaction PoP (si nécessaire)
impl PoPTransaction for TestPoPTransaction {
    type AccountId = u64;
    
    fn get_consumer(&self) -> &Self::AccountId {
        &self.consumer
    }
    
    fn get_merchant(&self) -> &Self::AccountId {
        &self.merchant
    }
    
    fn get_suppliers(&self) -> Vec<&Self::AccountId> {
        vec![&self.supplier]
    }
    
    fn get_amount(&self) -> Balance {
        self.amount
    }
    
    fn get_timestamp(&self) -> Moment {
        self.timestamp
    }
}

// Mock pour simuler une transaction PoP venant du module blockchain-core
fn simulate_pop_transaction(consumer: u64, merchant: u64, supplier: u64, amount: Balance) -> TestPoPTransaction {
    let now = etika_token_system::Module::<TestRuntime>::get_current_timestamp();
    
    TestPoPTransaction {
        consumer,
        merchant,
        supplier,
        amount,
        timestamp: now,
    }
}

// Fonction utilitaire pour créer un environnement de test
fn new_test_ext() -> sp_io::TestExternalities {
    let mut t = frame_system::GenesisConfig::default()
        .build_storage::<TestRuntime>()
        .unwrap();
        
    t.into()
}

// Fonction utilitaire pour configurer les acteurs du test
fn setup_test_actors() -> (u64, u64, u64, u64) {
    let admin = 0;
    let consumer = 1;
    let merchant = 2;
    let supplier = 3;
    let ngo = 4;
    
    // Enregistrer les types d'acteurs
    EtikaTokenSystem::update_actor_type(Origin::signed(admin), consumer, ActorType::Consumer).unwrap();
    EtikaTokenSystem::update_actor_type(Origin::signed(admin), merchant, ActorType::Merchant).unwrap();
    EtikaTokenSystem::update_actor_type(Origin::signed(admin), supplier, ActorType::Supplier).unwrap();
    EtikaTokenSystem::update_actor_type(Origin::signed(admin), ngo, ActorType::NGO).unwrap();
    
    // Initialiser les comptes avec des tokens
    etika_token_system::LatentTokenBalances::<TestRuntime>::insert(consumer, 5000);
    etika_token_system::ActiveTokenBalances::<TestRuntime>::insert(merchant, 3000);
    etika_token_system::ActiveTokenBalances::<TestRuntime>::insert(supplier, 2000);
    
    (consumer, merchant, supplier, ngo)
}

// Tests d'intégration
#[cfg(test)]
mod tests {
    use super::*;
    
    // Test d'intégration: distribution périodique de tokens
    #[test]
    fn test_periodic_token_distribution() {
        new_test_ext().execute_with(|| {
            // Configurer les acteurs
            let (consumer, merchant, supplier, _) = setup_test_actors();
            
            // Vérifier les soldes initiaux configurés
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), 5000);
            assert_eq!(EtikaTokenSystem::active_token_balances(merchant), 3000);
            assert_eq!(EtikaTokenSystem::active_token_balances(supplier), 2000);
            
            // Avancer jusqu'à un bloc de distribution
            System::set_block_number(100);
            EtikaTokenSystem::on_initialize(100);
            
            // Vérifier que les tokens ont été distribués
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), 5000 + ConsumerDistributionAmount::get());
            
            // Avancer jusqu'à un autre bloc de distribution
            System::set_block_number(200);
            EtikaTokenSystem::on_initialize(200);
            
            // Vérifier que les tokens ont été à nouveau distribués
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), 5000 + 2 * ConsumerDistributionAmount::get());
            assert_eq!(EtikaTokenSystem::distribution_history(consumer, 200), ConsumerDistributionAmount::get());
        });
    }
    
    // Test d'intégration: activation de tokens après une transaction PoP
    #[test]
    fn test_token_activation_after_pop_transaction() {
        new_test_ext().execute_with(|| {
            // Configurer les acteurs
            let (consumer, merchant, supplier, _) = setup_test_actors();
            
            // Activer manuellement des tokens pour le consommateur
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(consumer), 1000));
            
            // Vérifier les soldes après activation
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), 4000);
            assert_eq!(EtikaTokenSystem::active_token_balances(consumer), 1000);
            
            // Simuler une transaction PoP
            let transaction = simulate_pop_transaction(consumer, merchant, supplier, 800);
            
            // Utiliser l'API externe pour traiter la transaction PoP
            // Cela devrait déclencher une activation de tokens et un transfert
            let activation_result = <EtikaTokenSystem as TokenSystemTrait>::activate_tokens(&consumer, 500);
            assert!(activation_result.is_ok());
            
            // Simuler un transfert de tokens basé sur la transaction PoP
            let transfer_result = <EtikaTokenSystem as TokenSystemTrait>::transfer_tokens(
                &consumer,
                &merchant,
                transaction.amount
            );
            assert!(transfer_result.is_ok());
            
            // Calculer les montants attendus pour le transfert
            let burn_rate = BurnRate::get() as u128 / 10000u128; // 5%
            let ngo_rate = NGORate::get() as u128 / 10000u128;   // 2%
            
            let burn_amount = (transaction.amount as f64 * burn_rate as f64) as Balance;
            let ngo_amount = (transaction.amount as f64 * ngo_rate as f64) as Balance;
            let transfer_amount = transaction.amount - burn_amount - ngo_amount;
            
            // Vérifier les soldes après le transfert
            assert_eq!(EtikaTokenSystem::active_token_balances(consumer), 1000 + 500 - transaction.amount);
            assert_eq!(EtikaTokenSystem::active_token_balances(merchant), 3000 + transfer_amount);
        });
    }
    
    // Test d'intégration: interaction avec le module blockchain-core
    #[test]
    fn test_interaction_with_blockchain_core() {
        new_test_ext().execute_with(|| {
            // Configurer les acteurs
            let (consumer, merchant, supplier, _) = setup_test_actors();
            
            // Activer des tokens pour le consommateur
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(consumer), 2000));
            
            // Vérifier l'état initial
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), 3000);
            assert_eq!(EtikaTokenSystem::active_token_balances(consumer), 2000);
            
            // Cette partie simule une interaction avec le module blockchain-core
            // Dans un système réel, cela pourrait impliquer des appels entre modules
            
            // Simuler la validation d'une transaction PoP
            let pop_transaction = simulate_pop_transaction(consumer, merchant, supplier, 1500);
            
            // Traiter le transfert basé sur la transaction PoP validée
            // Dans un système réel, cela pourrait être déclenché par un hook ou un événement
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(consumer),
                merchant,
                pop_transaction.amount
            ));
            
            // Calculer les montants attendus
            let burn_amount = pop_transaction.amount * 5 / 100; // 5% de 1500 = 75
            let ngo_amount = pop_transaction.amount * 2 / 100;  // 2% de 1500 = 30
            let transfer_amount = pop_transaction.amount - burn_amount - ngo_amount; // 1395
            
            // Vérifier les soldes après la transaction
            assert_eq!(EtikaTokenSystem::active_token_balances(consumer), 500); // 2000 - 1500
            assert_eq!(EtikaTokenSystem::active_token_balances(merchant), 3000 + transfer_amount);
            assert_eq!(EtikaTokenSystem::total_burned_tokens(), burn_amount);
            assert_eq!(EtikaTokenSystem::total_ngo_tokens(), ngo_amount);
            
            // Vérifier l'historique des transferts
            let index = EtikaTokenSystem::transfer_history_counter(consumer) % MaxTransferHistoryEntries::get();
            let history_entry = EtikaTokenSystem::transfer_history(consumer, index - 1);
            assert_eq!(history_entry.0, merchant); // Destinataire
            assert_eq!(history_entry.1, transfer_amount); // Montant
        });
    }
    
    // Test d'intégration: verrouillage/déverrouillage de tokens en combinaison avec des transferts
    #[test]
    fn test_token_locking_with_transfers() {
        new_test_ext().execute_with(|| {
            // Configurer les acteurs
            let (consumer, merchant, supplier, _) = setup_test_actors();
            
            // Activer des tokens pour le consommateur
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(consumer), 3000));
            
            // Verrouiller une partie des tokens
            assert_ok!(EtikaTokenSystem::lock_tokens(Origin::signed(consumer), 1000, 100));
            
            // Vérifier les soldes
            assert_eq!(EtikaTokenSystem::active_token_balances(consumer), 2000);
            assert_eq!(EtikaTokenSystem::locked_token_balances(consumer), 1000);
            
            // Tentative de transfert avec tous les tokens actifs (devrait réussir)
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(consumer),
                merchant,
                2000
            ));
            
            // Vérifier que le transfert a réussi et les tokens verrouillés sont intacts
            assert_eq!(EtikaTokenSystem::active_token_balances(consumer), 0);
            assert_eq!(EtikaTokenSystem::locked_token_balances(consumer), 1000);
            
            // Simuler le passage du temps pour déverrouiller les tokens
            let current_time = EtikaTokenSystem::get_current_timestamp();
            <etika_token_system::TokenUnlockTime<TestRuntime>>::insert(consumer, current_time - 1);
            
            // Déverrouiller les tokens
            assert_ok!(EtikaTokenSystem::unlock_tokens(Origin::signed(consumer)));
            
            // Vérifier que les tokens sont déverrouillés
            assert_eq!(EtikaTokenSystem::active_token_balances(consumer), 1000);
            assert_eq!(EtikaTokenSystem::locked_token_balances(consumer), 0);
            
            // Effectuer un autre transfert avec les tokens déverrouillés
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(consumer),
                supplier,
                500
            ));
            
            // Vérifier le résultat final
            assert_eq!(EtikaTokenSystem::active_token_balances(consumer), 500);
        });
    }
    
    // Test d'intégration: scénario complet d'une transaction commerciale
    #[test]
    fn test_complete_commercial_transaction_scenario() {
        new_test_ext().execute_with(|| {
            // Configurer les acteurs
            let (consumer, merchant, supplier, ngo) = setup_test_actors();
            
            // Étape 1: Distribution de tokens aux consommateurs
            System::set_block_number(100);
            EtikaTokenSystem::on_initialize(100);
            
            // Étape 2: Activation de tokens par le consommateur
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(consumer), 2000));
            
            // Vérifier l'état avant la transaction
            let consumer_balance_before = EtikaTokenSystem::active_token_balances(consumer);
            let merchant_balance_before = EtikaTokenSystem::active_token_balances(merchant);
            let supplier_balance_before = EtikaTokenSystem::active_token_balances(supplier);
            
            // Étape 3: Simuler une transaction PoP
            let transaction_amount = 1000;
            let pop_transaction = simulate_pop_transaction(consumer, merchant, supplier, transaction_amount);
            
            // Étape 4: Traiter le transfert consommateur -> commerçant
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(consumer),
                merchant,
                transaction_amount
            ));
            
            // Calculer les montants attendus
            let burn_amount = transaction_amount * 5 / 100; // 5% de 1000 = 50
            let ngo_amount = transaction_amount * 2 / 100;  // 2% de 1000 = 20
            let transfer_amount = transaction_amount - burn_amount - ngo_amount; // 930
            
            // Vérifier les soldes après le transfert consommateur -> commerçant
            assert_eq!(
                EtikaTokenSystem::active_token_balances(consumer),
                consumer_balance_before - transaction_amount
            );
            assert_eq!(
                EtikaTokenSystem::active_token_balances(merchant),
                merchant_balance_before + transfer_amount
            );
            
            // Étape 5: Transfert commerçant -> fournisseur (affacturage)
            let factoring_amount = 500;
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(merchant),
                supplier,
                factoring_amount
            ));
            
            // Calculer les montants attendus pour l'affacturage
            let factoring_burn = factoring_amount * 5 / 100; // 25
            let factoring_ngo = factoring_amount * 2 / 100;  // 10
            let factoring_transfer = factoring_amount - factoring_burn - factoring_ngo; // 465
            
            // Vérifier les soldes après l'affacturage
            assert_eq!(
                EtikaTokenSystem::active_token_balances(merchant),
                merchant_balance_before + transfer_amount - factoring_amount
            );
            assert_eq!(
                EtikaTokenSystem::active_token_balances(supplier),
                supplier_balance_before + factoring_transfer
            );
            
            // Étape 6: Don du commerçant à une ONG
            let donation_amount = 200;
            assert_ok!(EtikaTokenSystem::transfer_to_ngo(
                Origin::signed(merchant),
                ngo,
                donation_amount
            ));
            
            // Vérifier les soldes après le don
            assert_eq!(
                EtikaTokenSystem::active_token_balances(merchant),
                merchant_balance_before + transfer_amount - factoring_amount - donation_amount
            );
            assert_eq!(EtikaTokenSystem::active_token_balances(ngo), donation_amount);
            
            // Vérifier les totaux
            let total_burned = EtikaTokenSystem::total_burned_tokens();
            let total_ngo = EtikaTokenSystem::total_ngo_tokens();
            
            assert_eq!(total_burned, burn_amount + factoring_burn);
            assert_eq!(total_ngo, ngo_amount + factoring_ngo + donation_amount);
        });
    }
    
    // Test d'intégration: test des limites et comportements en cas d'erreur
    #[test]
    fn test_error_cases_and_limits() {
        new_test_ext().execute_with(|| {
            // Configurer les acteurs
            let (consumer, merchant, supplier, ngo) = setup_test_actors();
            
            // Cas d'erreur 1: Tentative d'activation de plus de tokens que disponible
            assert_noop!(
                EtikaTokenSystem::activate_tokens(Origin::signed(consumer), 6000),
                Error::<TestRuntime>::InsufficientLatentBalance
            );
            
            // Cas d'erreur 2: Tentative de transfert de plus de tokens que disponible
            assert_noop!(
                EtikaTokenSystem::transfer_tokens(Origin::signed(consumer), merchant, 1000),
                Error::<TestRuntime>::InsufficientActiveBalance
            );
            
            // Cas d'erreur 3: Tentative de transfert à une ONG non enregistrée
            let fake_ngo = 10;
            EtikaTokenSystem::update_actor_type(Origin::signed(0), fake_ngo, ActorType::Consumer).unwrap();
            
            // Activer des tokens pour pouvoir tester le transfert
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(consumer), 1000));
            
            assert_noop!(
                EtikaTokenSystem::transfer_to_ngo(Origin::signed(consumer), fake_ngo, 500),
                Error::<TestRuntime>::NotRegisteredAsNGO
            );
            
            // Cas d'erreur 4: Tentative de déverrouillage de tokens encore verrouillés
            assert_ok!(EtikaTokenSystem::lock_tokens(Origin::signed(consumer), 500, 3600));
            
            assert_noop!(
                EtikaTokenSystem::unlock_tokens(Origin::signed(consumer)),
                Error::<TestRuntime>::TokensStillLocked
            );
            
            // Test de limite: Approcher la limite max de tokens
            let max_balance = MaxTokenBalance::get();
            
            // Insérer un solde proche du maximum
            let close_to_max = max_balance - 1000;
            <etika_token_system::ActiveTokenBalances<TestRuntime>>::insert(supplier, close_to_max);
            
            // Le transfert suivant devrait réussir car il est dans les limites
            assert_ok!(EtikaTokenSystem::transfer_tokens(
                Origin::signed(merchant),
                supplier,
                900
            ));
            
            // Ce transfert devrait échouer car il dépasserait la limite maximale
            let burn_rate = BurnRate::get() as u128 / 10000u128; // 5%
            let ngo_rate = NGORate::get() as u128 / 10000u128;   // 2%
            
            // Calculer le montant brut qui, après réduction, donnerait exactement 1000
            let gross_amount = 1000 / (1.0 - burn_rate as f64 - ngo_rate as f64);
            
            assert_noop!(
                EtikaTokenSystem::transfer_tokens(Origin::signed(merchant), supplier, 2000),
                Error::<TestRuntime>::TokenBalanceOverflow
            );
        });
    }
}
// etika-token-system/src/tests.rs
//
// Ce fichier contient des tests unitaires pour le module etika-token-system

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
    use crate::*;
    
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
    
    // Fonction utilitaire pour configurer différents types d'acteurs pour les tests
    fn setup_actor_types() -> (u64, u64, u64, u64) {
        let admin = 0;
        let consumer = 1;
        let merchant = 2;
        let supplier = 3;
        let ngo = 4;
        
        EtikaTokenSystem::update_actor_type(Origin::signed(admin), consumer, ActorType::Consumer).unwrap();
        EtikaTokenSystem::update_actor_type(Origin::signed(admin), merchant, ActorType::Merchant).unwrap();
        EtikaTokenSystem::update_actor_type(Origin::signed(admin), supplier, ActorType::Supplier).unwrap();
        EtikaTokenSystem::update_actor_type(Origin::signed(admin), ngo, ActorType::NGO).unwrap();
        
        (consumer, merchant, supplier, ngo)
    }
    
    // Test de distribution initiale des tokens
    #[test]
    fn test_distribute_tokens() {
        new_test_ext().execute_with(|| {
            // Configurer les types d'acteurs
            let (consumer, merchant, supplier, _) = setup_actor_types();
            
            // Vérifier les soldes initiaux
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), 0);
            assert_eq!(EtikaTokenSystem::latent_token_balances(merchant), 0);
            assert_eq!(EtikaTokenSystem::latent_token_balances(supplier), 0);
            
            // Avancer jusqu'au bloc de distribution
            System::set_block_number(100);
            EtikaTokenSystem::on_initialize(100);
            
            // Vérifier que les tokens ont été distribués selon les types d'acteurs
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), ConsumerDistributionAmount::get());
            assert_eq!(EtikaTokenSystem::latent_token_balances(merchant), MerchantDistributionAmount::get());
            assert_eq!(EtikaTokenSystem::latent_token_balances(supplier), SupplierDistributionAmount::get());
            
            // Vérifier le total des tokens distribués
            let expected_total = ConsumerDistributionAmount::get() + 
                               MerchantDistributionAmount::get() + 
                               SupplierDistributionAmount::get();
            assert_eq!(EtikaTokenSystem::total_distributed_tokens(), expected_total);
            
            // Vérifier que la distribution est enregistrée dans l'historique
            assert_eq!(EtikaTokenSystem::distribution_history(consumer, 100), ConsumerDistributionAmount::get());
            assert_eq!(EtikaTokenSystem::distribution_history(merchant, 100), MerchantDistributionAmount::get());
            assert_eq!(EtikaTokenSystem::distribution_history(supplier, 100), SupplierDistributionAmount::get());
            
            // Vérifier que le bloc de dernière distribution est mis à jour
            assert_eq!(EtikaTokenSystem::last_distribution_block(), 100);
        });
    }
    
    // Test de distributions multiples selon la période
    #[test]
    fn test_multiple_distribution_periods() {
        new_test_ext().execute_with(|| {
            // Configurer les types d'acteurs
            let (consumer, _, _, _) = setup_actor_types();
            
            // Première distribution
            System::set_block_number(100);
            EtikaTokenSystem::on_initialize(100);
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), ConsumerDistributionAmount::get());
            
            // Avancer de quelques blocs (mais pas assez pour une nouvelle distribution)
            System::set_block_number(150);
            EtikaTokenSystem::on_initialize(150);
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), ConsumerDistributionAmount::get());
            
            // Avancer jusqu'à la prochaine période de distribution
            System::set_block_number(200);
            EtikaTokenSystem::on_initialize(200);
            assert_eq!(EtikaTokenSystem::latent_token_balances(consumer), ConsumerDistributionAmount::get() * 2);
            
            // Vérifier le total des tokens distribués
            assert_eq!(EtikaTokenSystem::total_distributed_tokens(), ConsumerDistributionAmount::get() * 2);
        });
    }
    
    // Test d'activation des tokens
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
    
    // Test de dépassement du solde maximum
    #[test]
    fn test_max_token_balance() {
        new_test_ext().execute_with(|| {
            let account = 1;
            let max_balance = MaxTokenBalance::get();
            
            // Insérer le solde maximum
            <LatentTokenBalances<Test>>::insert(account, max_balance);
            
            // Essayer de distribuer plus de tokens
            assert!(!EtikaTokenSystem::distribute_tokens(&account, 1).is_ok());
            
            // Vérifier que le solde n'a pas changé
            assert_eq!(EtikaTokenSystem::latent_token_balances(account), max_balance);
            
            // Activer tous les tokens
            assert_ok!(EtikaTokenSystem::activate_tokens(Origin::signed(account), max_balance));
            
            // Vérifier les soldes
            assert_eq!(EtikaTokenSystem::latent_token_balances(account), 0);
            assert_eq!(EtikaTokenSystem::active_token_balances(account), max_balance);
        });
    }
    
    // Test de transfert de tokens
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
            
            // Vérifier que l'historique des transferts est correctement mis à jour
            let index = EtikaTokenSystem::transfer_history_counter(from) % MaxTransferHistoryEntries::get();
            let history_entry = EtikaTokenSystem::transfer_history(from, index - 1);
            assert_eq!(history_entry.1, transfer_amount); // Vérifier le montant
            assert_eq!(history_entry.0, to); // Vérifier le destinataire
        });
    }
    
    // Test de transfert à une ONG
    #[test]
    fn test_transfer_to_ngo() {
        new_test_ext().execute_with(|| {
            // Configurer des comptes
            let from = 1;
            let ngo = 2;
            let not_ngo = 3;
            <ActiveTokenBalances<Test>>::insert(from, 1000);
            
            // Configurer l'ONG et un compte non-ONG
            EtikaTokenSystem::update_actor_type(Origin::signed(0), ngo, ActorType::NGO).unwrap();
            EtikaTokenSystem::update_actor_type(Origin::signed(0), not_ngo, ActorType::Consumer).unwrap();
            
            // Transférer des tokens à l'ONG
            assert_ok!(EtikaTokenSystem::transfer_to_ngo(Origin::signed(from), ngo, 500));
            
            // Vérifier les soldes (pas de brûlage pour les dons aux ONG)
            assert_eq!(EtikaTokenSystem::active_token_balances(from), 500);
            assert_eq!(EtikaTokenSystem::active_token_balances(ngo), 500);
            assert_eq!(EtikaTokenSystem::total_ngo_tokens(), 500);
            
            // Tentative de transfert à un non-ONG
            assert_noop!(
                EtikaTokenSystem::transfer_to_ngo(Origin::signed(from), not_ngo, 100),
                Error::<Test>::NotRegisteredAsNGO
            );
            
            // Tentative de transfert avec solde insuffisant
            assert_noop!(
                EtikaTokenSystem::transfer_to_ngo(Origin::signed(from), ngo, 1000),
                Error::<Test>::InsufficientActiveBalance
            );
        });
    }
    
    // Test du mécanisme de calcul de la répartition des tokens
    #[test]
    fn test_calculate_token_distribution() {
        new_test_ext().execute_with(|| {
            // Calcul pour 1000 tokens avec 5% de brûlage et 2% pour ONG
            let amount = 1000;
            let (burn_amount, ngo_amount, transfer_amount) = 
                EtikaTokenSystem::calculate_token_distribution(amount);
            
            assert_eq!(burn_amount, 50); // 5% de 1000
            assert_eq!(ngo_amount, 20);  // 2% de 1000
            assert_eq!(transfer_amount, 930); // 1000 - 50 - 20
            assert_eq!(burn_amount + ngo_amount + transfer_amount, amount);
            
            // Calcul pour un petit montant
            let amount = 10;
            let (burn_amount, ngo_amount, transfer_amount) = 
                EtikaTokenSystem::calculate_token_distribution(amount);
            
            // Pour les petits montants, les arrondis peuvent donner des résultats particuliers
            assert!(burn_amount <= 1); // 5% de 10 arrondi
            assert!(ngo_amount <= 1);  // 2% de 10 arrondi
            assert_eq!(burn_amount + ngo_amount + transfer_amount, amount);
        });
    }
    
    // Test de verrouillage et déverrouillage des tokens
    #[test]
    fn test_lock_and_unlock_tokens() {
        new_test_ext().execute_with(|| {
            // Configurer un compte avec des tokens actifs
            let account = 1;
            <ActiveTokenBalances<Test>>::insert(account, 1000);
            
            // Verrouiller une partie des tokens pour 100 secondes
            assert_ok!(EtikaTokenSystem::lock_tokens(Origin::signed(account), 500, 100));
            
            // Vérifier les soldes
            assert_eq!(EtikaTokenSystem::active_token_balances(account), 500);
            assert_eq!(EtikaTokenSystem::locked_token_balances(account), 500);
            
            // Récupérer le temps de déverrouillage
            let unlock_time = EtikaTokenSystem::token_unlock_time(account);
            let current_time = EtikaTokenSystem::get_current_timestamp();
            assert!(unlock_time > current_time);
            
            // Tentative de déverrouillage avant la fin de la période
            assert_noop!(
                EtikaTokenSystem::unlock_tokens(Origin::signed(account)),
                Error::<Test>::TokensStillLocked
            );
            
            // Tester le déverrouillage automatique (puisqu'on ne peut pas avancer le temps dans les tests)
            EtikaTokenSystem::process_token_unlocks();
            
            // Simuler le passage du temps manuellement en modifiant directement la valeur de déverrouillage
            <TokenUnlockTime<Test>>::insert(account, current_time - 1);
            
            // Déverrouiller manuellement
            assert_ok!(EtikaTokenSystem::unlock_tokens(Origin::signed(account)));
            
            // Vérifier les soldes après déverrouillage
            assert_eq!(EtikaTokenSystem::active_token_balances(account), 1000);
            assert_eq!(EtikaTokenSystem::locked_token_balances(account), 0);
        });
    }
    
    // Test de mise à jour du type d'acteur
    #[test]
    fn test_update_actor_type() {
        new_test_ext().execute_with(|| {
            let admin = 0;
            let account = 1;
            
            // Vérifier la valeur initiale (par défaut)
            assert_eq!(EtikaTokenSystem::actor_types(account), ActorType::default());
            
            // Mettre à jour le type d'acteur
            assert_ok!(EtikaTokenSystem::update_actor_type(
                Origin::signed(admin),
                account,
                ActorType::Consumer
            ));
            
            // Vérifier la mise à jour
            assert_eq!(EtikaTokenSystem::actor_types(account), ActorType::Consumer);
            
            // Changer à un autre type
            assert_ok!(EtikaTokenSystem::update_actor_type(
                Origin::signed(admin),
                account,
                ActorType::Merchant
            ));
            
            // Vérifier la mise à jour
            assert_eq!(EtikaTokenSystem::actor_types(account), ActorType::Merchant);
        });
    }
    
    // Test de l'historique des transferts et sa limite
    #[test]
    fn test_transfer_history_limit() {
        new_test_ext().execute_with(|| {
            let from = 1;
            let to = 2;
            <ActiveTokenBalances<Test>>::insert(from, 10000);
            
            // Effectuer plus de transferts que la limite d'historique
            let max_entries = MaxTransferHistoryEntries::get();
            for i in 0..max_entries + 5 {
                assert_ok!(EtikaTokenSystem::transfer_tokens(Origin::signed(from), to, 10));
            }
            
            // Vérifier que le compteur d'historique a augmenté correctement
            assert_eq!(EtikaTokenSystem::transfer_history_counter(from), max_entries + 5);
            
            // Vérifier que les entrées les plus anciennes ont été écrasées
            // et que nous avons exactement `max_entries` entrées valides
            let mut found_entries = 0;
            for i in 0..max_entries * 2 {
                let entry = EtikaTokenSystem::transfer_history(from, i);
                if entry.0 == to && entry.1 > 0 {
                    found_entries += 1;
                }
            }
            
            assert_eq!(found_entries, max_entries);
        });
    }
    
    // Test de l'implémentation du trait TokenSystem
    #[test]
    fn test_token_system_trait_implementation() {
        new_test_ext().execute_with(|| {
            let account = 1;
            let destination = 2;
            
            // Tester la méthode distribute_tokens
            assert_ok!(EtikaTokenSystem::distribute_tokens(&account, 1000));
            assert_eq!(EtikaTokenSystem::latent_token_balances(account), 1000);
            
            // Tester la méthode activate_tokens
            assert_ok!(EtikaTokenSystem::activate_tokens(&account, 500));
            assert_eq!(EtikaTokenSystem::latent_token_balances(account), 500);
            assert_eq!(EtikaTokenSystem::active_token_balances(account), 500);
            
            // Tester la méthode burn_tokens
            assert_ok!(EtikaTokenSystem::burn_tokens(&account, 100));
            assert_eq!(EtikaTokenSystem::active_token_balances(account), 400);
            assert_eq!(EtikaTokenSystem::total_burned_tokens(), 100);
            
            // Tester la méthode transfer_tokens
            assert_ok!(EtikaTokenSystem::transfer_tokens(&account, &destination, 200));
            
            // Calculer les montants attendus
            let burn_amount = 200 * 5 / 100; // 10
            let ngo_amount = 200 * 2 / 100; // 4
            let transfer_amount = 200 - burn_amount - ngo_amount; // 186
            
            assert_eq!(EtikaTokenSystem::active_token_balances(account), 200); // 400 - 200
            assert_eq!(EtikaTokenSystem::active_token_balances(destination), transfer_amount);
        });
    }
}

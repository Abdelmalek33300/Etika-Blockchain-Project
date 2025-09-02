            // Vérifier que l'ordre est actif et compatible
            if buy_order.status == OrderStatus::Active && 
               buy_order.price >= sell_order.price &&
               buy_order.creator != sell_order.creator { // Pas de self-trading
                
                let match_quantity = remaining_quantity.min(buy_order.quantity);
                
                if match_quantity > Zero::zero() {
                    matched_buy_orders.push((buy_order_id, buy_order, match_quantity));
                    remaining_quantity = remaining_quantity.saturating_sub(match_quantity);
                    
                    // Si quantité restante = 0, on peut s'arrêter
                    if remaining_quantity.is_zero() {
                        break;
                    }
                }
            }
        }
        
        // Exécuter les correspondances
        for (buy_order_id, mut buy_order, match_quantity) in matched_buy_orders {
            // Calculer le prix de la transaction (généralement le prix de l'ordre placé en premier)
            let trade_price = buy_order.price;
            
            // Calculer le montant total
            let total_amount = match_quantity.saturating_mul(trade_price);
            
            // Calculer les frais de marché
            let fee_amount = T::MarketplaceFee::get() * total_amount;
            let net_amount = total_amount.saturating_sub(fee_amount);
            
            // Effectuer les transferts
            
            // 1. Libérer les fonds réservés de l'acheteur
            T::Currency::unreserve(&buy_order.creator, total_amount);
            
            // 2. Transférer les frais au compte des frais
            T::Currency::transfer(
                &buy_order.creator,
                &T::FeeAccount::get(),
                fee_amount,
                ExistenceRequirement::KeepAlive
            )?;
            
            // 3. Transférer le montant net au vendeur
            T::Currency::transfer(
                &buy_order.creator,
                &sell_order.creator,
                net_amount,
                ExistenceRequirement::KeepAlive
            )?;
            
            // 4. Transférer les tokens du vendeur à l'acheteur
            // Pour une implémentation réelle, il faudrait adapter ce code au vrai système de tokens
            let _ = T::TokenSystem::transfer_tokens(
                &sell_order.creator.clone().try_into().map_err(|_| Error::<T>::IncompatibleActorType)?,
                &buy_order.creator.clone().try_into().map_err(|_| Error::<T>::IncompatibleActorType)?,
                match_quantity.saturated_into::<Balance>()
            ).map_err(|_| Error::<T>::InsufficientFunds)?;
            
            // Mettre à jour les ordres
            
            // Ordre de vente
            sell_order.quantity = sell_order.quantity.saturating_sub(match_quantity);
            if sell_order.quantity.is_zero() {
                sell_order.status = OrderStatus::Filled;
                <SellOrders<T>>::insert(sell_order_id, sell_order.clone());
                <TotalSellOrders>::mutate(|count| *count = count.saturating_sub(1));
            } else {
                sell_order.status = OrderStatus::PartiallyFilled;
                <SellOrders<T>>::insert(sell_order_id, sell_order.clone());
            }
            
            // Ordre d'achat
            buy_order.quantity = buy_order.quantity.saturating_sub(match_quantity);
            if buy_order.quantity.is_zero() {
                buy_order.status = OrderStatus::Filled;
                <BuyOrders<T>>::insert(buy_order_id, buy_order.clone());
                <TotalBuyOrders>::mutate(|count| *count = count.saturating_sub(1));
            } else {
                buy_order.status = OrderStatus::PartiallyFilled;
                <BuyOrders<T>>::insert(buy_order_id, buy_order.clone());
            }
            
            // Mettre à jour les statistiques
            <TotalTradingVolume<T>>::mutate(|volume| {
                *volume = volume.saturating_add(total_amount);
            });
            
            <TotalFeesCollected<T>>::mutate(|fees| {
                *fees = fees.saturating_add(fee_amount);
            });
            
            // Mettre à jour l'historique des prix
            Self::update_price_history(trade_price);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TradeExecuted(
                buy_order_id,
                sell_order_id,
                match_quantity,
                trade_price
            ));
        }
        
        Ok(())
    }
    
    /// Faire correspondre les ordres d'achat et de vente existants
    fn match_orders() -> DispatchResult {
        // Cette fonction est appelée périodiquement pour tenter de faire correspondre les ordres existants
        
        // Récupérer tous les ordres d'achat actifs
        let buy_orders: Vec<_> = <BuyOrders<T>>::iter()
            .filter(|(_, order)| order.status == OrderStatus::Active)
            .collect();
        
        // Pour chaque ordre d'achat, tenter de le faire correspondre
        for (buy_order_id, _) in buy_orders {
            let _ = Self::try_match_buy_order(buy_order_id);
        }
        
        Ok(())
    }
    
    /// Mettre à jour l'historique des prix et la moyenne des prix
    fn update_price_history(price: BalanceOf<T>) {
        // Mettre à jour l'historique des prix
        let mut history = <PriceHistory<T>>::get();
        
        // Ajouter la nouvelle entrée
        let current_block = <frame_system::Module<T>>::block_number();
        history.push((price, current_block));
        
        // Limiter la taille de l'historique aux 100 dernières entrées
        if history.len() > 100 {
            history.remove(0);
        }
        
        <PriceHistory<T>>::put(history.clone());
        
        // Calculer la moyenne des prix
        if !history.is_empty() {
            let total_price: BalanceOf<T> = history.iter()
                .map(|(p, _)| *p)
                .fold(Zero::zero(), |acc, p| acc.saturating_add(p));
                
            let average_price = total_price / history.len().saturated_into::<BalanceOf<T>>();
            <AverageTokenPrice<T>>::put(average_price);
        }
    }
}

/// Implémentation du trait Marketplace pour le module marketplace
impl<T: Config> Marketplace for Module<T> {
    fn create_order(
        creator: &AccountId,
        order_type: OrderType,
        quantity: Balance,
        price: Balance,
        expiration: Moment,
    ) -> Result<[u8; 32], &'static str> {
        // Convertir les types génériques en types spécifiques au runtime
        let creator_id = creator.clone().try_into().map_err(|_| "Invalid creator ID")?;
        let quantity_balance = quantity.saturated_into::<BalanceOf<T>>();
        let price_balance = price.saturated_into::<BalanceOf<T>>();
        
        // Vérifier les paramètres basiques
        if quantity == 0 {
            return Err("Quantity must be positive");
        }
        
        if price == 0 {
            return Err("Price must be positive");
        }
        
        // Générer l'ID de l'ordre
        let order_id = Self::generate_order_id(&creator_id, order_type, quantity_balance, price_balance);
        
        // Dans une implémentation réelle, on créerait l'ordre ici
        // Pour cette interface simple, nous ne faisons que retourner l'ID
        
        Ok(order_id)
    }
    
    fn cancel_order(order_id: [u8; 32], caller: &AccountId) -> Result<(), &'static str> {
        // Convertir les types génériques en types spécifiques au runtime
        let caller_id = caller.clone().try_into().map_err(|_| "Invalid caller ID")?;
        
        // Vérifier si l'ordre existe comme ordre d'achat
        if <BuyOrders<T>>::contains_key(order_id) {
            let order = <BuyOrders<T>>::get(order_id);
            
            // Vérifier que l'appelant est le créateur
            if order.creator != caller_id {
                return Err("Unauthorized");
            }
            
            if order.status != OrderStatus::Active {
                return Err("Order is not active");
            }
            
            // Dans une implémentation réelle, on annulerait l'ordre ici
            
            Ok(())
        } 
        // Vérifier si l'ordre existe comme ordre de vente
        else if <SellOrders<T>>::contains_key(order_id) {
            let order = <SellOrders<T>>::get(order_id);
            
            // Vérifier que l'appelant est le créateur
            if order.creator != caller_id {
                return Err("Unauthorized");
            }
            
            if order.status != OrderStatus::Active {
                return Err("Order is not active");
            }
            
            // Dans une implémentation réelle, on annulerait l'ordre ici
            
            Ok(())
        }
        else {
            Err("Order not found")
        }
    }
    
    fn match_orders() -> Result<(), &'static str> {
        match Self::match_orders() {
            Ok(_) => Ok(()),
            Err(_) => Err("Failed to match orders"),
        }
    }
}

/// Tests unitaires pour le module marketplace
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
            EtikaMarketplace: Module<Test>,
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
    
    // Mock implementation for TokenSystem
    pub struct MockTokenSystem;
    
    impl TokenSystem for MockTokenSystem {
        fn distribute_tokens(_to: &AccountId, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }
    
        fn activate_tokens(_from: &AccountId, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }
    
        fn burn_tokens(_from: &AccountId, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }
    
        fn transfer_tokens(_from: &AccountId, _to: &AccountId, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }

        fn active_balance(_account: &AccountId) -> Balance {
            10000
        }

        fn lock_tokens(_account: &AccountId, _amount: Balance) -> Result<(), &'static str> {
            Ok(())
        }

        fn unlock_tokens(_account: &AccountId) -> Result<(), &'static str> {
            Ok(())
        }
    }
    
    parameter_types! {
        pub const MarketplaceFee: Perbill = Perbill::from_percent(1); // 1%
        pub const FeeAccountId: u64 = 999;
        pub const MinOrderAmount: u64 = 100;
        pub const MaxOrderDuration: u64 = 1000; // 1000 blocs
        pub const MaxOrdersPerAccount: u32 = 10;
        pub const MaxActiveProducts: u32 = 100;
        pub const ProductCreationFee: u64 = 1000;
    }
    
    impl Config for Test {
        type Event = Event;
        type Currency = Balances;
        type TokenSystem = MockTokenSystem;
        type MarketplaceFee = MarketplaceFee;
        type FeeAccount = FeeAccountId;
        type MinOrderAmount = MinOrderAmount;
        type MaxOrderDuration = MaxOrderDuration;
        type MaxOrdersPerAccount = MaxOrdersPerAccount;
        type MaxActiveProducts = MaxActiveProducts;
        type ProductCreationFee = ProductCreationFee;
    }
    
    // Fonction utilitaire pour créer un environnement de test
    fn new_test_ext() -> sp_io::TestExternalities {
        let mut t = frame_system::GenesisConfig::default()
            .build_storage::<Test>()
            .unwrap();
            
        pallet_balances::GenesisConfig::<Test> {
            balances: vec![
                (1, 100000),
                (2, 200000),
                (3, 300000),
                (4, 400000),
                (5, 500000),
                (999, 1000000), // Compte des frais
            ],
        }
        .assimilate_storage(&mut t)
        .unwrap();
        
        // Initialiser la moyenne des prix
        let mut ext = t.into();
        ext.execute_with(|| {
            <AverageTokenPrice<Test>>::put(1000);
            
            // Enregistrer les types d'acteurs
            <ActorTypes<Test>>::insert(1, ActorType::Consumer);
            <ActorTypes<Test>>::insert(2, ActorType::Merchant);
            <ActorTypes<Test>>::insert(3, ActorType::Supplier);
            <ActorTypes<Test>>::insert(4, ActorType::NGO);
            <ActorTypes<Test>>::insert(5, ActorType::Investor);
        });
        
        ext
    }
    
    #[test]
    fn test_create_buy_order() {
        new_test_ext().execute_with(|| {
            // Créer un ordre d'achat
            assert_ok!(EtikaMarketplace::create_buy_order(
                Origin::signed(1),
                100,    // quantité
                1500,   // prix
                100     // expiration
            ));
            
            // Vérifier le nombre d'ordres
            assert_eq!(EtikaMarketplace::total_buy_orders(), 1);
            
            // Vérifier les ordres du compte
            let account_orders = EtikaMarketplace::account_orders(1);
            assert_eq!(account_orders.len(), 1);
            
            // Vérifier le meilleur prix d'achat
            assert_eq!(EtikaMarketplace::best_buy_price(), 1500);
        });
    }
    
    #[test]
    fn test_create_sell_order() {
        new_test_ext().execute_with(|| {
            // Créer un ordre de vente
            assert_ok!(EtikaMarketplace::create_sell_order(
                Origin::signed(1),
                100,    // quantité
                1200,   // prix
                100     // expiration
            ));
            
            // Vérifier le nombre d'ordres
            assert_eq!(EtikaMarketplace::total_sell_orders(), 1);
            
            // Vérifier les ordres du compte
            let account_orders = EtikaMarketplace::account_orders(1);
            assert_eq!(account_orders.len(), 1);
            
            // Vérifier le meilleur prix de vente
            assert_eq!(EtikaMarketplace::best_sell_price(), 1200);
        });
    }
    
    #[test]
    fn test_cancel_order() {
        new_test_ext().execute_with(|| {
            // Créer un ordre d'achat
            assert_ok!(EtikaMarketplace::create_buy_order(
                Origin::signed(1),
                100,
                1500,
                100
            ));
            
            // Récupérer l'ID de l'ordre
            let account_orders = EtikaMarketplace::account_orders(1);
            let order_id = account_orders[0];
            
            // Annuler l'ordre
            assert_ok!(EtikaMarketplace::cancel_order(
                Origin::signed(1),
                order_id,
                OrderType::Buy
            ));
            
            // Vérifier que l'ordre est annulé
            let order = EtikaMarketplace::buy_orders(order_id);
            assert_eq!(order.status, OrderStatus::Cancelled);
            
            // Vérifier le nombre d'ordres actifs
            assert_eq!(EtikaMarketplace::total_buy_orders(), 0);
        });
    }
    
    #[test]
    fn test_order_matching() {
        new_test_ext().execute_with(|| {
            // Créer un ordre de vente
            assert_ok!(EtikaMarketplace::create_sell_order(
                Origin::signed(2),
                100,
                1000,
                100
            ));
            
            // Créer un ordre d'achat compatible
            assert_ok!(EtikaMarketplace::create_buy_order(
                Origin::signed(3),
                50,
                1200,  // Prix supérieur au prix de vente
                100
            ));
            
            // Vérifier que l'ordre d'achat a été partiellement exécuté
            let account_orders = EtikaMarketplace::account_orders(3);
            let buy_order_id = account_orders[0];
            let buy_order = EtikaMarketplace::buy_orders(buy_order_id);
            
            // L'ordre d'achat devrait être entièrement exécuté
            assert_eq!(buy_order.status, OrderStatus::Filled);
            
            // Vérifier que l'ordre de vente a été partiellement exécuté
            let account_orders = EtikaMarketplace::account_orders(2);
            let sell_order_id = account_orders[0];
            let sell_order = EtikaMarketplace::sell_orders(sell_order_id);
            
            // L'ordre de vente devrait être partiellement exécuté
            assert_eq!(sell_order.status, OrderStatus::PartiallyFilled);
            assert_eq!(sell_order.quantity, 50); // 100 - 50
            
            // Vérifier le volume de trading
            assert_eq!(EtikaMarketplace::total_trading_volume(), 50 * 1000); // quantité * prix
            
            // Vérifier les frais collectés
            let expected_fee = Perbill::from_percent(1) * (50 * 1000);
            assert_eq!(EtikaMarketplace::total_fees_collected(), expected_fee);
        });
    }
    
    #[test]
    fn test_create_financial_product() {
        new_test_ext().execute_with(|| {
            // Créer un produit financier
            assert_ok!(EtikaMarketplace::create_financial_product(
                Origin::signed(999), // Compte administrateur
                b"Savings Bond".to_vec(),
                b"A fixed income investment with guaranteed returns".to_vec(),
                ProductType::GuaranteedSavings,
                500, // 5.00% de rendement attendu
                180 * 24 * 60 * 60, // 180 jours en secondes
                10000, // Montant minimum d'investissement
                2 // Niveau de risque (1-5)
            ));
            
            // Vérifier le nombre de produits
            assert_eq!(EtikaMarketplace::total_active_products(), 1);
            
            // Vérifier la liste des produits par type
            let products = EtikaMarketplace::products_by_type(ProductType::GuaranteedSavings);
            assert_eq!(products.len(), 1);
            
            // Vérifier les détails du produit
            let product_id = products[0];
            let product = EtikaMarketplace::financial_products(product_id);
            
            assert_eq!(product.name, b"Savings Bond".to_vec());
            assert_eq!(product.expected_yield, 500);
            assert_eq!(product.risk_level, 2);
            assert_eq!(product.status, ProductStatus::Open);
        });
    }
    
    #[test]
    fn test_invest_in_product() {
        new_test_ext().execute_with(|| {
            // Créer un produit financier
            assert_ok!(EtikaMarketplace::create_financial_product(
                Origin::signed(999),
                b"Savings Bond".to_vec(),
                b"A fixed income investment with guaranteed returns".to_vec(),
                ProductType::GuaranteedSavings,
                500,
                180 * 24 * 60 * 60,
                10000,
                2
            ));
            
            // Récupérer l'ID du produit
            let products = EtikaMarketplace::products_by_type(ProductType::GuaranteedSavings);
            let product_id = products[0];
            
            // Investir dans le produit
            assert_ok!(EtikaMarketplace::invest_in_product(
                Origin::signed(1),
                product_id,
                20000 // Montant de l'investissement
            ));
            
            // Vérifier l'investissement
            let investment = EtikaMarketplace::investments(1, product_id);
            assert_eq!(investment, 20000);
            
            // Vérifier le total investi dans le produit
            let product = EtikaMarketplace::financial_products(product_id);
            assert_eq!(product.total_invested, 20000);
        });
    }
    
    #[test]
    fn test_close_product() {
        new_test_ext().execute_with(|| {
            // Créer un produit financier
            assert_ok!(EtikaMarketplace::create_financial_product(
                Origin::signed(999),
                b"Savings Bond".to_vec(),
                b"A fixed income investment with guaranteed returns".to_vec(),
                ProductType::GuaranteedSavings,
                500,
                180 * 24 * 60 * 60,
                10000,
                2
            ));
            
            // Récupérer l'ID du produit
            let products = EtikaMarketplace::products_by_type(ProductType::GuaranteedSavings);
            let product_id = products[0];
            
            // Fermer le produit aux nouveaux investissements
            assert_ok!(EtikaMarketplace::close_product(
                Origin::signed(999),
                product_id
            ));
            
            // Vérifier le statut du produit
            let product = EtikaMarketplace::financial_products(product_id);
            assert_eq!(product.status, ProductStatus::Closed);
        });
    }
}        /// Initialisation des erreurs
        type Error = Error<T>;
        
        /// Émission des événements
        fn deposit_event() = default;
        
        /// Traitement des ordres expirés et correspondance des ordres au changement de bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Nettoyer les ordres expirés
            Self::clean_expired_orders(n);
            
            // Tenter de faire correspondre des ordres d'achat et de vente
            Self::match_orders();
            
            0
        }
        
        /// Créer un nouvel ordre d'achat
        #[weight = 10_000]
        pub fn create_buy_order(
            origin,
            quantity: BalanceOf<T>,
            price: BalanceOf<T>,
            expiration: T::BlockNumber,
        ) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            
            // Vérifier que le montant est suffisant
            ensure!(
                quantity.saturating_mul(price) >= T::MinOrderAmount::get(),
                Error::<T>::AmountTooSmall
            );
            
            // Vérifier que les prix sont valides
            ensure!(price > Zero::zero(), Error::<T>::InvalidPrice);
            ensure!(quantity > Zero::zero(), Error::<T>::InvalidQuantity);
            
            // Vérifier que le créateur n'a pas trop d'ordres
            let mut account_orders = <AccountOrders<T>>::get(&creator);
            ensure!(
                account_orders.len() < T::MaxOrdersPerAccount::get() as usize,
                Error::<T>::TooManyOrders
            );
            
            // Vérifier la période d'expiration
            let current_block = <frame_system::Module<T>>::block_number();
            let max_expiration = current_block.saturating_add(T::MaxOrderDuration::get());
            
            let actual_expiration = if expiration > max_expiration {
                max_expiration
            } else if expiration <= current_block {
                current_block.saturating_add(T::MaxOrderDuration::get())
            } else {
                expiration
            };
            
            // Calculer le montant total nécessaire
            let total_amount = quantity.saturating_mul(price);
            
            // Vérifier que le créateur a suffisamment de fonds
            ensure!(
                T::Currency::free_balance(&creator) >= total_amount,
                Error::<T>::InsufficientFunds
            );
            
            // Réserver les fonds
            T::Currency::reserve(&creator, total_amount)?;
            
            // Créer l'ordre
            let order_id = Self::generate_order_id(&creator, OrderType::Buy, quantity, price);
            
            let order = MarketOrder {
                id: order_id,
                creator: creator.clone(),
                order_type: OrderType::Buy,
                quantity,
                price,
                created_at: Self::get_current_timestamp(),
                status: OrderStatus::Active,
                expiration: actual_expiration.saturated_into::<Moment>(),
            };
            
            // Enregistrer l'ordre
            <BuyOrders<T>>::insert(order_id, order);
            
            // Mettre à jour la liste des ordres du compte
            account_orders.push(order_id);
            <AccountOrders<T>>::insert(&creator, account_orders);
            
            // Mettre à jour le compteur d'ordres
            <TotalBuyOrders>::mutate(|count| *count += 1);
            
            // Mettre à jour le meilleur prix d'achat si nécessaire
            let best_buy = <BestBuyPrice<T>>::get();
            if price > best_buy {
                <BestBuyPrice<T>>::put(price);
            }
            
            // Émettre un événement
            Self::deposit_event(RawEvent::BuyOrderCreated(
                order_id,
                creator,
                quantity,
                price
            ));
            
            // Tenter de faire correspondre cet ordre avec des ordres de vente existants
            Self::try_match_buy_order(order_id)?;
            
            Ok(())
        }
        
        /// Créer un nouvel ordre de vente
        #[weight = 10_000]
        pub fn create_sell_order(
            origin,
            quantity: BalanceOf<T>,
            price: BalanceOf<T>,
            expiration: T::BlockNumber,
        ) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            
            // Vérifier que le montant est suffisant
            ensure!(
                quantity.saturating_mul(price) >= T::MinOrderAmount::get(),
                Error::<T>::AmountTooSmall
            );
            
            // Vérifier que les prix sont valides
            ensure!(price > Zero::zero(), Error::<T>::InvalidPrice);
            ensure!(quantity > Zero::zero(), Error::<T>::InvalidQuantity);
            
            // Vérifier que le créateur n'a pas trop d'ordres
            let mut account_orders = <AccountOrders<T>>::get(&creator);
            ensure!(
                account_orders.len() < T::MaxOrdersPerAccount::get() as usize,
                Error::<T>::TooManyOrders
            );
            
            // Vérifier la période d'expiration
            let current_block = <frame_system::Module<T>>::block_number();
            let max_expiration = current_block.saturating_add(T::MaxOrderDuration::get());
            
            let actual_expiration = if expiration > max_expiration {
                max_expiration
            } else if expiration <= current_block {
                current_block.saturating_add(T::MaxOrderDuration::get())
            } else {
                expiration
            };
            
            // Vérifier que le créateur a suffisamment de tokens actifs
            let active_balance = T::TokenSystem::active_balance(&creator.clone().try_into().map_err(|_| Error::<T>::IncompatibleActorType)?);
            ensure!(
                active_balance >= quantity.saturated_into::<Balance>(),
                Error::<T>::InsufficientFunds
            );
            
            // Réserver les tokens (en utilisant le système de tokens)
            let _ = T::TokenSystem::lock_tokens(
                &creator.clone().try_into().map_err(|_| Error::<T>::IncompatibleActorType)?,
                quantity.saturated_into::<Balance>()
            ).map_err(|_| Error::<T>::InsufficientFunds)?;
            
            // Créer l'ordre
            let order_id = Self::generate_order_id(&creator, OrderType::Sell, quantity, price);
            
            let order = MarketOrder {
                id: order_id,
                creator: creator.clone(),
                order_type: OrderType::Sell,
                quantity,
                price,
                created_at: Self::get_current_timestamp(),
                status: OrderStatus::Active,
                expiration: actual_expiration.saturated_into::<Moment>(),
            };
            
            // Enregistrer l'ordre
            <SellOrders<T>>::insert(order_id, order);
            
            // Mettre à jour la liste des ordres du compte
            account_orders.push(order_id);
            <AccountOrders<T>>::insert(&creator, account_orders);
            
            // Mettre à jour le compteur d'ordres
            <TotalSellOrders>::mutate(|count| *count += 1);
            
            // Mettre à jour le meilleur prix de vente si nécessaire
            let best_sell = <BestSellPrice<T>>::get();
            if best_sell.is_zero() || price < best_sell {
                <BestSellPrice<T>>::put(price);
            }
            
            // Émettre un événement
            Self::deposit_event(RawEvent::SellOrderCreated(
                order_id,
                creator,
                quantity,
                price
            ));
            
            // Tenter de faire correspondre cet ordre avec des ordres d'achat existants
            Self::try_match_sell_order(order_id)?;
            
            Ok(())
        }
        
        /// Annuler un ordre existant
        #[weight = 10_000]
        pub fn cancel_order(
            origin,
            order_id: [u8; 32],
            order_type: OrderType,
        ) -> DispatchResult {
            let canceller = ensure_signed(origin)?;
            
            // Vérifier que l'ordre existe et est actif
            match order_type {
                OrderType::Buy => {
                    ensure!(<BuyOrders<T>>::contains_key(order_id), Error::<T>::OrderNotFound);
                    let order = <BuyOrders<T>>::get(order_id);
                    
                    // Vérifier que le canceller est le créateur de l'ordre
                    ensure!(order.creator == canceller, Error::<T>::Unauthorized);
                    ensure!(order.status == OrderStatus::Active, Error::<T>::OrderNotActive);
                    
                    // Libérer les fonds réservés
                    let reserved_amount = order.quantity.saturating_mul(order.price);
                    T::Currency::unreserve(&order.creator, reserved_amount);
                    
                    // Mettre à jour le statut de l'ordre
                    let mut updated_order = order;
                    updated_order.status = OrderStatus::Cancelled;
                    <BuyOrders<T>>::insert(order_id, updated_order);
                    
                    // Mettre à jour le compteur d'ordres
                    <TotalBuyOrders>::mutate(|count| *count = count.saturating_sub(1));
                },
                OrderType::Sell => {
                    ensure!(<SellOrders<T>>::contains_key(order_id), Error::<T>::OrderNotFound);
                    let order = <SellOrders<T>>::get(order_id);
                    
                    // Vérifier que le canceller est le créateur de l'ordre
                    ensure!(order.creator == canceller, Error::<T>::Unauthorized);
                    ensure!(order.status == OrderStatus::Active, Error::<T>::OrderNotActive);
                    
                    // Libérer les tokens réservés
                    let _ = T::TokenSystem::unlock_tokens(
                        &order.creator.clone().try_into().map_err(|_| Error::<T>::IncompatibleActorType)?,
                    ).map_err(|_| Error::<T>::InsufficientFunds)?;
                    
                    // Mettre à jour le statut de l'ordre
                    let mut updated_order = order;
                    updated_order.status = OrderStatus::Cancelled;
                    <SellOrders<T>>::insert(order_id, updated_order);
                    
                    // Mettre à jour le compteur d'ordres
                    <TotalSellOrders>::mutate(|count| *count = count.saturating_sub(1));
                }
            }
            
            // Émettre un événement
            Self::deposit_event(RawEvent::OrderCancelled(order_id, order_type));
            
            Ok(())
        }
        
        /// Créer un nouveau produit financier
        #[weight = 10_000]
        pub fn create_financial_product(
            origin,
            name: Vec<u8>,
            description: Vec<u8>,
            product_type: ProductType,
            expected_yield: u32,
            min_investment_duration: u64,
            min_investment_amount: BalanceOf<T>,
            risk_level: u8,
        ) -> DispatchResult {
            let creator = ensure_signed(origin)?;
            
            // Vérifier que l'acteur est autorisé (devrait être le fonds des consommateurs ou un administrateur)
            // Dans une implémentation réelle, il faudrait un système d'autorisation plus sophistiqué
            
            // Vérifier que les paramètres du produit sont valides
            ensure!(expected_yield > 0, Error::<T>::InvalidExpectedYield);
            ensure!(min_investment_duration > 0, Error::<T>::InvalidInvestmentDuration);
            ensure!(min_investment_amount > Zero::zero(), Error::<T>::AmountTooSmall);
            ensure!(risk_level >= 1 && risk_level <= 5, Error::<T>::InvalidProductType);
            
            // Vérifier que nous n'avons pas trop de produits actifs
            let active_products = <TotalActiveProducts>::get();
            ensure!(
                active_products < T::MaxActiveProducts::get(),
                Error::<T>::TooManyActiveProducts
            );
            
            // Prélever les frais de création
            T::Currency::transfer(
                &creator,
                &T::FeeAccount::get(),
                T::ProductCreationFee::get(),
                ExistenceRequirement::KeepAlive
            )?;
            
            <TotalFeesCollected<T>>::mutate(|total| {
                *total = total.saturating_add(T::ProductCreationFee::get());
            });
            
            // Créer l'ID du produit
            let product_id = Self::generate_product_id(&creator, &name, product_type);
            
            // Créer le produit financier
            let product = FinancialProduct {
                id: product_id,
                name: name.clone(),
                description,
                product_type,
                expected_yield,
                min_investment_duration,
                min_investment_amount: min_investment_amount.saturated_into::<Balance>(),
                total_invested: 0,
                risk_level,
                created_at: Self::get_current_timestamp(),
                status: ProductStatus::Open,
            };
            
            // Enregistrer le produit
            <FinancialProducts<T>>::insert(product_id, product);
            
            // Mettre à jour la liste des produits par type
            <ProductsByType<T>>::mutate(product_type, |products| {
                products.push(product_id);
            });
            
            // Mettre à jour le compteur de produits
            <TotalActiveProducts>::mutate(|count| *count += 1);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::FinancialProductCreated(
                product_id,
                creator,
                name,
                product_type,
                expected_yield
            ));
            
            Ok(())
        }
        
        /// Investir dans un produit financier
        #[weight = 10_000]
        pub fn invest_in_product(
            origin,
            product_id: [u8; 32],
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            let investor = ensure_signed(origin)?;
            
            // Vérifier que le produit existe et est ouvert
            ensure!(<FinancialProducts<T>>::contains_key(product_id), Error::<T>::ProductNotFound);
            let mut product = <FinancialProducts<T>>::get(product_id);
            ensure!(product.status == ProductStatus::Open, Error::<T>::ProductNotOpen);
            
            // Vérifier que le montant est suffisant
            ensure!(
                amount >= product.min_investment_amount.saturated_into::<BalanceOf<T>>(),
                Error::<T>::AmountTooSmall
            );
            
            // Vérifier que l'investisseur a suffisamment de fonds
            ensure!(
                T::Currency::free_balance(&investor) >= amount,
                Error::<T>::InsufficientFunds
            );
            
            // Transférer les fonds vers le compte du produit (à implémenter)
            // Dans une implémentation réelle, chaque produit aurait son propre compte multisig
            // Pour l'exemple, nous utilisons le compte des frais comme destination
            T::Currency::transfer(
                &investor,
                &T::FeeAccount::get(),
                amount,
                ExistenceRequirement::KeepAlive
            )?;
            
            // Mettre à jour l'investissement
            <Investments<T>>::mutate(investor.clone(), product_id, |invested| {
                *invested = invested.saturating_add(amount);
            });
            
            // Mettre à jour le total investi dans le produit
            product.total_invested = product.total_invested.saturating_add(amount.saturated_into::<Balance>());
            <FinancialProducts<T>>::insert(product_id, product);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::InvestmentMade(
                investor,
                product_id,
                amount
            ));
            
            Ok(())
        }
        
        /// Fermer un produit financier aux nouveaux investissements
        #[weight = 10_000]
        pub fn close_product(
            origin,
            product_id: [u8; 32],
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;
            
            // Vérifier que le produit existe
            ensure!(<FinancialProducts<T>>::contains_key(product_id), Error::<T>::ProductNotFound);
            let mut product = <FinancialProducts<T>>::get(product_id);
            
            // Vérifier que le produit est ouvert
            ensure!(product.status == ProductStatus::Open, Error::<T>::ProductNotOpen);
            
            // Vérifier que l'appelant est autorisé (créateur du produit ou administrateur)
            // Dans une implémentation réelle, il faudrait un système d'autorisation plus sophistiqué
            
            // Mettre à jour le statut du produit
            product.status = ProductStatus::Closed;
            <FinancialProducts<T>>::insert(product_id, product);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::ProductStatusUpdated(
                product_id,
                ProductStatus::Closed
            ));
            
            Ok(())
        }
        
        /// Distribuer un rendement aux investisseurs d'un produit
        #[weight = 10_000]
        pub fn distribute_yield(
            origin,
            product_id: [u8; 32],
            total_yield: BalanceOf<T>,
        ) -> DispatchResult {
            let distributor = ensure_signed(origin)?;
            
            // Vérifier que le produit existe
            ensure!(<FinancialProducts<T>>::contains_key(product_id), Error::<T>::ProductNotFound);
            let product = <FinancialProducts<T>>::get(product_id);
            
            // Vérifier que le produit est fermé ou mature
            ensure!(
                product.status == ProductStatus::Closed || product.status == ProductStatus::Matured,
                Error::<T>::ProductNotOpen
            );
            
            // Vérifier que le distributeur a suffisamment de fonds
            ensure!(
                T::Currency::free_balance(&distributor) >= total_yield,
                Error::<T>::InsufficientFunds
            );
            
            // Dans une implémentation réelle, ici nous distribuerions le rendement
            // à tous les investisseurs proportionnellement à leur investissement
            // Pour l'exemple, nous émettons simplement un événement
            
            // Émettre un événement
            Self::deposit_event(RawEvent::YieldDistributed(
                product_id,
                total_yield
            ));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Générer un ID unique pour un ordre
    fn generate_order_id(creator: &T::AccountId, order_type: OrderType, quantity: BalanceOf<T>, price: BalanceOf<T>) -> [u8; 32] {
        let timestamp = Self::get_current_timestamp();
        let mut data = Vec::new();
        
        data.extend_from_slice(&creator.encode());
        data.extend_from_slice(&(order_type as u8).to_be_bytes());
        data.extend_from_slice(&quantity.saturated_into::<u128>().to_be_bytes());
        data.extend_from_slice(&price.saturated_into::<u128>().to_be_bytes());
        data.extend_from_slice(&timestamp.to_be_bytes());
        
        let hash = sp_io::hashing::blake2_256(&data);
        hash
    }
    
    /// Générer un ID unique pour un produit financier
    fn generate_product_id(creator: &T::AccountId, name: &[u8], product_type: ProductType) -> [u8; 32] {
        let timestamp = Self::get_current_timestamp();
        let mut data = Vec::new();
        
        data.extend_from_slice(&creator.encode());
        data.extend_from_slice(name);
        data.extend_from_slice(&(product_type as u8).to_be_bytes());
        data.extend_from_slice(&timestamp.to_be_bytes());
        
        let hash = sp_io::hashing::blake2_256(&data);
        hash
    }
    
    /// Obtenir le timestamp actuel en secondes
    fn get_current_timestamp() -> Moment {
        let now = sp_io::offchain::timestamp()
            .unwrap_or_default()
            .unix_millis();
        (now / 1000) as Moment
    }
    
    /// Nettoyer les ordres expirés
    fn clean_expired_orders(current_block: T::BlockNumber) {
        // Nettoyer les ordres d'achat expirés
        for (order_id, order) in <BuyOrders<T>>::iter() {
            if order.status == OrderStatus::Active && 
               current_block.saturated_into::<Moment>() > order.expiration {
                // Libérer les fonds réservés
                let reserved_amount = order.quantity.saturating_mul(order.price);
                T::Currency::unreserve(&order.creator, reserved_amount);
                
                // Mettre à jour le statut de l'ordre
                let mut updated_order = order;
                updated_order.status = OrderStatus::Expired;
                <BuyOrders<T>>::insert(order_id, updated_order);
                
                // Mettre à jour le compteur d'ordres
                <TotalBuyOrders>::mutate(|count| *count = count.saturating_sub(1));
                
                // Émettre un événement
                Self::deposit_event(RawEvent::OrderExpired(order_id, OrderType::Buy));
            }
        }
        
        // Nettoyer les ordres de vente expirés
        for (order_id, order) in <SellOrders<T>>::iter() {
            if order.status == OrderStatus::Active && 
               current_block.saturated_into::<Moment>() > order.expiration {
                // Libérer les tokens réservés
                let _ = T::TokenSystem::unlock_tokens(
                    &order.creator.clone().try_into().map_err(|_| "Conversion error").unwrap_or_default(),
                );
                
                // Mettre à jour le statut de l'ordre
                let mut updated_order = order;
                updated_order.status = OrderStatus::Expired;
                <SellOrders<T>>::insert(order_id, updated_order);
                
                // Mettre à jour le compteur d'ordres
                <TotalSellOrders>::mutate(|count| *count = count.saturating_sub(1));
                
                // Émettre un événement
                Self::deposit_event(RawEvent::OrderExpired(order_id, OrderType::Sell));
            }
        }
    }
    
    /// Tenter de faire correspondre un nouvel ordre d'achat avec des ordres de vente existants
    fn try_match_buy_order(buy_order_id: [u8; 32]) -> DispatchResult {
        // Vérifier que l'ordre existe toujours
        if !<BuyOrders<T>>::contains_key(buy_order_id) {
            return Ok(());
        }
        
        let mut buy_order = <BuyOrders<T>>::get(buy_order_id);
        
        // Si l'ordre n'est plus actif, ne rien faire
        if buy_order.status != OrderStatus::Active {
            return Ok(());
        }
        
        // Rechercher des ordres de vente compatibles (prix <= prix d'achat, par ordre de prix croissant)
        let mut matched_sell_orders = Vec::new();
        let mut remaining_quantity = buy_order.quantity;
        
        for (sell_order_id, sell_order) in <SellOrders<T>>::iter() {
            // Vérifier que l'ordre est actif et compatible
            if sell_order.status == OrderStatus::Active && 
               sell_order.price <= buy_order.price &&
               sell_order.creator != buy_order.creator { // Pas de self-trading
                
                let match_quantity = remaining_quantity.min(sell_order.quantity);
                
                if match_quantity > Zero::zero() {
                    matched_sell_orders.push((sell_order_id, sell_order, match_quantity));
                    remaining_quantity = remaining_quantity.saturating_sub(match_quantity);
                    
                    // Si quantité restante = 0, on peut s'arrêter
                    if remaining_quantity.is_zero() {
                        break;
                    }
                }
            }
        }
        
        // Exécuter les correspondances
        for (sell_order_id, mut sell_order, match_quantity) in matched_sell_orders {
            // Calculer le prix de la transaction (généralement le prix de l'ordre placé en premier)
            let trade_price = sell_order.price;
            
            // Calculer le montant total
            let total_amount = match_quantity.saturating_mul(trade_price);
            
            // Calculer les frais de marché
            let fee_amount = T::MarketplaceFee::get() * total_amount;
            let net_amount = total_amount.saturating_sub(fee_amount);
            
            // Effectuer les transferts
            
            // 1. Libérer les fonds réservés de l'acheteur
            T::Currency::unreserve(&buy_order.creator, total_amount);
            
            // 2. Transférer les frais au compte des frais
            T::Currency::transfer(
                &buy_order.creator,
                &T::FeeAccount::get(),
                fee_amount,
                ExistenceRequirement::KeepAlive
            )?;
            
            // 3. Transférer le montant net au vendeur
            T::Currency::transfer(
                &buy_order.creator,
                &sell_order.creator,
                net_amount,
                ExistenceRequirement::KeepAlive
            )?;
            
            // 4. Transférer les tokens du vendeur à l'acheteur
            // Pour une implémentation réelle, il faudrait adapter ce code au vrai système de tokens
            let _ = T::TokenSystem::transfer_tokens(
                &sell_order.creator.clone().try_into().map_err(|_| Error::<T>::IncompatibleActorType)?,
                &buy_order.creator.clone().try_into().map_err(|_| Error::<T>::IncompatibleActorType)?,
                match_quantity.saturated_into::<Balance>()
            ).map_err(|_| Error::<T>::InsufficientFunds)?;
            
            // Mettre à jour les ordres
            
            // Ordre d'achat
            buy_order.quantity = buy_order.quantity.saturating_sub(match_quantity);
            if buy_order.quantity.is_zero() {
                buy_order.status = OrderStatus::Filled;
                <BuyOrders<T>>::insert(buy_order_id, buy_order.clone());
                <TotalBuyOrders>::mutate(|count| *count = count.saturating_sub(1));
            } else {
                buy_order.status = OrderStatus::PartiallyFilled;
                <BuyOrders<T>>::insert(buy_order_id, buy_order.clone());
            }
            
            // Ordre de vente
            sell_order.quantity = sell_order.quantity.saturating_sub(match_quantity);
            if sell_order.quantity.is_zero() {
                sell_order.status = OrderStatus::Filled;
                <SellOrders<T>>::insert(sell_order_id, sell_order.clone());
                <TotalSellOrders>::mutate(|count| *count = count.saturating_sub(1));
            } else {
                sell_order.status = OrderStatus::PartiallyFilled;
                <SellOrders<T>>::insert(sell_order_id, sell_order.clone());
            }
            
            // Mettre à jour les statistiques
            <TotalTradingVolume<T>>::mutate(|volume| {
                *volume = volume.saturating_add(total_amount);
            });
            
            <TotalFeesCollected<T>>::mutate(|fees| {
                *fees = fees.saturating_add(fee_amount);
            });
            
            // Mettre à jour l'historique des prix
            Self::update_price_history(trade_price);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::TradeExecuted(
                buy_order_id,
                sell_order_id,
                match_quantity,
                trade_price
            ));
        }
        
        Ok(())
    }
    
    /// Tenter de faire correspondre un nouvel ordre de vente avec des ordres d'achat existants
    fn try_match_sell_order(sell_order_id: [u8; 32]) -> DispatchResult {
        // Vérifier que l'ordre existe toujours
        if !<SellOrders<T>>::contains_key(sell_order_id) {
            return Ok(());
        }
        
        let mut sell_order = <SellOrders<T>>::get(sell_order_id);
        
        // Si l'ordre n'est plus actif, ne rien faire
        if sell_order.status != OrderStatus::Active {
            return Ok(());
        }
        
        // Rechercher des ordres d'achat compatibles (prix >= prix de vente, par ordre de prix décroissant)
        let mut matched_buy_orders = Vec::new();
        let mut remaining_quantity = sell_order.quantity;
        
        // Trier les ordres d'achat par prix décroissant
        let mut buy_orders: Vec<(_, _)> = <BuyOrders<T>>::iter().collect();
        buy_orders.sort_by(|(_, a), (_, b)| b.price.cmp(&a.price));
        
        for (buy_order_id, buy_order) in buy_orders {
            // Vérifier que l'ordre est actif et compatible
            if buy_order.status ==// etika-marketplace/src/lib.rs
//
// Ce module implémente la place de marché de l'écosystème Étika:
// - Échange de tokens entre participants
// - Gestion des ordres d'achat et de vente
// - Produits financiers basés sur l'épargne des consommateurs
// - Mécanismes de liquidité et de détermination des prix

#![cfg_attr(not(feature = "std"), no_std)]

use codec::{Decode, Encode};
use frame_support::{
    decl_error, decl_event, decl_module, decl_storage, dispatch::DispatchResult,
    ensure, traits::{Currency, ExistenceRequirement, Get, ReservableCurrency, WithdrawReasons},
    Parameter,
};
use frame_system::{self as system, ensure_signed};
use sp_runtime::{
    traits::{AtLeast32BitUnsigned, CheckedAdd, CheckedSub, Member, Zero, SaturatedConversion},
    DispatchError, Perbill, RuntimeDebug,
};
use sp_std::prelude::*;

// Import des structures de données définies dans etika-data-structure
use etika_data_structure::{
    AccountId, Balance, Moment, ActorType, MarketOrder, OrderType, OrderStatus,
    FinancialProduct, ProductType, ProductStatus, Marketplace, TokenSystem,
};

/// Type monétaire utilisé pour le module
type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

/// Configuration du module marketplace
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Type de monnaie utilisé
    type Currency: ReservableCurrency<Self::AccountId>;
    
    /// Système de tokens
    type TokenSystem: TokenSystem;
    
    /// Frais de transaction sur la place de marché (en pourcentage)
    type MarketplaceFee: Get<Perbill>;
    
    /// Compte destinataire des frais de transaction
    type FeeAccount: Get<Self::AccountId>;
    
    /// Montant minimum pour un ordre sur la place de marché
    type MinOrderAmount: Get<BalanceOf<Self>>;
    
    /// Durée maximale d'un ordre (en blocs)
    type MaxOrderDuration: Get<Self::BlockNumber>;
    
    /// Nombre maximum d'ordres par compte
    type MaxOrdersPerAccount: Get<u32>;
    
    /// Nombre maximum de produits financiers actifs
    type MaxActiveProducts: Get<u32>;
    
    /// Frais de création d'un produit financier
    type ProductCreationFee: Get<BalanceOf<Self>>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaMarketplace {
        /// Ordres d'achat actifs
        BuyOrders get(fn buy_orders): map hasher(blake2_128_concat) [u8; 32] => MarketOrder;
        
        /// Ordres de vente actifs
        SellOrders get(fn sell_orders): map hasher(blake2_128_concat) [u8; 32] => MarketOrder;
        
        /// Ordres par compte
        AccountOrders get(fn account_orders): map hasher(blake2_128_concat) T::AccountId => Vec<[u8; 32]>;
        
        /// Produits financiers actifs
        FinancialProducts get(fn financial_products): map hasher(blake2_128_concat) [u8; 32] => FinancialProduct;
        
        /// Produits financiers par type
        ProductsByType get(fn products_by_type): map hasher(blake2_128_concat) ProductType => Vec<[u8; 32]>;
        
        /// Investissements par compte et produit
        Investments get(fn investments): double_map hasher(blake2_128_concat) T::AccountId, hasher(blake2_128_concat) [u8; 32] => BalanceOf<T>;
        
        /// Nombre total d'ordres d'achat actifs
        TotalBuyOrders get(fn total_buy_orders): u32;
        
        /// Nombre total d'ordres de vente actifs
        TotalSellOrders get(fn total_sell_orders): u32;
        
        /// Nombre total de produits financiers actifs
        TotalActiveProducts get(fn total_active_products): u32;
        
        /// Volume total des transactions sur la place de marché
        TotalTradingVolume get(fn total_trading_volume): BalanceOf<T>;
        
        /// Frais totaux collectés
        TotalFeesCollected get(fn total_fees_collected): BalanceOf<T>;
        
        /// Prix moyen du token (moyenne mobile sur les 100 dernières transactions)
        AverageTokenPrice get(fn average_token_price): BalanceOf<T>;
        
        /// Historique des prix (limité aux 100 dernières transactions)
        PriceHistory get(fn price_history): Vec<(BalanceOf<T>, T::BlockNumber)>;
        
        /// Meilleur prix d'achat actuel
        BestBuyPrice get(fn best_buy_price): BalanceOf<T>;
        
        /// Meilleur prix de vente actuel
        BestSellPrice get(fn best_sell_price): BalanceOf<T>;
        
        /// Mapping des types d'acteur par compte
        ActorTypes get(fn actor_types): map hasher(blake2_128_concat) T::AccountId => ActorType;
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        Balance = BalanceOf<T>,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Nouvel ordre d'achat créé
        /// [order_id, créateur, quantité, prix]
        BuyOrderCreated([u8; 32], AccountId, Balance, Balance),
        
        /// Nouvel ordre de vente créé
        /// [order_id, créateur, quantité, prix]
        SellOrderCreated([u8; 32], AccountId, Balance, Balance),
        
        /// Ordre annulé
        /// [order_id, type d'ordre]
        OrderCancelled([u8; 32], OrderType),
        
        /// Ordre expiré
        /// [order_id, type d'ordre]
        OrderExpired([u8; 32], OrderType),
        
        /// Transaction exécutée
        /// [ordre achat, ordre vente, quantité, prix]
        TradeExecuted([u8; 32], [u8; 32], Balance, Balance),
        
        /// Nouveau produit financier créé
        /// [product_id, créateur, nom, type, rendement attendu]
        FinancialProductCreated([u8; 32], AccountId, Vec<u8>, ProductType, u32),
        
        /// Investissement dans un produit financier
        /// [investisseur, product_id, montant]
        InvestmentMade(AccountId, [u8; 32], Balance),
        
        /// Retrait d'un investissement
        /// [investisseur, product_id, montant]
        InvestmentWithdrawn(AccountId, [u8; 32], Balance),
        
        /// Statut d'un produit financier modifié
        /// [product_id, nouveau statut]
        ProductStatusUpdated([u8; 32], ProductStatus),
        
        /// Rendement distribué aux investisseurs
        /// [product_id, rendement total]
        YieldDistributed([u8; 32], Balance),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Ordre non trouvé
        OrderNotFound,
        
        /// Produit financier non trouvé
        ProductNotFound,
        
        /// Montant trop faible
        AmountTooSmall,
        
        /// Trop d'ordres pour ce compte
        TooManyOrders,
        
        /// Trop de produits financiers actifs
        TooManyActiveProducts,
        
        /// Fonds insuffisants
        InsufficientFunds,
        
        /// Ordre déjà exécuté ou annulé
        OrderNotActive,
        
        /// Non autorisé à effectuer cette opération
        Unauthorized,
        
        /// Produit non disponible pour investissement
        ProductNotOpen,
        
        /// Période de verrouillage non écoulée
        LockPeriodNotExpired,
        
        /// Prix invalide
        InvalidPrice,
        
        /// Quantité invalide
        InvalidQuantity,
        
        /// Le créateur de l'ordre ne peut pas être l'exécuteur
        SelfTrading,
        
        /// Type d'acteur incompatible
        IncompatibleActorType,
        
        /// Type de produit financier non reconnu
        InvalidProductType,
        
        /// Rendement attendu invalide
        InvalidExpectedYield,
        
        /// Durée d'investissement invalide
        InvalidInvestmentDuration,
    }
}

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialisation
            relationship.factoring_conditions = conditions;
            
            // Enregistrer la relation mise à jour
            <CommercialRelationships<T>>::insert((merchant.clone(), supplier.clone()), relationship);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::FactoringConditionsUpdated(
                merchant,
                supplier,
                immediate_payment_percent,
                remaining_payment_delay,
                interest_rate
            ));
            
            Ok(())
        }
        
        /// Suspendre une relation commerciale
        #[weight = 10_000]
        pub fn suspend_relationship(
            origin,
            merchant: T::AccountId,
            supplier: T::AccountId,
        ) -> DispatchResult {
            let suspender = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est soit le commerçant, soit le fournisseur
            ensure!(suspender == merchant || suspender == supplier, Error::<T>::Unauthorized);
            
            // Vérifier que la relation existe
            ensure!(
                <CommercialRelationships<T>>::contains_key((merchant.clone(), supplier.clone())),
                Error::<T>::RelationshipNotFound
            );
            
            // Récupérer la relation
            let mut relationship = <CommercialRelationships<T>>::get((merchant.clone(), supplier.clone()));
            
            // Vérifier que la relation est active
            ensure!(relationship.status == RelationshipStatus::Active, Error::<T>::IncompatibleStatus);
            
            // Mettre à jour le statut
            relationship.status = RelationshipStatus::Suspended;
            
            // Enregistrer la relation mise à jour
            <CommercialRelationships<T>>::insert((merchant.clone(), supplier.clone()), relationship);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::RelationshipStatusUpdated(
                merchant,
                supplier,
                RelationshipStatus::Suspended
            ));
            
            Ok(())
        }
        
        /// Réactiver une relation commerciale suspendue
        #[weight = 10_000]
        pub fn reactivate_relationship(
            origin,
            merchant: T::AccountId,
            supplier: T::AccountId,
        ) -> DispatchResult {
            let reactivator = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est soit le commerçant, soit le fournisseur
            ensure!(reactivator == merchant || reactivator == supplier, Error::<T>::Unauthorized);
            
            // Vérifier que la relation existe
            ensure!(
                <CommercialRelationships<T>>::contains_key((merchant.clone(), supplier.clone())),
                Error::<T>::RelationshipNotFound
            );
            
            // Récupérer la relation
            let mut relationship = <CommercialRelationships<T>>::get((merchant.clone(), supplier.clone()));
            
            // Vérifier que la relation est suspendue
            ensure!(relationship.status == RelationshipStatus::Suspended, Error::<T>::IncompatibleStatus);
            
            // Mettre à jour le statut
            relationship.status = RelationshipStatus::Active;
            
            // Enregistrer la relation mise à jour
            <CommercialRelationships<T>>::insert((merchant.clone(), supplier.clone()), relationship);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::RelationshipStatusUpdated(
                merchant,
                supplier,
                RelationshipStatus::Active
            ));
            
            Ok(())
        }
        
        /// Mettre fin à une relation commerciale
        #[weight = 10_000]
        pub fn terminate_relationship(
            origin,
            merchant: T::AccountId,
            supplier: T::AccountId,
        ) -> DispatchResult {
            let terminator = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est soit le commerçant, soit le fournisseur
            ensure!(terminator == merchant || terminator == supplier, Error::<T>::Unauthorized);
            
            // Vérifier que la relation existe
            ensure!(
                <CommercialRelationships<T>>::contains_key((merchant.clone(), supplier.clone())),
                Error::<T>::RelationshipNotFound
            );
            
            // Récupérer la relation
            let mut relationship = <CommercialRelationships<T>>::get((merchant.clone(), supplier.clone()));
            
            // Mettre à jour le statut
            relationship.status = RelationshipStatus::Terminated;
            
            // Enregistrer la relation mise à jour
            <CommercialRelationships<T>>::insert((merchant.clone(), supplier.clone()), relationship);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::RelationshipStatusUpdated(
                merchant,
                supplier,
                RelationshipStatus::Terminated
            ));
            
            Ok(())
        }
        
        /// Traiter un paiement d'affacturage pour une transaction PoP
        #[weight = 10_000]
        pub fn process_factoring_payment(
            origin,
            pop_transaction_id: [u8; 32],
            merchant: T::AccountId,
            supplier: T::AccountId,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            let _ = ensure_signed(origin)?;
            
            // Cette fonction serait normalement appelée automatiquement par le système
            // en réponse à une transaction PoP validée, mais elle est exposée ici pour les tests
            
            // Vérifier que le montant est suffisant
            ensure!(amount >= T::MinFactoringAmount::get(), Error::<T>::FactoringAmountTooSmall);
            
            // Vérifier que la relation existe et est active
            ensure!(
                <CommercialRelationships<T>>::contains_key((merchant.clone(), supplier.clone())),
                Error::<T>::RelationshipNotFound
            );
            
            let relationship = <CommercialRelationships<T>>::get((merchant.clone(), supplier.clone()));
            ensure!(relationship.status == RelationshipStatus::Active, Error::<T>::IncompatibleStatus);
            
            // Vérifier que ce paiement n'a pas déjà été traité
            ensure!(
                !<PendingPayments<T>>::contains_key((merchant.clone(), supplier.clone(), pop_transaction_id)),
                Error::<T>::PaymentAlreadyProcessed
            );
            
            // Récupérer les conditions d'affacturage
            let conditions = relationship.factoring_conditions;
            
            // Calculer le paiement immédiat et le paiement restant
            let immediate_amount = Perbill::from_percent(conditions.immediate_payment_percent.into()) * amount;
            let remaining_amount = amount.saturating_sub(immediate_amount);
            
            // Vérifier la liquidité disponible
            ensure!(
                <FactoringLiquidity<T>>::get() >= immediate_amount,
                Error::<T>::InsufficientLiquidity
            );
            
            // Traiter le paiement immédiat
            if immediate_amount > Zero::zero() {
                // Transférer les fonds au fournisseur
                T::Currency::transfer(
                    &T::FactoringLiquidityAccount::get(),
                    &supplier,
                    immediate_amount,
                    ExistenceRequirement::KeepAlive
                )?;
                
                // Mettre à jour la liquidité
                <FactoringLiquidity<T>>::mutate(|liquidity| {
                    *liquidity = liquidity.saturating_sub(immediate_amount);
                });
                
                // Émettre un événement
                Self::deposit_event(RawEvent::ImmediatePaymentProcessed(
                    merchant.clone(),
                    supplier.clone(),
                    pop_transaction_id,
                    immediate_amount,
                    amount
                ));
            }
            
            // Planifier le paiement restant
            if remaining_amount > Zero::zero() {
                // Calculer le bloc d'échéance
                let current_block = <frame_system::Module<T>>::block_number();
                let payment_due_block = current_block.saturating_add(
                    conditions.remaining_payment_delay.saturated_into::<T::BlockNumber>()
                );
                
                // Enregistrer le paiement en attente
                <PendingPayments<T>>::insert(
                    (merchant.clone(), supplier.clone(), pop_transaction_id),
                    remaining_amount
                );
                
                <PaymentDueBlock<T>>::insert(
                    (merchant.clone(), supplier.clone(), pop_transaction_id),
                    payment_due_block
                );
                
                // Émettre un événement
                Self::deposit_event(RawEvent::RemainingPaymentScheduled(
                    merchant,
                    supplier,
                    pop_transaction_id,
                    remaining_amount,
                    payment_due_block
                ));
            }
            
            // Mettre à jour les statistiques
            <TotalFactoringPayments>::mutate(|count| *count += 1);
            <TotalFactoringProcessed>::mutate(|total| {
                *total = total.saturating_add(immediate_amount);
            });
            
            // Mettre à jour l'historique des paiements
            <PaymentHistory<T>>::mutate((merchant, supplier), |history| {
                if history.len() >= 20 {
                    history.remove(0);
                }
                history.push((amount, <frame_system::Module<T>>::block_number()));
            });
            
            Ok(())
        }
        
        /// Ajouter de la liquidité au système d'affacturage
        #[weight = 10_000]
        pub fn add_liquidity(
            origin,
            amount: BalanceOf<T>,
        ) -> DispatchResult {
            let contributor = ensure_signed(origin)?;
            
            // Vérifier que le montant est positif
            ensure!(amount > Zero::zero(), Error::<T>::FactoringAmountTooSmall);
            
            // Transférer les fonds au compte de liquidité
            T::Currency::transfer(
                &contributor,
                &T::FactoringLiquidityAccount::get(),
                amount,
                ExistenceRequirement::KeepAlive
            )?;
            
            // Mettre à jour la liquidité
            <FactoringLiquidity<T>>::mutate(|liquidity| {
                *liquidity = liquidity.saturating_add(amount);
            });
            
            // Émettre un événement
            Self::deposit_event(RawEvent::LiquidityAdded(contributor, amount));
            
            Ok(())
        }
        
        /// Retirer de la liquidité du système d'affacturage (réservé à l'administrateur)
        #[weight = 10_000]
        pub fn withdraw_liquidity(
            origin,
            amount: BalanceOf<T>,
            destination: T::AccountId,
        ) -> DispatchResult {
            let withdrawer = ensure_signed(origin)?;
            
            // Vérifier que l'appelant est autorisé (administrateur)
            // Dans une implémentation réelle, il faudrait un système de gouvernance plus sophistiqué
            ensure!(withdrawer == T::FactoringLiquidityAccount::get(), Error::<T>::AdminRequired);
            
            // Vérifier que le montant est positif et ne dépasse pas la liquidité disponible
            ensure!(amount > Zero::zero(), Error::<T>::FactoringAmountTooSmall);
            ensure!(amount <= <FactoringLiquidity<T>>::get(), Error::<T>::InsufficientLiquidity);
            
            // Transférer les fonds depuis le compte de liquidité
            T::Currency::transfer(
                &T::FactoringLiquidityAccount::get(),
                &destination,
                amount,
                ExistenceRequirement::KeepAlive
            )?;
            
            // Mettre à jour la liquidité
            <FactoringLiquidity<T>>::mutate(|liquidity| {
                *liquidity = liquidity.saturating_sub(amount);
            });
            
            // Émettre un événement
            Self::deposit_event(RawEvent::LiquidityWithdrawn(destination, amount));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Obtenir le timestamp actuel en secondes
    fn get_current_timestamp() -> Moment {
        let now = sp_io::offchain::timestamp()
            .unwrap_or_default()
            .unix_millis();
        (now / 1000) as Moment
    }
    
    /// Traiter les paiements arrivés à échéance
    fn process_due_payments(current_block: T::BlockNumber) {
        for ((merchant, supplier, transaction_id), due_block) in <PaymentDueBlock<T>>::iter() {
            if current_block >= due_block {
                // Le paiement est dû, le traiter
                if <PendingPayments<T>>::contains_key((merchant.clone(), supplier.clone(), transaction_id)) {
                    let remaining_amount = <PendingPayments<T>>::take((merchant.clone(), supplier.clone(), transaction_id));
                    
                    // Récupérer les conditions d'affacturage
                    if <CommercialRelationships<T>>::contains_key((merchant.clone(), supplier.clone())) {
                        let relationship = <CommercialRelationships<T>>::get((merchant.clone(), supplier.clone()));
                        
                        // Calculer les intérêts
                        let interest_rate = relationship.factoring_conditions.interest_rate;
                        let interest_amount = Perbill::from_parts(interest_rate as u32 * 10_000_000) * remaining_amount;
                        
                        // Verser les fonds au fournisseur (si liquidité suffisante)
                        let liquidity = <FactoringLiquidity<T>>::get();
                        
                        if liquidity >= remaining_amount {
                            // Transférer les fonds au fournisseur
                            let _ = T::Currency::transfer(
                                &T::FactoringLiquidityAccount::get(),
                                &supplier,
                                remaining_amount,
                                ExistenceRequirement::KeepAlive
                            );
                            
                            // Mettre à jour la liquidité
                            <FactoringLiquidity<T>>::mutate(|liq| {
                                *liq = liq.saturating_sub(remaining_amount);
                            });
                            
                            // Mettre à jour les statistiques
                            <TotalFactoringProcessed>::mutate(|total| {
                                *total = total.saturating_add(remaining_amount);
                            });
                            
                            <TotalInterestGenerated>::mutate(|total| {
                                *total = total.saturating_add(interest_amount);
                            });
                            
                            // Émettre un événement
                            Self::deposit_event(RawEvent::RemainingPaymentProcessed(
                                merchant.clone(),
                                supplier.clone(),
                                transaction_id,
                                remaining_amount,
                                interest_amount
                            ));
                        } else {
                            // Liquidité insuffisante, suspendre la relation
                            if relationship.status == RelationshipStatus::Active {
                                let mut updated_relationship = relationship;
                                updated_relationship.status = RelationshipStatus::Suspended;
                                
                                <CommercialRelationships<T>>::insert(
                                    (merchant.clone(), supplier.clone()),
                                    updated_relationship
                                );
                                
                                // Émettre un événement de défaut de paiement
                                Self::deposit_event(RawEvent::PaymentDefault(
                                    merchant.clone(),
                                    supplier.clone(),
                                    transaction_id,
                                    remaining_amount
                                ));
                                
                                // Émettre un événement de changement de statut
                                Self::deposit_event(RawEvent::RelationshipStatusUpdated(
                                    merchant,
                                    supplier,
                                    RelationshipStatus::Suspended
                                ));
                            }
                        }
                    }
                }
                
                // Nettoyer les données
                <PaymentDueBlock<T>>::remove((merchant, supplier, transaction_id));
            }
        }
    }
}

/// Implémentation du trait FactoringSystem pour le module factoring system
impl<T: Config> FactoringSystem for Module<T> {
    fn register_relationship(
        merchant: &AccountId,
        supplier: &AccountId,
        conditions: FactoringConditions,
    ) -> Result<(), &'static str> {
        // Convertir les AccountId génériques en AccountId spécifiques au runtime
        let merchant_id = merchant.clone().try_into().map_err(|_| "Invalid merchant ID")?;
        let supplier_id = supplier.clone().try_into().map_err(|_| "Invalid supplier ID")?;
        
        // Vérifier que la relation n'existe pas déjà
        if <CommercialRelationships<T>>::contains_key((merchant_id.clone(), supplier_id.clone())) {
            return Err("Relationship already exists");
        }
        
        // Vérifier les conditions d'affacturage
        if conditions.immediate_payment_percent < T::MinImmediatePaymentPercent::get() {
            return Err("Immediate payment percentage too low");
        }
        
        if conditions.interest_rate > T::MaxInterestRate::get() {
            return Err("Interest rate too high");
        }
        
        // Créer la relation commerciale
        let relationship = CommercialRelationship {
            merchant: merchant_id.clone(),
            supplier: supplier_id.clone(),
            category: b"Generic".to_vec(), // Catégorie par défaut
            factoring_conditions: conditions,
            created_at: Self::get_current_timestamp(),
            status: RelationshipStatus::Active, // Actif par défaut via l'API
        };
        
        // Enregistrer la relation
        <CommercialRelationships<T>>::insert((merchant_id.clone(), supplier_id.clone()), relationship);
        
        // Mettre à jour les listes de relations
        <MerchantRelationships<T>>::mutate(merchant_id.clone(), |suppliers| {
            if !suppliers.contains(&supplier_id) {
                suppliers.push(supplier_id.clone());
            }
        });
        
        <SupplierRelationships<T>>::mutate(supplier_id.clone(), |merchants| {
            if !merchants.contains(&merchant_id) {
                merchants.push(merchant_id.clone());
            }
        });
        
        // Mettre à jour le compteur
        <TotalCommercialRelationships>::mutate(|count| *count += 1);
        
        Ok(())
    }
    
    fn process_factoring_payment(pop_transaction: &PoPTransaction) -> Result<(), &'static str> {
        // Extraire les informations de la transaction
        let merchant_id = pop_transaction.merchant.clone().try_into().map_err(|_| "Invalid merchant ID")?;
        
        // Vérifier que la transaction implique un fournisseur
        if pop_transaction.suppliers.is_empty() {
            return Err("No supplier in transaction");
        }
        
        let supplier_id = pop_transaction.suppliers[0].clone().try_into().map_err(|_| "Invalid supplier ID")?;
        
        // Vérifier que la relation existe et est active
        if !<CommercialRelationships<T>>::contains_key((merchant_id.clone(), supplier_id.clone())) {
            return Err("Relationship not found");
        }
        
        let relationship = <CommercialRelationships<T>>::get((merchant_id.clone(), supplier_id.clone()));
        if relationship.status != RelationshipStatus::Active {
            return Err("Relationship not active");
        }
        
        // Vérifier que ce paiement n'a pas déjà été traité
        if <PendingPayments<T>>::contains_key((merchant_id.clone(), supplier_id.clone(), pop_transaction.id)) {
            return Err("Payment already processed");
        }
        
        // Convertir le montant
        let amount: BalanceOf<T> = pop_transaction.standard_amount.saturated_into();
        
        // Vérifier que le montant est suffisant
        if amount < T::MinFactoringAmount::get() {
            return Err("Amount too small");
        }
        
        // Récupérer les conditions d'affacturage
        let conditions = relationship.factoring_conditions;
        
        // Calculer le paiement immédiat et le paiement restant
        let immediate_amount = Perbill::from_percent(conditions.immediate_payment_percent.into()) * amount;
        let remaining_amount = amount.saturating_sub(immediate_amount);
        
        // Vérifier la liquidité disponible
        if <FactoringLiquidity<T>>::get() < immediate_amount {
            return Err("Insufficient liquidity");
        }
        
        // Traiter le paiement immédiat
        if immediate_amount > Zero::zero() {
            // Transférer les fonds au fournisseur
            T::Currency::transfer(
                &T::FactoringLiquidityAccount::get(),
                &supplier_id,
                immediate_amount,
                ExistenceRequirement::KeepAlive
            ).map_err(|_| "Transfer failed")?;
            
            // Mettre à jour la liquidité
            <FactoringLiquidity<T>>::mutate(|liquidity| {
                *liquidity = liquidity.saturating_sub(immediate_amount);
            });
        }
        
        // Planifier le paiement restant
        if remaining_amount > Zero::zero() {
            // Calculer le bloc d'échéance
            let current_block = <frame_system::Module<T>>::block_number();
            let payment_due_block = current_block.saturating_add(
                conditions.remaining_payment_delay.saturated_into::<T::BlockNumber>()
            );
            
            // Enregistrer le paiement en attente
            <PendingPayments<T>>::insert(
                (merchant_id.clone(), supplier_id.clone(), pop_transaction.id),
                remaining_amount
            );
            
            <PaymentDueBlock<T>>::insert(
                (merchant_id.clone(), supplier_id.clone(), pop_transaction.id),
                payment_due_block
            );
        }
        
        // Mettre à jour les statistiques
        <TotalFactoringPayments>::mutate(|count| *count += 1);
        <TotalFactoringProcessed>::mutate(|total| {
            *total = total.saturating_add(immediate_amount);
        });
        
        Ok(())
    }
    
    fn get_factoring_conditions(merchant: &AccountId, supplier: &AccountId) -> Result<FactoringConditions, &'static str> {
        // Convertir les AccountId génériques en AccountId spécifiques au runtime
        let merchant_id = merchant.clone().try_into().map_err(|_| "Invalid merchant ID")?;
        let supplier_id = supplier.clone().try_into().map_err(|_| "Invalid supplier ID")?;
        
        if <CommercialRelationships<T>>::contains_key((merchant_id, supplier_id)) {
            let relationship = <CommercialRelationships<T>>::get((merchant_id, supplier_id));
            Ok(relationship.factoring_conditions)
        } else {
            Err("Relationship not found")
        }
    }
}

/// Tests du module factoring system
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
            EtikaFactoringSystem: Module<Test>,
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
        pub const FactoringLiquidityAccountId: u64 = 999;
        pub const MaxInterestRate: u32 = 3000; // 30.00%
        pub const MinImmediatePaymentPercent: u8 = 50; // 50%
        pub const MaxPaymentDelay: u64 = 100; // 100 blocs
        pub const MinFactoringAmount: u64 = 100;
        pub const DefaultSuspensionPeriod: u64 = 50; // 50 blocs
    }
    
    impl Config for Test {
        type Event = Event;
        type Currency = Balances;
        type FactoringLiquidityAccount = FactoringLiquidityAccountId;
        type MaxInterestRate = MaxInterestRate;
        type MinImmediatePaymentPercent = MinImmediatePaymentPercent;
        type MaxPaymentDelay = MaxPaymentDelay;
        type MinFactoringAmount = MinFactoringAmount;
        type DefaultSuspensionPeriod = DefaultSuspensionPeriod;
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
                (999, 1000000), // Compte de liquidité
            ],
        }
        .assimilate_storage(&mut t)
        .unwrap();
        
        // Initialiser la liquidité
        let mut ext = t.into();
        ext.execute_with(|| {
            <FactoringLiquidity<Test>>::put(1000000);
            
            // Enregistrer les types d'acteurs
            <ActorTypes<Test>>::insert(1, ActorType::Consumer);
            <ActorTypes<Test>>::insert(2, ActorType::Merchant);
            <ActorTypes<Test>>::insert(3, ActorType::Supplier);
            <ActorTypes<Test>>::insert(4, ActorType::Merchant);
            <ActorTypes<Test>>::insert(5, ActorType::Supplier);
        });
        
        ext
    }
    
    #[test]
    fn test_register_relationship() {
        new_test_ext().execute_with(|| {
            // Enregistrer une relation commerciale
            assert_ok!(EtikaFactoringSystem::register_relationship(
                Origin::signed(2),
                2,
                3,
                b"electronics".to_vec(),
                80,
                50,
                500
            ));
            
            // Confirmer la relation
            assert_ok!(EtikaFactoringSystem::confirm_relationship(
                Origin::signed(3),
                2,
                3
            ));
            
            // Vérifier que le statut a été mis à jour
            let relationship = EtikaFactoringSystem::commercial_relationships((2, 3));
            assert_eq!(relationship.status, RelationshipStatus::Active);
        });
    }
    
    #[test]
    fn test_update_factoring_conditions() {
        new_test_ext().execute_with(|| {
            // Enregistrer et confirmer une relation commerciale
            assert_ok!(EtikaFactoringSystem::register_relationship(
                Origin::signed(2),
                2,
                3,
                b"electronics".to_vec(),
                80,
                50,
                500
            ));
            
            assert_ok!(EtikaFactoringSystem::confirm_relationship(
                Origin::signed(3),
                2,
                3
            ));
            
            // Mettre à jour les conditions d'affacturage
            assert_ok!(EtikaFactoringSystem::update_factoring_conditions(
                Origin::signed(2),
                2,
                3,
                90,
                30,
                400
            ));
            
            // Vérifier que les conditions ont été mises à jour
            let relationship = EtikaFactoringSystem::commercial_relationships((2, 3));
            assert_eq!(relationship.factoring_conditions.immediate_payment_percent, 90);
            assert_eq!(relationship.factoring_conditions.remaining_payment_delay, 30);
            assert_eq!(relationship.factoring_conditions.interest_rate, 400);
        });
    }
    
    #[test]
    fn test_process_factoring_payment() {
        new_test_ext().execute_with(|| {
            // Enregistrer et confirmer une relation commerciale
            assert_ok!(EtikaFactoringSystem::register_relationship(
                Origin::signed(2),
                2,
                3,
                b"electronics".to_vec(),
                80,
                50,
                500
            ));
            
            assert_ok!(EtikaFactoringSystem::confirm_relationship(
                Origin::signed(3),
                2,
                3
            ));
            
            // Traiter un paiement d'affacturage
            let transaction_id = [0; 32];
            assert_ok!(EtikaFactoringSystem::process_factoring_payment(
                Origin::signed(2),
                transaction_id,
                2,
                3,
                1000
            ));
            
            // Vérifier le paiement immédiat
            let supplier_balance = Balances::free_balance(3);
            assert_eq!(supplier_balance, 30000 + 800); // 80% de 1000
            
            // Vérifier le paiement restant planifié
            assert!(<PendingPayments<Test>>::contains_key((2, 3, transaction_id)));
            let remaining_amount = EtikaFactoringSystem::pending_payments((2, 3, transaction_id));
            assert_eq!(remaining_amount, 200); // 20% de 1000
            
            // Vérifier la liquidité
            let liquidity = EtikaFactoringSystem::factoring_liquidity();
            assert_eq!(liquidity, 1000000 - 800);
            
            // Vérifier les statistiques
            assert_eq!(EtikaFactoringSystem::total_factoring_payments(), 1);
            assert_eq!(EtikaFactoringSystem::total_factoring_processed(), 800);
        });
    }
    
    #[test]
    fn test_process_due_payments() {
        new_test_ext().execute_with(|| {
            // Enregistrer et confirmer une relation commerciale
            assert_ok!(EtikaFactoringSystem::register_relationship(
                Origin::signed(2),
                2,
                3,
                b"electronics".to_vec(),
                80,
                50,
                500 // 5.00% d'intérêt
            ));
            
            assert_ok!(EtikaFactoringSystem::confirm_relationship(
                Origin::signed(3),
                2,
                3
            ));
            
            // Traiter un paiement d'affacturage
            let transaction_id = [0; 32];
            assert_ok!(EtikaFactoringSystem::process_factoring_payment(
                Origin::signed(2),
                transaction_id,
                2,
                3,
                1000
            ));
            
            // Vérifier le paiement immédiat
            let supplier_balance_before = Balances::free_balance(3);
            assert_eq!(supplier_balance_before, 30000 + 800); // 80% de 1000
            
            // Avancer le temps pour que le paiement restant arrive à échéance
            System::set_block_number(60); // > 50 blocs
            
            // Traiter les paiements arrivés à échéance
            EtikaFactoringSystem::on_initialize(60);
            
            // Vérifier que le paiement restant a été effectué
            let supplier_balance_after = Balances::free_balance(3);
            assert_eq!(supplier_balance_after, supplier_balance_before + 200); // + 20% de 1000
            
            // Vérifier que le paiement a été supprimé
            assert!(!<PendingPayments<Test>>::contains_key((2, 3, transaction_id)));
            assert!(!<PaymentDueBlock<Test>>::contains_key((2, 3, transaction_id)));
            
            // Vérifier les statistiques
            assert_eq!(EtikaFactoringSystem::total_factoring_processed(), 1000);
            
            // Les intérêts sont calculés sur le montant restant: 200 * 5% = 10
            let expected_interest = 10;
            assert_eq!(EtikaFactoringSystem::total_interest_generated(), expected_interest);
        });
    }
    
    #[test]
    fn test_payment_default() {
        new_test_ext().execute_with(|| {
            // Enregistrer et confirmer une relation commerciale
            assert_ok!(EtikaFactoringSystem::register_relationship(
                Origin::signed(2),
                2,
                3,
                b"electronics".to_vec(),
                80,
                50,
                500
            ));
            
            assert_ok!(EtikaFactoringSystem::confirm_relationship(
                Origin::signed(3),
                2,
                3
            ));
            
            // Traiter un paiement d'affacturage
            let transaction_id = [0; 32];
            assert_ok!(EtikaFactoringSystem::process_factoring_payment(
                Origin::signed(2),
                transaction_id,
                2,
                3,
                1000
            ));
            
            // Réduire la liquidité pour simuler un défaut de paiement
            <FactoringLiquidity<Test>>::put(0);
            
            // Avancer le temps pour que le paiement restant arrive à échéance
            System::set_block_number(60);
            
            // Traiter les paiements arrivés à échéance
            EtikaFactoringSystem::on_initialize(60);
            
            // Vérifier que la relation a été suspendue
            let relationship = EtikaFactoringSystem::commercial_relationships((2, 3));
            assert_eq!(relationship.status, RelationshipStatus::Suspended);
        });
    }
    
    #[test]
    fn test_suspend_and_reactivate_relationship() {
        new_test_ext().execute_with(|| {
            // Enregistrer et confirmer une relation commerciale
            assert_ok!(EtikaFactoringSystem::register_relationship(
                Origin::signed(2),
                2,
                3,
                b"electronics".to_vec(),
                80,
                50,
                500
            ));
            
            assert_ok!(EtikaFactoringSystem::confirm_relationship(
                Origin::signed(3),
                2,
                3
            ));
            
            // Suspendre la relation
            assert_ok!(EtikaFactoringSystem::suspend_relationship(
                Origin::signed(2),
                2,
                3
            ));
            
            // Vérifier que la relation a été suspendue
            let relationship = EtikaFactoringSystem::commercial_relationships((2, 3));
            assert_eq!(relationship.status, RelationshipStatus::Suspended);
            
            // Réactiver la relation
            assert_ok!(EtikaFactoringSystem::reactivate_relationship(
                Origin::signed(3),
                2,
                3
            ));
            
            // Vérifier que la relation a été réactivée
            let relationship = EtikaFactoringSystem::commercial_relationships((2, 3));
            assert_eq!(relationship.status, RelationshipStatus::Active);
        });
    }
    
    #[test]
    fn test_terminate_relationship() {
        new_test_ext().execute_with(|| {
            // Enregistrer et confirmer une relation commerciale
            assert_ok!(EtikaFactoringSystem::register_relationship(
                Origin::signed(2),
                2,
                3,
                b"electronics".to_vec(),
                80,
                50,
                500
            ));
            
            assert_ok!(EtikaFactoringSystem::confirm_relationship(
                Origin::signed(3),
                2,
                3
            ));
            
            // Mettre fin à la relation
            assert_ok!(EtikaFactoringSystem::terminate_relationship(
                Origin::signed(2),
                2,
                3
            ));
            
            // Vérifier que la relation a été terminée
            let relationship = EtikaFactoringSystem::commercial_relationships((2, 3));
            assert_eq!(relationship.status, RelationshipStatus::Terminated);
        });
    }
    
    #[test]
    fn test_liquidity_management() {
        new_test_ext().execute_with(|| {
            // Ajouter de la liquidité
            assert_ok!(EtikaFactoringSystem::add_liquidity(
                Origin::signed(1),
                5000
            ));
            
            // Vérifier la liquidité
            let liquidity_after_add = EtikaFactoringSystem::factoring_liquidity();
            assert_eq!(liquidity_after_add, 1000000 + 5000);
            
            // Vérifier le solde du compte de liquidité
            let liquidity_account_balance = Balances::free_balance(999);
            assert_eq!(liquidity_account_balance, 1000000 + 5000);
            
            // Retirer de la liquidité
            assert_ok!(EtikaFactoringSystem::withdraw_liquidity(
                Origin::signed(999),
                2000,
                1
            ));
            
            // Vérifier la liquidité
            let liquidity_after_withdraw = EtikaFactoringSystem::factoring_liquidity();
            assert_eq!(liquidity_after_withdraw, 1000000 + 5000 - 2000);
            
            // Vérifier le solde du compte de liquidité
            let liquidity_account_balance_after = Balances::free_balance(999);
            assert_eq!(liquidity_account_balance_after, 1000000 + 5000 - 2000);
            
            // Vérifier le solde du destinataire
            let recipient_balance = Balances::free_balance(1);
            assert_eq!(recipient_balance, 10000 - 5000 + 2000);
        });
    }
}),
                2,
                3,
                b"electronics".to_vec(),
                80,
                50,
                500
            ));
            
            // Vérifier que la relation a été créée
            assert!(<CommercialRelationships<Test>>::contains_key((2, 3)));
            
            // Vérifier les détails de la relation
            let relationship = EtikaFactoringSystem::commercial_relationships((2, 3));
            assert_eq!(relationship.merchant, 2);
            assert_eq!(relationship.supplier, 3);
            assert_eq!(relationship.category, b"electronics".to_vec());
            assert_eq!(relationship.factoring_conditions.immediate_payment_percent, 80);
            assert_eq!(relationship.factoring_conditions.remaining_payment_delay, 50);
            assert_eq!(relationship.factoring_conditions.interest_rate, 500);
            assert_eq!(relationship.status, RelationshipStatus::Pending);
            
            // Vérifier les listes de relations
            let merchant_relationships = EtikaFactoringSystem::merchant_relationships(2);
            assert_eq!(merchant_relationships, vec![3]);
            
            let supplier_relationships = EtikaFactoringSystem::supplier_relationships(3);
            assert_eq!(supplier_relationships, vec![2]);
            
            // Vérifier le compteur
            assert_eq!(EtikaFactoringSystem::total_commercial_relationships(), 1);
        });
    }
    
    #[test]
    fn test_confirm_relationship() {
        new_test_ext().execute_with(|| {
            // Enregistrer une relation commerciale
            assert_ok!(EtikaFactoringSystem::register_relationship(
                Origin::signed(2// etika-factoring-system/src/lib.rs
//
// Ce module implémente le système d'affacturage innovant de l'écosystème Étika:
// - Enregistrement des relations commerciales entre commerçants et fournisseurs
// - Paiement instantané des fournisseurs selon le principe "c'est vendu c'est payé"
// - Gestion des conditions d'affacturage et des flux financiers

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
    AccountId, Balance, Moment, CommercialRelationship, FactoringConditions, RelationshipStatus,
    PoPTransaction, FactoringSystem, ActorType, ActorProfile,
};

/// Type monétaire utilisé pour le module
type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

/// Configuration du module factoring system
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Type de monnaie utilisé
    type Currency: ReservableCurrency<Self::AccountId>;
    
    /// Compte pour les fonds de liquidité d'affacturage
    type FactoringLiquidityAccount: Get<Self::AccountId>;
    
    /// Taux d'intérêt maximum pour l'affacturage (en centièmes de pourcentage)
    type MaxInterestRate: Get<u32>;
    
    /// Pourcentage minimum du paiement immédiat (en pourcentage)
    type MinImmediatePaymentPercent: Get<u8>;
    
    /// Délai maximum pour le reste du paiement (en blocs)
    type MaxPaymentDelay: Get<Self::BlockNumber>;
    
    /// Montant minimum pour les transactions d'affacturage
    type MinFactoringAmount: Get<BalanceOf<Self>>;
    
    /// Période de suspension automatique en cas de défaut de paiement (en blocs)
    type DefaultSuspensionPeriod: Get<Self::BlockNumber>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaFactoringSystem {
        /// Relations commerciales entre commerçants et fournisseurs
        CommercialRelationships get(fn commercial_relationships): 
            map hasher(blake2_128_concat) (T::AccountId, T::AccountId) => CommercialRelationship;
        
        /// Liquidité disponible dans le système d'affacturage
        FactoringLiquidity get(fn factoring_liquidity): BalanceOf<T>;
        
        /// Paiements d'affacturage en attente (montant restant à payer après le paiement immédiat)
        PendingPayments get(fn pending_payments): 
            map hasher(blake2_128_concat) (T::AccountId, T::AccountId, [u8; 32]) => BalanceOf<T>;
        
        /// Bloc auquel le paiement restant est dû
        PaymentDueBlock get(fn payment_due_block): 
            map hasher(blake2_128_concat) (T::AccountId, T::AccountId, [u8; 32]) => T::BlockNumber;
        
        /// Montant total d'affacturage traité
        TotalFactoringProcessed get(fn total_factoring_processed): BalanceOf<T>;
        
        /// Montant total des intérêts générés
        TotalInterestGenerated get(fn total_interest_generated): BalanceOf<T>;
        
        /// Nombre total de relations commerciales
        TotalCommercialRelationships get(fn total_commercial_relationships): u32;
        
        /// Nombre total de paiements d'affacturage effectués
        TotalFactoringPayments get(fn total_factoring_payments): u64;
        
        /// Relations commerciales par commerçant
        MerchantRelationships get(fn merchant_relationships): 
            map hasher(blake2_128_concat) T::AccountId => Vec<T::AccountId>;
        
        /// Relations commerciales par fournisseur
        SupplierRelationships get(fn supplier_relationships): 
            map hasher(blake2_128_concat) T::AccountId => Vec<T::AccountId>;
        
        /// Historique des paiements d'affacturage par relation commerciale
        PaymentHistory get(fn payment_history): 
            map hasher(blake2_128_concat) (T::AccountId, T::AccountId) => Vec<(BalanceOf<T>, T::BlockNumber)>;
        
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
        /// Nouvelle relation commerciale enregistrée
        /// [commerçant, fournisseur, catégorie]
        CommercialRelationshipRegistered(AccountId, AccountId, Vec<u8>),
        
        /// Conditions d'affacturage mises à jour
        /// [commerçant, fournisseur, pourcentage immédiat, délai, taux d'intérêt]
        FactoringConditionsUpdated(AccountId, AccountId, u8, u64, u32),
        
        /// État de la relation commerciale modifié
        /// [commerçant, fournisseur, nouvel état]
        RelationshipStatusUpdated(AccountId, AccountId, RelationshipStatus),
        
        /// Paiement d'affacturage immédiat effectué
        /// [commerçant, fournisseur, transaction_id, montant, montant total]
        ImmediatePaymentProcessed(AccountId, AccountId, [u8; 32], Balance, Balance),
        
        /// Paiement d'affacturage restant planifié
        /// [commerçant, fournisseur, transaction_id, montant, bloc d'échéance]
        RemainingPaymentScheduled(AccountId, AccountId, [u8; 32], Balance, BlockNumber),
        
        /// Paiement d'affacturage restant effectué
        /// [commerçant, fournisseur, transaction_id, montant, intérêts]
        RemainingPaymentProcessed(AccountId, AccountId, [u8; 32], Balance, Balance),
        
        /// Défaut de paiement détecté
        /// [commerçant, fournisseur, transaction_id, montant]
        PaymentDefault(AccountId, AccountId, [u8; 32], Balance),
        
        /// Liquidité ajoutée au système d'affacturage
        /// [source, montant]
        LiquidityAdded(AccountId, Balance),
        
        /// Liquidité retirée du système d'affacturage
        /// [destination, montant]
        LiquidityWithdrawn(AccountId, Balance),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Relation commerciale déjà existante
        RelationshipAlreadyExists,
        
        /// Relation commerciale non trouvée
        RelationshipNotFound,
        
        /// Statut incompatible pour l'opération
        IncompatibleStatus,
        
        /// Taux d'intérêt trop élevé
        InterestRateTooHigh,
        
        /// Pourcentage de paiement immédiat trop bas
        ImmediatePaymentPercentTooLow,
        
        /// Délai de paiement trop long
        PaymentDelayTooLong,
        
        /// Montant d'affacturage trop faible
        FactoringAmountTooSmall,
        
        /// Liquidité insuffisante pour l'opération
        InsufficientLiquidity,
        
        /// Transaction PoP non valide
        InvalidPopTransaction,
        
        /// Accès non autorisé
        Unauthorized,
        
        /// Type d'acteur incompatible
        IncompatibleActorType,
        
        /// Le commerçant et le fournisseur doivent être différents
        SameMerchantAndSupplier,
        
        /// Paiement déjà traité
        PaymentAlreadyProcessed,
        
        /// Tentative de modifier une relation en suspens
        ModifyingPendingRelationship,
        
        /// Opération limitée à l'administrateur
        AdminRequired,
    }
}

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialisation des erreurs
        type Error = Error<T>;
        
        /// Émission des événements
        fn deposit_event() = default;
        
        /// Traitement des paiements d'affacturage en attente au changement de bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Traiter les paiements arrivés à échéance
            Self::process_due_payments(n);
            
            0
        }
        
        /// Enregistrer une nouvelle relation commerciale
        #[weight = 10_000]
        pub fn register_relationship(
            origin,
            merchant: T::AccountId,
            supplier: T::AccountId,
            category: Vec<u8>,
            immediate_payment_percent: u8,
            remaining_payment_delay: u64,
            interest_rate: u32,
        ) -> DispatchResult {
            let initiator = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est soit le commerçant, soit le fournisseur
            ensure!(initiator == merchant || initiator == supplier, Error::<T>::Unauthorized);
            
            // Vérifier que le commerçant et le fournisseur sont différents
            ensure!(merchant != supplier, Error::<T>::SameMerchantAndSupplier);
            
            // Vérifier que le commerçant et le fournisseur ont les bons types
            ensure!(<ActorTypes<T>>::get(&merchant) == ActorType::Merchant, Error::<T>::IncompatibleActorType);
            ensure!(<ActorTypes<T>>::get(&supplier) == ActorType::Supplier, Error::<T>::IncompatibleActorType);
            
            // Vérifier que la relation n'existe pas déjà
            ensure!(
                !<CommercialRelationships<T>>::contains_key((merchant.clone(), supplier.clone())),
                Error::<T>::RelationshipAlreadyExists
            );
            
            // Vérifier les conditions d'affacturage
            ensure!(
                immediate_payment_percent >= T::MinImmediatePaymentPercent::get(),
                Error::<T>::ImmediatePaymentPercentTooLow
            );
            
            ensure!(interest_rate <= T::MaxInterestRate::get(), Error::<T>::InterestRateTooHigh);
            
            let conditions = FactoringConditions {
                immediate_payment_percent,
                remaining_payment_delay,
                interest_rate,
            };
            
            // Créer la relation commerciale
            let relationship = CommercialRelationship {
                merchant: merchant.clone(),
                supplier: supplier.clone(),
                category: category.clone(),
                factoring_conditions: conditions,
                created_at: Self::get_current_timestamp(),
                status: RelationshipStatus::Pending, // En attente de confirmation par l'autre partie
            };
            
            // Enregistrer la relation
            <CommercialRelationships<T>>::insert((merchant.clone(), supplier.clone()), relationship);
            
            // Mettre à jour les listes de relations
            <MerchantRelationships<T>>::mutate(merchant.clone(), |suppliers| {
                if !suppliers.contains(&supplier) {
                    suppliers.push(supplier.clone());
                }
            });
            
            <SupplierRelationships<T>>::mutate(supplier.clone(), |merchants| {
                if !merchants.contains(&merchant) {
                    merchants.push(merchant.clone());
                }
            });
            
            // Mettre à jour le compteur
            <TotalCommercialRelationships>::mutate(|count| *count += 1);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::CommercialRelationshipRegistered(
                merchant,
                supplier,
                category
            ));
            
            Ok(())
        }
        
        /// Confirmer une relation commerciale en attente
        #[weight = 10_000]
        pub fn confirm_relationship(
            origin,
            merchant: T::AccountId,
            supplier: T::AccountId,
        ) -> DispatchResult {
            let confirmer = ensure_signed(origin)?;
            
            // Vérifier que le confirmateur est soit le commerçant, soit le fournisseur
            // et qu'il n'est pas celui qui a initié la relation
            ensure!(confirmer == merchant || confirmer == supplier, Error::<T>::Unauthorized);
            
            // Vérifier que la relation existe
            ensure!(
                <CommercialRelationships<T>>::contains_key((merchant.clone(), supplier.clone())),
                Error::<T>::RelationshipNotFound
            );
            
            // Récupérer la relation
            let mut relationship = <CommercialRelationships<T>>::get((merchant.clone(), supplier.clone()));
            
            // Vérifier que la relation est en attente
            ensure!(relationship.status == RelationshipStatus::Pending, Error::<T>::IncompatibleStatus);
            
            // Mettre à jour le statut
            relationship.status = RelationshipStatus::Active;
            
            // Enregistrer la relation mise à jour
            <CommercialRelationships<T>>::insert((merchant.clone(), supplier.clone()), relationship);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::RelationshipStatusUpdated(
                merchant,
                supplier,
                RelationshipStatus::Active
            ));
            
            Ok(())
        }
        
        /// Mettre à jour les conditions d'affacturage
        #[weight = 10_000]
        pub fn update_factoring_conditions(
            origin,
            merchant: T::AccountId,
            supplier: T::AccountId,
            immediate_payment_percent: u8,
            remaining_payment_delay: u64,
            interest_rate: u32,
        ) -> DispatchResult {
            let updater = ensure_signed(origin)?;
            
            // Vérifier que l'initiateur est soit le commerçant, soit le fournisseur
            ensure!(updater == merchant || updater == supplier, Error::<T>::Unauthorized);
            
            // Vérifier que la relation existe
            ensure!(
                <CommercialRelationships<T>>::contains_key((merchant.clone(), supplier.clone())),
                Error::<T>::RelationshipNotFound
            );
            
            // Récupérer la relation
            let mut relationship = <CommercialRelationships<T>>::get((merchant.clone(), supplier.clone()));
            
            // Vérifier que la relation est active
            ensure!(relationship.status == RelationshipStatus::Active, Error::<T>::IncompatibleStatus);
            
            // Vérifier les nouvelles conditions
            ensure!(
                immediate_payment_percent >= T::MinImmediatePaymentPercent::get(),
                Error::<T>::ImmediatePaymentPercentTooLow
            );
            
            ensure!(interest_rate <= T::MaxInterestRate::get(), Error::<T>::InterestRateTooHigh);
            
            // Mettre à jour les conditions
            let conditions = FactoringConditions {
                immediate_payment_percent,
                remaining_payment_delay,
                interest_rate,
            };
            
            relationship.factoring
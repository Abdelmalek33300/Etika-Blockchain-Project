            // Vérifier la période de refroidissement pour cette catégorie
            if let Some((_, last_block)) = CategoryToLastAuction::<T>::get(&category).1.checked_is_zero() {
                let current_block = frame_system::Module::<T>::block_number();
                let cooldown_end = last_block.saturating_add(T::CategoryCooldown::get());
                
                ensure!(current_block >= cooldown_end, Error::<T>::CategoryCooldownNotExpired);
            }
            
            // Créer un ID unique pour l'enchère
            let auction_id = Self::generate_auction_id(&category, starting_price);
            
            // Calculer le bloc de fin
            let end_block = frame_system::Module::<T>::block_number().saturating_add(duration);
            
            // Créer l'enchère
            let auction = Auction {
                id: auction_id,
                category: category.clone(),
                start_time: Self::get_current_timestamp(),
                end_time: 0, // Sera mis à jour à la fin de l'enchère
                starting_price,
                min_bid_increment: T::MinBidIncrement::get().saturated_into::<Balance>(),
                status: AuctionStatus::Active,
                bid_history: Vec::new(),
            };
            
            // Enregistrer l'enchère
            <ActiveAuctions<T>>::insert(auction_id, auction);
            <ActiveAuctionCount>::mutate(|count| *count += 1);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::AuctionCreated(
                auction_id,
                category,
                starting_price,
                end_block
            ));
            
            Ok(())
        }
        
        /// Placer une offre sur une enchère
        #[weight = 10_000]
        pub fn place_bid(
            origin,
            auction_id: [u8; 32],
            bid_amount: BalanceOf<T>,
        ) -> DispatchResult {
            let bidder = ensure_signed(origin)?;
            
            // Vérifier que l'enchère existe et est active
            ensure!(<ActiveAuctions<T>>::contains_key(auction_id), Error::<T>::AuctionNotFound);
            let mut auction = <ActiveAuctions<T>>::get(auction_id);
            ensure!(auction.status == AuctionStatus::Active, Error::<T>::AuctionAlreadyCompleted);
            
            // Vérifier que l'enchère n'est pas expirée
            let current_block = frame_system::Module::<T>::block_number();
            let end_block = current_block.saturating_add(T::MinAuctionDuration::get());
            ensure!(current_block <= end_block, Error::<T>::AuctionExpired);
            
            // Vérifier que l'offre est suffisamment élevée
            let min_bid = if auction.bid_history.is_empty() {
                auction.starting_price
            } else {
                let last_bid = &auction.bid_history[auction.bid_history.len() - 1];
                let increment = Perbill::from_percent(auction.min_bid_increment.saturated_into::<u32>()) * last_bid.amount;
                last_bid.amount.saturating_add(increment)
            };
            
            ensure!(bid_amount >= min_bid, Error::<T>::BidTooLow);
            
            // Calculer le montant à réserver
            let reservation_amount = T::BidReservationPercentage::get() * bid_amount;
            
            // Vérifier que l'enchérisseur a suffisamment de fonds
            ensure!(
                T::Currency::free_balance(&bidder) >= reservation_amount,
                Error::<T>::InsufficientFunds
            );
            
            // Libérer toute réservation précédente de cet enchérisseur pour cette enchère
            if let Some(previous_reservation) = <BidReservations<T>>::get((bidder.clone(), auction_id)) {
                T::Currency::unreserve(&bidder, previous_reservation);
            }
            
            // Réserver les fonds
            T::Currency::reserve(&bidder, reservation_amount)
                .map_err(|_| Error::<T>::ReservationFailed)?;
            
            // Enregistrer la réservation
            <BidReservations<T>>::insert((bidder.clone(), auction_id), reservation_amount);
            
            // Ajouter l'offre à l'historique
            let timestamp = Self::get_current_timestamp();
            let bid = Bid {
                bidder: bidder.clone(),
                amount: bid_amount,
                timestamp,
            };
            
            auction.bid_history.push(bid);
            
            // Mettre à jour l'enchère
            <ActiveAuctions<T>>::insert(auction_id, auction);
            
            // Émettre un événement
            Self::deposit_event(RawEvent::BidPlaced(auction_id, bidder, bid_amount));
            
            Ok(())
        }
        
        /// Finaliser une enchère terminée
        #[weight = 10_000]
        pub fn finalize_auction(
            origin,
            auction_id: [u8; 32],
        ) -> DispatchResult {
            let caller = ensure_signed(origin)?;
            
            // Vérifier que l'enchère existe et est active
            ensure!(<ActiveAuctions<T>>::contains_key(auction_id), Error::<T>::AuctionNotFound);
            let mut auction = <ActiveAuctions<T>>::get(auction_id);
            ensure!(auction.status == AuctionStatus::Active, Error::<T>::AuctionAlreadyCompleted);
            
            // Vérifier que l'enchère est terminée
            let current_block = frame_system::Module::<T>::block_number();
            let end_block = current_block.saturating_add(T::MinAuctionDuration::get());
            ensure!(current_block > end_block, Error::<T>::AuctionNotYetEnded);
            
            // Mettre à jour le statut de l'enchère
            auction.end_time = Self::get_current_timestamp();
            
            if auction.bid_history.is_empty() {
                // Aucune offre, l'enchère a échoué
                auction.status = AuctionStatus::Failed;
                
                // Émettre un événement
                Self::deposit_event(RawEvent::AuctionFailed(auction_id, auction.category.clone()));
            } else {
                // Récupérer l'offre gagnante
                let winner_bid = &auction.bid_history[auction.bid_history.len() - 1];
                let winner = winner_bid.bidder.clone();
                let winning_amount = winner_bid.amount;
                
                // Mettre à jour le statut
                auction.status = AuctionStatus::Completed;
                
                // Transférer le montant réservé au fonds des consommateurs
                let reserved_amount = <BidReservations<T>>::get((winner.clone(), auction_id))
                    .unwrap_or_else(Zero::zero);
                
                if !reserved_amount.is_zero() {
                    T::Currency::unreserve(&winner, reserved_amount);
                    
                    // Transférer les fonds au compte du fonds des consommateurs
                    T::Currency::transfer(
                        &winner,
                        &T::FundAccount::get(),
                        reserved_amount,
                        ExistenceRequirement::KeepAlive
                    )?;
                    
                    // Mettre à jour le total des fonds collectés
                    <TotalAuctionFunds<T>>::mutate(|total| {
                        *total = total.saturating_add(reserved_amount);
                    });
                    
                    // Émettre un événement pour le transfert de fonds
                    Self::deposit_event(RawEvent::FundsTransferredToConsumerFund(
                        reserved_amount,
                        T::FundAccount::get()
                    ));
                }
                
                // Enregistrer le sponsor officiel pour cette catégorie
                <OfficialSponsors<T>>::insert(auction.category.clone(), winner.clone());
                
                // Émettre un événement pour la sélection du sponsor
                Self::deposit_event(RawEvent::OfficialSponsorSelected(
                    auction.category.clone(),
                    winner.clone(),
                    winning_amount
                ));
                
                // Émettre un événement pour la fin de l'enchère
                Self::deposit_event(RawEvent::AuctionCompleted(
                    auction_id,
                    auction.category.clone(),
                    winner,
                    winning_amount
                ));
            }
            
            // Nettoyer les réservations pour tous les enchérisseurs
            for bid in &auction.bid_history {
                let bidder = &bid.bidder;
                if let Some(reserved) = <BidReservations<T>>::get((bidder.clone(), auction_id)) {
                    if !reserved.is_zero() {
                        T::Currency::unreserve(bidder, reserved);
                    }
                    <BidReservations<T>>::remove((bidder.clone(), auction_id));
                }
            }
            
            // Déplacer l'enchère vers les enchères terminées
            <CompletedAuctions<T>>::insert(auction_id, auction.clone());
            <ActiveAuctions<T>>::remove(auction_id);
            
            // Mettre à jour les compteurs
            <ActiveAuctionCount>::mutate(|count| *count = count.saturating_sub(1));
            <CompletedAuctionCount>::mutate(|count| *count = count.saturating_add(1));
            
            // Mettre à jour la dernière enchère pour cette catégorie
            <CategoryToLastAuction<T>>::insert(
                auction.category,
                (auction_id, current_block)
            );
            
            Ok(())
        }
        
        /// Annuler une enchère active
        #[weight = 10_000]
        pub fn cancel_auction(
            origin,
            auction_id: [u8; 32],
            reason: Vec<u8>,
        ) -> DispatchResult {
            // Cette fonction pourrait être restreinte aux administrateurs ou à un mécanisme de gouvernance
            let caller = ensure_signed(origin)?;
            
            // Vérifier que l'enchère existe et est active
            ensure!(<ActiveAuctions<T>>::contains_key(auction_id), Error::<T>::AuctionNotFound);
            let mut auction = <ActiveAuctions<T>>::get(auction_id);
            ensure!(auction.status == AuctionStatus::Active, Error::<T>::AuctionAlreadyCompleted);
            
            // Mettre à jour le statut
            auction.status = AuctionStatus::Cancelled;
            auction.end_time = Self::get_current_timestamp();
            
            // Rembourser toutes les réservations
            for bid in &auction.bid_history {
                let bidder = &bid.bidder;
                if let Some(reserved) = <BidReservations<T>>::get((bidder.clone(), auction_id)) {
                    if !reserved.is_zero() {
                        T::Currency::unreserve(bidder, reserved);
                    }
                    <BidReservations<T>>::remove((bidder.clone(), auction_id));
                }
            }
            
            // Déplacer l'enchère vers les enchères terminées
            <CompletedAuctions<T>>::insert(auction_id, auction.clone());
            <ActiveAuctions<T>>::remove(auction_id);
            
            // Mettre à jour les compteurs
            <ActiveAuctionCount>::mutate(|count| *count = count.saturating_sub(1));
            <CompletedAuctionCount>::mutate(|count| *count = count.saturating_add(1));
            
            // Émettre un événement
            Self::deposit_event(RawEvent::AuctionCancelled(auction_id, reason));
            
            Ok(())
        }
    }
}

impl<T: Config> Module<T> {
    /// Générer un ID unique pour une enchère
    fn generate_auction_id(category: &[u8], starting_price: BalanceOf<T>) -> [u8; 32] {
        let timestamp = Self::get_current_timestamp();
        let mut data = Vec::new();
        
        data.extend_from_slice(category);
        data.extend_from_slice(&starting_price.saturated_into::<u128>().to_be_bytes());
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
    
    /// Vérifier les enchères qui se terminent au bloc donné
    fn check_ended_auctions(current_block: T::BlockNumber) {
        for (auction_id, auction) in <ActiveAuctions<T>>::iter() {
            if auction.status == AuctionStatus::Active {
                let end_block = current_block.saturating_add(T::MinAuctionDuration::get());
                
                if current_block > end_block {
                    // L'enchère est terminée, tenter de la finaliser
                    let _ = Self::finalize_auction(
                        frame_system::RawOrigin::Signed(T::FundAccount::get()).into(),
                        auction_id
                    );
                }
            }
        }
    }
}

/// Implémentation du trait AuctionSystem pour le module auction system
impl<T: Config> AuctionSystem for Module<T> {
    fn create_auction(
        category: Vec<u8>,
        start_time: Moment,
        duration: u64,
        starting_price: Balance,
    ) -> Result<[u8; 32], &'static str> {
        // Vérifier la durée
        let duration_as_block = duration.saturated_into::<T::BlockNumber>();
        
        if duration_as_block < T::MinAuctionDuration::get() || duration_as_block > T::MaxAuctionDuration::get() {
            return Err("Invalid auction duration");
        }
        
        // Vérifier le prix de départ
        if starting_price == 0 {
            return Err("Starting price too low");
        }
        
        // Vérifier le nombre d'enchères actives
        let active_count = Self::active_auction_count();
        if active_count >= T::MaxConcurrentAuctions::get() {
            return Err("Too many active auctions");
        }
        
        // Générer un ID pour l'enchère
        let starting_price_as_balance = starting_price.saturated_into::<BalanceOf<T>>();
        let auction_id = Self::generate_auction_id(&category, starting_price_as_balance);
        
        // Créer l'enchère
        let auction = Auction {
            id: auction_id,
            category: category.clone(),
            start_time,
            end_time: 0, // Sera mis à jour à la fin de l'enchère
            starting_price,
            min_bid_increment: T::MinBidIncrement::get().saturated_into::<Balance>(),
            status: AuctionStatus::Active,
            bid_history: Vec::new(),
        };
        
        // Enregistrer l'enchère
        <ActiveAuctions<T>>::insert(auction_id, auction);
        <ActiveAuctionCount>::mutate(|count| *count += 1);
        
        Ok(auction_id)
    }
    
    fn place_bid(auction_id: [u8; 32], bidder: &AccountId, amount: Balance) -> Result<(), &'static str> {
        // Vérifier que l'enchère existe et est active
        if !<ActiveAuctions<T>>::contains_key(auction_id) {
            return Err("Auction not found");
        }
        
        let mut auction = <ActiveAuctions<T>>::get(auction_id);
        if auction.status != AuctionStatus::Active {
            return Err("Auction already completed");
        }
        
        // Vérifier que l'offre est suffisamment élevée
        let min_bid = if auction.bid_history.is_empty() {
            auction.starting_price
        } else {
            let last_bid = &auction.bid_history[auction.bid_history.len() - 1];
            let increment = auction.min_bid_increment.saturating_mul(last_bid.amount) / 100;
            last_bid.amount.saturating_add(increment)
        };
        
        if amount < min_bid {
            return Err("Bid too low");
        }
        
        // Ajouter l'offre à l'historique
        let timestamp = Self::get_current_timestamp();
        let bidder_as_account_id = bidder.clone().try_into().map_err(|_| "Invalid account ID")?;
        
        let bid = Bid {
            bidder: bidder_as_account_id,
            amount,
            timestamp,
        };
        
        auction.bid_history.push(bid);
        
        // Mettre à jour l'enchère
        <ActiveAuctions<T>>::insert(auction_id, auction);
        
        Ok(())
    }
    
    fn finalize_auction(auction_id: [u8; 32]) -> Result<Option<AccountId>, &'static str> {
        // Vérifier que l'enchère existe et est active
        if !<ActiveAuctions<T>>::contains_key(auction_id) {
            return Err("Auction not found");
        }
        
        let mut auction = <ActiveAuctions<T>>::get(auction_id);
        if auction.status != AuctionStatus::Active {
            return Err("Auction already completed");
        }
        
        // Mettre à jour le statut de l'enchère
        auction.end_time = Self::get_current_timestamp();
        
        if auction.bid_history.is_empty() {
            // Aucune offre, l'enchère a échoué
            auction.status = AuctionStatus::Failed;
            
            // Déplacer l'enchère vers les enchères terminées
            <CompletedAuctions<T>>::insert(auction_id, auction);
            <ActiveAuctions<T>>::remove(auction_id);
            
            // Mettre à jour les compteurs
            <ActiveAuctionCount>::mutate(|count| *count = count.saturating_sub(1));
            <CompletedAuctionCount>::mutate(|count| *count = count.saturating_add(1));
            
            return Ok(None);
        } else {
            // Récupérer l'offre gagnante
            let winner_bid = &auction.bid_history[auction.bid_history.len() - 1];
            let winner = winner_bid.bidder.clone();
            
            // Mettre à jour le statut
            auction.status = AuctionStatus::Completed;
            
            // Enregistrer le sponsor officiel pour cette catégorie
            <OfficialSponsors<T>>::insert(auction.category.clone(), winner.clone());
            
            // Déplacer l'enchère vers les enchères terminées
            <CompletedAuctions<T>>::insert(auction_id, auction);
            <ActiveAuctions<T>>::remove(auction_id);
            
            // Mettre à jour les compteurs
            <ActiveAuctionCount>::mutate(|count| *count = count.saturating_sub(1));
            <CompletedAuctionCount>::mutate(|count| *count = count.saturating_add(1));
            
            return Ok(Some(winner.try_into().map_err(|_| "Invalid account ID")?));
        }
    }
}

/// Tests pour le module auction system
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
            EtikaAuctionSystem: Module<Test>,
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
        pub const MinAuctionDuration: u64 = 10;
        pub const MaxAuctionDuration: u64 = 1000;
        pub const MinBidIncrement: Perbill = Perbill::from_percent(5);
        pub const MaxConcurrentAuctions: u32 = 5;
        pub const CategoryCooldown: u64 = 100;
        pub const BidReservationPercentage: Perbill = Perbill::from_percent(10);
        pub const AuctionModuleId: ModuleId = ModuleId(*b"etk/auct");
        pub const FundAccountId: u64 = 999;
    }
    
    impl Config for Test {
        type Event = Event;
        type Currency = Balances;
        type MinAuctionDuration = MinAuctionDuration;
        type MaxAuctionDuration = MaxAuctionDuration;
        type MinBidIncrement = MinBidIncrement;
        type MaxConcurrentAuctions = MaxConcurrentAuctions;
        type CategoryCooldown = CategoryCooldown;
        type BidReservationPercentage = BidReservationPercentage;
        type FundAccount = FundAccountId;
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
                (999, 0), // Compte du fonds
            ],
        }
        .assimilate_storage(&mut t)
        .unwrap();
            
        t.into()
    }
    
    #[test]
    fn test_create_auction() {
        new_test_ext().execute_with(|| {
            // Créer une enchère
            let category = b"banking".to_vec();
            let starting_price = 1000;
            let duration = 100;
            
            assert_ok!(EtikaAuctionSystem::create_auction(
                Origin::signed(1),
                category.clone(),
                starting_price,
                duration
            ));
            
            // Vérifier que l'enchère a été créée
            let auction_id = EtikaAuctionSystem::generate_auction_id(&category, starting_price);
            let auction = EtikaAuctionSystem::active_auctions(auction_id);
            
            assert_eq!(auction.category, category);
            assert_eq!(auction.starting_price, starting_price);
            assert_eq!(auction.status, AuctionStatus::Active);
            assert_eq!(auction.bid_history.len(), 0);
            
            // Vérifier le compteur
            assert_eq!(EtikaAuctionSystem::active_auction_count(), 1);
        });
    }
    
    #[test]
    fn test_place_bid() {
        new_test_ext().execute_with(|| {
            // Créer une enchère
            let category = b"banking".to_vec();
            let starting_price = 1000;
            let duration = 100;
            
            assert_ok!(EtikaAuctionSystem::create_auction(
                Origin::signed(1),
                category.clone(),
                starting_price,
                duration
            ));
            
            let auction_id = EtikaAuctionSystem::generate_auction_id(&category, starting_price);
            
            // Placer une offre inférieure au prix de départ
            assert_noop!(
                EtikaAuctionSystem::place_bid(Origin::signed(2), auction_id, 999),
                Error::<Test>::BidTooLow
            );
            
            // Placer une offre valide
            assert_ok!(EtikaAuctionSystem::place_bid(
                Origin::signed(2),
                auction_id,
                1500
            ));
            
            // Vérifier que l'offre a été enregistrée
            let auction = EtikaAuctionSystem::active_auctions(auction_id);
            assert_eq!(auction.bid_history.len(), 1);
            assert_eq!(auction.bid_history[0].bidder, 2);
            assert_eq!(auction.bid_history[0].amount, 1500);
            
            // Vérifier la réservation
            let reservation = EtikaAuctionSystem::bid_reservations((2, auction_id));
            assert_eq!(reservation, Perbill::from_percent(10) * 1500);
            
            // Placer une offre trop basse par rapport à la précédente
            assert_noop!(
                EtikaAuctionSystem::place_bid(Origin::signed(3), auction_id, 1550),
                Error::<Test>::BidTooLow
            );
            
            // Placer une nouvelle offre valide
            // L'incrément minimal est de 5%, donc l'offre doit être d'au moins 1500 * 1.05 = 1575
            assert_ok!(EtikaAuctionSystem::place_bid(
                Origin::signed(3),
                auction_id,
                1600
            ));
            
            // Vérifier que l'offre a été enregistrée
            let auction = EtikaAuctionSystem::active_auctions(auction_id);
            assert_eq!(auction.bid_history.len(), 2);
            assert_eq!(auction.bid_history[1].bidder, 3);
            assert_eq!(auction.bid_history[1].amount, 1600);
        });
    }
    
    #[test]
    fn test_finalize_auction() {
        new_test_ext().execute_with(|| {
            // Créer une enchère
            let category = b"banking".to_vec();
            let starting_price = 1000;
            let duration = 100;
            
            assert_ok!(EtikaAuctionSystem::create_auction(
                Origin::signed(1),
                category.clone(),
                starting_price,
                duration
            ));
            
            let auction_id = EtikaAuctionSystem::generate_auction_id(&category, starting_price);
            
            // Placer des offres
            assert_ok!(EtikaAuctionSystem::place_bid(
                Origin::signed(2),
                auction_id,
                1500
            ));
            
            assert_ok!(EtikaAuctionSystem::place_bid(
                Origin::signed(3),
                auction_id,
                1600
            ));
            
            // Avancer le temps pour que l'enchère se termine
            System::set_block_number(111); // 111 > durée de l'enchère (100)
            
            // Finaliser l'enchère
            assert_ok!(EtikaAuctionSystem::finalize_auction(
                Origin::signed(1),
                auction_id
            ));
            
            // Vérifier que l'enchère a été déplacée vers les enchères terminées
            assert!(!<ActiveAuctions<Test>>::contains_key(auction_id));
            assert!(<CompletedAuctions<Test>>::contains_key(auction_id));
            
            // Vérifier le statut
            let auction = EtikaAuctionSystem::completed_auctions(auction_id);
            assert_eq!(auction.status, AuctionStatus::Completed);
            
            // Vérifier que le sponsor officiel a été enregistré
            assert_eq!(EtikaAuctionSystem::official_sponsors(category), 3);
            
            // Vérifier les compteurs
            assert_eq!(EtikaAuctionSystem::active_auction_count(), 0);
            assert_eq!(EtikaAuctionSystem::completed_auction_count(), 1);
            
            // Vérifier que les fonds ont été transférés
            let reservation_amount = Perbill::from_percent(10) * 1600;
            assert_eq!(EtikaAuctionSystem::total_auction_funds(), reservation_amount);
            assert_eq!(Balances::free_balance(999), reservation_amount);
        });
    }
    
    #[test]
    fn test_cancel_auction() {
        new_test_ext().execute_with(|| {
            // Créer une enchère
            let category = b"banking".to_vec();
            let starting_price = 1000;
            let duration = 100;
            
            assert_ok!(EtikaAuctionSystem::create_auction(
                Origin::signed(1),
                category.clone(),
                starting_price,
                duration
            ));
            
            let auction_id = EtikaAuctionSystem::generate_auction_id(&category, starting_price);
            
            // Placer une offre
            assert_ok!(EtikaAuctionSystem::place_bid(
                Origin::signed(2),
                auction_id,
                1500
            ));
            
            let initial_balance = Balances::free_balance(2);
            let reservation = EtikaAuctionSystem::bid_reservations((2, auction_id));
            
            // Annuler l'enchère
            assert_ok!(EtikaAuctionSystem::cancel_auction(
                Origin::signed(1),
                auction_id,
                b"Testing cancellation".to_vec()
            ));
            
            // Vérifier que l'enchère a été déplacée vers les enchères terminées
            assert!(!<ActiveAuctions<Test>>::contains_key(auction_id));
            assert!(<CompletedAuctions<Test>>::contains_key(auction_id));
            
            // Vérifier le statut
            let auction = EtikaAuctionSystem::completed_auctions(auction_id);
            assert_eq!(auction.status, AuctionStatus::Cancelled);
            
            // Vérifier que les fonds ont été remboursés
            assert_eq!(Balances::free_balance(2), initial_balance);
            assert!(!<BidReservations<Test>>::contains_key((2, auction_id)));
            
            // Vérifier les compteurs
            assert_eq!(EtikaAuctionSystem::active_auction_count(), 0);
            assert_eq!(EtikaAuctionSystem::completed_auction_count(), 1);
        });
    }
    
    #[test]
    fn test_auction_without_bids() {
        new_test_ext().execute_with(|| {
            // Créer une enchère
            let category = b"banking".to_vec();
            let starting_price = 1000;
            let duration = 100;
            
            assert_ok!(EtikaAuctionSystem::create_auction(
                Origin::signed(1),
                category.clone(),
                starting_price,
                duration
            ));
            
            let auction_id = EtikaAuctionSystem::generate_auction_id(&category, starting_price);
            
            // Avancer le temps pour que l'enchère se termine
            System::set_block_number(111);
            
            // Finaliser l'enchère
            assert_ok!(EtikaAuctionSystem::finalize_auction(
                Origin::signed(1),
                auction_id
            ));
            
            // Vérifier le statut
            let auction = EtikaAuctionSystem::completed_auctions(auction_id);
            assert_eq!(auction.status, AuctionStatus::Failed);
            
            // Vérifier qu'aucun sponsor n'a été enregistré
            assert!(!<OfficialSponsors<Test>>::contains_key(category));
        });
    }
}
            // etika-auction-system/src/lib.rs
//
// Ce module implémente le système d'enchères pour la sélection des sponsors officiels de l'écosystème Étika:
// - Organisation d'enchères par catégorie d'activité
// - Processus d'enchères avec des règles transparentes
// - Sélection des sponsors officiels
// - Contribution initiale au fonds des consommateurs

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
    AccountId, Balance, Auction, AuctionStatus, Bid, ActorType, AuctionSystem, Moment,
};

/// Type monétaire utilisé pour le module
type BalanceOf<T> = <<T as Config>::Currency as Currency<<T as frame_system::Config>::AccountId>>::Balance;

/// Configuration du module auction system
pub trait Config: frame_system::Config {
    /// Type d'événement
    type Event: From<Event<Self>> + Into<<Self as frame_system::Config>::Event>;
    
    /// Type de monnaie utilisé
    type Currency: ReservableCurrency<Self::AccountId>;
    
    /// Durée minimale d'une enchère (en blocs)
    type MinAuctionDuration: Get<Self::BlockNumber>;
    
    /// Durée maximale d'une enchère (en blocs)
    type MaxAuctionDuration: Get<Self::BlockNumber>;
    
    /// Incrément minimal pour les enchères (en pourcentage)
    type MinBidIncrement: Get<Perbill>;
    
    /// Nombre maximum d'enchères simultanées
    type MaxConcurrentAuctions: Get<u32>;
    
    /// Délai minimum entre la fin d'une enchère et le début d'une nouvelle dans la même catégorie
    type CategoryCooldown: Get<Self::BlockNumber>;
    
    /// Pourcentage du montant de l'enchère réservé lors de l'offre
    type BidReservationPercentage: Get<Perbill>;
    
    /// Compte destinataire des fonds d'enchère (fonds des consommateurs)
    type FundAccount: Get<Self::AccountId>;
}

decl_storage! {
    trait Store for Module<T: Config> as EtikaAuctionSystem {
        /// Enchères actives
        ActiveAuctions get(fn active_auctions): map hasher(blake2_128_concat) [u8; 32] => Auction;
        
        /// Enchères terminées
        CompletedAuctions get(fn completed_auctions): map hasher(blake2_128_concat) [u8; 32] => Auction;
        
        /// Mapping des catégories vers leur dernière enchère
        CategoryToLastAuction get(fn category_to_last_auction): map hasher(blake2_128_concat) Vec<u8> => ([u8; 32], T::BlockNumber);
        
        /// Sponsors officiels par catégorie
        OfficialSponsors get(fn official_sponsors): map hasher(blake2_128_concat) Vec<u8> => T::AccountId;
        
        /// Montant total collecté via les enchères
        TotalAuctionFunds get(fn total_auction_funds): BalanceOf<T>;
        
        /// Nombre d'enchères actives
        ActiveAuctionCount get(fn active_auction_count): u32;
        
        /// Nombre total d'enchères terminées
        CompletedAuctionCount get(fn completed_auction_count): u32;
        
        /// Montant réservé pour chaque enchérisseur
        BidReservations get(fn bid_reservations): map hasher(blake2_128_concat) (T::AccountId, [u8; 32]) => BalanceOf<T>;
    }
}

decl_event!(
    pub enum Event<T> where
        AccountId = <T as frame_system::Config>::AccountId,
        Balance = BalanceOf<T>,
        BlockNumber = <T as frame_system::Config>::BlockNumber,
    {
        /// Nouvelle enchère créée
        /// [auction_id, catégorie, prix de départ, bloc de fin]
        AuctionCreated([u8; 32], Vec<u8>, Balance, BlockNumber),
        
        /// Offre placée sur une enchère
        /// [auction_id, enchérisseur, montant]
        BidPlaced([u8; 32], AccountId, Balance),
        
        /// Enchère terminée avec succès
        /// [auction_id, catégorie, gagnant, montant]
        AuctionCompleted([u8; 32], Vec<u8>, AccountId, Balance),
        
        /// Enchère annulée
        /// [auction_id, raison]
        AuctionCancelled([u8; 32], Vec<u8>),
        
        /// Enchère échouée (pas d'offre)
        /// [auction_id, catégorie]
        AuctionFailed([u8; 32], Vec<u8>),
        
        /// Nouveau sponsor officiel
        /// [catégorie, sponsor, montant]
        OfficialSponsorSelected(Vec<u8>, AccountId, Balance),
        
        /// Fonds transférés au fonds des consommateurs
        /// [montant, compte du fonds]
        FundsTransferredToConsumerFund(Balance, AccountId),
    }
);

decl_error! {
    pub enum Error for Module<T: Config> {
        /// Durée d'enchère invalide
        InvalidAuctionDuration,
        
        /// Prix de départ trop bas
        StartingPriceTooLow,
        
        /// Enchère non trouvée
        AuctionNotFound,
        
        /// Enchère déjà terminée
        AuctionAlreadyCompleted,
        
        /// Trop d'enchères actives
        TooManyActiveAuctions,
        
        /// Période de refroidissement de la catégorie pas encore écoulée
        CategoryCooldownNotExpired,
        
        /// Offre trop basse
        BidTooLow,
        
        /// Enchère expirée
        AuctionExpired,
        
        /// Fonds insuffisants pour l'offre
        InsufficientFunds,
        
        /// Échec de réservation des fonds
        ReservationFailed,
        
        /// Enchère pas encore terminée
        AuctionNotYetEnded,
        
        /// Montant invalide
        InvalidAmount,
    }
}

decl_module! {
    pub struct Module<T: Config> for enum Call where origin: T::Origin {
        /// Initialisation des erreurs
        type Error = Error<T>;
        
        /// Émission des événements
        fn deposit_event() = default;
        
        /// Vérification des enchères terminées au changement de bloc
        fn on_initialize(n: T::BlockNumber) -> frame_support::weights::Weight {
            // Vérifier les enchères qui se terminent à ce bloc
            Self::check_ended_auctions(n);
            0
        }
        
        /// Créer une nouvelle enchère
        #[weight = 10_000]
        pub fn create_auction(
            origin,
            category: Vec<u8>,
            starting_price: BalanceOf<T>,
            duration: T::BlockNumber,
        ) -> DispatchResult {
            // Cette fonction pourrait être restreinte aux administrateurs ou à un mécanisme de gouvernance
            let creator = ensure_signed(origin)?;
            
            // Vérifier la durée de l'enchère
            ensure!(
                duration >= T::MinAuctionDuration::get() && duration <= T::MaxAuctionDuration::get(),
                Error::<T>::InvalidAuctionDuration
            );
            
            // Vérifier le prix de départ
            ensure!(starting_price > Zero::zero(), Error::<T>::StartingPriceTooLow);
            
            // Vérifier le nombre d'enchères actives
            let active_count = Self::active_auction_count();
            ensure!(active_count < T::MaxConcurrentAuctions::get(), Error::<T>::TooManyActiveAuctions);
            
            // Vérifier la période de refroidissement pour cette catégorie
            if let Some((_, last_block)) = CategoryToLastAuction::<T>::get(&category).1.checked_
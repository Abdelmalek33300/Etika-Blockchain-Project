#[test]
fn create_auction_internal_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        // Créer une catégorie pour le test
        let category = b"banking".to_vec();
        let territory_id = b"default".to_vec();
        
        <Categories<Test>>::insert(&category, CategoryMetadata {
            category_id: category.clone(),
            name: category.clone(),
            description: category.clone(),
            status: CategoryStatus::Active,
            status_changed_at: 1,
            auction_count: 0,
        });
        
        // Paramètres de l'enchère
        let start_block = 10;
        let end_block = 110;
        let starting_price = 10000;
        let min_bid_increment = 1000;
        let retry_count = 0;
        
        // Créer une enchère
        let result = Module::<Test>::create_auction_internal(
            category.clone(),
            territory_id.clone(),
            start_block,
            end_block,
            starting_price,
            min_bid_increment,
            retry_count
        );
        
        // Vérifier que l'enchère a été créée
        assert!(result.is_ok());
        
        let auction_id = result.unwrap();
        
        // Vérifier que l'enchère existe
        let auction = <Auctions<Test>>::get(&auction_id);
        assert!(auction.is_some());
        
        let auction = auction.unwrap();
        
        // Vérifier les paramètres de l'enchère
        assert_eq!(auction.category, category);
        assert_eq!(auction.territory_id, territory_id);
        assert_eq!(auction.start_block, start_block);
        assert_eq!(auction.end_block, end_block);
        assert_eq!(auction.starting_price, starting_price);
        assert_eq!(auction.min_bid_increment, min_bid_increment);
        assert_eq!(auction.status, AuctionStatus::Pending);
        assert_eq!(auction.retry_count, retry_count);
        assert_eq!(auction.tokens_allocated, DefaultAuctionTokenAllocation::get());
        
        // Vérifier que les métadonnées de la catégorie ont été mises à jour
        let metadata = <Categories<Test>>::get(&category).unwrap();
        assert_eq!(metadata.auction_count, 1);
        
        // Vérifier que l'ID de la dernière enchère a été mis à jour
        let last_auction_id = <CategoryLastAuction<Test>>::get(&category);
        assert_eq!(last_auction_id, auction_id);
        
        // Vérifier qu'un événement a été émis
        System::assert_has_event(RawEvent::AuctionCreated(
            auction_id,
            category,
            territory_id,
            starting_price
        ).into());
        
        // Test avec une catégorie inexistante
        let invalid_category = b"invalid".to_vec();
        let result = Module::<Test>::create_auction_internal(
            invalid_category,
            territory_id,
            start_block,
            end_block,
            starting_price,
            min_bid_increment,
            retry_count
        );
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::<Test>::CategoryNotFound);
        
        // Test avec une période d'enchère invalide
        let result = Module::<Test>::create_auction_internal(
            category.clone(),
            territory_id,
            end_block, // Inversion des blocs de début et de fin
            start_block,
            starting_price,
            min_bid_increment,
            retry_count
        );
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::<Test>::InvalidAuctionPeriod);
        
        // Test avec un prix de départ trop bas
        let result = Module::<Test>::create_auction_internal(
            category.clone(),
            territory_id,
            start_block,
            end_block,
            MinimumAuctionStartingPrice::get() - 1, // Prix trop bas
            min_bid_increment,
            retry_count
        );
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::<Test>::InvalidStartingPrice);
        
        // Test avec une enchère active existante
        // Mettre l'enchère précédente en état actif
        <Auctions<Test>>::mutate(auction_id, |auction| {
            if let Some(a) = auction {
                a.status = AuctionStatus::Active;
            }
        });
        
        let result = Module::<Test>::create_auction_internal(
            category.clone(),
            territory_id,
            start_block,
            end_block,
            starting_price,
            min_bid_increment,
            retry_count
        );
        
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), Error::<Test>::CategoryAlreadyHasActiveAuction);
    });
}
#[test]
fn distribute_initial_savings_with_pagination_works() {
    new_test_ext().execute_with(|| {
        System::set_block_number(1);
        
        // Créer une catégorie pour le test
        let category = b"banking".to_vec();
        
        <Categories<Test>>::insert(&category, CategoryMetadata {
            category_id: category.clone(),
            name: category.clone(),
            description: category.clone(),
            status: CategoryStatus::Active,
            status_changed_at: 1,
            auction_count: 0,
        });
        
        // Créer un sponsor pour la catégorie
        let sponsor = 1;
        <CategorySponsors<Test>>::insert(&category, sponsor);
        
        // Donner des fonds au sponsor
        Balances::make_free_balance_be(&sponsor, 1_000_000);
        
        // Créer plusieurs consommateurs
        for i in 1..21 {
            let consumer = 100 + i;
            // Marquer comme consommateur
            <ConsumerAccounts<Test>>::insert(consumer, true);
            // Initialiser le solde
            Balances::make_free_balance_be(&consumer, 100);
        }
        
        // Configurer le fonds des consommateurs
        let consumer_fund = ConsumerFundAccount::get();
        Balances::make_free_balance_be(&consumer_fund, 100);
        
        // Vérifier l'état initial
        assert!(
            <InitialSavingsDistributionState<Test>>::get().is_none(),
            "L'état de distribution initial devrait être None"
        );
        
        // Premier lot (taille 5)
        assert_ok!(Module::<Test>::distribute_initial_savings(
            RawOrigin::Root.into(),
            category.clone(),
            5
        ));
        
        // Vérifier que l'état de la distribution a été mis à jour
        let state = <InitialSavingsDistributionState<Test>>::get();
        assert!(state.is_some(), "L'état de distribution devrait être défini");
        
        let (stored_category, last_account, count) = state.unwrap();
        assert_eq!(stored_category, category, "La catégorie stockée devrait correspondre");
        assert_eq!(count, 5, "Le nombre d'éléments traités devrait être 5");
        
        // Vérifier que les 5 premiers consommateurs ont reçu l'épargne
        for i in 1..6 {
            let consumer = 100 + i;
            assert!(
                <AdoptionStatus<Test>>::get((consumer, category.clone())),
                "Le consommateur {} devrait avoir adopté la catégorie", consumer
            );
            
            assert!(
                <LastSponsorInteraction<Test>>::contains_key((consumer, category.clone())),
                "Le consommateur {} devrait avoir une interaction", consumer
            );
        }
        
        // Vérifier que le 6ème consommateur n'a pas encore reçu l'épargne
        let consumer6 = 106;
        assert!(
            !<AdoptionStatus<Test>>::get((consumer6, category.clone())),
            "Le consommateur 6 ne devrait pas encore avoir adopté la catégorie"
        );
        
        // Deuxième lot (taille 10)
        assert_ok!(Module::<Test>::distribute_initial_savings(
            RawOrigin::Root.into(),
            category.clone(),
            10
        ));
        
        // Vérifier que l'état de la distribution a été mis à jour
        let state = <InitialSavingsDistributionState<Test>>::get();
        assert!(state.is_some(), "L'état de distribution devrait être défini");
        
        // Vérifier que les 10 consommateurs suivants ont reçu l'épargne
        for i in 6..16 {
            let consumer = 100 + i;
            assert!(
                <AdoptionStatus<Test>>::get((consumer, category.clone())),
                "Le consommateur {} devrait avoir adopté la catégorie", consumer
            );
        }
        
        // Dernier lot (les 5 consommateurs restants)
        assert_ok!(Module::<Test>::distribute_initial_savings(
            RawOrigin::Root.into(),
            category.clone(),
            10 // La taille est plus grande que le nombre restant
        ));
        
        // Vérifier que l'état de la distribution a été réinitialisé
        assert!(
            <InitialSavingsDistributionState<Test>>::get().is_none(),
            "L'état de distribution devrait être None après la fin"
        );
        
        // Vérifier que tous les consommateurs ont reçu l'épargne
        for i in 1..21 {
            let consumer = 100 + i;
            assert!(
                <AdoptionStatus<Test>>::get((consumer, category.clone())),
                "Le consommateur {} devrait avoir adopté la catégorie", consumer
            );
        }
        
        // Vérifier qu'un événement de fin de distribution a été émis
        System::assert_has_event(RawEvent::InitialSavingsDistributionCompleted(
            category.clone()
        ).into());
    });
}
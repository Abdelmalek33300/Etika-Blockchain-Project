#[test]
fn validate_pop_transaction_signature_works() {
    new_test_ext().execute_with(|| {
        // Générer des paires de clés pour les tests
        let consumer_pair = sp_core::sr25519::Pair::generate().0;
        let merchant_pair = sp_core::sr25519::Pair::generate().0;
        
        // Créer les AccountId à partir des clés publiques
        let consumer = AccountId::from(consumer_pair.public());
        let merchant = AccountId::from(merchant_pair.public());
        
        // Construire une transaction PoP valide
        let transaction = PoPTransaction {
            id: [1u8; 32],
            consumer: consumer.clone(),
            merchant: merchant.clone(),
            suppliers: Vec::new(),
            standard_amount: 1000,
            tokens_exchanged: 100,
            savings_generated: 50,
            timestamp: 12345,
            receipt_hash: [2u8; 32],
            signatures: Vec::new(), // On va les ajouter plus tard
        };
        
        // Générer le message à signer
        let message = Module::<Test>::generate_pop_message(&transaction);
        
        // Signer le message avec les clés du consommateur et du marchand
        let consumer_signature = consumer_pair.sign(&message);
        let merchant_signature = merchant_pair.sign(&message);
        
        // Créer la transaction avec les signatures valides
        let mut valid_transaction = transaction.clone();
        valid_transaction.signatures = vec![
            (consumer.clone(), consumer_signature.0.to_vec().try_into().unwrap()),
            (merchant.clone(), merchant_signature.0.to_vec().try_into().unwrap()),
        ];
        
        // La validation devrait réussir
        assert_ok!(Module::<Test>::validate_pop_transaction(&valid_transaction));
        
        // Tester avec une signature invalide (en modifiant la signature)
        let mut invalid_signature = consumer_signature.0.to_vec();
        if invalid_signature[0] == 0 {
            invalid_signature[0] = 1;
        } else {
            invalid_signature[0] = 0;
        }
        
        let mut invalid_transaction = transaction.clone();
        invalid_transaction.signatures = vec![
            (consumer.clone(), invalid_signature.try_into().unwrap()),
            (merchant.clone(), merchant_signature.0.to_vec().try_into().unwrap()),
        ];
        
        // La validation devrait échouer
        assert_noop!(
            Module::<Test>::validate_pop_transaction(&invalid_transaction),
            Error::<Test>::InvalidSignature
        );
        
        // Tester avec un signataire manquant
        let mut missing_signer_transaction = transaction.clone();
        missing_signer_transaction.signatures = vec![
            (consumer.clone(), consumer_signature.0.to_vec().try_into().unwrap()),
            // Marchand manquant
        ];
        
        // La validation devrait échouer
        assert_noop!(
            Module::<Test>::validate_pop_transaction(&missing_signer_transaction),
            Error::<Test>::InsufficientSignatures
        );
        
        // Tester avec un signataire qui n'est ni le consommateur ni le marchand
        let random_pair = sp_core::sr25519::Pair::generate().0;
        let random_account = AccountId::from(random_pair.public());
        let random_signature = random_pair.sign(&message);
        
        let mut wrong_signer_transaction = transaction.clone();
        wrong_signer_transaction.signatures = vec![
            (random_account, random_signature.0.to_vec().try_into().unwrap()),
            (merchant.clone(), merchant_signature.0.to_vec().try_into().unwrap()),
        ];
        
        // La validation devrait échouer
        assert_noop!(
            Module::<Test>::validate_pop_transaction(&wrong_signer_transaction),
            Error::<Test>::ConsumerSignatureRequired
        );
    });
}
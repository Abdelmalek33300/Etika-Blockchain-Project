# Documentation des Tests du Module etika-token-system

Ce document présente la stratégie de tests pour le module `etika-token-system`. Il explique les différents types de tests implémentés, leur couverture, et comment les exécuter.

## Structure des Tests

Les tests du module `etika-token-system` sont organisés en trois catégories principales :

1. **Tests unitaires** (`tests.rs`) - Testent des fonctions et comportements spécifiques isolément
2. **Tests d'intégration** (`integration_tests.rs`) - Testent les interactions entre `etika-token-system` et d'autres modules
3. **Tests de scénarios** (`scenario_tests.rs`) - Testent des cas d'utilisation réels de bout en bout

## 1. Tests Unitaires

### Objectif
Les tests unitaires sont conçus pour valider le fonctionnement correct de chaque fonction publique et mécanisme interne du module, de manière isolée. Ils assurent que chaque composant fonctionne comme prévu avant de tester les interactions plus complexes.

### Fonctions Testées
- Distribution périodique des tokens (`test_distribute_tokens`, `test_multiple_distribution_periods`)
- Activation des tokens (`test_activate_tokens`)
- Transfert de tokens (`test_transfer_tokens`)
- Verrouillage et déverrouillage des tokens (`test_lock_and_unlock_tokens`)
- Brûlage de tokens lors des transferts (`test_calculate_token_distribution`)
- Transfert vers les ONG (`test_transfer_to_ngo`)
- Mise à jour des types d'acteurs (`test_update_actor_type`)
- Limites de solde des tokens (`test_max_token_balance`)
- Historique des transferts (`test_transfer_history_limit`)
- Implémentation du trait TokenSystem (`test_token_system_trait_implementation`)

### Couverture
Ces tests couvrent toutes les fonctions publiques (extrinsics) ainsi que les fonctions internes cruciales du module. Ils testent à la fois les cas de succès et les cas d'erreur pour s'assurer que les validations fonctionnent correctement.

### Exécution
Pour exécuter les tests unitaires, utilisez la commande suivante :
```bash
cargo test -p etika-token-system
```

## 2. Tests d'Intégration

### Objectif
Les tests d'intégration vérifient que le module `etika-token-system` interagit correctement avec d'autres modules de l'écosystème Étika, en particulier avec `etika-blockchain-core` et `etika-data-structure`. Ils permettent de s'assurer que les composants fonctionnent ensemble comme prévu.

### Scénarios Testés
- Distribution périodique de tokens en intégration avec le système de blocs (`test_periodic_token_distribution`)
- Activation de tokens après une transaction PoP (`test_token_activation_after_pop_transaction`)
- Interaction avec le module blockchain-core (`test_interaction_with_blockchain_core`)
- Verrouillage/déverrouillage de tokens combinés avec des transferts (`test_token_locking_with_transfers`)
- Scénario complet d'une transaction commerciale (`test_complete_commercial_transaction_scenario`)
- Comportements en cas d'erreur et limites système (`test_error_cases_and_limits`)

### Aspects Intégrés
- Interactions avec le mécanisme de consensus PoP (Proof of Purchase)
- Flux de transaction entre différents types d'acteurs
- Événements et hooks du système
- Gestion des erreurs entre modules

### Exécution
Pour exécuter les tests d'intégration, utilisez la commande suivante :
```bash
cargo test -p etika-token-system --test integration_tests
```

## 3. Tests de Scénarios

### Objectif
Les tests de scénarios simulent des cas d'utilisation réels de bout en bout dans l'écosystème Étika. Ils servent à valider que le système fonctionne correctement dans des situations complexes impliquant plusieurs acteurs et transactions.

### Scénarios Testés
- Cycle de vie complet des tokens (`test_token_lifecycle`)
- Système d'épargne avec verrouillage/déverrouillage (`test_saving_system`)
- Enchères de sponsors (`test_sponsor_auction`)
- Affacturage en temps réel (`test_real_time_factoring`)
- Cycle complet multi-acteurs avec distributions périodiques (`test_complete_multi_actor_cycle`)

### Aspects Testés
- Interactions entre différents types d'acteurs (consommateurs, commerçants, fournisseurs, ONG)
- Cycles commerciaux complets incluant achats, paiements et redistribution
- Mécanismes économiques spécifiques à Étika (affacturage, enchères de sponsors)
- Comportement du système sur de multiples périodes de distribution

### Environnement de Test
Les tests de scénarios utilisent un environnement plus réaliste avec:
- Multiples acteurs de chaque type
- Soldes initiaux réalistes
- Simulation de cycles économiques complets

### Exécution
Pour exécuter les tests de scénarios, utilisez la commande suivante :
```bash
cargo test -p etika-token-system --test scenario_tests
```

## 4. Couverture de Tests

### Objectifs de Couverture
La stratégie de test vise à atteindre une couverture minimale de 80% du code, avec une attention particulière pour les fonctions critiques suivantes :

- Fonctions de distribution des tokens
- Fonctions de transfert et calcul des montants (brûlage, ONG)
- Mécanismes de verrouillage/déverrouillage
- Validation des types d'acteurs

### Rapport de Couverture
Pour générer un rapport de couverture de test, vous pouvez utiliser l'outil `grcov` avec la configuration suivante :

```bash
# Installation de grcov
cargo install grcov

# Configuration des variables d'environnement pour la couverture
export CARGO_INCREMENTAL=0
export RUSTFLAGS="-Zprofile -Ccodegen-units=1 -Copt-level=0 -Clink-dead-code -Coverflow-checks=off"

# Exécution des tests avec génération de données de couverture
cargo test -p etika-token-system

# Génération du rapport HTML
grcov . -s . --binary-path ./target/debug/ -t html --branch --ignore-not-existing -o ./coverage/
```

Le rapport généré sera disponible dans le dossier `./coverage/`.

### Points d'Attention
Les fonctions suivantes méritent une attention particulière dans l'analyse de couverture :

1. `calculate_token_distribution` - Fonction cruciale pour le calcul des montants
2. `process_token_unlocks` - Mécanisme automatique de déverrouillage
3. `distribute_tokens` - Distribution périodique des tokens
4. `add_to_transfer_history` - Maintien de l'historique des transactions

## 5. Bonnes Pratiques de Test

### Mocking
Pour les tests d'intégration, nous utilisons des mocks pour simuler le comportement des modules externes comme `etika-blockchain-core`. Cette approche permet d'isoler les tests du module `etika-token-system` tout en vérifiant les interactions correctes.

### Isolation des Tests
Chaque test commence avec un environnement propre grâce à la fonction `new_test_ext()` qui crée une nouvelle instance de stockage pour chaque test.

### Assertions Complètes
Les tests vérifient non seulement que les fonctions réussissent ou échouent dans les cas appropriés, mais aussi que les effets secondaires (changements d'état, émission d'événements) sont correctement appliqués.

### Tests de Limites
Nous testons explicitement les limites du système (solde maximal, transferts impossibles) pour s'assurer que les protections fonctionnent comme prévu.

## 6. Évolution Future des Tests

### Améliorations Prévues
- Ajout de tests de performance pour vérifier le comportement du système sous charge
- Création de tests de fuzzing pour identifier des cas limites non anticipés
- Intégration avec un système CI/CD pour l'exécution automatique des tests

### Nouveaux Scénarios à Tester
- Tests de migration de données lors des mises à jour
- Tests de récupération après des pannes simulées
- Tests de résistance aux attaques économiques spécifiques

## 7. Conclusion

La suite de tests pour le module `etika-token-system` est conçue pour assurer son fonctionnement correct tant de manière isolée qu'en intégration avec l'écosystème Étika complet. Les trois niveaux de tests (unitaires, intégration, scénarios) offrent une couverture complète et permettent de valider à la fois le comportement technique et les mécanismes économiques implémentés.
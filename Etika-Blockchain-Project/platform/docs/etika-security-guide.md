  // Méthodes auxiliaires
  Future<void> _logAuthAttempt(bool success) async {
    // Journaliser la tentative d'authentification de manière sécurisée
    // Sans stocker de données biométriques ou d'identification personnelle
    // Implémentation...
  }
  
  Future<bool> _verifyPin(String userId, String pin) async {
    // Vérifier le PIN de l'utilisateur
    // Implémentation...
    return true; // Placeholder
  }
  
  Future<String> _generateBiometricToken() async {
    // Générer un token aléatoire pour l'association biométrique
    final random = Random.secure();
    final values = List<int>.generate(32, (i) => random.nextInt(256));
    return base64Url.encode(values);
  }
}

class BiometricAvailability {
  final bool isAvailable;
  final List<BiometricType>? availableTypes;
  final BiometricType? primaryType;
  final BiometricUnavailabilityReason? reason;
  final String? error;
  
  BiometricAvailability({
    required this.isAvailable,
    this.availableTypes,
    this.primaryType,
    this.reason,
    this.error,
  });
}

enum BiometricUnavailabilityReason {
  notSupported,
  notEnrolled,
  lockedOut,
  unknown,
}

class BiometricAuthResult {
  final bool success;
  final String? error;
  
  BiometricAuthResult({
    required this.success,
    this.error,
  });
}
```

## 9. Procédures en cas d'incident

### 9.1 Plan de réponse aux incidents de sécurité

En cas d'incident de sécurité, les étapes suivantes doivent être suivies :

1. **Détection et alerte** : Système de détection automatique des anomalies et alerte immédiate
2. **Confinement** : Limitation de l'impact par isolation des systèmes compromis
3. **Investigation** : Analyse des causes et étendue de l'incident
4. **Remédiation** : Correction des vulnérabilités et restauration des systèmes
5. **Notification** : Information transparente aux utilisateurs affectés
6. **Prévention** : Mesures pour éviter des incidents similaires à l'avenir

### 9.2 Mécanismes de sauvegarde et récupération

En cas de perte ou corruption de données, l'application met en œuvre :

1. **Sauvegarde chiffrée** des clés et données critiques
2. **Mécanismes de récupération** basés sur des phrases mnémoniques (BIP-39)
3. **Procédure de reconstruction** des portefeuilles à partir de la blockchain
4. **Isolation des sauvegardes** pour éviter la compromission simultanée

```dart
class DisasterRecoveryService {
  final CryptoService _cryptoService;
  final SecureStorage _secureStorage;
  final BackupRepository _backupRepository;
  
  DisasterRecoveryService(
    this._cryptoService,
    this._secureStorage,
    this._backupRepository,
  );
  
  // Générer une phrase mnémonique (BIP-39) pour la récupération
  Future<String> generateRecoveryPhrase({int strength = 128}) async {
    try {
      // Générer de l'entropie aléatoire
      final entropy = await _cryptoService.generateSecureRandomKey(strength ~/ 8);
      
      // Convertir en phrase mnémonique selon BIP-39
      final mnemonic = _entropyToMnemonic(entropy);
      
      return mnemonic;
    } catch (e) {
      throw SecurityException('Erreur lors de la génération de la phrase de récupération: ${e.toString()}');
    }
  }
  
  // Créer une sauvegarde chiffrée du portefeuille
  Future<BackupResult> createWalletBackup(String userId, String pin) async {
    try {
      // Récupérer les données critiques de l'utilisateur
      final privateKey = await _secureStorage.read(key: 'private_key_$userId');
      if (privateKey == null) {
        throw SecurityException('Clé privée non disponible');
      }
      
      // Récupérer ou générer une phrase de récupération
      String recoveryPhrase = await _secureStorage.read(key: 'recovery_phrase_$userId') ?? 
                             await generateRecoveryPhrase();
      
      // Si nous venons de générer une nouvelle phrase, la sauvegarder
      if (await _secureStorage.read(key: 'recovery_phrase_$userId') == null) {
        await _secureStorage.write(
          key: 'recovery_phrase_$userId',
          value: recoveryPhrase,
        );
      }
      
      // Préparer les données à sauvegarder
      final backupData = {
        'privateKey': privateKey,
        'userId': userId,
        'createdAt': DateTime.now().toUtc().toIso8601String(),
        'version': '1.0',
      };
      
      // Dériver une clé de chiffrement à partir du PIN
      final encryptionKey = await _deriveBackupEncryptionKey(pin, userId);
      
      // Chiffrer les données de sauvegarde
      final encryptedBackup = await _cryptoService.encryptAES(
        jsonEncode(backupData),
        encryptionKey,
      );
      
      // Générer un code de vérification unique
      final verificationCode = _generateVerificationCode();
      
      // Stocker la sauvegarde chiffrée
      final backupId = await _backupRepository.storeBackup(
        userId: userId,
        encryptedData: encryptedBackup,
        verificationCode: verificationCode,
      );
      
      return BackupResult(
        success: true,
        backupId: backupId,
        recoveryPhrase: recoveryPhrase,
        verificationCode: verificationCode,
      );
    } catch (e) {
      return BackupResult(
        success: false,
        error: 'Erreur lors de la création de la sauvegarde: ${e.toString()}',
      );
    }
  }
  
  // Restaurer un portefeuille à partir d'une sauvegarde
  Future<RestoreResult> restoreWalletFromBackup(
    String backupId,
    String pin,
    String verificationCode,
  ) async {
    try {
      // Récupérer la sauvegarde chiffrée
      final encryptedBackup = await _backupRepository.getBackup(
        backupId: backupId,
        verificationCode: verificationCode,
      );
      
      if (encryptedBackup == null) {
        return RestoreResult(
          success: false,
          error: 'Sauvegarde non trouvée ou code de vérification incorrect',
        );
      }
      
      // Extraire l'ID utilisateur
      final userId = await _backupRepository.getUserIdForBackup(backupId);
      if (userId == null) {
        return RestoreResult(
          success: false,
          error: 'ID utilisateur non trouvé pour cette sauvegarde',
        );
      }
      
      // Dériver la clé de chiffrement à partir du PIN
      final encryptionKey = await _deriveBackupEncryptionKey(pin, userId);
      
      // Déchiffrer les données de sauvegarde
      final decryptedData = await _cryptoService.decryptAES(
        encryptedBackup,
        encryptionKey,
      );
      
      // Parser les données déchiffrées
      final backupData = jsonDecode(decryptedData) as Map<String, dynamic>;
      
      // Vérifier que l'ID utilisateur correspond
      if (backupData['userId'] != userId) {
        return RestoreResult(
          success: false,
          error: 'Données de sauvegarde corrompues: ID utilisateur ne correspond pas',
        );
      }
      
      // Restaurer la clé privée
      await _secureStorage.write(
        key: 'private_key_$userId',
        value: backupData['privateKey'] as String,
      );
      
      // Régénérer le portefeuille à partir de la clé privée
      final walletAddress = await _reconstructWalletFromPrivateKey(
        backupData['privateKey'] as String,
      );
      
      return RestoreResult(
        success: true,
        userId: userId,
        walletAddress: walletAddress,
      );
    } catch (e) {
      return RestoreResult(
        success: false,
        error: 'Erreur lors de la restauration de la sauvegarde: ${e.toString()}',
      );
    }
  }
  
  // Restaurer un portefeuille à partir d'une phrase mnémonique
  Future<RestoreResult> restoreWalletFromPhrase(
    String recoveryPhrase,
    String newPin,
  ) async {
    try {
      // Valider la phrase de récupération
      if (!_isValidMnemonic(recoveryPhrase)) {
        return RestoreResult(
          success: false,
          error: 'Phrase de récupération invalide',
        );
      }
      
      // Dériver la seed à partir de la phrase mnémonique
      final seed = _mnemonicToSeed(recoveryPhrase);
      
      // Dériver la clé privée à partir de la seed
      final privateKey = _derivePrivateKey(seed);
      
      // Dériver l'adresse du portefeuille
      final walletAddress = await _deriveWalletAddress(privateKey);
      
      // Vérifier si ce portefeuille existe déjà dans le système
      final userId = await _getUserIdForWallet(walletAddress);
      
      if (userId == null) {
        return RestoreResult(
          success: false,
          error: 'Portefeuille non trouvé dans le système',
        );
      }
      
      // Stocker la clé privée de manière sécurisée
      await _secureStorage.write(
        key: 'private_key_$userId',
        value: privateKey,
      );
      
      // Stocker la phrase de récupération
      await _secureStorage.write(
        key: 'recovery_phrase_$userId',
        value: recoveryPhrase,
      );
      
      // Configurer le nouveau PIN
      await _setupNewPin(userId, newPin);
      
      return RestoreResult(
        success: true,
        userId: userId,
        walletAddress: walletAddress,
      );
    } catch (e) {
      return RestoreResult(
        success: false,
        error: 'Erreur lors de la restauration avec phrase: ${e.toString()}',
      );
    }
  }
  
  // Méthodes auxiliaires
  String _entropyToMnemonic(Uint8List entropy) {
    // Implémentation BIP-39
    // Dans une implémentation réelle, utiliser une bibliothèque éprouvée
    return ''; // Placeholder
  }
  
  bool _isValidMnemonic(String mnemonic) {
    // Validation de la phrase mnémonique selon BIP-39
    return true; // Placeholder
  }
  
  Uint8List _mnemonicToSeed(String mnemonic) {
    // Conversion de la phrase mnémonique en seed selon BIP-39
    return Uint8List(64); // Placeholder
  }
  
  String _derivePrivateKey(Uint8List seed) {
    // Dérivation de la clé privée à partir de la seed selon BIP-32/44
    return ''; // Placeholder
  }
  
  Future<String> _deriveWalletAddress(String privateKey) async {
    // Dérivation de l'adresse du portefeuille à partir de la clé privée
    return ''; // Placeholder
  }
  
  Future<String?> _getUserIdForWallet(String walletAddress) async {
    // Recherche de l'ID utilisateur associé à une adresse de portefeuille
    return ''; // Placeholder
  }
  
  Future<void> _setupNewPin(String userId, String newPin) async {
    // Configuration d'un nouveau PIN pour l'utilisateur
    // Implémentation...
  }
  
  Future<Uint8List> _deriveBackupEncryptionKey(String pin, String userId) async {
    // Dériver une clé de chiffrement à partir du PIN et de l'ID utilisateur
    final salt = await _secureStorage.read(key: 'backup_salt_$userId') ?? 
               base64Url.encode(await _cryptoService.generateSecureRandomKey(32));
    
    // Sauvegarder le sel s'il vient d'être généré
    if (await _secureStorage.read(key: 'backup_salt_$userId') == null) {
      await _secureStorage.write(key: 'backup_salt_$userId', value: salt);
    }
    
    // Dériver la clé
    return await _cryptoService.pbkdf2(
      pin + userId, // Combiner PIN et ID utilisateur
      base64Url.decode(salt),
      iterations: 100000,
      keyLength: 32,
    );
  }
  
  String _generateVerificationCode() {
    // Générer un code de vérification aléatoire pour la sauvegarde
    final random = Random.secure();
    final codeBytes = List<int>.generate(4, (i) => random.nextInt(10));
    return codeBytes.join();
  }
  
  Future<String> _reconstructWalletFromPrivateKey(String privateKey) async {
    // Reconstruire l'adresse du portefeuille à partir de la clé privée
    return ''; // Placeholder
  }
}

class BackupResult {
  final bool success;
  final String? backupId;
  final String? recoveryPhrase;
  final String? verificationCode;
  final String? error;
  
  BackupResult({
    required this.success,
    this.backupId,
    this.recoveryPhrase,
    this.verificationCode,
    this.error,
  });
}

class RestoreResult {
  final bool success;
  final String? userId;
  final String? walletAddress;
  final String? error;
  
  RestoreResult({
    required this.success,
    this.userId,
    this.walletAddress,
    this.error,
  });
}
```

## 10. Formation et sensibilisation

### 10.1 Guide de bonnes pratiques pour les utilisateurs

Pour assurer une utilisation sécurisée de l'application, les recommandations suivantes sont fournies aux utilisateurs :

1. **Sécurité générale de l'appareil**
   - Maintenir le système d'exploitation à jour
   - Utiliser le verrouillage de l'écran (PIN, motif ou biométrie)
   - Éviter les appareils jailbreakés/rootés
   - Installer uniquement des applications de sources fiables

2. **Sécurité de l'application Étika**
   - Utiliser un PIN fort et unique (éviter les dates de naissance, etc.)
   - Activer l'authentification biométrique si disponible
   - Ne jamais partager les codes de récupération ou phrases mnémoniques
   - Se déconnecter sur les appareils partagés

3. **Prévention des fraudes**
   - Vérifier les détails de transaction avant confirmation
   - Ne scanner que les QR codes de commerçants connus et vérifiés
   - Signaler immédiatement toute activité suspecte
   - Être vigilant face aux tentatives de phishing

4. **Sauvegarde et récupération**
   - Sauvegarder régulièrement la phrase de récupération
   - Stocker la phrase de récupération dans un lieu sûr, hors ligne
   - Ne pas prendre de photos ou capturer d'écran de la phrase de récupération
   - Tester périodiquement la procédure de récupération

### 10.2 Procédures de mise à jour sécurisée

Pour maintenir la sécurité de l'application :

1. **Vérification des mises à jour**
   - L'application vérifie régulièrement la disponibilité de mises à jour
   - Les mises à jour sont signées numériquement pour garantir leur authenticité
   - Le processus de mise à jour est chiffré et sécurisé

2. **Installation des mises à jour**
   - Les mises à jour critiques de sécurité sont clairement identifiées
   - L'utilisateur est guidé dans le processus d'installation
   - Les données sont sauvegardées avant les mises à jour majeures

3. **Transparence des mises à jour**
   - Les notes de version détaillent les améliorations de sécurité
   - Les correctifs de vulnérabilités sont documentés
   - Les utilisateurs sont informés à l'avance des changements majeurs

## Conclusion

Ce guide de sécurité et transparence fournit les fondations techniques et les bonnes pratiques pour assurer la protection des données utilisateur et la transparence des opérations dans l'application mobile Étika. En implémentant ces recommandations, l'application offre un niveau de sécurité élevé tout en maintenant une excellente expérience utilisateur.

La sécurité est un processus continu qui nécessite une vigilance constante et des mises à jour régulières. Ce document devra être révisé et mis à jour périodiquement pour refléter l'évolution des menaces et des bonnes pratiques de sécurité.

L'équipe Étika s'engage à maintenir les plus hauts standards de sécurité et de transparence pour garantir la confiance des utilisateurs dans ce nouvel écosystème financier autonome.
    // Étape 4: Supprimer les données utilisateur
    await _userRepository.deleteUser(userId);
    
    // Étape 5: Anonymiser les journaux d'audit
    await _auditRepository.anonymizeUserAuditLogs(userId);
    
    // Étape 6: Effacer les données stockées localement
    await _secureStorage.clearUserData(userId);
    
    // Journaliser la suppression (de manière anonyme)
    await _auditRepository.logEvent(AuditEvent(
      type: 'data_deletion',
      severity: AuditSeverity.critical,
      data: {
        'anonymizedUserId': _anonymizeUserId(userId),
        'deletionDate': DateTime.now().toUtc().toIso8601String(),
        'success': true,
      },
    ));
    
    return true;
  }
  
  // Récupérer les catégories de données collectées
  Future<List<DataCategory>> getDataCategories() async {
    return [
      DataCategory(
        name: 'Données de profil',
        description: 'Informations de base sur votre compte',
        dataTypes: ['Numéro de téléphone', 'Adresse e-mail (optionnelle)'],
        purpose: 'Authentification et communication',
        retention: 'Jusqu\'à la suppression du compte',
      ),
      DataCategory(
        name: 'Données de transaction',
        description: 'Informations sur vos achats et utilisation de tokens',
        dataTypes: ['Montant', 'Commerçant', 'Date', 'Tokens activés'],
        purpose: 'Traitement des transactions et activation des tokens',
        retention: 'Conservées sous forme anonymisée après suppression du compte',
      ),
      DataCategory(
        name: 'Données d\'épargne',
        description: 'Informations sur votre épargne Étika',
        dataTypes: ['Montants épargnés', 'Historique des contributions'],
        purpose: 'Gestion de votre épargne et génération de rapports',
        retention: 'Jusqu\'à la suppression du compte',
      ),
      DataCategory(
        name: 'Données d\'appareil',
        description: 'Informations techniques sur votre appareil',
        dataTypes: ['Type d\'appareil', 'Système d\'exploitation', 'Version de l\'application'],
        purpose: 'Sécurité et amélioration de l\'expérience utilisateur',
        retention: '90 jours après la dernière utilisation',
      ),
    ];
  }
  
  // Vérifier si l'utilisateur est authentifié
  Future<bool> _isUserAuthenticated(String userId) async {
    // Implémentation...
    return true; // Placeholder
  }
  
  // Vérifier le code de suppression
  Future<bool> _verifyDeletionCode(String userId, String verificationCode) async {
    // Implémentation...
    return true; // Placeholder
  }
  
  // Anonymiser l'identifiant utilisateur
  String _anonymizeUserId(String userId) {
    // Créer un hash unidirectionnel de l'ID
    final bytes = utf8.encode(userId);
    final digest = sha256.convert(bytes);
    return digest.toString().substring(0, 16);
  }
}

class DataCategory {
  final String name;
  final String description;
  final List<String> dataTypes;
  final String purpose;
  final String retention;
  
  DataCategory({
    required this.name,
    required this.description,
    required this.dataTypes,
    required this.purpose,
    required this.retention,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'description': description,
      'dataTypes': dataTypes,
      'purpose': purpose,
      'retention': retention,
    };
  }
}
```

### 7.2 Conformité aux normes de sécurité blockchain

L'application implémente les meilleures pratiques recommandées pour les applications blockchain :

1. **Stockage sécurisé des clés** : Les clés privées ne quittent jamais l'appareil
2. **Validation des transactions** : Toutes les transactions sont vérifiées avant signature
3. **Protection contre la double dépense** : Mécanismes de prévention de la double dépense
4. **Audit immuable** : Journal des transactions immuable et vérifiable

```dart
class BlockchainSecurityService {
  final CryptoService _cryptoService;
  final SecureStorage _secureStorage;
  final BlockchainRepository _blockchainRepository;
  
  BlockchainSecurityService(
    this._cryptoService,
    this._secureStorage,
    this._blockchainRepository,
  );
  
  // Vérifier l'état de la blockchain
  Future<BlockchainStatus> verifyBlockchainStatus() async {
    // Récupérer l'état local
    final localState = await _getLocalBlockchainState();
    
    // Récupérer l'état depuis plusieurs nœuds de confiance
    final networkStates = await _getNetworkBlockchainStates();
    
    // Vérifier la cohérence entre les nœuds
    final isNetworkConsistent = _checkNetworkConsistency(networkStates);
    
    // Vérifier la cohérence avec l'état local
    final isLocalConsistent = _checkLocalConsistency(localState, networkStates);
    
    // Résultat de la vérification
    return BlockchainStatus(
      isNetworkConsistent: isNetworkConsistent,
      isLocalConsistent: isLocalConsistent,
      localHeight: localState.height,
      networkHeight: _getConsensusHeight(networkStates),
      lastVerified: DateTime.now(),
    );
  }
  
  // Vérifier une transaction spécifique
  Future<TransactionVerification> verifyTransaction(String transactionHash) async {
    // Récupérer la transaction depuis plusieurs nœuds
    final transactionData = await _getTransactionFromNodes(transactionHash);
    
    if (transactionData.isEmpty) {
      return TransactionVerification(
        isValid: false,
        status: TransactionStatus.notFound,
        confirmations: 0,
        error: 'Transaction non trouvée sur le réseau',
      );
    }
    
    // Vérifier la cohérence des données
    final isConsistent = _checkTransactionConsistency(transactionData);
    
    if (!isConsistent) {
      return TransactionVerification(
        isValid: false,
        status: TransactionStatus.inconsistent,
        confirmations: 0,
        error: 'Données de transaction incohérentes entre les nœuds',
      );
    }
    
    // Récupérer les détails de la transaction
    final transaction = transactionData.first;
    
    // Vérifier la signature
    final isSignatureValid = await _verifyTransactionSignature(transaction);
    
    if (!isSignatureValid) {
      return TransactionVerification(
        isValid: false,
        status: TransactionStatus.invalidSignature,
        confirmations: 0,
        error: 'Signature de transaction invalide',
      );
    }
    
    // Vérifier le nombre de confirmations
    final confirmations = await _getTransactionConfirmations(transactionHash);
    
    // Déterminer le statut
    TransactionStatus status;
    if (confirmations == 0) {
      status = TransactionStatus.pending;
    } else if (confirmations < 3) {
      status = TransactionStatus.confirming;
    } else {
      status = TransactionStatus.confirmed;
    }
    
    return TransactionVerification(
      isValid: true,
      status: status,
      confirmations: confirmations,
      transaction: transaction,
    );
  }
  
  // Prévention de la double dépense
  Future<bool> checkDoubleSpending(List<String> tokenIds) async {
    // Pour chaque token, vérifier qu'il est bien possédé par l'utilisateur
    // et qu'il n'est pas déjà engagé dans une autre transaction
    
    for (final tokenId in tokenIds) {
      // Vérifier la propriété
      final ownership = await _verifyTokenOwnership(tokenId);
      if (!ownership.isOwned) {
        return false;
      }
      
      // Vérifier s'il est déjà utilisé dans une transaction en attente
      final isPending = await _isTokenInPendingTransaction(tokenId);
      if (isPending) {
        return false;
      }
    }
    
    return true;
  }
  
  // Méthodes auxiliaires pour la vérification blockchain
  Future<BlockchainState> _getLocalBlockchainState() async {
    // Implémentation...
    return BlockchainState(
      height: 0,
      lastBlockHash: '',
      lastBlockTime: DateTime.now(),
    ); // Placeholder
  }
  
  Future<List<BlockchainState>> _getNetworkBlockchainStates() async {
    // Implémentation...
    return []; // Placeholder
  }
  
  bool _checkNetworkConsistency(List<BlockchainState> states) {
    if (states.isEmpty) {
      return false;
    }
    
    // Vérifier que tous les nœuds sont d'accord sur la hauteur et le hash
    final consensusHeight = _getConsensusHeight(states);
    final consensusHash = _getConsensusHash(states);
    
    // Compter combien de nœuds sont en accord
    int consistentNodes = 0;
    for (final state in states) {
      if (state.height == consensusHeight && state.lastBlockHash == consensusHash) {
        consistentNodes++;
      }
    }
    
    // Au moins 2/3 des nœuds doivent être cohérents
    return consistentNodes >= (states.length * 2 / 3);
  }
  
  bool _checkLocalConsistency(BlockchainState localState, List<BlockchainState> networkStates) {
    if (networkStates.isEmpty) {
      return false;
    }
    
    final consensusHeight = _getConsensusHeight(networkStates);
    final consensusHash = _getConsensusHash(networkStates);
    
    // La hauteur locale peut être légèrement inférieure (1-2 blocs)
    if (consensusHeight - localState.height > 2) {
      return false;
    }
    
    // Si même hauteur, les hashs doivent correspondre
    if (localState.height == consensusHeight && localState.lastBlockHash != consensusHash) {
      return false;
    }
    
    return true;
  }
  
  int _getConsensusHeight(List<BlockchainState> states) {
    if (states.isEmpty) {
      return 0;
    }
    
    // Compter les occurrences de chaque hauteur
    final heightCounts = <int, int>{};
    for (final state in states) {
      heightCounts[state.height] = (heightCounts[state.height] ?? 0) + 1;
    }
    
    // Trouver la hauteur la plus courante
    int maxCount = 0;
    int consensusHeight = 0;
    
    heightCounts.forEach((height, count) {
      if (count > maxCount) {
        maxCount = count;
        consensusHeight = height;
      }
    });
    
    return consensusHeight;
  }
  
  String _getConsensusHash(List<BlockchainState> states) {
    if (states.isEmpty) {
      return '';
    }
    
    // Compter les occurrences de chaque hash
    final hashCounts = <String, int>{};
    for (final state in states) {
      hashCounts[state.lastBlockHash] = (hashCounts[state.lastBlockHash] ?? 0) + 1;
    }
    
    // Trouver le hash le plus courant
    int maxCount = 0;
    String consensusHash = '';
    
    hashCounts.forEach((hash, count) {
      if (count > maxCount) {
        maxCount = count;
        consensusHash = hash;
      }
    });
    
    return consensusHash;
  }
  
  Future<List<Map<String, dynamic>>> _getTransactionFromNodes(String transactionHash) async {
    // Implémentation...
    return []; // Placeholder
  }
  
  bool _checkTransactionConsistency(List<Map<String, dynamic>> transactions) {
    // Implémentation...
    return true; // Placeholder
  }
  
  Future<bool> _verifyTransactionSignature(Map<String, dynamic> transaction) async {
    // Implémentation...
    return true; // Placeholder
  }
  
  Future<int> _getTransactionConfirmations(String transactionHash) async {
    // Implémentation...
    return 0; // Placeholder
  }
  
  Future<TokenOwnership> _verifyTokenOwnership(String tokenId) async {
    // Implémentation...
    return TokenOwnership(
      isOwned: true,
      ownerId: '',
    ); // Placeholder
  }
  
  Future<bool> _isTokenInPendingTransaction(String tokenId) async {
    // Implémentation...
    return false; // Placeholder
  }
}

class BlockchainState {
  final int height;
  final String lastBlockHash;
  final DateTime lastBlockTime;
  
  BlockchainState({
    required this.height,
    required this.lastBlockHash,
    required this.lastBlockTime,
  });
}

class BlockchainStatus {
  final bool isNetworkConsistent;
  final bool isLocalConsistent;
  final int localHeight;
  final int networkHeight;
  final DateTime lastVerified;
  
  BlockchainStatus({
    required this.isNetworkConsistent,
    required this.isLocalConsistent,
    required this.localHeight,
    required this.networkHeight,
    required this.lastVerified,
  });
}

enum TransactionStatus {
  notFound,
  inconsistent,
  invalidSignature,
  pending,
  confirming,
  confirmed,
}

class TransactionVerification {
  final bool isValid;
  final TransactionStatus status;
  final int confirmations;
  final String? error;
  final Map<String, dynamic>? transaction;
  
  TransactionVerification({
    required this.isValid,
    required this.status,
    required this.confirmations,
    this.error,
    this.transaction,
  });
}

class TokenOwnership {
  final bool isOwned;
  final String ownerId;
  
  TokenOwnership({
    required this.isOwned,
    required this.ownerId,
  });
}
```

## 8. Implémentations et code source

### 8.1 Service de cryptographie complet

```dart
class CryptoService {
  static const int KEY_SIZE = 32; // 256 bits
  static const int IV_SIZE = 16; // 128 bits
  static const int SALT_SIZE = 32; // 256 bits
  static const int ITERATION_COUNT = 100000; // Pour PBKDF2
  
  // Générer une clé aléatoire sécurisée
  Future<Uint8List> generateSecureRandomKey(int length) async {
    final random = Random.secure();
    return Uint8List.fromList(
      List<int>.generate(length, (i) => random.nextInt(256))
    );
  }
  
  // Fonctions de hachage
  Future<String> sha256(String input) async {
    final bytes = utf8.encode(input);
    final digest = crypto.sha256.convert(bytes);
    return digest.toString();
  }
  
  Future<String> sha512(String input) async {
    final bytes = utf8.encode(input);
    final digest = crypto.sha512.convert(bytes);
    return digest.toString();
  }
  
  // Dérivation de clé basée sur mot de passe (PBKDF2)
  Future<Uint8List> pbkdf2(String password, Uint8List salt, {
    int iterations = ITERATION_COUNT,
    int keyLength = KEY_SIZE,
  }) async {
    final passwordBytes = utf8.encode(password);
    
    // Utiliser le package pointycastle pour PBKDF2
    final params = Pbkdf2Parameters(salt, iterations, keyLength);
    final keyDerivator = PBKDF2KeyDerivator(HMac(SHA256Digest(), 64));
    keyDerivator.init(params);
    
    return keyDerivator.process(Uint8List.fromList(passwordBytes));
  }
  
  // Chiffrement AES-GCM (Authenticated Encryption)
  Future<String> encryptAES(String plaintext, Uint8List key, {
    int ivLength = IV_SIZE,
  }) async {
    // Générer un vecteur d'initialisation aléatoire
    final iv = await generateSecureRandomKey(ivLength);
    
    // Préparer le chiffreur
    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(
      KeyParameter(key),
      128, // Taille du tag d'authentification (en bits)
      iv,
      Uint8List(0), // Données additionnelles (empty)
    );
    cipher.init(true, params);
    
    // Chiffrer les données
    final plaintextBytes = utf8.encode(plaintext);
    final ciphertextBytes = cipher.process(Uint8List.fromList(plaintextBytes));
    
    // Concaténer IV et données chiffrées pour le stockage/transmission
    final result = Uint8List(iv.length + ciphertextBytes.length);
    result.setRange(0, iv.length, iv);
    result.setRange(iv.length, result.length, ciphertextBytes);
    
    // Encoder en base64 pour faciliter le stockage
    return base64Url.encode(result);
  }
  
  // Déchiffrement AES-GCM
  Future<String> decryptAES(String encryptedText, Uint8List key, {
    int ivLength = IV_SIZE,
  }) async {
    try {
      // Décoder le base64
      final encryptedBytes = base64Url.decode(encryptedText);
      
      // Extraire l'IV et le texte chiffré
      final iv = encryptedBytes.sublist(0, ivLength);
      final ciphertextBytes = encryptedBytes.sublist(ivLength);
      
      // Préparer le déchiffreur
      final cipher = GCMBlockCipher(AESEngine());
      final params = AEADParameters(
        KeyParameter(key),
        128, // Taille du tag d'authentification (en bits)
        iv,
        Uint8List(0), // Données additionnelles (empty)
      );
      cipher.init(false, params);
      
      // Déchiffrer les données
      final plaintextBytes = cipher.process(ciphertextBytes);
      
      // Convertir en UTF-8
      return utf8.decode(plaintextBytes);
    } catch (e) {
      throw SecurityException('Erreur de déchiffrement: ${e.toString()}');
    }
  }
  
  // Signature numérique (ECDSA avec courbe secp256k1, utilisée par la plupart des blockchains)
  Future<String> sign(String message, String privateKeyHex) async {
    try {
      // Convertir la clé privée hexadécimale en bytes
      final privateKeyBytes = _hexToBytes(privateKeyHex);
      
      // Créer la paire de clés
      final privateKey = ECPrivateKey(
        BigInt.parse(privateKeyHex, radix: 16),
        ECDomainParameters('secp256k1')
      );
      
      // Calculer le hash du message
      final messageBytes = utf8.encode(message);
      final messageHash = crypto.sha256.convert(messageBytes).bytes;
      
      // Signer le hash
      final signer = ECDSASigner(SHA256Digest(), HMac(SHA256Digest(), 64));
      final params = PrivateKeyParameter<ECPrivateKey>(privateKey);
      signer.init(true, params);
      final signature = signer.generateSignature(Uint8List.fromList(messageHash));
      
      // Convertir la signature en format approprié
      final r = (signature as ECSignature).r;
      final s = signature.s;
      
      // Convertir en DER format
      final derSignature = _toDERSignature(r, s);
      
      // Encoder en base64
      return base64Url.encode(derSignature);
    } catch (e) {
      throw SecurityException('Erreur de signature: ${e.toString()}');
    }
  }
  
  // Vérification de signature
  Future<bool> verify(String message, String signature, String publicKeyHex) async {
    try {
      // Décoder la signature
      final signatureBytes = base64Url.decode(signature);
      
      // Extraire r et s depuis le format DER
      final rsValues = _fromDERSignature(signatureBytes);
      final r = rsValues[0];
      final s = rsValues[1];
      
      // Convertir la clé publique
      final publicKeyBytes = _hexToBytes(publicKeyHex);
      final publicKey = ECPublicKey(
        // Conversion de la clé publique depuis le format compressé/non-compressé
        // Dépend de la bibliothèque spécifique utilisée
        BigInt.parse('0', radix: 16), // Placeholder
        ECDomainParameters('secp256k1')
      );
      
      // Calculer le hash du message
      final messageBytes = utf8.encode(message);
      final messageHash = crypto.sha256.convert(messageBytes).bytes;
      
      // Vérifier la signature
      final verifier = ECDSASigner(SHA256Digest(), HMac(SHA256Digest(), 64));
      final params = PublicKeyParameter<ECPublicKey>(publicKey);
      verifier.init(false, params);
      
      final ecSignature = ECSignature(r, s);
      return verifier.verifySignature(Uint8List.fromList(messageHash), ecSignature);
    } catch (e) {
      return false;
    }
  }
  
  // Génération de paire de clés ECDSA (secp256k1)
  Future<KeyPair> generateECDSAKeyPair() async {
    final domainParams = ECDomainParameters('secp256k1');
    final keyGen = ECKeyGenerator();
    final random = SecureRandom('Fortuna');
    random.seed(KeyParameter(await generateSecureRandomKey(32)));
    
    final params = ECKeyGeneratorParameters(domainParams);
    final genParams = ParametersWithRandom<ECKeyGeneratorParameters>(params, random);
    keyGen.init(genParams);
    
    final keyPair = keyGen.generateKeyPair();
    final privateKey = keyPair.privateKey as ECPrivateKey;
    final publicKey = keyPair.publicKey as ECPublicKey;
    
    // Convertir en format hexadécimal
    final privateKeyHex = privateKey.d!.toRadixString(16).padLeft(64, '0');
    final publicKeyHex = _publicKeyToHex(publicKey);
    
    return KeyPair(privateKeyHex, publicKeyHex);
  }
  
  // Utilitaires pour la conversion des formats
  Uint8List _hexToBytes(String hex) {
    hex = hex.length % 2 != 0 ? '0$hex' : hex;
    final result = Uint8List(hex.length ~/ 2);
    for (int i = 0; i < result.length; i++) {
      result[i] = int.parse(hex.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return result;
  }
  
  String _bytesToHex(Uint8List bytes) {
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }
  
  String _publicKeyToHex(ECPublicKey publicKey) {
    // Conversion dépendante de l'implémentation spécifique
    return ''; // Placeholder
  }
  
  Uint8List _toDERSignature(BigInt r, BigInt s) {
    // Conversion en format DER
    return Uint8List(0); // Placeholder
  }
  
  List<BigInt> _fromDERSignature(Uint8List derSignature) {
    // Extraction de r et s depuis le format DER
    return [BigInt.zero, BigInt.zero]; // Placeholder
  }
}

class KeyPair {
  final String privateKey;
  final String publicKey;
  
  KeyPair(this.privateKey, this.publicKey);
}
```

### 8.2 Service d'authentification biométrique

```dart
class BiometricAuthService {
  final LocalAuthentication _localAuth = LocalAuthentication();
  final SecureStorage _secureStorage;
  
  BiometricAuthService(this._secureStorage);
  
  // Vérifier si l'authentification biométrique est disponible
  Future<BiometricAvailability> checkBiometricAvailability() async {
    try {
      // Vérifier si le matériel supporte la biométrie
      final canCheckBiometrics = await _localAuth.canCheckBiometrics;
      if (!canCheckBiometrics) {
        return BiometricAvailability(
          isAvailable: false,
          reason: BiometricUnavailabilityReason.notSupported,
        );
      }
      
      // Vérifier quels types de biométrie sont disponibles
      final availableBiometrics = await _localAuth.getAvailableBiometrics();
      
      if (availableBiometrics.isEmpty) {
        return BiometricAvailability(
          isAvailable: false,
          reason: BiometricUnavailabilityReason.notEnrolled,
        );
      }
      
      // Déterminer le type de biométrie principal
      BiometricType primaryType;
      if (availableBiometrics.contains(BiometricType.face)) {
        primaryType = BiometricType.face;
      } else if (availableBiometrics.contains(BiometricType.fingerprint)) {
        primaryType = BiometricType.fingerprint;
      } else if (availableBiometrics.contains(BiometricType.iris)) {
        primaryType = BiometricType.iris;
      } else {
        primaryType = BiometricType.unknown;
      }
      
      return BiometricAvailability(
        isAvailable: true,
        availableTypes: availableBiometrics,
        primaryType: primaryType,
      );
    } catch (e) {
      return BiometricAvailability(
        isAvailable: false,
        reason: BiometricUnavailabilityReason.unknown,
        error: e.toString(),
      );
    }
  }
  
  // Authentifier l'utilisateur avec biométrie
  Future<BiometricAuthResult> authenticate({
    required String reason,
    bool useErrorDialogs = true,
    bool stickyAuth = false,
  }) async {
    try {
      // Vérifier d'abord la disponibilité
      final availability = await checkBiometricAvailability();
      if (!availability.isAvailable) {
        return BiometricAuthResult(
          success: false,
          error: 'Biométrie non disponible: ${availability.reason}',
        );
      }
      
      // Tenter l'authentification
      final authenticated = await _localAuth.authenticate(
        localizedReason: reason,
        options: AuthenticationOptions(
          useErrorDialogs: useErrorDialogs,
          stickyAuth: stickyAuth,
          biometricOnly: true,
        ),
      );
      
      // Journaliser la tentative (sans données sensibles)
      await _logAuthAttempt(authenticated);
      
      return BiometricAuthResult(success: authenticated);
    } catch (e) {
      return BiometricAuthResult(
        success: false,
        error: 'Erreur d\'authentification: ${e.toString()}',
      );
    }
  }
  
  // Enregistrer/activer l'authentification biométrique
  Future<bool> enableBiometricAuth(String userId, String pin) async {
    try {
      // Vérifier si la biométrie est disponible
      final availability = await checkBiometricAvailability();
      if (!availability.isAvailable) {
        return false;
      }
      
      // Vérifier d'abord le PIN pour s'assurer que l'utilisateur est légitime
      final isPinValid = await _verifyPin(userId, pin);
      if (!isPinValid) {
        throw SecurityException('PIN invalide');
      }
      
      // Demander authentification biométrique
      final authResult = await authenticate(
        reason: 'Activer l\'authentification biométrique',
      );
      
      if (!authResult.success) {
        return false;
      }
      
      // Créer un token secret aléatoire lié à la biométrie
      final biometricToken = await _generateBiometricToken();
      
      // Enregistrer que la biométrie est activée pour cet utilisateur
      await _secureStorage.write(
        key: 'biometric_enabled_$userId',
        value: 'true',
      );
      
      // Stocker le token secret chiffré avec le PIN
      // Ce token sera utilisé pour "lier" le PIN à la biométrie
      await _secureStorage.write(
        key: 'biometric_token_$userId',
        value: biometricToken,
      );
      
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // Désactiver l'authentification biométrique
  Future<bool> disableBiometricAuth(String userId, String pin) async {
    try {
      // Vérifier d'abord le PIN
      final isPinValid = await _verifyPin(userId, pin);
      if (!isPinValid) {
        throw SecurityException('PIN invalide');
      }
      
      // Supprimer les données biométriques
      await _secureStorage.delete(key: 'biometric_enabled_$userId');
      await _secureStorage.delete(key: 'biometric_token_$userId');
      
      return true;
    } catch (e) {
      return false;
    }
  }
  
  // Méthodes auxiliaires
  Future<void> _logAuthAttempt(bool success) async {
    // Journaliser la tentative d'authentification de manière sécurisée
    // Sans    // Stocker l'entrée de journal
    await _repository.addLogEntry(finalEntry);
    
    // Mettre à jour le hash du dernier événement
    await _setLastEventHash(entryHash);
    
    // Optionnellement, synchroniser avec la blockchain pour une transparence maximale
    if (event.severity == AuditSeverity.critical) {
      await _synchronizeWithBlockchain(finalEntry);
    }
  }
  
  Future<AuditEvent> _enrichEvent(AuditEvent event) async {
    // Ajouter des métadonnées d'appareil
    final deviceInfo = await _getDeviceInfo();
    
    // Ajouter des métadonnées utilisateur (sans PII)
    final userContext = await _getUserContext();
    
    return event.copyWith(
      deviceInfo: deviceInfo,
      userContext: userContext,
      applicationVersion: await _getAppVersion(),
    );
  }
  
  Future<String> _calculateEntryHash(AuditLogEntry entry) async {
    // Créer une version sans le hash pour le calcul
    final tempEntry = entry.copyWith(entryHash: '');
    
    // Sérialiser l'entrée en JSON
    final serialized = jsonEncode(tempEntry.toJson());
    
    // Calculer le hash SHA-256
    return await _cryptoService.sha256(serialized);
  }
  
  Future<String> _getLastEventHash() async {
    return await _secureStorage.read(key: 'last_audit_hash') ?? '';
  }
  
  Future<void> _setLastEventHash(String hash) async {
    await _secureStorage.write(key: 'last_audit_hash', value: hash);
  }
  
  Future<DeviceInfo> _getDeviceInfo() async {
    // Collecter les informations sur l'appareil
    // sans identifiants uniques pour respecter la vie privée
    return DeviceInfo(
      platform: Platform.operatingSystem,
      osVersion: Platform.operatingSystemVersion,
      appBuild: await _getAppVersion(),
      // Éviter les identifiants d'appareil spécifiques
    );
  }
  
  Future<UserContext> _getUserContext() async {
    // Collecter le contexte utilisateur sans PII
    return UserContext(
      userType: 'consumer', // ou merchant, etc.
      accountAgeInDays: await _getAccountAgeInDays(),
      // Éviter toute donnée permettant d'identifier directement l'utilisateur
    );
  }
  
  Future<int> _getAccountAgeInDays() async {
    // Implémentation...
    return 0; // Placeholder
  }
  
  Future<String> _getAppVersion() async {
    // Implémentation...
    return '1.0.0'; // Placeholder
  }
  
  Future<void> _synchronizeWithBlockchain(AuditLogEntry entry) async {
    // Envoyer un hash de l'entrée à la blockchain pour une vérifiabilité publique
    // Implémentation...
  }
  
  Future<bool> verifyAuditChain() async {
    // Récupérer toutes les entrées de journal
    final logEntries = await _repository.getAllLogEntries();
    
    // Trier par timestamp
    logEntries.sort((a, b) => a.timestamp.compareTo(b.timestamp));
    
    // Vérifier la chaîne de hashes
    String previousHash = '';
    
    for (final entry in logEntries) {
      // Vérifier que le previousHash correspond
      if (entry.previousHash != previousHash) {
        return false;
      }
      
      // Vérifier l'intégrité de l'entrée elle-même
      final calculatedHash = await _calculateEntryHash(entry);
      if (calculatedHash != entry.entryHash) {
        return false;
      }
      
      // Mettre à jour le hash précédent pour la prochaine itération
      previousHash = entry.entryHash;
    }
    
    return true;
  }
}

class AuditEvent {
  final String type;
  final AuditSeverity severity;
  final Map<String, dynamic> data;
  final DeviceInfo? deviceInfo;
  final UserContext? userContext;
  final String? applicationVersion;
  
  AuditEvent({
    required this.type,
    required this.severity,
    required this.data,
    this.deviceInfo,
    this.userContext,
    this.applicationVersion,
  });
  
  AuditEvent copyWith({
    String? type,
    AuditSeverity? severity,
    Map<String, dynamic>? data,
    DeviceInfo? deviceInfo,
    UserContext? userContext,
    String? applicationVersion,
  }) {
    return AuditEvent(
      type: type ?? this.type,
      severity: severity ?? this.severity,
      data: data ?? this.data,
      deviceInfo: deviceInfo ?? this.deviceInfo,
      userContext: userContext ?? this.userContext,
      applicationVersion: applicationVersion ?? this.applicationVersion,
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'severity': severity.toString(),
      'data': data,
      'deviceInfo': deviceInfo?.toJson(),
      'userContext': userContext?.toJson(),
      'applicationVersion': applicationVersion,
    };
  }
}

class AuditLogEntry {
  final AuditEvent event;
  final DateTime timestamp;
  final String previousHash;
  final String entryHash;
  
  AuditLogEntry({
    required this.event,
    required this.timestamp,
    required this.previousHash,
    required this.entryHash,
  });
  
  AuditLogEntry copyWith({
    AuditEvent? event,
    DateTime? timestamp,
    String? previousHash,
    String? entryHash,
  }) {
    return AuditLogEntry(
      event: event ?? this.event,
      timestamp: timestamp ?? this.timestamp,
      previousHash: previousHash ?? this.previousHash,
      entryHash: entryHash ?? this.entryHash,
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'event': event.toJson(),
      'timestamp': timestamp.toUtc().toIso8601String(),
      'previousHash': previousHash,
      'entryHash': entryHash,
    };
  }
}

enum AuditSeverity {
  debug,
  info,
  warning,
  error,
  critical,
}

class DeviceInfo {
  final String platform;
  final String osVersion;
  final String appBuild;
  
  DeviceInfo({
    required this.platform,
    required this.osVersion,
    required this.appBuild,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'platform': platform,
      'osVersion': osVersion,
      'appBuild': appBuild,
    };
  }
}

class UserContext {
  final String userType;
  final int accountAgeInDays;
  
  UserContext({
    required this.userType,
    required this.accountAgeInDays,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'userType': userType,
      'accountAgeInDays': accountAgeInDays,
    };
  }
}
```

### 6.2 Rapport de transparence utilisateur

```dart
class TransparencyReportGenerator {
  final TransactionRepository _transactionRepository;
  final TokenRepository _tokenRepository;
  final ConsumerFundRepository _fundRepository;
  final AuditLogRepository _auditRepository;
  
  TransparencyReportGenerator(
    this._transactionRepository,
    this._tokenRepository,
    this._fundRepository,
    this._auditRepository,
  );
  
  Future<UserTransparencyReport> generateUserReport(String userId, int months) async {
    // Calculer la période couverte
    final now = DateTime.now();
    final startDate = DateTime(now.year, now.month - months, now.day);
    
    // Récupérer les transactions de l'utilisateur
    final transactions = await _transactionRepository.getUserTransactions(
      userId: userId,
      startDate: startDate,
      endDate: now,
    );
    
    // Récupérer l'activité des tokens
    final tokenActivity = await _tokenRepository.getUserTokenActivity(
      userId: userId,
      startDate: startDate,
      endDate: now,
    );
    
    // Récupérer les données d'épargne
    final savingsData = await _fundRepository.getUserSavingsHistory(
      userId: userId,
      startDate: startDate,
      endDate: now,
    );
    
    // Récupérer les événements d'audit pertinents
    final auditEvents = await _auditRepository.getUserAuditEvents(
      userId: userId,
      startDate: startDate,
      endDate: now,
    );
    
    // Générer les métriques de l'utilisateur
    final metrics = _calculateUserMetrics(transactions, tokenActivity, savingsData);
    
    // Générer les visualisations
    final visualizations = _generateVisualizations(transactions, tokenActivity, savingsData);
    
    // Créer le rapport
    return UserTransparencyReport(
      userId: userId,
      generatedAt: now,
      period: ReportPeriod(start: startDate, end: now),
      transactionsSummary: _summarizeTransactions(transactions),
      tokensSummary: _summarizeTokens(tokenActivity),
      savingsSummary: _summarizeSavings(savingsData),
      metrics: metrics,
      visualizations: visualizations,
      verificationHash: await _generateVerificationHash(userId, now),
    );
  }
  
  TransactionsSummary _summarizeTransactions(List<Transaction> transactions) {
    // Calculer les statistiques sur les transactions
    final totalCount = transactions.length;
    final totalAmount = transactions.fold<double>(
      0, (sum, tx) => sum + tx.amount);
    final averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;
    
    // Grouper par commerçant
    final merchantCounts = <String, int>{};
    for (final tx in transactions) {
      merchantCounts[tx.merchantName] = (merchantCounts[tx.merchantName] ?? 0) + 1;
    }
    
    // Trouver les commerçants les plus fréquents
    final sortedMerchants = merchantCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    
    final topMerchants = sortedMerchants.take(5).map((e) => 
      MerchantSummary(name: e.key, transactionCount: e.value)).toList();
    
    return TransactionsSummary(
      totalCount: totalCount,
      totalAmount: totalAmount,
      averageAmount: averageAmount,
      topMerchants: topMerchants,
    );
  }
  
  TokensSummary _summarizeTokens(List<TokenActivity> activity) {
    // Calculer les statistiques sur les tokens
    final totalEarned = activity.fold<int>(
      0, (sum, act) => sum + (act.type == TokenActivityType.earned ? act.amount : 0));
    
    final totalActivated = activity.fold<int>(
      0, (sum, act) => sum + (act.type == TokenActivityType.activated ? act.amount : 0));
    
    final totalSpent = activity.fold<int>(
      0, (sum, act) => sum + (act.type == TokenActivityType.spent ? act.amount : 0));
    
    return TokensSummary(
      totalEarned: totalEarned,
      totalActivated: totalActivated,
      totalSpent: totalSpent,
      currentBalance: totalEarned - totalSpent,
      latentTokens: totalEarned - totalActivated,
    );
  }
  
  SavingsSummary _summarizeSavings(List<SavingsEntry> savingsData) {
    // Trouver la première et la dernière entrée
    if (savingsData.isEmpty) {
      return SavingsSummary(
        startingBalance: 0,
        currentBalance: 0,
        totalContributions: 0,
        growthPercentage: 0,
        longTermSavings: 0,
        projectsSavings: 0,
      );
    }
    
    savingsData.sort((a, b) => a.date.compareTo(b.date));
    final firstEntry = savingsData.first;
    final lastEntry = savingsData.last;
    
    final totalContributions = savingsData
      .where((e) => e.type == SavingsEntryType.contribution)
      .fold<double>(0, (sum, e) => sum + e.amount);
    
    // Calculer le pourcentage de croissance
    final growthPercentage = firstEntry.totalBalance > 0
      ? ((lastEntry.totalBalance - firstEntry.totalBalance) / firstEntry.totalBalance) * 100
      : 0;
    
    return SavingsSummary(
      startingBalance: firstEntry.totalBalance,
      currentBalance: lastEntry.totalBalance,
      totalContributions: totalContributions,
      growthPercentage: growthPercentage,
      longTermSavings: lastEntry.longTermBalance,
      projectsSavings: lastEntry.projectsBalance,
    );
  }
  
  UserMetrics _calculateUserMetrics(
    List<Transaction> transactions,
    List<TokenActivity> tokenActivity,
    List<SavingsEntry> savingsData,
  ) {
    // Calculer l'impact environnemental estimé
    final environmentalImpact = _estimateEnvironmentalImpact(transactions);
    
    // Calculer l'impact social estimé
    final socialImpact = _estimateSocialImpact(transactions);
    
    // Calculer l'efficacité d'épargne
    final savingsEfficiency = _calculateSavingsEfficiency(transactions, savingsData);
    
    return UserMetrics(
      transactionsPerMonth: _calculateTransactionsPerMonth(transactions),
      averageTokensPerTransaction: _calculateAverageTokensPerTransaction(transactions),
      tokenActivationRate: _calculateTokenActivationRate(tokenActivity),
      savingsGrowthRate: _calculateSavingsGrowthRate(savingsData),
      environmentalImpact: environmentalImpact,
      socialImpact: socialImpact,
      savingsEfficiency: savingsEfficiency,
    );
  }
  
  List<Visualization> _generateVisualizations(
    List<Transaction> transactions,
    List<TokenActivity> tokenActivity,
    List<SavingsEntry> savingsData,
  ) {
    final visualizations = <Visualization>[];
    
    // Graphique des transactions par mois
    visualizations.add(_createMonthlyTransactionsChart(transactions));
    
    // Graphique de l'évolution des tokens
    visualizations.add(_createTokenEvolutionChart(tokenActivity));
    
    // Graphique de l'évolution de l'épargne
    visualizations.add(_createSavingsEvolutionChart(savingsData));
    
    // Répartition des dépenses par catégorie
    visualizations.add(_createSpendingCategoryChart(transactions));
    
    return visualizations;
  }
  
  Future<String> _generateVerificationHash(String userId, DateTime timestamp) async {
    // Générer un hash de vérification pour l'intégrité du rapport
    final dataToHash = '$userId|${timestamp.toIso8601String()}';
    final hash = await Crypto.sha256(dataToHash);
    return hash;
  }
  
  // Méthodes auxiliaires pour les calculs de métriques
  double _calculateTransactionsPerMonth(List<Transaction> transactions) {
    // Implémentation...
    return 0.0; // Placeholder
  }
  
  double _calculateAverageTokensPerTransaction(List<Transaction> transactions) {
    // Implémentation...
    return 0.0; // Placeholder
  }
  
  double _calculateTokenActivationRate(List<TokenActivity> tokenActivity) {
    // Implémentation...
    return 0.0; // Placeholder
  }
  
  double _calculateSavingsGrowthRate(List<SavingsEntry> savingsData) {
    // Implémentation...
    return 0.0; // Placeholder
  }
  
  EnvironmentalImpact _estimateEnvironmentalImpact(List<Transaction> transactions) {
    // Implémentation...
    return EnvironmentalImpact(
      carbonSaved: 0.0,
      waterSaved: 0.0,
      treesPlanted: 0,
    );
  }
  
  SocialImpact _estimateSocialImpact(List<Transaction> transactions) {
    // Implémentation...
    return SocialImpact(
      communityProjects: 0,
      peopleHelped: 0,
      educationHours: 0,
    );
  }
  
  double _calculateSavingsEfficiency(
    List<Transaction> transactions,
    List<SavingsEntry> savingsData,
  ) {
    // Implémentation...
    return 0.0; // Placeholder
  }
  
  // Méthodes pour générer les visualisations
  Visualization _createMonthlyTransactionsChart(List<Transaction> transactions) {
    // Implémentation...
    return Visualization(
      type: VisualizationType.barChart,
      title: 'Transactions mensuelles',
      description: 'Nombre de transactions par mois',
      data: {},
    );
  }
  
  Visualization _createTokenEvolutionChart(List<TokenActivity> tokenActivity) {
    // Implémentation...
    return Visualization(
      type: VisualizationType.lineChart,
      title: 'Évolution des tokens',
      description: 'Évolution de vos tokens au fil du temps',
      data: {},
    );
  }
  
  Visualization _createSavingsEvolutionChart(List<SavingsEntry> savingsData) {
    // Implémentation...
    return Visualization(
      type: VisualizationType.lineChart,
      title: 'Évolution de l\'épargne',
      description: 'Croissance de votre épargne au fil du temps',
      data: {},
    );
  }
  
  Visualization _createSpendingCategoryChart(List<Transaction> transactions) {
    // Implémentation...
    return Visualization(
      type: VisualizationType.pieChart,
      title: 'Répartition des dépenses',
      description: 'Répartition de vos dépenses par catégorie',
      data: {},
    );
  }
}

class UserTransparencyReport {
  final String userId;
  final DateTime generatedAt;
  final ReportPeriod period;
  final TransactionsSummary transactionsSummary;
  final TokensSummary tokensSummary;
  final SavingsSummary savingsSummary;
  final UserMetrics metrics;
  final List<Visualization> visualizations;
  final String verificationHash;
  
  UserTransparencyReport({
    required this.userId,
    required this.generatedAt,
    required this.period,
    required this.transactionsSummary,
    required this.tokensSummary,
    required this.savingsSummary,
    required this.metrics,
    required this.visualizations,
    required this.verificationHash,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'generatedAt': generatedAt.toIso8601String(),
      'period': period.toJson(),
      'transactionsSummary': transactionsSummary.toJson(),
      'tokensSummary': tokensSummary.toJson(),
      'savingsSummary': savingsSummary.toJson(),
      'metrics': metrics.toJson(),
      'visualizations': visualizations.map((v) => v.toJson()).toList(),
      'verificationHash': verificationHash,
    };
  }
}

// Classes de support pour le rapport
class ReportPeriod {
  final DateTime start;
  final DateTime end;
  
  ReportPeriod({required this.start, required this.end});
  
  Map<String, dynamic> toJson() {
    return {
      'start': start.toIso8601String(),
      'end': end.toIso8601String(),
    };
  }
}

class TransactionsSummary {
  final int totalCount;
  final double totalAmount;
  final double averageAmount;
  final List<MerchantSummary> topMerchants;
  
  TransactionsSummary({
    required this.totalCount,
    required this.totalAmount,
    required this.averageAmount,
    required this.topMerchants,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'totalCount': totalCount,
      'totalAmount': totalAmount,
      'averageAmount': averageAmount,
      'topMerchants': topMerchants.map((m) => m.toJson()).toList(),
    };
  }
}

class MerchantSummary {
  final String name;
  final int transactionCount;
  
  MerchantSummary({
    required this.name,
    required this.transactionCount,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'transactionCount': transactionCount,
    };
  }
}

class TokensSummary {
  final int totalEarned;
  final int totalActivated;
  final int totalSpent;
  final int currentBalance;
  final int latentTokens;
  
  TokensSummary({
    required this.totalEarned,
    required this.totalActivated,
    required this.totalSpent,
    required this.currentBalance,
    required this.latentTokens,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'totalEarned': totalEarned,
      'totalActivated': totalActivated,
      'totalSpent': totalSpent,
      'currentBalance': currentBalance,
      'latentTokens': latentTokens,
    };
  }
}

class SavingsSummary {
  final double startingBalance;
  final double currentBalance;
  final double totalContributions;
  final double growthPercentage;
  final double longTermSavings;
  final double projectsSavings;
  
  SavingsSummary({
    required this.startingBalance,
    required this.currentBalance,
    required this.totalContributions,
    required this.growthPercentage,
    required this.longTermSavings,
    required this.projectsSavings,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'startingBalance': startingBalance,
      'currentBalance': currentBalance,
      'totalContributions': totalContributions,
      'growthPercentage': growthPercentage,
      'longTermSavings': longTermSavings,
      'projectsSavings': projectsSavings,
    };
  }
}

class UserMetrics {
  final double transactionsPerMonth;
  final double averageTokensPerTransaction;
  final double tokenActivationRate;
  final double savingsGrowthRate;
  final EnvironmentalImpact environmentalImpact;
  final SocialImpact socialImpact;
  final double savingsEfficiency;
  
  UserMetrics({
    required this.transactionsPerMonth,
    required this.averageTokensPerTransaction,
    required this.tokenActivationRate,
    required this.savingsGrowthRate,
    required this.environmentalImpact,
    required this.socialImpact,
    required this.savingsEfficiency,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'transactionsPerMonth': transactionsPerMonth,
      'averageTokensPerTransaction': averageTokensPerTransaction,
      'tokenActivationRate': tokenActivationRate,
      'savingsGrowthRate': savingsGrowthRate,
      'environmentalImpact': environmentalImpact.toJson(),
      'socialImpact': socialImpact.toJson(),
      'savingsEfficiency': savingsEfficiency,
    };
  }
}

class EnvironmentalImpact {
  final double carbonSaved;
  final double waterSaved;
  final int treesPlanted;
  
  EnvironmentalImpact({
    required this.carbonSaved,
    required this.waterSaved,
    required this.treesPlanted,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'carbonSaved': carbonSaved,
      'waterSaved': waterSaved,
      'treesPlanted': treesPlanted,
    };
  }
}

class SocialImpact {
  final int communityProjects;
  final int peopleHelped;
  final int educationHours;
  
  SocialImpact({
    required this.communityProjects,
    required this.peopleHelped,
    required this.educationHours,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'communityProjects': communityProjects,
      'peopleHelped': peopleHelped,
      'educationHours': educationHours,
    };
  }
}

enum VisualizationType {
  barChart,
  lineChart,
  pieChart,
  heatmap,
}

class Visualization {
  final VisualizationType type;
  final String title;
  final String description;
  final Map<String, dynamic> data;
  
  Visualization({
    required this.type,
    required this.title,
    required this.description,
    required this.data,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'type': type.toString(),
      'title': title,
      'description': description,
      'data': data,
    };
  }
}

enum TokenActivityType {
  earned,
  activated,
  spent,
  expired,
}

class TokenActivity {
  final String id;
  final TokenActivityType type;
  final int amount;
  final DateTime date;
  final String? transactionId;
  
  TokenActivity({
    required this.id,
    required this.type,
    required this.amount,
    required this.date,
    this.transactionId,
  });
}

enum SavingsEntryType {
  contribution,
  withdrawal,
  allocation,
}

class SavingsEntry {
  final String id;
  final DateTime date;
  final SavingsEntryType type;
  final double amount;
  final double totalBalance;
  final double longTermBalance;
  final double projectsBalance;
  
  SavingsEntry({
    required this.id,
    required this.date,
    required this.type,
    required this.amount,
    required this.totalBalance,
    required this.longTermBalance,
    required this.projectsBalance,
  });
}
```

## 7. Audit et conformité

### 7.1 Conformité au RGPD

L'application est conçue dès le départ pour respecter le RGPD :

1. **Minimisation des données** : Seules les données strictement nécessaires sont collectées
2. **Droit à l'oubli** : Fonctionnalité intégrée de suppression des données utilisateur
3. **Portabilité des données** : Export des données dans un format lisible par machine
4. **Transparence** : Documentation claire des données collectées et de leur utilisation

```dart
class DataPrivacyService {
  final UserRepository _userRepository;
  final TransactionRepository _transactionRepository;
  final TokenRepository _tokenRepository;
  final ConsumerFundRepository _fundRepository;
  final AuditLogRepository _auditRepository;
  final SecureStorage _secureStorage;
  
  DataPrivacyService(
    this._userRepository,
    this._transactionRepository,
    this._tokenRepository,
    this._fundRepository,
    this._auditRepository,
    this._secureStorage,
  );
  
  // Export des données utilisateur (portabilité)
  Future<Map<String, dynamic>> exportUserData(String userId) async {
    // Vérifier l'authentification
    if (!await _isUserAuthenticated(userId)) {
      throw UnauthorizedException('Non autorisé à accéder à ces données');
    }
    
    // Récupérer les données utilisateur
    final userData = await _userRepository.getUserData(userId);
    
    // Récupérer les transactions
    final transactions = await _transactionRepository.getUserTransactions(
      userId: userId,
      limit: null, // Toutes les transactions
    );
    
    // Récupérer les tokens
    final tokens = await _tokenRepository.getUserTokens(userId);
    
    // Récupérer les données d'épargne
    final savingsData = await _fundRepository.getUserSavings(userId);
    
    // Créer le fichier d'export
    final exportData = {
      'userData': userData,
      'transactions': transactions.map((t) => t.toJson()).toList(),
      'tokens': tokens.map((t) => t.toJson()).toList(),
      'savings': savingsData.toJson(),
      'exportDate': DateTime.now().toUtc().toIso8601String(),
      'version': '1.0',
    };
    
    // Journaliser l'export
    await _auditRepository.logEvent(AuditEvent(
      type: 'data_export',
      severity: AuditSeverity.info,
      data: {
        'userId': userId,
        'exportDate': DateTime.now().toUtc().toIso8601String(),
      },
    ));
    
    return exportData;
  }
  
  // Suppression des données utilisateur (droit à l'oubli)
  Future<bool> deleteUserData(String userId, String verificationCode) async {
    // Vérifier l'authentification
    if (!await _isUserAuthenticated(userId)) {
      throw UnauthorizedException('Non autorisé à supprimer ces données');
    }
    
    // Vérifier le code de vérification
    if (!await _verifyDeletionCode(userId, verificationCode)) {
      throw SecurityException('Code de vérification incorrect');
    }
    
    // Étape 1: Anonymiser les transactions (pour préserver l'intégrité blockchain)
    await _transactionRepository.anonymizeUserTransactions(userId);
    
    // Étape 2: Supprimer les tokens de l'utilisateur
    await _tokenRepository.deleteUserTokens(userId);
    
    // Étape 3: Supprimer les données d'épargne
    await _fundRepository.deleteUserSavings(userId);
    
    // Étape 4: Supprimer les données utilisateur
    await _userRepository.deleteUser(userId);
    # Guide de Sécurité et Transparence - Application Mobile Étika

## Introduction

Ce guide présente les mesures de sécurité et les principes de transparence recommandés pour l'application mobile Étika. Ces recommandations visent à protéger les actifs numériques des utilisateurs, à sécuriser les transactions blockchain et à garantir la transparence du système conformément aux principes fondamentaux d'Étika.

## Table des matières

1. [Principes fondamentaux](#1-principes-fondamentaux)
2. [Sécurisation des clés cryptographiques](#2-sécurisation-des-clés-cryptographiques)
3. [Protection des données utilisateur](#3-protection-des-données-utilisateur)
4. [Sécurisation des communications](#4-sécurisation-des-communications)
5. [Détection et prévention des fraudes](#5-détection-et-prévention-des-fraudes)
6. [Mesures de transparence](#6-mesures-de-transparence)
7. [Audit et conformité](#7-audit-et-conformité)
8. [Implémentations et code source](#8-implémentations-et-code-source)
9. [Procédures en cas d'incident](#9-procédures-en-cas-dincident)
10. [Formation et sensibilisation](#10-formation-et-sensibilisation)

## 1. Principes fondamentaux

### 1.1 Piliers de sécurité

La sécurité de l'application mobile Étika repose sur quatre piliers essentiels :

1. **Confidentialité** : Protection des données sensibles des utilisateurs
2. **Intégrité** : Garantie que les données et transactions ne sont pas altérées
3. **Disponibilité** : Accès continu au service, même en mode déconnecté
4. **Non-répudiation** : Impossibilité de nier avoir effectué une transaction validée

### 1.2 Principes de transparence

Conformément à l'éthique du projet Étika, nous appliquons les principes suivants :

1. **Code open source** : Les composants critiques sont auditables
2. **Triple transparence** : Utilisateur, commerçant, fournisseur
3. **Consensus visible** : Le mécanisme PoP (Proof of Purchase) est vérifiable
4. **Traçabilité complète** : Historique des transactions accessible aux parties impliquées

## 2. Sécurisation des clés cryptographiques

La gestion des clés cryptographiques est critique pour la sécurité de tout système blockchain.

### 2.1 Stockage sécurisé des clés privées

#### 2.1.1 Architecture de stockage

Les clés privées des utilisateurs sont protégées par une architecture à plusieurs niveaux :

1. **Stockage dans l'enclave sécurisée** : Utilisation de Keychain (iOS) et Keystore (Android)
2. **Chiffrement supplémentaire** : Couche de chiffrement AES-256 par-dessus le stockage natif
3. **Dérivation de clé** : Utilisation de PBKDF2 avec une dérivation basée sur des informations biométriques
4. **Séparation des clés** : Division de la clé privée en plusieurs fragments

#### 2.1.2 Implémentation recommandée

```dart
class SecureKeyManager {
  final FlutterSecureStorage _secureStorage;
  final LocalAuthentication _localAuth;
  final CryptoService _cryptoService;
  
  // Génération de sel aléatoire pour PBKDF2
  Future<String> _generateSalt() async {
    final random = Random.secure();
    final values = List<int>.generate(32, (i) => random.nextInt(256));
    return base64Url.encode(values);
  }
  
  // Dérivation de clé basée sur PIN + facteur de sécurité de l'appareil
  Future<Uint8List> _deriveKey(String pin) async {
    // Récupérer ou générer un sel
    String salt = await _secureStorage.read(key: 'key_salt') ?? 
                 await _generateSalt();
    
    if (await _secureStorage.read(key: 'key_salt') == null) {
      await _secureStorage.write(key: 'key_salt', value: salt);
    }
    
    // Obtenir identifiant unique de l'appareil (ne quitte jamais l'appareil)
    final deviceId = await _getSecureDeviceIdentifier();
    
    // Combiner PIN + identifiant de l'appareil
    final combinedKey = pin + deviceId;
    
    // Dériver une clé forte avec PBKDF2
    return await _cryptoService.pbkdf2(
      combinedKey, 
      base64Url.decode(salt),
      iterations: 100000,
      keyLength: 32
    );
  }
  
  // Chiffrement de la clé privée
  Future<void> storePrivateKey(String privateKey, String pin) async {
    // Vérifier authentification biométrique si disponible
    if (await _localAuth.canCheckBiometrics) {
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Authentification nécessaire pour sécuriser votre clé',
        useErrorDialogs: true,
        stickyAuth: true,
        biometricOnly: true,
      );
      
      if (!authenticated) {
        throw SecurityException('Authentification biométrique requise');
      }
    }
    
    // Dériver la clé de chiffrement
    final key = await _deriveKey(pin);
    
    // Chiffrer la clé privée
    final encryptedKey = await _cryptoService.encryptAES(
      privateKey,
      key,
      ivLength: 16,
    );
    
    // Diviser en plusieurs fragments
    final keyFragments = _splitKey(encryptedKey);
    
    // Stocker les fragments dans différentes zones sécurisées
    await Future.wait([
      _secureStorage.write(key: 'private_key_1', value: keyFragments[0]),
      _secureStorage.write(key: 'private_key_2', value: keyFragments[1]),
      // Stocker les métadonnées pour la reconstruction
      _secureStorage.write(key: 'key_meta', value: json.encode({
        'fragments': keyFragments.length,
        'version': '1.0',
        'created': DateTime.now().toIso8601String(),
      })),
    ]);
  }
  
  // Récupération de la clé privée
  Future<String?> getPrivateKey(String pin) async {
    // Authentification biométrique
    if (await _localAuth.canCheckBiometrics) {
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Authentification nécessaire pour accéder à votre clé',
        useErrorDialogs: true,
        stickyAuth: true,
      );
      
      if (!authenticated) {
        throw SecurityException('Authentification biométrique échouée');
      }
    }
    
    try {
      // Récupérer les fragments
      final fragment1 = await _secureStorage.read(key: 'private_key_1');
      final fragment2 = await _secureStorage.read(key: 'private_key_2');
      
      if (fragment1 == null || fragment2 == null) {
        return null;
      }
      
      // Reconstruire la clé chiffrée
      final encryptedKey = _combineKeyFragments([fragment1, fragment2]);
      
      // Dériver la clé de déchiffrement
      final key = await _deriveKey(pin);
      
      // Déchiffrer la clé privée
      return await _cryptoService.decryptAES(encryptedKey, key);
    } catch (e) {
      // Journaliser la tentative d'accès échouée (sans données sensibles)
      await _logSecurityEvent('private_key_access_failed');
      return null;
    }
  }
  
  // Fragmentation de clé (implémentation Shamir Secret Sharing)
  List<String> _splitKey(String encryptedKey) {
    // Implémentation de l'algorithme de partage de secret de Shamir
    // Dans une implémentation réelle, utiliser une bibliothèque éprouvée
    
    // Version simplifiée pour l'exemple :
    final bytes = utf8.encode(encryptedKey);
    final mid = bytes.length ~/ 2;
    
    final part1 = base64Url.encode(bytes.sublist(0, mid));
    final part2 = base64Url.encode(bytes.sublist(mid));
    
    return [part1, part2];
  }
  
  // Recombinaison des fragments
  String _combineKeyFragments(List<String> fragments) {
    final part1 = base64Url.decode(fragments[0]);
    final part2 = base64Url.decode(fragments[1]);
    
    final combined = Uint8List(part1.length + part2.length);
    combined.setRange(0, part1.length, part1);
    combined.setRange(part1.length, combined.length, part2);
    
    return utf8.decode(combined);
  }
  
  // Effacement sécurisé de clés
  Future<void> secureWipe() async {
    // Écraser les données avec des valeurs aléatoires avant suppression
    final random = Random.secure();
    
    for (final key in ['private_key_1', 'private_key_2']) {
      final currentValue = await _secureStorage.read(key: key);
      if (currentValue != null) {
        final randomData = List<int>.generate(
            currentValue.length, (i) => random.nextInt(256));
        final randomString = base64Url.encode(randomData);
        
        // Écraser avec données aléatoires
        await _secureStorage.write(key: key, value: randomString);
      }
    }
    
    // Supprimer toutes les clés
    await _secureStorage.deleteAll();
    
    // Journaliser l'effacement
    await _logSecurityEvent('secure_wipe_performed');
  }
  
  // Journal d'événements de sécurité
  Future<void> _logSecurityEvent(String event) async {
    // Implémentation du journaliseur sécurisé
    // À externaliser dans un service dédié
  }
}
```

### 2.2 Authentification et autorisation

#### 2.2.1 Méthodes d'authentification multicouches

L'application implémente un système d'authentification à plusieurs facteurs :

1. **Premier facteur** : PIN ou mot de passe (connaissance)
2. **Second facteur** : Biométrie (empreinte, reconnaissance faciale) (inhérence)
3. **Troisième facteur optionnel** : Validation par appareil associé (possession)

#### 2.2.2 Politique de PIN/mot de passe

- Longueur minimale de 6 caractères pour le PIN
- Analyse des PINs faibles ou communs (blocage des 1234, etc.)
- Délai progressif après tentatives échouées
- Effacement des données après 10 tentatives échouées (configurable)

#### 2.2.3 Gestion des sessions

- Durée de session limitée (configurable, par défaut 15 minutes)
- Verrouillage automatique en cas d'inactivité
- Invalidation forcée des sessions à distance en cas de perte/vol

### 2.3 Protection contre le vol et la perte d'appareil

#### 2.3.1 Détection d'appareils compromis

```dart
class DeviceSecurityChecker {
  Future<SecurityStatus> checkDeviceSecurity() async {
    List<SecurityIssue> issues = [];
    
    // Vérifier si l'appareil est rooté/jailbreaké
    if (await _isDeviceRooted()) {
      issues.add(SecurityIssue.rootedDevice);
    }
    
    // Vérifier si le débogage est activé
    if (await _isDebuggerAttached()) {
      issues.add(SecurityIssue.debuggerAttached);
    }
    
    // Vérifier si l'application est exécutée dans un émulateur
    if (await _isEmulator()) {
      issues.add(SecurityIssue.emulatorDetected);
    }
    
    // Vérifier les applications de superposition d'écran (overlay)
    if (Platform.isAndroid && await _hasScreenOverlays()) {
      issues.add(SecurityIssue.screenOverlayDetected);
    }
    
    // Vérifier la présence d'applications de capture d'écran automatique
    if (await _hasScreenCapturingApps()) {
      issues.add(SecurityIssue.screenCaptureRisk);
    }
    
    return SecurityStatus(
      secure: issues.isEmpty,
      issues: issues,
      riskLevel: _calculateRiskLevel(issues),
    );
  }
  
  Future<bool> _isDeviceRooted() async {
    if (Platform.isAndroid) {
      try {
        // Vérifier des chemins typiques des appareils rootés
        final paths = [
          '/system/app/Superuser.apk',
          '/system/xbin/su',
          '/system/app/SuperSU.apk',
          '/sbin/su',
          '/system/bin/su',
          '/system/xbin/daemonsu',
          '/system/etc/init.d/99SuperSUDaemon',
          '/data/local/su',
          '/data/local/bin/su',
          '/data/local/xbin/su',
        ];
        
        for (final path in paths) {
          if (await File(path).exists()) {
            return true;
          }
        }
        
        // Essayer d'exécuter la commande su
        final result = await Process.run('which', ['su']);
        if (result.stdout.toString().isNotEmpty) {
          return true;
        }
        
        return false;
      } catch (e) {
        // En cas d'erreur, considérer qu'il peut y avoir un risque
        return false;
      }
    } else if (Platform.isIOS) {
      try {
        // Vérifier des applications typiques de jailbreak
        final paths = [
          '/Applications/Cydia.app',
          '/Applications/blackra1n.app',
          '/Applications/FakeCarrier.app',
          '/Applications/Icy.app',
          '/Applications/IntelliScreen.app',
          '/Applications/MxTube.app',
          '/Applications/RockApp.app',
          '/Applications/SBSettings.app',
          '/Applications/WinterBoard.app',
          '/Library/MobileSubstrate/MobileSubstrate.dylib',
          '/Library/MobileSubstrate/DynamicLibraries/Veency.plist',
          '/private/var/lib/apt',
          '/private/var/lib/cydia',
          '/private/var/mobile/Library/SBSettings/Themes',
          '/private/var/stash',
          '/private/var/tmp/cydia.log',
          '/System/Library/LaunchDaemons/com.ikey.bbot.plist',
          '/System/Library/LaunchDaemons/com.saurik.Cydia.Startup.plist',
          '/usr/bin/sshd',
          '/usr/libexec/sftp-server',
          '/usr/sbin/sshd',
          '/var/cache/apt',
          '/var/lib/apt',
          '/var/lib/cydia',
        ];
        
        for (final path in paths) {
          if (await File(path).exists()) {
            return true;
          }
        }
        
        // Essayer d'ouvrir une URL cydia
        final canOpen = await canLaunch('cydia://');
        if (canOpen) {
          return true;
        }
        
        return false;
      } catch (e) {
        return false;
      }
    }
    
    return false;
  }
  
  Future<bool> _isDebuggerAttached() async {
    // Implémentation de la détection de débogueur
    // Spécifique à la plateforme
    return false; // Placeholder
  }
  
  Future<bool> _isEmulator() async {
    if (Platform.isAndroid) {
      // Vérifier les propriétés de l'appareil sur Android
      final properties = [
        'ro.hardware',
        'ro.product.model',
        'ro.bootloader',
        'ro.bootmode',
        'ro.product.name',
        'ro.product.device',
      ];
      
      final emulatorSignatures = [
        'goldfish',
        'ranchu',
        'sdk_gphone',
        'sdk',
        'vbox',
        'emulator',
      ];
      
      try {
        for (final prop in properties) {
          final result = await Process.run('getprop', [prop]);
          final value = result.stdout.toString().toLowerCase();
          
          for (final signature in emulatorSignatures) {
            if (value.contains(signature)) {
              return true;
            }
          }
        }
      } catch (e) {
        // Ignorer les erreurs
      }
      
      // Vérifier les caractéristiques du téléphone
      // comme la présence d'une batterie, IMEI, etc.
      
      return false;
    } else if (Platform.isIOS) {
      // Vérifier les simulateurs iOS
      try {
        final iosInfo = await DeviceInfoPlugin().iosInfo;
        return !iosInfo.isPhysicalDevice;
      } catch (e) {
        return false;
      }
    }
    
    return false;
  }
  
  Future<bool> _hasScreenOverlays() async {
    // Vérification des overlays Android
    // Nécessite des permissions spécifiques
    return false; // Placeholder
  }
  
  Future<bool> _hasScreenCapturingApps() async {
    // Vérification des applications de capture d'écran
    return false; // Placeholder
  }
  
  SecurityRiskLevel _calculateRiskLevel(List<SecurityIssue> issues) {
    if (issues.contains(SecurityIssue.rootedDevice) || 
        issues.contains(SecurityIssue.debuggerAttached)) {
      return SecurityRiskLevel.high;
    } else if (issues.isNotEmpty) {
      return SecurityRiskLevel.medium;
    } else {
      return SecurityRiskLevel.low;
    }
  }
}

enum SecurityIssue {
  rootedDevice,
  debuggerAttached,
  emulatorDetected,
  screenOverlayDetected,
  screenCaptureRisk,
}

enum SecurityRiskLevel {
  low,
  medium,
  high,
}

class SecurityStatus {
  final bool secure;
  final List<SecurityIssue> issues;
  final SecurityRiskLevel riskLevel;
  
  SecurityStatus({
    required this.secure,
    required this.issues,
    required this.riskLevel,
  });
}
```

#### 2.3.2 Mode de sécurité restrictif

En cas de détection d'un appareil compromis, l'application peut passer en mode de sécurité restrictif :

- Limitation des opérations sensibles (transactions, modifications de paramètres)
- Notification à l'utilisateur des risques
- Options pour sécuriser le compte (changement de PIN, déconnexion des appareils)
- Journalisation renforcée pour l'audit de sécurité

## 3. Protection des données utilisateur

### 3.1 Chiffrement des données au repos

Toutes les données sensibles stockées localement sont chiffrées :

1. **Base de données locale** : Chiffrement SQLCipher ou Hive avec chiffrement
2. **Préférences utilisateur** : Chiffrement des préférences sensibles
3. **Fichiers temporaires** : Chiffrement et nettoyage régulier
4. **Cache** : Minimisation des données sensibles mises en cache

#### 3.1.1 Implémentation du chiffrement de la base de données

```dart
class SecureDatabase {
  Database? _database;
  final CryptoService _cryptoService;
  final SecureStorage _secureStorage;
  
  Future<void> initialize() async {
    // Récupérer ou générer la clé de chiffrement de la base de données
    String? encryptionKey = await _secureStorage.read(key: 'db_encryption_key');
    
    if (encryptionKey == null) {
      // Générer une nouvelle clé aléatoire
      final key = await _cryptoService.generateSecureRandomKey(32);
      encryptionKey = base64Url.encode(key);
      await _secureStorage.write(key: 'db_encryption_key', value: encryptionKey);
    }
    
    // Configurer la base de données chiffrée (SQLCipher)
    _database = await openDatabase(
      'etika_secure.db',
      version: 1,
      onCreate: _createTables,
      password: encryptionKey, // Clé de chiffrement pour SQLCipher
    );
  }
  
  Future<void> _createTables(Database db, int version) async {
    // Créer les tables de la base de données
    await db.execute('''
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        merchant_id TEXT NOT NULL,
        amount REAL NOT NULL,
        tokens_activated INTEGER NOT NULL,
        status TEXT NOT NULL,
        receipt_hash TEXT,
        blockchain_tx TEXT,
        encrypted_details TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
    
    await db.execute('''
      CREATE TABLE tokens (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        value REAL NOT NULL,
        activation_date TEXT,
        expiry_date TEXT,
        source_transaction TEXT,
        encrypted_metadata TEXT,
        created_at TEXT NOT NULL
      )
    ''');
    
    // Autres tables...
  }
  
  // Méthodes CRUD sécurisées avec chiffrement additionnel pour les données sensibles
  Future<int> insertTransaction(Transaction transaction) async {
    if (_database == null) {
      await initialize();
    }
    
    // Chiffrer les détails sensibles de la transaction
    final encryptedDetails = await _encryptSensitiveData(transaction.details);
    
    return await _database!.insert('transactions', {
      'id': transaction.id,
      'date': transaction.date.toIso8601String(),
      'merchant_id': transaction.merchantId,
      'amount': transaction.amount,
      'tokens_activated': transaction.tokensActivated,
      'status': transaction.status.toString(),
      'receipt_hash': transaction.receiptHash,
      'blockchain_tx': transaction.blockchainTx,
      'encrypted_details': encryptedDetails,
      'created_at': DateTime.now().toIso8601String(),
      'updated_at': DateTime.now().toIso8601String(),
    });
  }
  
  Future<Transaction?> getTransaction(String id) async {
    if (_database == null) {
      await initialize();
    }
    
    final maps = await _database!.query(
      'transactions',
      where: 'id = ?',
      whereArgs: [id],
    );
    
    if (maps.isEmpty) {
      return null;
    }
    
    final map = maps.first;
    
    // Déchiffrer les détails sensibles
    final decryptedDetails = await _decryptSensitiveData(map['encrypted_details'] as String);
    
    return Transaction(
      id: map['id'] as String,
      date: DateTime.parse(map['date'] as String),
      merchantId: map['merchant_id'] as String,
      amount: map['amount'] as double,
      tokensActivated: map['tokens_activated'] as int,
      status: TransactionStatus.values.firstWhere(
        (e) => e.toString() == map['status'],
      ),
      receiptHash: map['receipt_hash'] as String?,
      blockchainTx: map['blockchain_tx'] as String?,
      details: decryptedDetails,
    );
  }
  
  // Méthodes pour chiffrer/déchiffrer les données sensibles
  Future<String> _encryptSensitiveData(Map<String, dynamic> data) async {
    final key = await _getEncryptionKey();
    final jsonData = json.encode(data);
    final encrypted = await _cryptoService.encryptAES(jsonData, key);
    return encrypted;
  }
  
  Future<Map<String, dynamic>> _decryptSensitiveData(String encryptedData) async {
    final key = await _getEncryptionKey();
    final decrypted = await _cryptoService.decryptAES(encryptedData, key);
    return json.decode(decrypted) as Map<String, dynamic>;
  }
  
  Future<Uint8List> _getEncryptionKey() async {
    final encryptionKey = await _secureStorage.read(key: 'db_encryption_key');
    if (encryptionKey == null) {
      throw SecurityException('Clé de chiffrement de base de données non trouvée');
    }
    return base64Url.decode(encryptionKey);
  }
  
  // Méthodes de nettoyage et de maintenance
  Future<void> secureDeleteOldData() async {
    if (_database == null) {
      await initialize();
    }
    
    // Supprimer les transactions anciennes (plus de 90 jours)
    final cutoffDate = DateTime.now().subtract(Duration(days: 90)).toIso8601String();
    
    await _database!.delete(
      'transactions',
      where: 'date < ? AND status = ?',
      whereArgs: [cutoffDate, TransactionStatus.completed.toString()],
    );
    
    // Supprimer les tokens expirés
    await _database!.delete(
      'tokens',
      where: 'expiry_date < ? AND status = ?',
      whereArgs: [DateTime.now().toIso8601String(), 'expired'],
    );
    
    // Optimiser la base de données (VACUUM)
    await _database!.execute('VACUUM');
  }
}
```

### 3.2 Minimisation des données

Principes de minimisation des données implémentés :

1. **Collecte limitée** : Uniquement les données strictement nécessaires
2. **Durée de conservation limitée** : Suppression automatique des données anciennes
3. **Anonymisation** : Les données utilisées pour les statistiques sont anonymisées
4. **Contrôle utilisateur** : Interface pour consulter et supprimer ses données

### 3.3 Sécurité des sauvegardes

Mesures pour sécuriser les sauvegardes des données utilisateur :

1. **Chiffrement de bout en bout** des sauvegardes
2. **Code de récupération unique** généré lors de la sauvegarde
3. **Validation multi-facteurs** pour la restauration
4. **Expiration automatique** des sauvegardes non utilisées

## 4. Sécurisation des communications

### 4.1 Sécurité du transport

#### 4.1.1 HTTPS avec certificate pinning

```dart
class SecureHttpClient {
  final Dio _dio;
  final List<String> _pinnedCertificates;
  final ConnectivityService _connectivity;
  
  SecureHttpClient({
    required List<String> pinnedCertificates,
    required ConnectivityService connectivity,
  }) : _pinnedCertificates = pinnedCertificates,
       _connectivity = connectivity,
       _dio = Dio() {
    _configureClient();
  }
  
  void _configureClient() {
    // Configuration TLS
    (_dio.httpClientAdapter as DefaultHttpClientAdapter).onHttpClientCreate = (client) {
      client.badCertificateCallback = (X509Certificate cert, String host, int port) {
        return _validateCertificate(cert, host);
      };
      
      // Configurer les versions TLS acceptées (TLS 1.2+ uniquement)
      final context = SecurityContext.defaultContext;
      
      // Configurer les chiffrements acceptés (liste des chiffrements forts)
      // Ceci est spécifique à l'implémentation et peut nécessiter des plugins natifs
      
      return client;
    };
    
    // Configuration des timeouts
    _dio.options.connectTimeout = 10000; // 10 secondes
    _dio.options.receiveTimeout = 30000; // 30 secondes
    
    // Intercepteurs pour la journalisation, l'authentification, etc.
    _dio.interceptors.add(LogInterceptor(
      requestBody: false, // Ne pas journaliser les corps de requête (données sensibles)
      responseBody: false, // Ne pas journaliser les corps de réponse (données sensibles)
      error: true,
    ));
    
    _dio.interceptors.add(_createRetryInterceptor());
  }
  
  bool _validateCertificate(X509Certificate cert, String host) {
    // Calculer l'empreinte du certificat
    final fingerprint = _calculateSHA256Fingerprint(cert);
    
    // Vérifier si l'empreinte est dans la liste des certificats épinglés
    return _pinnedCertificates.contains(fingerprint);
  }
  
  String _calculateSHA256Fingerprint(X509Certificate cert) {
    final digest = sha256.convert(cert.der);
    return digest.toString();
  }
  
  Interceptor _createRetryInterceptor() {
    return InterceptorsWrapper(
      onError: (DioError e, ErrorInterceptorHandler handler) async {
        if (_shouldRetry(e)) {
          try {
            // Attendre que la connectivité soit restaurée
            await _waitForConnectivity();
            
            // Recréer la requête
            final options = e.requestOptions;
            final response = await _dio.request(
              options.path,
              data: options.data,
              queryParameters: options.queryParameters,
              options: Options(
                method: options.method,
                headers: options.headers,
                responseType: options.responseType,
                contentType: options.contentType,
              ),
            );
            
            return handler.resolve(response);
          } catch (retryError) {
            return handler.next(e);
          }
        }
        return handler.next(e);
      },
    );
  }
  
  bool _shouldRetry(DioError error) {
    // Retry on connection errors and server errors (5xx)
    return error.type == DioErrorType.connectionTimeout ||
           error.type == DioErrorType.receiveTimeout ||
           error.type == DioErrorType.sendTimeout ||
           (error.response?.statusCode != null && 
            error.response!.statusCode! >= 500 && 
            error.response!.statusCode! < 600);
  }
  
  Future<void> _waitForConnectivity() async {
    if (!await _connectivity.isConnected()) {
      // Wait for connectivity to be restored
      await _connectivity.onConnected().first;
      // Add a small delay to ensure the connection is stable
      await Future.delayed(Duration(milliseconds: 500));
    }
  }
  
  // HTTP methods with security validations
  Future<Response> get(String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    bool secure = true,
  }) async {
    if (secure && !await _preRequestSecurityCheck()) {
      throw SecurityException('Environnement non sécurisé détecté');
    }
    
    return _dio.get(
      path,
      queryParameters: queryParameters,
      options: options,
    );
  }
  
  Future<Response> post(String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    bool secure = true,
  }) async {
    if (secure && !await _preRequestSecurityCheck()) {
      throw SecurityException('Environnement non sécurisé détecté');
    }
    
    return _dio.post(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }
  
  // Additional HTTP methods...
  
  Future<bool> _preRequestSecurityCheck() async {
    // Verify device security status before making sensitive requests
    final securityChecker = DeviceSecurityChecker();
    final status = await securityChecker.checkDeviceSecurity();
    
    // Block high-risk environments for secure requests
    return status.riskLevel != SecurityRiskLevel.high;
  }
}
```

#### 4.1.2 Protections supplémentaires

- Validation des redirections HTTP pour prévenir les attaques par redirection
- Validation stricte des noms d'hôtes
- Timeouts configurables pour limiter l'exposition
- Blocage des requêtes mixtes (HTTP/HTTPS)

### 4.2 Signature des transactions

Toutes les transactions sont signées numériquement pour garantir leur authenticité :

```dart
class TransactionSigner {
  final CryptoService _cryptoService;
  final SecureKeyManager _keyManager;
  
  TransactionSigner(this._cryptoService, this._keyManager);
  
  Future<SignedTransaction> signTransaction(Transaction transaction, String pin) async {
    // Récupérer la clé privée (protégée par PIN et biométrie)
    final privateKey = await _keyManager.getPrivateKey(pin);
    if (privateKey == null) {
      throw SecurityException('Clé privée non disponible');
    }
    
    // Créer un hash de la transaction
    final transactionData = _serializeTransaction(transaction);
    final transactionHash = await _cryptoService.sha256(transactionData);
    
    // Signer le hash avec la clé privée
    final signature = await _cryptoService.sign(transactionHash, privateKey);
    
    return SignedTransaction(
      transaction: transaction,
      signature: signature,
      hash: transactionHash,
      signingTime: DateTime.now().toUtc(),
    );
  }
  
  Future<bool> verifyTransaction(SignedTransaction signedTransaction) async {
    // Récupérer la clé publique associée à l'utilisateur
    final publicKey = await _keyManager.getPublicKey();
    
    // Recalculer le hash de la transaction
    final transactionData = _serializeTransaction(signedTransaction.transaction);
    final calculatedHash = await _cryptoService.sha256(transactionData);
    
    // Vérifier que le hash correspond
    if (calculatedHash != signedTransaction.hash) {
      return false;
    }
    
    // Vérifier la signature
    return await _cryptoService.verify(
      signedTransaction.hash,
      signedTransaction.signature,
      publicKey,
    );
  }
  
  Uint8List _serializeTransaction(Transaction transaction) {
    // Sérialisation déterministe de la transaction
    final buffer = ByteData(1024); // Taille initiale
    int offset = 0;
    
    // Écrire les champs dans un ordre fixe
    offset = _writeString(buffer, offset, transaction.id);
    offset = _writeString(buffer, offset, transaction.merchantId);
    offset = _writeDouble(buffer, offset, transaction.amount);
    offset = _writeInt(buffer, offset, transaction.tokensActivated);
    offset = _writeString(buffer, offset, transaction.date.toUtc().toIso8601String());
    // Écrire d'autres champs...
    
    return buffer.buffer.asUint8List(0, offset);
  }
  
  int _writeString(ByteData buffer, int offset, String value) {
    final bytes = utf8.encode(value);
    buffer.setUint16(offset, bytes.length, Endian.big);
    offset += 2;
    
    for (int i = 0; i < bytes.length; i++) {
      buffer.setUint8(offset + i, bytes[i]);
    }
    
    return offset + bytes.length;
  }
  
  int _writeInt(ByteData buffer, int offset, int value) {
    buffer.setInt32(offset, value, Endian.big);
    return offset + 4;
  }
  
  int _writeDouble(ByteData buffer, int offset, double value) {
    buffer.setFloat64(offset, value, Endian.big);
    return offset + 8;
  }
}

class SignedTransaction {
  final Transaction transaction;
  final String signature;
  final String hash;
  final DateTime signingTime;
  
  SignedTransaction({
    required this.transaction,
    required this.signature,
    required this.hash,
    required this.signingTime,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'transaction': transaction.toJson(),
      'signature': signature,
      'hash': hash,
      'signingTime': signingTime.toUtc().toIso8601String(),
    };
  }
  
  factory SignedTransaction.fromJson(Map<String, dynamic> json) {
    return SignedTransaction(
      transaction: Transaction.fromJson(json['transaction']),
      signature: json['signature'],
      hash: json['hash'],
      signingTime: DateTime.parse(json['signingTime']),
    );
  }
}
```

### 4.3 WebSockets sécurisés

Pour les communications en temps réel, des WebSockets sécurisés sont utilisés :

```dart
class SecureWebSocketService {
  WebSocketChannel? _channel;
  final String _baseUrl;
  final AuthService _authService;
  final SecureStorage _secureStorage;
  Timer? _heartbeatTimer;
  StreamController<dynamic> _messagesController = StreamController.broadcast();
  
  SecureWebSocketService(this._baseUrl, this._authService, this._secureStorage);
  
  Stream<dynamic> get messages => _messagesController.stream;
  
  Future<void> connect() async {
    if (_channel != null) {
      await disconnect();
    }
    
    // Récupérer le token JWT
    final token = await _authService.getAccessToken();
    if (token == null) {
      throw AuthException('Non authentifié');
    }
    
    // Connexion WebSocket sécurisée avec token d'authentification
    final wsUrl = Uri.parse('$_baseUrl/ws?token=$token');
    _channel = WebSocketChannel.connect(wsUrl);
    
    // Écouter les messages
    _channel!.stream.listen(
      (message) {
        // Vérifier et traiter le message
        _processMessage(message);
      },
      onError: (error) {
        _messagesController.addError(error);
        _reconnect();
      },
      onDone: () {
        _reconnect();
      },
    );
    
    // Démarrer le heartbeat
    _startHeartbeat();
  }
  
  Future<void> disconnect() async {
    _stopHeartbeat();
    await _channel?.sink.close();
    _channel = null;
  }
  
  void send(Map<String, dynamic> data) {
    if (_channel == null) {
      throw WebSocketException('Non connecté');
    }
    
    // Ajouter un ID de message unique et un timestamp
    final message = {
      ...data,
      'messageId': _generateMessageId(),
      'timestamp': DateTime.now().toUtc().toIso8601String(),
    };
    
    // Envoyer le message au format JSON
    _channel!.sink.add(jsonEncode(message));
  }
  
  void _processMessage(dynamic message) {
    try {
      // Décoder le message JSON
      final data = jsonDecode(message as String);
      
      // Vérifier le type de message
      if (data['type'] == 'heartbeat') {
        // Répondre au heartbeat
        send({'type': 'heartbeat_ack'});
        return;
      }
      
      // Ajouter le message au stream
      _messagesController.add(data);
    } catch (e) {
      // Ignorer les messages malformés
      print('Message WebSocket malformé: $e');
    }
  }
  
  void _startHeartbeat() {
    _heartbeatTimer = Timer.periodic(Duration(seconds: 30), (timer) {
      if (_channel != null) {
        send({'type': 'heartbeat'});
      }
    });
  }
  
  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }
  
  Future<void> _reconnect() async {
    await disconnect();
    
    // Attendre avant de tenter une reconnexion
    await Future.delayed(Duration(seconds: 5));
    
    try {
      await connect();
    } catch (e) {
      // Échec de reconnexion, réessayer plus tard
      Future.delayed(Duration(seconds: 30), _reconnect);
    }
  }
  
  String _generateMessageId() {
    final random = Random.secure();
    final values = List<int>.generate(16, (i) => random.nextInt(256));
    return base64Url.encode(values);
  }
}
```

## 5. Détection et prévention des fraudes

### 5.1 Système d'analyse de transactions

```dart
class FraudDetectionService {
  final TransactionRepository _transactionRepository;
  final TokenRepository _tokenRepository;
  final DeviceSecurityService _deviceSecurity;
  
  FraudDetectionService(
    this._transactionRepository,
    this._tokenRepository,
    this._deviceSecurity,
  );
  
  Future<FraudRiskAssessment> assessTransactionRisk(Transaction transaction) async {
    // Vérifier le niveau de sécurité de l'appareil
    final deviceStatus = await _deviceSecurity.checkDeviceSecurity();
    
    // Points de risque initiaux basés sur la sécurité de l'appareil
    int riskScore = _calculateDeviceRiskScore(deviceStatus);
    List<FraudRiskFactor> riskFactors = [];
    
    // Analyse du comportement de l'utilisateur
    final userBehavior = await _analyzeUserBehavior(transaction.userId);
    riskScore += userBehavior.riskScore;
    riskFactors.addAll(userBehavior.riskFactors);
    
    // Vérification des anomalies de transaction
    final transactionAnomalies = await _detectTransactionAnomalies(transaction);
    riskScore += transactionAnomalies.riskScore;
    riskFactors.addAll(transactionAnomalies.riskFactors);
    
    // Vérification des patterns temporels
    final temporalPatterns = await _analyzeTemporalPatterns(transaction);
    riskScore += temporalPatterns.riskScore;
    riskFactors.addAll(temporalPatterns.riskFactors);
    
    // Déterminer le niveau de risque global
    FraudRiskLevel riskLevel;
    if (riskScore < 30) {
      riskLevel = FraudRiskLevel.low;
    } else if (riskScore < 70) {
      riskLevel = FraudRiskLevel.medium;
    } else {
      riskLevel = FraudRiskLevel.high;
    }
    
    return FraudRiskAssessment(
      riskScore: riskScore,
      riskLevel: riskLevel,
      riskFactors: riskFactors,
      recommendedAction: _determineRecommendedAction(riskLevel, riskFactors),
      assessmentId: _generateAssessmentId(),
      timestamp: DateTime.now(),
    );
  }
  
  int _calculateDeviceRiskScore(SecurityStatus deviceStatus) {
    switch (deviceStatus.riskLevel) {
      case SecurityRiskLevel.low:
        return 0;
      case SecurityRiskLevel.medium:
        return 25;
      case SecurityRiskLevel.high:
        return 50;
    }
  }
  
  Future<RiskAnalysisResult> _analyzeUserBehavior(String userId) async {
    int riskScore = 0;
    List<FraudRiskFactor> riskFactors = [];
    
    // Récupérer l'historique des transactions
    final recentTransactions = await _transactionRepository.getRecentTransactions(
      userId: userId,
      limit: 20,
    );
    
    // Vérifier les changements d'appareil fréquents
    final deviceChanges = _countDeviceChanges(recentTransactions);
    if (deviceChanges > 3) {
      riskScore += 15;
      riskFactors.add(FraudRiskFactor.frequentDeviceChanges);
    }
    
    // Vérifier les transactions à haute fréquence
    final transactionFrequency = _calculateTransactionFrequency(recentTransactions);
    if (transactionFrequency > 10) { // Plus de 10 transactions par heure
      riskScore += 10;
      riskFactors.add(FraudRiskFactor.highTransactionFrequency);
    }
    
    // Vérifier l'activation soudaine de tokens en latence
    final tokenActivationRate = await _calculateTokenActivationRate(userId);
    if (tokenActivationRate > 0.8) { // Plus de 80% des tokens activés rapidement
      riskScore += 20;
      riskFactors.add(FraudRiskFactor.suddenTokenActivation);
    }
    
    return RiskAnalysisResult(riskScore, riskFactors);
  }
  
  Future<RiskAnalysisResult> _detectTransactionAnomalies(Transaction transaction) async {
    int riskScore = 0;
    List<FraudRiskFactor> riskFactors = [];
    
    // Récupérer le profil commerçant
    final merchantProfile = await _getMerchantProfile(transaction.merchantId);
    
    // Vérifier si le montant est inhabituel pour ce commerçant
    if (_isUnusualAmount(transaction.amount, merchantProfile)) {
      riskScore += 15;
      riskFactors.add(FraudRiskFactor.unusualTransactionAmount);
    }
    
    // Vérifier la localisation (si disponible)
    if (transaction.location != null && merchantProfile.location != null) {
      final distance = _calculateDistance(
        transaction.location!,
        merchantProfile.location!,
      );
      
      if (distance > 1.0) { // Plus d'1 km de différence
        riskScore += 30;
        riskFactors.add(FraudRiskFactor.locationMismatch);
      }
    }
    
    // Vérifier le rapport tokens/montant
    final tokenRatio = transaction.tokensActivated / transaction.amount;
    if (tokenRatio > merchantProfile.averageTokenRatio * 1.5) {
      riskScore += 20;
      riskFactors.add(FraudRiskFactor.unusualTokenRatio);
    }
    
    return RiskAnalysisResult(riskScore, riskFactors);
  }
  
  Future<RiskAnalysisResult> _analyzeTemporalPatterns(Transaction transaction) async {
    int riskScore = 0;
    List<FraudRiskFactor> riskFactors = [];
    
    // Récupérer les transactions récentes
    final recentTransactions = await _transactionRepository.getRecentTransactions(
      userId: transaction.userId,
      limit: 10,
    );
    
    if (recentTransactions.isNotEmpty) {
      // Vérifier si la transaction est effectuée à un moment inhabituel
      final isUnusualTime = _isUnusualTransactionTime(
        transaction.date,
        recentTransactions.map((t) => t.date).toList(),
      );
      
      if (isUnusualTime) {
        riskScore += 10;
        riskFactors.add(FraudRiskFactor.unusualTransactionTime);
      }
      
      // Vérifier la vitesse de déplacement (si les localisations sont disponibles)
      final lastTransaction = recentTransactions.first;
      if (transaction.location != null && 
          lastTransaction.location != null &&
          transaction.date.difference(lastTransaction.date).inMinutes < 30) {
        
        final distance = _calculateDistance(
          transaction.location!,
          lastTransaction.location!,
        );
        
        final timeMinutes = transaction.date.difference(lastTransaction.date).inMinutes;
        final speedKmPerHour = distance / (timeMinutes / 60);
        
        if (speedKmPerHour > 150) { // Déplacement trop rapide (> 150 km/h)
          riskScore += 25;
          riskFactors.add(FraudRiskFactor.impossibleTravelSpeed);
        }
      }
    }
    
    return RiskAnalysisResult(riskScore, riskFactors);
  }
  
  FraudAction _determineRecommendedAction(
      FraudRiskLevel riskLevel, List<FraudRiskFactor> riskFactors) {
    switch (riskLevel) {
      case FraudRiskLevel.low:
        return FraudAction.allow;
      
      case FraudRiskLevel.medium:
        // Vérifier les facteurs de risque spécifiques
        if (riskFactors.contains(FraudRiskFactor.locationMismatch) ||
            riskFactors.contains(FraudRiskFactor.impossibleTravelSpeed)) {
          return FraudAction.additionalVerification;
        }
        return FraudAction.monitor;
      
      case FraudRiskLevel.high:
        if (riskFactors.contains(FraudRiskFactor.deviceTampering) ||
            riskFactors.contains(FraudRiskFactor.knownFraudPattern)) {
          return FraudAction.block;
        }
        return FraudAction.additionalVerification;
    }
  }
  
  String _generateAssessmentId() {
    final random = Random.secure();
    final values = List<int>.generate(16, (i) => random.nextInt(256));
    return 'fraud_assessment_${base64Url.encode(values)}';
  }
  
  // Méthodes d'analyse supplémentaires
  int _countDeviceChanges(List<Transaction> transactions) {
    // Implémentation...
    return 0; // Placeholder
  }
  
  double _calculateTransactionFrequency(List<Transaction> transactions) {
    // Implémentation...
    return 0.0; // Placeholder
  }
  
  Future<double> _calculateTokenActivationRate(String userId) async {
    // Implémentation...
    return 0.0; // Placeholder
  }
  
  Future<MerchantProfile> _getMerchantProfile(String merchantId) async {
    // Implémentation...
    return MerchantProfile(); // Placeholder
  }
  
  bool _isUnusualAmount(double amount, MerchantProfile merchantProfile) {
    // Implémentation...
    return false; // Placeholder
  }
  
  double _calculateDistance(GeoLocation location1, GeoLocation location2) {
    // Implementation using Haversine formula for distance calculation
    // Implémentation...
    return 0.0; // Placeholder
  }
  
  bool _isUnusualTransactionTime(DateTime transactionTime, List<DateTime> userHistory) {
    // Implémentation...
    return false; // Placeholder
  }
}

class RiskAnalysisResult {
  final int riskScore;
  final List<FraudRiskFactor> riskFactors;
  
  RiskAnalysisResult(this.riskScore, this.riskFactors);
}

enum FraudRiskLevel {
  low,
  medium,
  high,
}

enum FraudRiskFactor {
  deviceTampering,
  frequentDeviceChanges,
  highTransactionFrequency,
  suddenTokenActivation,
  unusualTransactionAmount,
  locationMismatch,
  unusualTokenRatio,
  unusualTransactionTime,
  impossibleTravelSpeed,
  knownFraudPattern,
}

enum FraudAction {
  allow,
  monitor,
  additionalVerification,
  block,
}

class FraudRiskAssessment {
  final int riskScore;
  final FraudRiskLevel riskLevel;
  final List<FraudRiskFactor> riskFactors;
  final FraudAction recommendedAction;
  final String assessmentId;
  final DateTime timestamp;
  
  FraudRiskAssessment({
    required this.riskScore,
    required this.riskLevel,
    required this.riskFactors,
    required this.recommendedAction,
    required this.assessmentId,
    required this.timestamp,
  });
}

class MerchantProfile {
  final String id;
  final String name;
  final GeoLocation? location;
  final double averageTransactionAmount;
  final double averageTokenRatio;
  
  MerchantProfile({
    this.id = '',
    this.name = '',
    this.location,
    this.averageTransactionAmount = 0.0,
    this.averageTokenRatio = 0.0,
  });
}

class GeoLocation {
  final double latitude;
  final double longitude;
  
  GeoLocation({
    required this.latitude,
    required this.longitude,
  });
}
```

### 5.2 Vérification des preuves d'achat (PoP)

```dart
class ProofOfPurchaseValidator {
  final CryptoService _cryptoService;
  final MerchantRepository _merchantRepository;
  
  ProofOfPurchaseValidator(this._cryptoService, this._merchantRepository);
  
  Future<PoValidationResult> validateProofOfPurchase(
      ProofOfPurchase pop, Transaction transaction) async {
    // Vérifier la correspondance avec la transaction
    if (pop.transactionId != transaction.id) {
      return PoValidationResult.error(
        PoValidationError.transactionMismatch,
        'L\'identifiant de transaction ne correspond pas',
      );
    }
    
    // Vérifier la fraîcheur (timestamp)
    final currentTime = DateTime.now();
    if (currentTime.difference(pop.timestamp).inMinutes > 15) {
      return PoValidationResult.error(
        PoValidationError.expired,
        'Preuve d\'achat expirée',
      );
    }
    
    // Vérifier selon le type de preuve
    switch (pop.type) {
      case PoType.qrCode:
        return await _validateQrCodePop(pop, transaction);
      
      case PoType.ticket:
        return await _validateReceiptPop(pop, transaction);
      
      case PoType.manual:
        return await _validateManualPop(pop, transaction);
    }
  }
  
  Future<PoValidationResult> _validateQrCodePop(
      ProofOfPurchase pop, Transaction transaction) async {
    try {
      // Décoder les données du QR code
      final qrData = jsonDecode(pop.data) as Map<String, dynamic>;
      
      // Vérifier les champs obligatoires
      if (!qrData.containsKey('merchantId') || 
          !qrData.containsKey('amount') ||
          !qrData.containsKey('timestamp') ||
          !qrData.containsKey('signature')) {
        return PoValidationResult.error(
          PoValidationError.invalidFormat,
          'Format QR code invalide',
        );
      }
      
      // Vérifier la concordance avec la transaction
      if (qrData['merchantId'] != transaction.merchantId) {
        return PoValidationResult.error(
          PoValidationError.merchantMismatch,
          'Identifiant commerçant incorrect',
        );
      }
      
      if ((qrData['amount'] as num).toDouble() != transaction.amount) {
        return PoValidationResult.error(
          PoValidationError.amountMismatch,
          'Montant incorrect',
        );
      }
      
      // Vérifier la signature numérique
      final merchantPublicKey = await _getMerchantPublicKey(transaction.merchantId);
      if (merchantPublicKey == null) {
        return PoValidationResult.error(
          PoValidationError.merchantNotFound,
          'Clé publique du commerçant non trouvée',
        );
      }
      
      // Recréer les données signées
      final signedData = {
        'transactionId': transaction.id,
        'merchantId': qrData['merchantId'],
        'amount': qrData['amount'],
        'timestamp': qrData['timestamp'],
      };
      
      final dataToVerify = jsonEncode(signedData);
      final signature = qrData['signature'] as String;
      
      // Vérifier la signature
      final isValid = await _cryptoService.verifySignature(
        dataToVerify,
        signature,
        merchantPublicKey,
      );
      
      if (!isValid) {
        return PoValidationResult.error(
          PoValidationError.invalidSignature,
          'Signature QR code invalide',
        );
      }
      
      return PoValidationResult.success();
    } catch (e) {
      return PoValidationResult.error(
        PoValidationError.parseError,
        'Erreur d\'analyse des données QR: ${e.toString()}',
      );
    }
  }
  
  Future<PoValidationResult> _validateReceiptPop(
      ProofOfPurchase pop, Transaction transaction) async {
    // Implémentation de la validation de ticket de caisse
    // Analyse OCR, vérification de cohérence, etc.
    return PoValidationResult.success(); // Placeholder
  }
  
  Future<PoValidationResult> _validateManualPop(
      ProofOfPurchase pop, Transaction transaction) async {
    // Implémentation de la validation manuelle
    // Vérification des codes d'autorisation, etc.
    return PoValidationResult.success(); // Placeholder
  }
  
  Future<String?> _getMerchantPublicKey(String merchantId) async {
    final merchant = await _merchantRepository.getMerchantById(merchantId);
    return merchant?.publicKey;
  }
}

enum PoType {
  qrCode,
  ticket,
  manual,
}

enum PoValidationError {
  transactionMismatch,
  merchantMismatch,
  amountMismatch,
  expired,
  invalidFormat,
  invalidSignature,
  merchantNotFound,
  parseError,
  unknownError,
}

class ProofOfPurchase {
  final String transactionId;
  final PoType type;
  final String data;
  final DateTime timestamp;
  
  ProofOfPurchase({
    required this.transactionId,
    required this.type,
    required this.data,
    required this.timestamp,
  });
}

class PoValidationResult {
  final bool isValid;
  final PoValidationError? error;
  final String? errorMessage;
  
  PoValidationResult({
    required this.isValid,
    this.error,
    this.errorMessage,
  });
  
  factory PoValidationResult.success() {
    return PoValidationResult(isValid: true);
  }
  
  factory PoValidationResult.error(PoValidationError error, String message) {
    return PoValidationResult(
      isValid: false,
      error: error,
      errorMessage: message,
    );
  }
}
```

## 6. Mesures de transparence

### 6.1 Journal d'audit immuable

```dart
class AuditLogger {
  final AuditLogRepository _repository;
  final CryptoService _cryptoService;
  final SecureStorage _secureStorage;
  
  AuditLogger(this._repository, this._cryptoService, this._secureStorage);
  
  Future<void> logEvent(AuditEvent event) async {
    // Enrichir l'événement avec des métadonnées
    final enrichedEvent = await _enrichEvent(event);
    
    // Calculer le hash de l'événement précédent
    final previousHash = await _getLastEventHash();
    
    // Créer une entrée de journal chainée
    final logEntry = AuditLogEntry(
      event: enrichedEvent,
      timestamp: DateTime.now().toUtc(),
      previousHash: previousHash,
      entryHash: '', // À calculer
    );
    
    // Calculer le hash de cette entrée
    final entryHash = await _calculateEntryHash(logEntry);
    final finalEntry = logEntry.copyWith(entryHash: entryHash);
    
    // Stocker l'entrée de journal
    await _repository.addLogEntry(finalEntry);
    
    // Mettre à jour le hash du
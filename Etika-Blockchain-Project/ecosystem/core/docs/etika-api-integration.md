# Plan d'Intégration API - Application Mobile Étika

## 1. Vue d'ensemble

Ce document détaille la stratégie d'intégration entre l'application mobile Étika pour les consommateurs et l'API de la plateforme Étika (`etika-platform-api`). Cette intégration est essentielle pour permettre à l'application de communiquer avec l'écosystème blockchain Étika et d'offrir toutes les fonctionnalités nécessaires aux consommateurs.

## 2. Architecture d'intégration

### 2.1 Diagramme d'intégration

```
┌──────────────────┐       ┌──────────────────┐        ┌───────────────────┐
│                  │       │                  │        │                   │
│  Application     │◄─────►│  etika-platform  │◄──────►│  etika-blockchain │
│  Mobile          │       │  -api            │        │  -core            │
│                  │       │                  │        │                   │
└──────────────────┘       └──────────────────┘        └───────────────────┘
       │                           │                           │
       │                           │                           │
       ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐        ┌───────────────────┐
│                  │       │                  │        │                   │
│  Stockage local  │       │  Base de données │        │  Smart Contracts  │
│  (Hive/SQLite)   │       │  Plateforme      │        │                   │
│                  │       │                  │        │                   │
└──────────────────┘       └──────────────────┘        └───────────────────┘
```

### 2.2 Flux de données

1. L'application mobile communique avec `etika-platform-api` via des requêtes REST et WebSockets
2. La plateforme API interagit avec le core blockchain pour les opérations liées aux tokens et transactions
3. Les données sensibles sont stockées localement dans un stockage sécurisé sur l'appareil
4. Les données moins sensibles sont mises en cache localement pour le mode offline

## 3. Points d'intégration API détaillés

### 3.1 API d'authentification et de gestion de compte

| Endpoint | Méthode | Description | Payload | Réponse |
|----------|---------|-------------|---------|---------|
| `/auth/register` | POST | Inscription utilisateur | `{ phone, deviceId }` | `{ userId, verificationId }` |
| `/auth/verify` | POST | Vérification par code SMS | `{ verificationId, code }` | `{ success, tokens }` |
| `/auth/login` | POST | Connexion utilisateur | `{ phone, pin/biometric }` | `{ tokens, user }` |
| `/auth/refresh` | POST | Rafraîchissement de token | `{ refreshToken }` | `{ accessToken }` |
| `/auth/device` | POST | Enregistrement d'appareil | `{ deviceInfo }` | `{ deviceId }` |
| `/user/profile` | GET | Récupération profil | - | `{ userData }` |
| `/user/profile` | PUT | Mise à jour profil | `{ userData }` | `{ success }` |
| `/user/settings` | GET/PUT | Gestion paramètres | `{ settings }` | `{ settings }` |

#### Implémentation côté application

```dart
// Exemple d'implémentation du repository d'authentification
class AuthRepository {
  final ApiService _apiService;
  final SecureStorage _secureStorage;

  Future<User> register(String phone) async {
    final response = await _apiService.post('/auth/register', {
      'phone': phone,
      'deviceId': await _secureStorage.getDeviceId()
    });
    
    return VerificationProcess.fromJson(response);
  }
  
  Future<AuthTokens> verifyCode(String verificationId, String code) async {
    final response = await _apiService.post('/auth/verify', {
      'verificationId': verificationId,
      'code': code
    });
    
    final tokens = AuthTokens.fromJson(response);
    await _secureStorage.saveTokens(tokens);
    return tokens;
  }
  
  // Autres méthodes...
}
```

### 3.2 API de Wallet et Tokens

| Endpoint | Méthode | Description | Payload | Réponse |
|----------|---------|-------------|---------|---------|
| `/wallet/create` | POST | Création portefeuille | `{ userId }` | `{ walletAddress, publicKey }` |
| `/wallet/recover` | POST | Récupération portefeuille | `{ seed, userId }` | `{ walletAddress, success }` |
| `/wallet/balance` | GET | Solde tokens | - | `{ active, latent, total }` |
| `/wallet/transactions` | GET | Historique transactions | `{ page, limit }` | `{ transactions[] }` |
| `/tokens/activate` | POST | Activation tokens | `{ transactionId, proof }` | `{ activatedTokens }` |
| `/tokens/transfer` | POST | Transfert entre utilisateurs | `{ recipient, amount }` | `{ transactionId }` |
| `/tokens/history` | GET | Historique des tokens | `{ tokenType, page }` | `{ history[] }` |

#### Implémentation côté application

```dart
class WalletRepository {
  final ApiService _apiService;
  final SecureStorage _secureStorage;

  Future<WalletBalance> getBalance() async {
    final response = await _apiService.get('/wallet/balance');
    return WalletBalance.fromJson(response);
  }
  
  Future<List<Transaction>> getTransactions({int page = 1, int limit = 20}) async {
    final response = await _apiService.get('/wallet/transactions', queryParams: {
      'page': page.toString(),
      'limit': limit.toString()
    });
    
    return (response['transactions'] as List)
        .map((json) => Transaction.fromJson(json))
        .toList();
  }
  
  Future<ActivationResult> activateTokens(String transactionId, String proof) async {
    // Implementation...
  }
  
  // Autres méthodes...
}
```

### 3.3 API de transactions et PoP

| Endpoint | Méthode | Description | Payload | Réponse |
|----------|---------|-------------|---------|---------|
| `/transaction/init` | POST | Initialisation transaction | `{ merchantId, amount }` | `{ transactionId, qrData }` |
| `/transaction/verify` | POST | Vérification QR code | `{ qrData }` | `{ valid, transactionData }` |
| `/transaction/confirm` | POST | Confirmation transaction | `{ transactionId, userId }` | `{ status, rewards }` |
| `/transaction/pop` | POST | Soumission preuve d'achat | `{ transactionId, popData }` | `{ validated, tokens }` |
| `/transaction/receipt` | GET | Récupération ticket numérique | `{ transactionId }` | `{ receiptData }` |
| `/transaction/status` | GET | Statut transaction | `{ transactionId }` | `{ status, details }` |

#### Implémentation côté application

```dart
class TransactionRepository {
  final ApiService _apiService;
  final PopValidator _popValidator;

  Future<QrVerificationResult> verifyQrCode(String qrData) async {
    // Vérification locale préliminaire
    if (!_popValidator.isValidQrFormat(qrData)) {
      return QrVerificationResult(valid: false, error: 'Format QR invalide');
    }
    
    try {
      final response = await _apiService.post('/transaction/verify', {
        'qrData': qrData
      });
      
      return QrVerificationResult.fromJson(response);
    } catch (e) {
      // Gestion du mode offline
      if (e is ConnectionException) {
        final localVerification = await _popValidator.verifyOffline(qrData);
        return QrVerificationResult(
          valid: localVerification.isValid,
          transactionData: localVerification.data,
          offlineMode: true
        );
      }
      rethrow;
    }
  }
  
  Future<TransactionConfirmation> confirmTransaction(
      String transactionId, String userId) async {
    // Implementation avec gestion offline...
  }
  
  // Autres méthodes...
}
```

### 3.4 API de gestion de l'épargne (Consumer Fund)

| Endpoint | Méthode | Description | Payload | Réponse |
|----------|---------|-------------|---------|---------|
| `/fund/balance` | GET | Solde épargne | - | `{ total, longTerm, projects }` |
| `/fund/history` | GET | Historique de l'épargne | `{ period }` | `{ history[] }` |
| `/fund/projects` | GET | Liste projets personnels | - | `{ projects[] }` |
| `/fund/projects` | POST | Création projet personnel | `{ name, target, description }` | `{ projectId }` |
| `/fund/allocate` | PUT | Allocation épargne projets | `{ projectId, amount }` | `{ success, newBalance }` |
| `/fund/forecast` | GET | Prévisions d'épargne | `{ months }` | `{ forecast[] }` |
| `/fund/benefits` | GET | Avantages disponibles | - | `{ benefits[] }` |

#### Implémentation côté application

```dart
class ConsumerFundRepository {
  final ApiService _apiService;
  
  Future<FundBalance> getBalance() async {
    final response = await _apiService.get('/fund/balance');
    return FundBalance.fromJson(response);
  }
  
  Future<List<FundHistoryEntry>> getHistory(String period) async {
    final response = await _apiService.get('/fund/history', queryParams: {
      'period': period
    });
    
    return (response['history'] as List)
        .map((json) => FundHistoryEntry.fromJson(json))
        .toList();
  }
  
  Future<bool> allocateToProject(String projectId, double amount) async {
    final response = await _apiService.put('/fund/allocate', {
      'projectId': projectId,
      'amount': amount
    });
    
    return response['success'] as bool;
  }
  
  // Autres méthodes...
}
```

## 4. Stratégies d'intégration

### 4.1 Gestion de la synchronisation

Pour assurer une expérience utilisateur fluide même en cas de connectivité limitée, nous implémentons une stratégie de synchronisation sophistiquée :

#### 4.1.1 Queue de synchronisation

```dart
class SyncQueue {
  final _queue = <SyncOperation>[];
  final ApiService _apiService;
  final LocalDatabase _localDb;
  bool _isSyncing = false;
  
  Future<void> addOperation(SyncOperation operation) async {
    // Ajouter à la file d'attente locale
    await _localDb.saveOperation(operation);
    _queue.add(operation);
    
    // Tenter la synchronisation si possible
    _processSyncQueue();
  }
  
  Future<void> _processSyncQueue() async {
    if (_isSyncing || _queue.isEmpty || !await _apiService.isConnected()) {
      return;
    }
    
    _isSyncing = true;
    
    try {
      while (_queue.isNotEmpty) {
        final operation = _queue.first;
        final success = await _performSync(operation);
        
        if (success) {
          _queue.removeAt(0);
          await _localDb.removeOperation(operation.id);
        } else if (!await _apiService.isConnected()) {
          // Connexion perdue, arrêter la synchronisation
          break;
        } else {
          // Échec pour une autre raison, passer à l'opération suivante
          // et remettre celle-ci à la fin de la file
          _queue.removeAt(0);
          _queue.add(operation);
        }
      }
    } finally {
      _isSyncing = false;
    }
  }
  
  Future<bool> _performSync(SyncOperation operation) async {
    // Logique de synchronisation selon le type d'opération
    switch (operation.type) {
      case SyncOperationType.confirmTransaction:
        return await _syncTransactionConfirmation(operation);
      case SyncOperationType.activateTokens:
        return await _syncTokenActivation(operation);
      // Autres cas...
    }
  }
  
  // Méthodes spécifiques de synchronisation...
}
```

#### 4.1.2 Stratégie de mise en cache

```dart
class ApiCache {
  final LocalDatabase _localDb;
  final Duration _defaultExpiration;
  
  Future<T?> getCachedData<T>(String key) async {
    final cached = await _localDb.getCacheEntry(key);
    
    if (cached != null && !_isExpired(cached.timestamp, cached.expiration)) {
      return cached.data as T;
    }
    
    return null;
  }
  
  Future<void> setCachedData<T>(
      String key, T data, {Duration? expiration}) async {
    final entry = CacheEntry(
      key: key,
      data: data,
      timestamp: DateTime.now(),
      expiration: expiration ?? _defaultExpiration
    );
    
    await _localDb.saveCacheEntry(entry);
  }
  
  bool _isExpired(DateTime timestamp, Duration expiration) {
    return DateTime.now().difference(timestamp) > expiration;
  }
}
```

### 4.2 Sécurité des communications

#### 4.2.1 Certificate Pinning

```dart
class SecureApiClient {
  final Dio _dio;
  final List<String> _validCertificateFingerprints;
  
  SecureApiClient(this._dio, this._validCertificateFingerprints) {
    _dio.httpClientAdapter = IOHttpClientAdapter(
      createHttpClient: () {
        final client = HttpClient();
        client.badCertificateCallback = _validateCertificate;
        return client;
      }
    );
  }
  
  bool _validateCertificate(X509Certificate cert, String host, int port) {
    final fingerprint = _calculateSHA256Fingerprint(cert.der);
    return _validCertificateFingerprints.contains(fingerprint);
  }
  
  String _calculateSHA256Fingerprint(List<int> der) {
    final digest = sha256.convert(der);
    return digest.toString();
  }
}
```

#### 4.2.2 JWT Authentication

```dart
class JwtAuthInterceptor extends Interceptor {
  final SecureStorage _secureStorage;
  final AuthRepository _authRepository;
  final Dio _dio;
  
  @override
  Future<void> onRequest(
      RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _secureStorage.getAccessToken();
    
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    
    return handler.next(options);
  }
  
  @override
  Future<void> onError(DioError err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      if (await _refreshToken()) {
        // Retry with new token
        final request = err.requestOptions;
        final token = await _secureStorage.getAccessToken();
        request.headers['Authorization'] = 'Bearer $token';
        
        try {
          final response = await _dio.fetch(request);
          return handler.resolve(response);
        } catch (e) {
          return handler.reject(err);
        }
      }
    }
    
    return handler.next(err);
  }
  
  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await _secureStorage.getRefreshToken();
      if (refreshToken == null) return false;
      
      final newTokens = await _authRepository.refreshToken(refreshToken);
      await _secureStorage.saveTokens(newTokens);
      return true;
    } catch (e) {
      // Token refresh failed
      await _secureStorage.clearTokens();
      return false;
    }
  }
}
```

## 5. Stratégies d'optimisation

### 5.1 Requêtes groupées et pagination

Pour optimiser les performances et la consommation de données, l'application implémente des stratégies de requêtes groupées et de pagination :

```dart
class OptimizedRepository<T> {
  final ApiService _apiService;
  final String _endpoint;
  final T Function(Map<String, dynamic>) _fromJson;
  
  Future<PaginatedResult<T>> getItems({
    required int page,
    required int pageSize,
    Map<String, String>? filters
  }) async {
    final queryParams = {
      'page': page.toString(),
      'limit': pageSize.toString(),
      ...?filters
    };
    
    final response = await _apiService.get(_endpoint, queryParams: queryParams);
    
    return PaginatedResult(
      items: (response['items'] as List).map((json) => _fromJson(json)).toList(),
      totalItems: response['totalItems'],
      totalPages: response['totalPages'],
      currentPage: response['currentPage']
    );
  }
}
```

### 5.2 Lazy Loading et chargement progressif

Pour les écrans avec beaucoup de données, l'application utilise des techniques de chargement progressif :

```dart
class LazyLoadingBloc extends Bloc<LazyLoadEvent, LazyLoadState> {
  final Repository _repository;
  int _currentPage = 1;
  bool _hasReachedEnd = false;
  
  LazyLoadingBloc(this._repository) : super(LazyLoadInitial()) {
    on<LoadItems>(_onLoadItems);
    on<LoadMoreItems>(_onLoadMoreItems);
  }
  
  Future<void> _onLoadItems(
      LoadItems event, Emitter<LazyLoadState> emit) async {
    emit(LazyLoadLoading());
    
    try {
      final result = await _repository.getItems(page: 1, pageSize: 20);
      _currentPage = 1;
      _hasReachedEnd = result.items.length < 20;
      
      emit(LazyLoadSuccess(
        items: result.items,
        hasReachedEnd: _hasReachedEnd
      ));
    } catch (e) {
      emit(LazyLoadFailure(error: e.toString()));
    }
  }
  
  Future<void> _onLoadMoreItems(
      LoadMoreItems event, Emitter<LazyLoadState> emit) async {
    if (_hasReachedEnd || state is! LazyLoadSuccess) return;
    
    final currentState = state as LazyLoadSuccess;
    emit(LazyLoadSuccess(
      items: currentState.items,
      hasReachedEnd: false,
      isLoadingMore: true
    ));
    
    try {
      final nextPage = _currentPage + 1;
      final result = await _repository.getItems(page: nextPage, pageSize: 20);
      
      _currentPage = nextPage;
      _hasReachedEnd = result.items.length < 20;
      
      emit(LazyLoadSuccess(
        items: [...currentState.items, ...result.items],
        hasReachedEnd: _hasReachedEnd
      ));
    } catch (e) {
      emit(LazyLoadSuccess(
        items: currentState.items,
        hasReachedEnd: currentState.hasReachedEnd,
        error: e.toString()
      ));
    }
  }
}
```

## 6. Tests d'intégration

### 6.1 Stratégie de test

Nous mettrons en place une suite complète de tests pour valider l'intégration API :

1. **Tests unitaires** : Validation des repositories et services
2. **Tests d'intégration** : Validation des interactions avec l'API
3. **Tests de Mock** : Validation des comportements en cas d'erreur API
4. **Tests de synchronisation** : Validation du comportement offline/online

### 6.2 Exemples de tests

```dart
void main() {
  group('WalletRepository Tests', () {
    late WalletRepository repository;
    late MockApiService mockApiService;
    
    setUp(() {
      mockApiService = MockApiService();
      repository = WalletRepository(mockApiService, MockSecureStorage());
    });
    
    test('getBalance returns correct balance when API call succeeds', () async {
      // Arrange
      when(mockApiService.get('/wallet/balance')).thenAnswer((_) async => {
        'active': 100,
        'latent': 50,
        'total': 150
      });
      
      // Act
      final result = await repository.getBalance();
      
      // Assert
      expect(result.active, 100);
      expect(result.latent, 50);
      expect(result.total, 150);
    });
    
    test('getBalance throws exception when API call fails', () async {
      // Arrange
      when(mockApiService.get('/wallet/balance'))
          .thenThrow(ApiException('Server error'));
      
      // Act & Assert
      expect(() => repository.getBalance(), throwsA(isA<ApiException>()));
    });
    
    // Autres tests...
  });
}
```

## 7. Plans de contingence

### 7.1 Gestion des erreurs API

L'application implémente une stratégie robuste de gestion des erreurs avec plusieurs niveaux de fallback :

```dart
class ApiErrorHandler {
  final LocalCache _cache;
  
  Future<T> handleApiCall<T>({
    required Future<T> Function() apiCall,
    required Future<T?> Function() getCachedData,
    required String errorMessage,
    bool useCache = true,
    bool forceRefresh = false
  }) async {
    try {
      // En cas de demande de rafraîchissement forcé ou si le cache n'est pas utilisé
      if (forceRefresh || !useCache) {
        return await apiCall();
      }
      
      // Essayer d'obtenir les données en cache d'abord
      final cachedData = await getCachedData();
      
      // Si nous avons des données en cache, lancer l'appel API en arrière-plan
      // pour mettre à jour le cache et retourner immédiatement les données en cache
      if (cachedData != null) {
        apiCall().then((freshData) => _updateCache(freshData));
        return cachedData;
      }
      
      // Si pas de cache, faire l'appel API
      return await apiCall();
    } on ConnectivityException {
      // En cas d'erreur de connectivité, essayer d'utiliser le cache
      final cachedData = await getCachedData();
      if (cachedData != null) {
        return cachedData;
      }
      
      throw NoConnectivityException(
        'Pas de connexion internet et aucune donnée en cache disponible');
    } on ApiException catch (e) {
      // En cas d'erreur API, essayer d'utiliser le cache
      final cachedData = await getCachedData();
      if (cachedData != null) {
        return cachedData;
      }
      
      throw ApiException('$errorMessage: ${e.message}');
    } catch (e) {
      throw UnexpectedException('Une erreur inattendue est survenue: $e');
    }
  }
  
  Future<void> _updateCache<T>(T data) async {
    // Logique de mise à jour du cache
  }
}
```

### 7.2 Stratégie de repli en mode offline

Pour assurer une continuité de service même en cas de perte de connexion :

```dart
class OfflineManager {
  final ConnectivityService _connectivity;
  final SyncQueue _syncQueue;
  final LocalDatabase _localDb;
  
  Stream<ConnectivityStatus> get connectivityStream => 
      _connectivity.statusStream;
  
  Future<bool> isOnline() => _connectivity.isConnected();
  
  Future<void> enqueueOperation(SyncOperation operation) async {
    await _syncQueue.addOperation(operation);
  }
  
  Future<void> syncWhenOnline() async {
    await for (final status in connectivityStream) {
      if (status == ConnectivityStatus.online) {
        await _syncQueue.startSync();
      }
    }
  }
  
  Future<T> performCriticalOperation<T>({
    required Future<T> Function() onlineOperation,
    required Future<T> Function() offlineOperation
  }) async {
    if (await isOnline()) {
      try {
        return await onlineOperation();
      } catch (e) {
        if (e is ConnectivityException) {
          return await offlineOperation();
        }
        rethrow;
      }
    } else {
      return await offlineOperation();
    }
  }
}
```

## 8. Sécurité et conformité

### 8.1 Chiffrement des données

Toutes les données sensibles stockées localement sont chiffrées :

```dart
class SecureStorage {
  final FlutterSecureStorage _secureStorage;
  final Encrypter _encrypter;
  
  Future<void> saveSecureData(String key, String value) async {
    final encrypted = _encrypter.encrypt(value);
    await _secureStorage.write(key: key, value: encrypted.base64);
  }
  
  Future<String?> getSecureData(String key) async {
    final encrypted = await _secureStorage.read(key: key);
    if (encrypted == null) return null;
    
    try {
      final decrypted = _encrypter.decrypt64(encrypted);
      return decrypted;
    } catch (e) {
      // Données corrompues ou clé invalide
      await _secureStorage.delete(key: key);
      return null;
    }
  }
  
  Future<void> clearAllSecureData() async {
    await _secureStorage.deleteAll();
  }
}
```

### 8.2 Protection des clés privées

La gestion des clés privées est cruciale pour la sécurité de l'application :

```dart
class KeyManager {
  final SecureStorage _secureStorage;
  final BiometricAuth _biometricAuth;
  
  Future<String?> getPrivateKey() async {
    // Exiger l'authentification biométrique avant d'accéder à la clé privée
    final authenticated = await _biometricAuth.authenticate(
      'Authentification requise pour accéder à votre clé privée');
    
    if (!authenticated) {
      throw SecurityException('Authentification biométrique échouée');
    }
    
    return await _secureStorage.getSecureData('private_key');
  }
  
  Future<void> savePrivateKey(String privateKey) async {
    await _secureStorage.saveSecureData('private_key', privateKey);
  }
  
  Future<bool> hasPrivateKey() async {
    final key = await _secureStorage.getSecureData('private_key');
    return key != null;
  }
}
```

## 9. Conclusion

Ce plan d'intégration API fournit un cadre complet pour connecter l'application mobile Étika avec la plateforme backend. L'architecture proposée met l'accent sur :

- Une expérience utilisateur fluide même en conditions réseau limitées
- Une sécurité robuste pour les données sensibles et les transactions
- Des performances optimisées avec mise en cache intelligente
- Une gestion efficace des erreurs et des cas limites

L'implémentation suivra une approche progressive, en commençant par les fonctionnalités essentielles (authentification, wallet, transactions) avant d'ajouter les fonctionnalités complémentaires (épargne, marketplace).

## 10. Annexes

### 10.1 Glossaire des termes techniques

- **JWT (JSON Web Token)** : Standard pour la création de tokens d'accès
- **Certificate Pinning** : Validation des certificats SSL pour prévenir les attaques MitM
- **Synchronisation différée** : Stockage temporaire des opérations pour synchronisation ultérieure
- **PoP (Proof of Purchase)** : Mécanisme de consensus d'Étika basé sur la preuve d'achat

### 10.2 Diagramme de séquence pour la transaction PoP

```
┌────────────┐          ┌────────────┐          ┌────────────┐          ┌────────────┐
│            │          │            │          │            │          │            │
│ Application│          │ etika-     │          │ etika-     │          │ etika-     │
│ Mobile     │          │ platform-  │          │ token-     │          │ blockchain │
│            │          │ api        │          │ system     │          │ -core      │
│            │          │            │          │            │          │            │
└────┬───────┘          └────┬───────┘          └────┬───────┘          └────┬───────┘
     │                       │                       │                       │
     │  Scan QR Code         │                       │                       │
     │───────────────────────│                       │                       │
     │                       │                       │                       │
     │  Verify QR            │                       │                       │
     │───────────────────────▶                       │                       │
     │                       │                       │                       │
     │  QR Verified          │                       │                       │
     │◀───────────────────────                       │                       │
     │                       │                       │                       │
     │  Confirm Transaction  │                       │                       │
     │───────────────────────▶                       │                       │
     │                       │                       │                       │
     │                       │  Validate PoP         │                       │
     │                       │───────────────────────▶                       │
     │                       │                       │                       │
     │                       │                       │  Create Transaction   │
     │                       │                       │───────────────────────▶
     │                       │                       │                       │
     │                       │                       │  Transaction Created  │
     │                       │                       │◀───────────────────────
     │                       │                       │                       │
     │                       │  PoP Validated        │                       │
     │                       │◀───────────────────────                       │
     │                       │                       │                       │
     │  Transaction Complete │                       │                       │
     │◀───────────────────────                       │                       │
     │                       │                       │                       │
     │  Activate Tokens      │                       │                       │
     │───────────────────────▶                       │                       │
     │                       │                       │                       │
     │                       │  Activate User Tokens │                       │
     │                       │───────────────────────▶                       │
     │                       │                       │                       │
     │                       │  Tokens Activated     │                       │
     │                       │◀───────────────────────                       │
     │                       │                       │                       │
     │  Tokens Activated     │                       │                       │
     │◀───────────────────────                       │                       │
     │                       │                       │                       │
```

### 10.3 Format des requêtes d'authentification

#### 10.3.1 Exemple de requête d'inscription

```json
// POST /auth/register
{
  "phone": "+33612345678",
  "deviceId": "eb7c3499-b3a8-4b98-8e71-f12c42431a5b",
  "deviceInfo": {
    "platform": "iOS",
    "version": "15.4",
    "model": "iPhone 13",
    "deviceName": "iPhone de Jean"
  }
}
```

#### 10.3.2 Exemple de réponse d'inscription

```json
{
  "userId": "user_28c7f0a9",
  "verificationId": "ver_3f9d2e71",
  "expiresIn": 300,
  "success": true
}
```

### 10.4 Format des structures de données principales

#### 10.4.1 Structure Transaction

```json
{
  "id": "txn_a7c8e5d2",
  "date": "2025-02-27T15:30:42Z",
  "merchantId": "merchant_b4e9c7a1",
  "merchantName": "Carrefour Mérignac",
  "amount": 78.50,
  "currency": "EUR",
  "tokensActivated": 12,
  "savingsGenerated": 1.57,
  "status": "completed",
  "receiptUrl": "https://api.etika.com/receipts/r_19d7e52c",
  "popType": "qrcode",
  "popValidators": ["user", "merchant"],
  "transactionHash": "0xf7a8e2c5d4b3..."
}
```

#### 10.4.2 Structure Token

```json
{
  "id": "token_e5d9c3b2",
  "status": "active",  // active, latent, burned
  "value": 1.0,
  "activationDate": "2025-02-27T15:32:17Z",
  "expiryDate": "2026-02-27T15:32:17Z",
  "sourceTransaction": "txn_a7c8e5d2",
  "currentOwner": "user_28c7f0a9"
}
```

#### 10.4.3 Structure Consumer Fund

```json
{
  "userId": "user_28c7f0a9",
  "totalSavings": 523.00,
  "longTermSavings": 418.40,
  "projectSavings": 104.60,
  "lastUpdate": "2025-02-27T12:00:00Z",
  "savingsHistory": [
    {
      "date": "2025-01-27",
      "amount": 495.20
    },
    {
      "date": "2025-02-27",
      "amount": 523.00
    }
  ],
  "projects": [
    {
      "id": "proj_3d7c9e1b",
      "name": "Vacances été",
      "target": 500.00,
      "current": 85.30,
      "createdAt": "2024-12-10T09:15:22Z"
    },
    {
      "id": "proj_8e5c2a7b",
      "name": "Nouveau vélo",
      "target": 200.00,
      "current": 19.30,
      "createdAt": "2025-01-05T14:30:45Z"
    }
  ]
}
```

### 10.5 Règles de gestion des erreurs

| Code | Type d'erreur | Gestion client |
|------|--------------|----------------|
| 400 | BadRequest | Afficher message d'erreur, corriger les données |
| 401 | Unauthorized | Forcer la reconnexion |
| 403 | Forbidden | Informer l'utilisateur de droits insuffisants |
| 404 | NotFound | Afficher message "Ressource non trouvée" |
| 409 | Conflict | Résoudre le conflit (p.ex. transaction déjà confirmée) |
| 422 | UnprocessableEntity | Afficher les erreurs de validation |
| 429 | TooManyRequests | Implémenter exponential backoff |
| 500 | ServerError | Réessayer après délai, puis contacter support |
| 503 | ServiceUnavailable | Basculer en mode offline si possible |

#### Format standard des réponses d'erreur

```json
{
  "error": {
    "code": "TRANSACTION_ALREADY_CONFIRMED",
    "status": 409,
    "message": "Cette transaction a déjà été confirmée",
    "details": {
      "transactionId": "txn_a7c8e5d2",
      "confirmedAt": "2025-02-27T15:30:45Z"
    }
  }
}
```

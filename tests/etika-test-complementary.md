# Compléments de Tests pour Étika

Ce document contient les tests complémentaires suggérés par Gemini pour atteindre une couverture de test optimale pour le projet Étika.

## 1. Tests Unitaires Complémentaires

### 1.1 Tests pour createAuction

```javascript
// tests/unit/auction/createAuction.test.js (compléments)

// Test pour catégorie manquante/vide
it('should throw ValidationError if category is missing', async () => {
  // Arrange
  const invalidData = {
    // Category missing
    title: 'Valid Title',
    description: 'Valid description for auction',
    startTime: new Date(Date.now() + 3600000),
    endTime: new Date(Date.now() + 86400000),
    startingPrice: 5000,
    createdBy: new mongoose.Types.ObjectId().toString()
  };
  
  // Act & Assert
  try {
    await auctionSystem.createAuction(invalidData);
    expect.fail('Should have thrown ValidationError');
  } catch (err) {
    expect(err).to.be.instanceOf(ValidationError);
    expect(err.message).to.include('catégorie');
  }
});

it('should throw ValidationError if category is empty', async () => {
  // Arrange
  const invalidData = {
    category: '', // Empty category
    title: 'Valid Title',
    description: 'Valid description for auction',
    startTime: new Date(Date.now() + 3600000),
    endTime: new Date(Date.now() + 86400000),
    startingPrice: 5000,
    createdBy: new mongoose.Types.ObjectId().toString()
  };
  
  // Act & Assert
  try {
    await auctionSystem.createAuction(invalidData);
    expect.fail('Should have thrown ValidationError');
  } catch (err) {
    expect(err).to.be.instanceOf(ValidationError);
    expect(err.message).to.include('catégorie');
  }
});

// Test pour incrément d'enchère négatif/nul
it('should throw ValidationError if minBidIncrement is negative', async () => {
  // Arrange
  const invalidData = {
    category: 'Energie',
    title: 'Valid Title',
    description: 'Valid description',
    startTime: new Date(Date.now() + 3600000),
    endTime: new Date(Date.now() + 86400000),
    startingPrice: 5000,
    minBidIncrement: -100, // Negative increment
    createdBy: new mongoose.Types.ObjectId().toString()
  };
  
  // Act & Assert
  try {
    await auctionSystem.createAuction(invalidData);
    expect.fail('Should have thrown ValidationError');
  } catch (err) {
    expect(err).to.be.instanceOf(ValidationError);
    expect(err.message).to.include('incrément');
    expect(err.message).to.include('positif');
  }
});

it('should throw ValidationError if minBidIncrement is zero', async () => {
  // Arrange
  const invalidData = {
    category: 'Energie',
    title: 'Valid Title',
    description: 'Valid description',
    startTime: new Date(Date.now() + 3600000),
    endTime: new Date(Date.now() + 86400000),
    startingPrice: 5000,
    minBidIncrement: 0, // Zero increment
    createdBy: new mongoose.Types.ObjectId().toString()
  };
  
  // Act & Assert
  try {
    await auctionSystem.createAuction(invalidData);
    expect.fail('Should have thrown ValidationError');
  } catch (err) {
    expect(err).to.be.instanceOf(ValidationError);
    expect(err.message).to.include('incrément');
    expect(err.message).to.include('positif');
  }
});

// Test pour dates invalides
it('should throw ValidationError if startTime is not a date', async () => {
  // Arrange
  const invalidData = {
    category: 'Energie',
    title: 'Valid Title',
    description: 'Valid description',
    startTime: 'not-a-date', // Invalid date
    endTime: new Date(Date.now() + 86400000),
    startingPrice: 5000,
    createdBy: new mongoose.Types.ObjectId().toString()
  };
  
  // Act & Assert
  try {
    await auctionSystem.createAuction(invalidData);
    expect.fail('Should have thrown ValidationError');
  } catch (err) {
    expect(err).to.be.instanceOf(ValidationError);
    expect(err.message).to.include('date');
  }
});

it('should throw ValidationError if endTime is not a date', async () => {
  // Arrange
  const invalidData = {
    category: 'Energie',
    title: 'Valid Title',
    description: 'Valid description',
    startTime: new Date(Date.now() + 3600000),
    endTime: 'not-a-date', // Invalid date
    startingPrice: 5000,
    createdBy: new mongoose.Types.ObjectId().toString()
  };
  
  // Act & Assert
  try {
    await auctionSystem.createAuction(invalidData);
    expect.fail('Should have thrown ValidationError');
  } catch (err) {
    expect(err).to.be.instanceOf(ValidationError);
    expect(err.message).to.include('date');
  }
});

// Test pour createdBy manquant/invalide
it('should throw ValidationError if createdBy is missing', async () => {
  // Arrange
  const invalidData = {
    category: 'Energie',
    title: 'Valid Title',
    description: 'Valid description',
    startTime: new Date(Date.now() + 3600000),
    endTime: new Date(Date.now() + 86400000),
    startingPrice: 5000,
    // createdBy missing
  };
  
  // Act & Assert
  try {
    await auctionSystem.createAuction(invalidData);
    expect.fail('Should have thrown ValidationError');
  } catch (err) {
    expect(err).to.be.instanceOf(ValidationError);
    expect(err.message).to.include('createdBy');
  }
});

it('should throw ValidationError if createdBy is invalid ObjectId', async () => {
  // Arrange
  const invalidData = {
    category: 'Energie',
    title: 'Valid Title',
    description: 'Valid description',
    startTime: new Date(Date.now() + 3600000),
    endTime: new Date(Date.now() + 86400000),
    startingPrice: 5000,
    createdBy: 'not-an-object-id' // Invalid ObjectId
  };
  
  // Act & Assert
  try {
    await auctionSystem.createAuction(invalidData);
    expect.fail('Should have thrown ValidationError');
  } catch (err) {
    expect(err).to.be.instanceOf(ValidationError);
    expect(err.message).to.include('createdBy');
    expect(err.message).to.include('ObjectId');
  }
});

// Test pour gestion d'erreur dans la notification
it('should handle error when notification fails', async () => {
  // Arrange
  const validData = {
    category: 'Energie',
    title: 'Test Notification Error',
    description: 'Testing error handling in notification',
    startTime: new Date(Date.now() + 3600000),
    endTime: new Date(Date.now() + 86400000),
    startingPrice: 5000,
    createdBy: new mongoose.Types.ObjectId().toString()
  };
  
  // Simuler une erreur dans la notification
  mockAdminService.notifyNewAuction.rejects(new Error('Notification failed'));
  
  // Spy sur console.error pour vérifier le log d'erreur
  const consoleErrorSpy = sinon.spy(console, 'error');
  
  // Act
  const result = await auctionSystem.createAuction(validData);
  
  // Assert
  // L'enchère doit quand même être créée même si la notification échoue
  expect(result).to.be.an('object');
  expect(result.id).to.exist;
  expect(mockDb.auctions.insertOne.calledOnce).to.be.true;
  
  // Vérifier que l'erreur est correctement logguée
  expect(consoleErrorSpy.calledOnce).to.be.true;
  expect(consoleErrorSpy.firstCall.args[0]).to.include('notification');
  
  // Clean up
  consoleErrorSpy.restore();
});
```

### 1.2 Tests pour activateAuction

```javascript
// tests/unit/auction/activateAuction.test.js (compléments)

// Test pour vérifier que l'utilisateur est bien un administrateur
it('should verify that user is admin via adminService', async () => {
  // Arrange
  const pendingAuction = {
    _id: auctionId,
    status: 'pending',
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date(Date.now() + 86400000),
    adminValidation: true
  };
  
  mockDb.auctions.findOne.resolves(pendingAuction);
  
  // Reset adminService.isAdmin et configurer pour toujours renvoyer false
  mockAdminService.isAdmin.reset();
  mockAdminService.isAdmin.resolves(false);
  
  // Act & Assert
  try {
    await auctionSystem.activateAuction(auctionId, adminUserId);
    expect.fail('Should have thrown AuthorizationError');
  } catch (err) {
    expect(err).to.be.instanceOf(AuthorizationError);
    expect(mockAdminService.isAdmin.calledWith(adminUserId)).to.be.true;
    expect(mockDb.auctions.updateOne.called).to.be.false;
  }
});

// Tests pour statuts supplémentaires
it('should throw InvalidOperationError if auction is in payment_pending status', async () => {
  // Arrange
  const paymentPendingAuction = {
    _id: auctionId,
    status: 'payment_pending',
    startTime: new Date(Date.now() - 86400000),
    endTime: new Date(Date.now() - 3600000)
  };
  
  mockDb.auctions.findOne.resolves(paymentPendingAuction);
  
  // Act & Assert
  try {
    await auctionSystem.activateAuction(auctionId, adminUserId);
    expect.fail('Should have thrown InvalidOperationError');
  } catch (err) {
    expect(err).to.be.instanceOf(InvalidOperationError);
    expect(err.message).to.include('payment_pending');
    expect(mockDb.auctions.updateOne.called).to.be.false;
  }
});

it('should throw InvalidOperationError if auction is in failed status', async () => {
  // Arrange
  const failedAuction = {
    _id: auctionId,
    status: 'failed',
    startTime: new Date(Date.now() - 86400000),
    endTime: new Date(Date.now() - 3600000)
  };
  
  mockDb.auctions.findOne.resolves(failedAuction);
  
  // Act & Assert
  try {
    await auctionSystem.activateAuction(auctionId, adminUserId);
    expect.fail('Should have thrown InvalidOperationError');
  } catch (err) {
    expect(err).to.be.instanceOf(InvalidOperationError);
    expect(err.message).to.include('failed');
    expect(mockDb.auctions.updateOne.called).to.be.false;
  }
});

// Test pour vérifier l'appel à _scheduleAuctionFinalization
it('should call _scheduleAuctionFinalization with correct arguments', async () => {
  // Arrange
  const pendingAuction = {
    _id: auctionId,
    status: 'pending',
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date(Date.now() + 86400000),
    adminValidation: true
  };
  
  mockDb.auctions.findOne.resolves(pendingAuction);
  
  // Spy sur _scheduleAuctionFinalization
  const scheduleSpy = sinon.spy(auctionSystem, '_scheduleAuctionFinalization');
  
  // Act
  await auctionSystem.activateAuction(auctionId, adminUserId);
  
  // Assert
  expect(scheduleSpy.calledOnce).to.be.true;
  sinon.assert.calledWith(
    scheduleSpy,
    auctionId,
    pendingAuction.endTime
  );
  
  // Clean up
  scheduleSpy.restore();
});
```

### 1.3 Tests pour placeBid

```javascript
// tests/unit/auction/placeBid.test.js (compléments)

// Test pour enchère égale au minimum requis (exactement enchère la plus haute + incrément)
it('should accept bid that exactly meets minimum required amount', async () => {
  // Arrange
  const activeAuction = {
    _id: auctionId,
    status: 'active',
    startingPrice: 5000,
    minBidIncrement: 500,
    endTime: new Date(Date.now() + 3600000),
    bids: ['bid-123'] // ID de l'enchère existante
  };
  
  const existingBid = {
    _id: 'bid-123',
    amount: 6000,
    status: 'active'
  };
  
  mockDb.auctions.findOne.resolves(activeAuction);
  mockDb.bids.find().sort().limit().toArray.resolves([existingBid]);
  
  const exactMinimumAmount = 6500; // Exactement 6000 + 500
  
  // Act
  const result = await auctionSystem.placeBid(auctionId, bidderId, exactMinimumAmount);
  
  // Assert
  expect(result).to.be.an('object');
  expect(result.amount).to.equal(exactMinimumAmount);
  expect(mockDb.bids.insertOne.calledOnce).to.be.true;
});

// Test pour montant négatif
it('should throw InvalidBidError if amount is negative', async () => {
  // Arrange
  const activeAuction = {
    _id: auctionId,
    status: 'active',
    startingPrice: 5000,
    minBidIncrement: 500,
    endTime: new Date(Date.now() + 3600000),
    bids: []
  };
  
  mockDb.auctions.findOne.resolves(activeAuction);
  
  const negativeAmount = -1000;
  
  // Act & Assert
  try {
    await auctionSystem.placeBid(auctionId, bidderId, negativeAmount);
    expect.fail('Should have thrown InvalidBidError');
  } catch (err) {
    expect(err).to.be.instanceOf(InvalidBidError);
    expect(err.message).to.include('montant');
    expect(err.message).to.include('positif');
    expect(mockDb.bids.insertOne.called).to.be.false;
  }
});

// Test pour montant nul
it('should throw InvalidBidError if amount is zero', async () => {
  // Arrange
  const activeAuction = {
    _id: auctionId,
    status: 'active',
    startingPrice: 5000,
    minBidIncrement: 500,
    endTime: new Date(Date.now() + 3600000),
    bids: []
  };
  
  mockDb.auctions.findOne.resolves(activeAuction);
  
  const zeroAmount = 0;
  
  // Act & Assert
  try {
    await auctionSystem.placeBid(auctionId, bidderId, zeroAmount);
    expect.fail('Should have thrown InvalidBidError');
  } catch (err) {
    expect(err).to.be.instanceOf(InvalidBidError);
    expect(err.message).to.include('montant');
    expect(err.message).to.include('positif');
    expect(mockDb.bids.insertOne.called).to.be.false;
  }
});

// Test pour montant non numérique
it('should throw InvalidBidError if amount is not a number', async () => {
  // Arrange
  const activeAuction = {
    _id: auctionId,
    status: 'active',
    startingPrice: 5000,
    minBidIncrement: 500,
    endTime: new Date(Date.now() + 3600000),
    bids: []
  };
  
  mockDb.auctions.findOne.resolves(activeAuction);
  
  const nonNumericAmount = 'not-a-number';
  
  // Act & Assert
  try {
    await auctionSystem.placeBid(auctionId, bidderId, nonNumericAmount);
    expect.fail('Should have thrown InvalidBidError');
  } catch (err) {
    expect(err).to.be.instanceOf(InvalidBidError);
    expect(err.message).to.include('montant');
    expect(err.message).to.include('numérique');
    expect(mockDb.bids.insertOne.called).to.be.false;
  }
});

// Test pour vérifier que l'enchérisseur est une entreprise approuvée
it('should verify that bidder is an approved company', async () => {
  // Arrange
  const activeAuction = {
    _id: auctionId,
    status: 'active',
    startingPrice: 5000,
    minBidIncrement: 500,
    endTime: new Date(Date.now() + 3600000),
    bids: []
  };
  
  mockDb.auctions.findOne.resolves(activeAuction);
  
  // Mock pour la récupération de l'utilisateur
  mockDb.users = {
    findOne: sinon.stub()
  };
  
  // Cas où l'enchérisseur n'est pas une entreprise
  mockDb.users.findOne.resolves({
    _id: bidderId,
    role: 'user', // Pas une entreprise
    companyStatus: 'approved'
  });
  
  // Act & Assert
  try {
    await auctionSystem.placeBid(auctionId, bidderId, 6000);
    expect.fail('Should have thrown AuthorizationError');
  } catch (err) {
    expect(err).to.be.instanceOf(AuthorizationError);
    expect(err.message).to.include('entreprise');
    expect(mockDb.bids.insertOne.called).to.be.false;
  }
  
  // Cas où l'entreprise n'est pas approuvée
  mockDb.users.findOne.resolves({
    _id: bidderId,
    role: 'company',
    companyStatus: 'pending' // Pas approuvée
  });
  
  // Act & Assert
  try {
    await auctionSystem.placeBid(auctionId, bidderId, 6000);
    expect.fail('Should have thrown AuthorizationError');
  } catch (err) {
    expect(err).to.be.instanceOf(AuthorizationError);
    expect(err.message).to.include('approuvée');
    expect(mockDb.bids.insertOne.called).to.be.false;
  }
});

// Test pour le cas où l'entreprise n'existe pas
it('should throw UserNotFoundError if bidder does not exist', async () => {
  // Arrange
  const activeAuction = {
    _id: auctionId,
    status: 'active',
    startingPrice: 5000,
    minBidIncrement: 500,
    endTime: new Date(Date.now() + 3600000),
    bids: []
  };
  
  mockDb.auctions.findOne.resolves(activeAuction);
  
  // Mock pour la récupération de l'utilisateur
  mockDb.users = {
    findOne: sinon.stub().resolves(null) // L'utilisateur n'existe pas
  };
  
  // Act & Assert
  try {
    await auctionSystem.placeBid(auctionId, bidderId, 6000);
    expect.fail('Should have thrown UserNotFoundError');
  } catch (err) {
    expect(err).to.be.instanceOf(UserNotFoundError);
    expect(mockDb.bids.insertOne.called).to.be.false;
  }
});

// Test pour anti-sniping (non-extension quand pas proche de la fin)
it('should not extend auction time if bid is not placed near the end', async () => {
  // Arrange
  const farFromEndTime = new Date(Date.now() + 7200000); // 2 heures dans le futur (> seuil de 5 min)
  const activeAuction = {
    _id: auctionId,
    status: 'active',
    startingPrice: 5000,
    minBidIncrement: 500,
    endTime: farFromEndTime,
    bids: []
  };
  
  mockDb.auctions.findOne.resolves(activeAuction);
  
  // Spy sur _extendAuctionTime
  const extendSpy = sinon.spy(auctionSystem, '_extendAuctionTime');
  
  // Act
  await auctionSystem.placeBid(auctionId, bidderId, 6000);
  
  // Assert
  expect(extendSpy.called).to.be.false;
  
  // Clean up
  extendSpy.restore();
});

// Test amélioré pour la concurrence
it('should ensure highest bid is recorded when handling concurrent bids', async () => {
  // Arrange
  const activeAuction = {
    _id: auctionId,
    status: 'active',
    startingPrice: 5000,
    minBidIncrement: 500,
    endTime: new Date(Date.now() + 3600000),
    bids: []
  };
  
  mockDb.auctions.findOne.resolves(activeAuction);
  
  // Simuler des enchères concurrentes
  const bidAmount1 = 6000;
  const bidAmount2 = 7000;
  const bidderId2 = new mongoose.Types.ObjectId().toString();
  
  // Act
  const bidPromises = [
    auctionSystem.placeBid(auctionId, bidderId, bidAmount1),
    auctionSystem.placeBid(auctionId, bidderId2, bidAmount2)
  ];
  
  const results = await Promise.all(bidPromises);
  
  // Assert
  expect(results.length).to.equal(2);
  
  // Vérifier que l'enchère la plus haute est enregistrée correctement
  // Simuler l'appel à getAuctionDetails pour récupérer l'enchère la plus haute
  mockDb.bids.find().sort().limit().toArray.resolves(
    results.map(r => ({ _id: r.id, amount: r.amount, bidderId: r.bidderId }))
  );
  
  const auctionDetails = await auctionSystem.getAuctionDetails(auctionId);
  
  // Vérifier que l'enchère la plus haute est bien celle avec le montant le plus élevé
  expect(auctionDetails.currentHighestBid.amount).to.equal(Math.max(bidAmount1, bidAmount2));
});

// Test pour échec de paiement
it('should throw PaymentError if payment verification fails', async () => {
  // Arrange
  const activeAuction = {
    _id: auctionId,
    status: 'active',
    startingPrice: 5000,
    minBidIncrement: 500,
    endTime: new Date(Date.now() + 3600000),
    bids: []
  };
  
  mockDb.auctions.findOne.resolves(activeAuction);
  
  // Simuler un échec dans la vérification du paiement
  mockPaymentService.verifyPaymentMethod.resolves(false);
  
  // Act & Assert
  try {
    await auctionSystem.placeBid(auctionId, bidderId, 6000);
    expect.fail('Should have thrown PaymentError');
  } catch (err) {
    expect(err).to.be.instanceOf(PaymentError);
    expect(err.message).to.include('paiement');
    expect(mockDb.bids.insertOne.called).to.be.false;
  }
});
```

## 2. Organisation des Tests

Organisation des tests selon la structure recommandée par Gemini:

```bash
mkdir -p tests/unit/auction
mkdir -p tests/unit/user
mkdir -p tests/unit/shared
mkdir -p tests/integration/routes
mkdir -p tests/integration/services
mkdir -p tests/load
mkdir -p tests/security
mkdir -p tests/e2e
```

Voici un script shell pour créer les fichiers de test unitaires pour le service d'enchères:

```bash
# Créer les fichiers de test pour le service d'enchères
touch tests/unit/auction/createAuction.test.js
touch tests/unit/auction/activateAuction.test.js
touch tests/unit/auction/placeBid.test.js
touch tests/unit/auction/getAuctionDetails.test.js
touch tests/unit/auction/finalizeAuction.test.js
touch tests/unit/auction/updateAuction.test.js
touch tests/unit/auction/deleteAuction.test.js
touch tests/unit/auction/_validateAuctionData.test.js
touch tests/unit/auction/_emitAuctionEvent.test.js
touch tests/unit/auction/auctionService.test.js

# Créer les fichiers de test pour le service utilisateur
touch tests/unit/user/userService.test.js
touch tests/unit/user/authService.test.js
touch tests/unit/user/registrationService.test.js

# Créer les fichiers de test pour les routes
touch tests/integration/routes/auctions.test.js
touch tests/integration/routes/users.test.js
touch tests/integration/routes/auth.test.js

# Créer les fichiers de test de sécurité
touch tests/security/xss-csrf.test.js
touch tests/security/injection.test.js
touch tests/security/rate-limiting.test.js

# Créer les fichiers de test de charge
touch tests/load/auction-load.js
touch tests/load/registration-load.js
```

## 3. Configuration d'Intégration Continue

Voici un exemple de configuration pour GitHub Actions:

```yaml
# .github/workflows/tests.yml
name: Étika Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:4.4
        ports:
          - 27017:27017

      redis:
        image: redis:6
        ports:
          - 6379:6379

    strategy:
      matrix:
        node-version: [14.x, 16.x]

    steps:
    - uses: actions/checkout@v2
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v2
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Lint check
      run: npm run lint
    
    - name: Run unit tests
      run: npm run test:unit
      
    - name: Run integration tests
      run: npm run test:integration
      
    - name: Run security tests
      run: npm run test:security
    
    - name: Generate coverage report
      run: npm run coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v2
      with:
        directory: ./coverage/
        fail_ci_if_error: true
```

## 4. Scripts NPM pour Tests

Ajouter ces scripts à `package.json`:

```json
"scripts": {
  "test": "mocha 'tests/**/*.test.js'",
  "test:unit": "mocha 'tests/unit/**/*.test.js'",
  "test:integration": "mocha 'tests/integration/**/*.test.js'",
  "test:security": "mocha 'tests/security/**/*.test.js'",
  "test:load": "k6 run tests/load/auction-load.js",
  "coverage": "nyc --reporter=lcov --reporter=text-summary npm test",
  "lint": "eslint ."
}
```

## 5. Configuration de Couverture de Code

Fichier `.nycrc` pour configurer la couverture de code:

```json
{
  "all": true,
  "include": [
    "services/**/*.js",
    "controllers/**/*.js",
    "models/**/*.js",
    "utils/**/*.js"
  ],
  "exclude": [
    "**/*.test.js",
    "coverage/**",
    "node_modules/**"
  ],
  "reporter": [
    "lcov",
    "text-summary"
  ],
  "check-coverage": true,
  "branches": 80,
  "lines": 85,
  "functions": 85,
  "statements": 85
}
```

Ces compléments de tests et configurations permettront d'atteindre une couverture de code optimale et d'assurer la qualité du système d'enchères Étika conformément aux recommandations de Gemini.

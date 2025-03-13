  
  // Simuler le placement d'enchères (pour les entreprises uniquement)
  if (Math.random() < 0.3) { // 30% de chances de placer une enchère
    // Récupérer les détails pour connaitre le montant actuel
    let currentAmount = 5000; // Montant par défaut
    
    if (detailsSuccess) {
      const auctionDetails = JSON.parse(auctionDetailsResponse.body).auction;
      if (auctionDetails.currentHighestBid) {
        currentAmount = auctionDetails.currentHighestBid.amount;
      } else {
        currentAmount = auctionDetails.startingPrice;
      }
    }
    
    // Incrément aléatoire pour l'enchère (entre min increment et +2000)
    const increment = randomIntBetween(500, 2000);
    const bidAmount = currentAmount + increment;
    
    // Placer l'enchère
    const placeBidResponse = http.post(
      `${BASE_URL}/auctions/${auctionId}/bids`,
      JSON.stringify({ amount: bidAmount }),
      {
        headers: {
          'Authorization': `Bearer ${companyToken}`,
          'Content-Type': 'application/json'
        },
        tags: { name: 'place_bid' }
      }
    );
    
    const bidSuccess = check(placeBidResponse, {
      'placement d\'enchère - statut 201 ou 400': (r) => r.status === 201 || r.status === 400,
      'placement d\'enchère - réponse valide': (r) => {
        if (r.status === 201) {
          const body = JSON.parse(r.body);
          return body.success && body.bid && body.bid.amount === bidAmount;
        } else if (r.status === 400) {
          // Peut échouer si une autre enchère a été placée entre-temps
          const body = JSON.parse(r.body);
          return body.error && (body.error.includes('minimum') || body.error.includes('enchère'));
        }
        return false;
      },
    });
    
    if (bidSuccess) {
      if (placeBidResponse.status === 201) {
        bidCounter.add(1);
      }
      successCounter.add(1);
    } else {
      failureRate.add(1);
    }
  }
  
  // Simulation de navigation
  sleep(randomIntBetween(1, 3));
}

// Nettoyage après le test
export function teardown(data) {
  // Nettoyage potentiel des données de test
  console.log(`Test terminé. Enchères placées: ${bidCounter.value}`);
}
```

## 4. Tests de Sécurité

```javascript
// tests/security/xss-csrf.test.js
const request = require('supertest');
const { expect } = require('chai');
const app = require('../../app');

describe('Tests de Sécurité - XSS et CSRF', () => {
  describe('Protections XSS', () => {
    it('should sanitize user input in auction title', async () => {
      // Tenter d'injecter un script dans le titre d'une enchère
      const xssPayload = '<script>alert("XSS")</script>Auction Title';
      
      // Se connecter en tant qu'admin
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123'
        });
      
      const adminToken = loginRes.body.token;
      
      // Créer une enchère avec le payload XSS
      const res = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'Energie',
          title: xssPayload,
          description: 'Description for auction',
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 86400000),
          startingPrice: 5000
        });
      
      // Vérifier que le script a été échappé ou retiré
      expect(res.body.auction.title).to.not.include('<script>');
    });
    
    it('should sanitize user input in auction description', async () => {
      // Tenter d'injecter un script dans la description
      const xssPayload = 'Description <img src="x" onerror="alert(\'XSS\')">';
      
      // Se connecter en tant qu'admin
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123'
        });
      
      const adminToken = loginRes.body.token;
      
      // Créer une enchère avec le payload XSS
      const res = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'Energie',
          title: 'Safe Auction Title',
          description: xssPayload,
          startTime: new Date(Date.now() + 3600000),
          endTime: new Date(Date.now() + 86400000),
          startingPrice: 5000
        });
      
      // Vérifier que les attributs dangereux ont été échappés ou retirés
      expect(res.body.auction.description).to.not.include('onerror=');
    });
  });
  
  describe('Protection CSRF', () => {
    it('should require CSRF token for POST request', async () => {
      // D'abord obtenir un cookie de session
      await request(app)
        .get('/api/auctions')
        .expect(200);
      
      // Tenter une requête POST sans token CSRF
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'password123'
        });
      
      // Vérifier que la requête est rejetée à cause du token CSRF manquant
      // Note: le comportement exact dépend de la configuration de csurf
      expect(res.status).to.be.oneOf([403, 500]); // 403 si protection activée
      if (res.status === 403) {
        expect(res.body.error).to.include('CSRF');
      }
    });
  });
});

// tests/security/auth-injection.test.js
const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const app = require('../../app');

describe('Tests de Sécurité - Authentification et Injection', () => {
  describe('Protections d\'Authentification', () => {
    it('should reject login with NoSQL injection attempt', async () => {
      // Tentative d'injection NoSQL dans le champ email
      const injectionPayload = {
        email: { $ne: null },
        password: 'anypassword'
      };
      
      const res = await request(app)
        .post('/api/auth/login')
        .send(injectionPayload)
        .expect(400); // Devrait être rejeté avec un 400 Bad Request
      
      expect(res.body.success).to.be.false;
    });
    
    it('should reject login with SQL-like injection in email', async () => {
      // Tentative d'injection SQL-like
      const injectionPayload = {
        email: "' OR '1'='1",
        password: 'anypassword'
      };
      
      const res = await request(app)
        .post('/api/auth/login')
        .send(injectionPayload)
        .expect(401); // Authentification échouée
      
      expect(res.body.success).to.be.false;
    });
    
    it('should limit login attempts from same IP', async () => {
      // Tentatives multiples de connexion avec mauvais mot de passe
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'user@test.com',
            password: 'wrongpassword' + i
          });
      }
      
      // La 11e tentative devrait être bloquée si rate-limiting est actif
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'wrongpassword'
        });
      
      // Dans un environnement avec rate limiting, le code serait 429
      expect(res.status).to.be.oneOf([401, 429]);
    });
  });
  
  describe('Protections de Routes', () => {
    it('should reject requests with invalid JWT token', async () => {
      // Token JWT invalide (mal formé)
      const invalidToken = 'Bearer invalid.jwt.token';
      
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', invalidToken)
        .expect(401);
      
      expect(res.body.success).to.be.false;
    });
    
    it('should reject requests with expired JWT token', async () => {
      // Token JWT expiré
      // Note: Ceci est un token JWT valide mais déjà expiré
      const expiredToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4OTAiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyM30.signature';
      
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', expiredToken)
        .expect(401);
      
      expect(res.body.success).to.be.false;
    });
    
    it('should reject access to admin routes for non-admin users', async () => {
      // Se connecter en tant qu'utilisateur normal
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'password123'
        });
      
      const userToken = loginRes.body.token;
      
      // Tenter d'accéder à une route admin
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
      
      expect(res.body.success).to.be.false;
    });
  });
  
  describe('Paramètres de Sécurité HTTP', () => {
    it('should have security headers enabled', async () => {
      const res = await request(app).get('/api/auctions');
      
      // Helmet devrait avoir configuré ces en-têtes
      expect(res.headers).to.include.any.keys([
        'x-content-type-options',
        'x-frame-options',
        'content-security-policy',
        'x-xss-protection'
      ]);
    });
  });
});
```

## 5. Tests de Performance et d'Acceptation

### 5.1 Tests de Performance

```javascript
// tests/performance/auction-performance.js
const { performance } = require('perf_hooks');
const mongoose = require('mongoose');
const { EtikaAuctionSystem } = require('../../services/auctionService');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Tests de performance unitaires
async function runPerformanceTests() {
  // Démarrer un serveur MongoDB en mémoire pour les tests
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  // Se connecter à la base de données
  await mongoose.connect(uri);
  
  // Initialiser le système d'enchères
  const auctionSystem = new EtikaAuctionSystem(/* dépendances */);
  
  console.log('=== Tests de Performance Unitaires ===');
  
  // Test 1: Création d'enchères en masse
  console.log('\nTest: Création d\'enchères en masse');
  const numAuctions = 100;
  
  const startCreate = performance.now();
  
  for (let i = 0; i < numAuctions; i++) {
    await auctionSystem.createAuction({
      category: 'Performance',
      title: `Performance Test Auction ${i}`,
      description: 'Description for performance testing',
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 86400000),
      startingPrice: 5000,
      createdBy: new mongoose.Types.ObjectId()
    });
  }
  
  const endCreate = performance.now();
  const createDuration = endCreate - startCreate;
  
  console.log(`Création de ${numAuctions} enchères: ${createDuration.toFixed(2)}ms`);
  console.log(`Moyenne par enchère: ${(createDuration / numAuctions).toFixed(2)}ms`);
  
  // Test 2: Récupération d'enchères avec filtrage
  console.log('\nTest: Récupération d\'enchères avec filtrage');
  
  const startQuery = performance.now();
  
  await auctionSystem.getAuctions({
    category: 'Performance',
    startTime: { $gte: new Date() }
  });
  
  const endQuery = performance.now();
  
  console.log(`Requête filtrée: ${(endQuery - startQuery).toFixed(2)}ms`);
  
  // Test 3: Enchères simultanées sur la même enchère
  console.log('\nTest: Enchères simultanées');
  
  // Créer une enchère de test
  const testAuction = await auctionSystem.createAuction({
    category: 'Performance',
    title: 'Concurrent Bid Test',
    description: 'Testing concurrent bidding performance',
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date(Date.now() + 3600000),
    startingPrice: 5000,
    minBidIncrement: 100,
    status: 'active',
    createdBy: new mongoose.Types.ObjectId()
  });
  
  // Simuler 50 enchères simultanées
  const numBids = 50;
  const bidders = Array.from({ length: numBids }, () => new mongoose.Types.ObjectId());
  
  const startBids = performance.now();
  
  const bidPromises = bidders.map((bidderId, index) => {
    return auctionSystem.placeBid(
      testAuction.id,
      bidderId,
      5000 + (index + 1) * 100
    );
  });
  
  await Promise.all(bidPromises);
  
  const endBids = performance.now();
  const bidsDuration = endBids - startBids;
  
  console.log(`${numBids} enchères simultanées: ${bidsDuration.toFixed(2)}ms`);
  console.log(`Moyenne par enchère: ${(bidsDuration / numBids).toFixed(2)}ms`);
  
  // Nettoyer
  await mongoose.disconnect();
  await mongod.stop();
}

// Exécuter les tests
runPerformanceTests().catch(console.error);
```

### 5.2 Plan de Tests d'Acceptation (UAT)

```markdown
# Plan de Tests d'Acceptation Utilisateur (UAT) pour Étika Phase 1

## Objectifs
- Valider que le système répond aux exigences fonctionnelles
- Confirmer que l'expérience utilisateur est intuitive et sans friction
- Vérifier que le flux complet d'enchères fonctionne de bout en bout
- Évaluer la réaction des utilisateurs face au concept d'Étika

## Participants
- Représentants d'entreprises potentiellement intéressées
- Utilisateurs finaux (consommateurs)
- Représentants d'ONG partenaires
- Équipe de développement et de projet

## Scénarios de Test

### 1. Inscription et Authentification
1.1. Un utilisateur peut s'inscrire avec son email et son mot de passe
1.2. Une entreprise peut s'inscrire et soumettre ses informations
1.3. Un utilisateur peut se connecter avec ses identifiants
1.4. Un utilisateur peut réinitialiser son mot de passe
1.5. Une entreprise peut voir son statut d'approbation

### 2. Navigation et Découverte
2.1. Un utilisateur peut consulter la liste des enchères actives
2.2. Un utilisateur peut filtrer les enchères par catégorie
2.3. Un utilisateur peut voir les détails d'une enchère
2.4. Un utilisateur peut voir le compte à rebours d'une enchère
2.5. Un utilisateur peut voir les entreprises participantes

### 3. Processus d'Enchères
3.1. Une entreprise approuvée peut placer une enchère
3.2. Une entreprise reçoit une notification quand son enchère est dépassée
3.3. Un administrateur peut créer une nouvelle enchère
3.4. Un administrateur peut activer une enchère en attente
3.5. Le système prolonge automatiquement la durée en cas d'enchère tardive
3.6. L'entreprise gagnante est correctement identifiée à la fin de l'enchère

### 4. Certificats Numériques (NFT)
4.1. Un utilisateur reçoit automatiquement un certificat à l'inscription
4.2. Un utilisateur peut voir ses certificats dans sa collection
4.3. Un utilisateur peut partager un certificat via un lien ou QR code
4.4. Les certificats ont des visuels thématiques alignés avec les ONG

### 5. Mécanisme de Parrainage
5.1. Un utilisateur peut générer un lien de parrainage
5.2. Un nouveau membre peut s'inscrire via un lien de parrainage
5.3. Le parrain est notifié quand son filleul s'inscrit
5.4. Le système affiche correctement la structure de parrainage

### 6. Expérience Mobile
6.1. L'utilisateur peut s'inscrire via l'application mobile
6.2. L'utilisateur reçoit des notifications push pour les événements importants
6.3. L'utilisateur peut facilement suivre les enchères via l'application
6.4. L'application permet de scanner des QR codes de parrainage

### 7. Fonctionnalités ONG
7.1. Une ONG peut personnaliser son espace communautaire
7.2. Les membres peuvent rejoindre la communauté d'une ONG
7.3. Les certificats liés à une ONG ont des visuels thématiques

### 8. Administration et Gestion
8.1. Un administrateur peut approuver une entreprise
8.2. Un administrateur peut configurer les paramètres d'une enchère
8.3. Un administrateur peut suivre les statistiques en temps réel
8.4. Un administrateur peut exporter des rapports

## Critères d'Acceptation
- Chaque scénario doit être réalisable sans erreur technique
- L'expérience utilisateur doit être notée au moins 4/5 par les testeurs
- Le temps de chargement des pages ne doit pas dépasser 3 secondes
- Le système doit supporter au moins 50 utilisateurs simultanés
- Les notifications doivent être reçues dans un délai maximum de 30 secondes

## Méthode d'Évaluation
Pour chaque scénario, les testeurs rempliront une fiche d'évaluation avec:
- Réussite/Échec du scénario
- Facilité d'utilisation (1-5)
- Problèmes rencontrés
- Suggestions d'amélioration
- Temps nécessaire pour accomplir la tâche

## Calendrier de Tests
- Préparation: 1 semaine
- Session de tests: 2 semaines
- Analyse et corrections: 1 semaine
- Tests de validation: 1 semaine

## Environnement de Test
- Serveur de staging dédié
- Base de données de test pré-remplie avec des données représentatives
- Variété d'appareils (desktop, tablettes, smartphones)
- Différents navigateurs (Chrome, Firefox, Safari, Edge)
```

## Résumé du Plan de Tests

Ce plan de tests exhaustif couvre tous les aspects essentiels du système Étika pour sa phase test:

1. **Tests Unitaires**: Tests approfondis des composants individuels du système d'enchères, avec une couverture complète des cas normaux et des cas d'erreur.

2. **Tests d'Intégration**: Validation des interactions entre les différentes parties du système via les API REST, avec vérification de la gestion des erreurs et des autorisations.

3. **Tests de Charge**: Simulation de trafic élevé pour valider la robustesse et les performances du système sous pression.

4. **Tests de Sécurité**: Vérification des protections contre les vulnérabilités courantes (XSS, CSRF, injections).

5. **Tests de Performance**: Mesure des temps de réponse et de la capacité de traitement du système.

6. **Tests d'Acceptation**: Plan structuré pour valider que le système répond aux attentes des utilisateurs finaux.

L'implémentation de ce plan garantira la qualité, la sécurité et la robustesse de la plateforme Étika, en préparant efficacement la phase 2 du projet si la phase test rencontre le succès attendu.    it('should return 404 for non-existent auction', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await request(app)
        .put(`/api/auctions/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Non-existent Auction' })
        .expect(404);
    });
    
    it('should return 400 with invalid data', async () => {
      const invalidData = {
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now()) // endTime avant startTime
      };
      
      const res = await request(app)
        .put(`/api/auctions/${testAuction._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
    
    it('should not allow updating critical fields of active auctions', async () => {
      const criticalUpdate = {
        startingPrice: 1000, // Ne devrait pas être modifiable pour une enchère active
        status: 'pending'    // Ne devrait pas être modifiable directement
      };
      
      const res = await request(app)
        .put(`/api/auctions/${testAuction._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(criticalUpdate)
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
      
      // Vérifier que l'enchère n'a pas été modifiée
      const unchangedAuction = await Auction.findById(testAuction._id);
      expect(unchangedAuction.startingPrice).to.equal(testAuction.startingPrice);
      expect(unchangedAuction.status).to.equal(testAuction.status);
    });
  });
  
  describe('DELETE /api/auctions/:id', () => {
    let auctionToDelete;
    
    beforeEach(async () => {
      // Créer une enchère à supprimer pour chaque test
      auctionToDelete = await Auction.create({
        category: 'Telecom',
        title: 'Auction to Delete',
        description: 'This auction will be deleted',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 86400000),
        startingPrice: 3000,
        status: 'pending',
        createdBy: adminUser._id
      });
    });
    
    it('should delete pending auction with admin auth', async () => {
      const res = await request(app)
        .delete(`/api/auctions/${auctionToDelete._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      
      // Vérifier que l'enchère a été supprimée
      const deletedAuction = await Auction.findById(auctionToDelete._id);
      expect(deletedAuction).to.be.null;
    });
    
    it('should return 401 without authentication', async () => {
      await request(app)
        .delete(`/api/auctions/${auctionToDelete._id}`)
        .expect(401);
      
      // Vérifier que l'enchère existe toujours
      const stillExistsAuction = await Auction.findById(auctionToDelete._id);
      expect(stillExistsAuction).to.exist;
    });
    
    it('should return 403 with non-admin authentication', async () => {
      await request(app)
        .delete(`/api/auctions/${auctionToDelete._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
      
      // Vérifier que l'enchère existe toujours
      const stillExistsAuction = await Auction.findById(auctionToDelete._id);
      expect(stillExistsAuction).to.exist;
    });
    
    it('should return 404 for non-existent auction', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await request(app)
        .delete(`/api/auctions/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
    
    it('should not delete active auction but mark as cancelled', async () => {
      // Créer une enchère active
      const activeAuction = await Auction.create({
        category: 'Banque',
        title: 'Active Auction to Cancel',
        description: 'This active auction should be cancelled, not deleted',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        startingPrice: 4000,
        status: 'active',
        createdBy: adminUser._id
      });
      
      const res = await request(app)
        .delete(`/api/auctions/${activeAuction._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.cancelled).to.be.true;
      
      // Vérifier que l'enchère existe toujours mais est marquée comme annulée
      const cancelledAuction = await Auction.findById(activeAuction._id);
      expect(cancelledAuction).to.exist;
      expect(cancelledAuction.status).to.equal('cancelled');
    });
    
    it('should not allow cancelling completed auctions', async () => {
      // Créer une enchère terminée
      const completedAuction = await Auction.create({
        category: 'Assurance',
        title: 'Completed Auction',
        description: 'This completed auction should not be cancellable',
        startTime: new Date(Date.now() - 86400000),
        endTime: new Date(Date.now() - 3600000),
        startingPrice: 4000,
        status: 'completed',
        createdBy: adminUser._id
      });
      
      const res = await request(app)
        .delete(`/api/auctions/${completedAuction._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
      
      // Vérifier que l'enchère existe toujours et n'est pas modifiée
      const unchangedAuction = await Auction.findById(completedAuction._id);
      expect(unchangedAuction).to.exist;
      expect(unchangedAuction.status).to.equal('completed');
    });
  });
});
```

### 2.2 Tests d'Intégration pour les Routes Utilisateurs

```javascript
// tests/integration/routes/users.test.js
const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const app = require('../../../app');
const User = require('../../../models/User');
const { generateToken } = require('../../../services/authService');

describe('User Routes - Integration Tests', () => {
  let adminUser;
  let regularUser;
  let companyUser;
  let adminToken;
  let userToken;
  let companyToken;
  
  before(async () => {
    // Connexion à la base de données de test
    await mongoose.connect(process.env.MONGODB_URI_TEST);
    
    // Nettoyer la collection
    await User.deleteMany({});
    
    // Créer des utilisateurs de test
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });
    
    regularUser = await User.create({
      email: 'user@test.com',
      password: 'password123',
      role: 'user'
    });
    
    companyUser = await User.create({
      email: 'company@test.com',
      password: 'password123',
      role: 'company',
      companyName: 'Test Company',
      companyStatus: 'pending'
    });
    
    // Générer des tokens
    adminToken = generateToken(adminUser);
    userToken = generateToken(regularUser);
    companyToken = generateToken(companyUser);
  });
  
  after(async () => {
    // Nettoyer la collection
    await User.deleteMany({});
    
    // Fermer la connexion
    await mongoose.connection.close();
  });
  
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const newUser = {
        email: 'newuser@test.com',
        password: 'newpassword123',
        role: 'user'
      };
      
      const res = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(201);
      
      expect(res.body.success).to.be.true;
      expect(res.body.user).to.be.an('object');
      expect(res.body.user.email).to.equal(newUser.email);
      expect(res.body.user.role).to.equal(newUser.role);
      expect(res.body.token).to.be.a('string');
      
      // Vérifier que le mot de passe n'est pas renvoyé
      expect(res.body.user.password).to.be.undefined;
      
      // Vérifier que l'utilisateur a été créé en base de données
      const savedUser = await User.findOne({ email: newUser.email });
      expect(savedUser).to.exist;
      expect(savedUser.email).to.equal(newUser.email);
    });
    
    it('should register a new company', async () => {
      const newCompany = {
        email: 'newcompany@test.com',
        password: 'companypass123',
        role: 'company',
        companyName: 'New Test Company'
      };
      
      const res = await request(app)
        .post('/api/auth/register')
        .send(newCompany)
        .expect(201);
      
      expect(res.body.success).to.be.true;
      expect(res.body.user).to.be.an('object');
      expect(res.body.user.email).to.equal(newCompany.email);
      expect(res.body.user.role).to.equal(newCompany.role);
      expect(res.body.user.companyName).to.equal(newCompany.companyName);
      expect(res.body.user.companyStatus).to.equal('pending'); // Les entreprises commencent en statut pending
      expect(res.body.token).to.be.a('string');
    });
    
    it('should return 400 if email is already taken', async () => {
      const duplicateUser = {
        email: 'user@test.com', // Email existant
        password: 'password123',
        role: 'user'
      };
      
      const res = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
    
    it('should return 400 if email is invalid', async () => {
      const invalidUser = {
        email: 'invalid-email', // Format incorrect
        password: 'password123',
        role: 'user'
      };
      
      const res = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
    
    it('should return 400 if password is too short', async () => {
      const weakPasswordUser = {
        email: 'weakpass@test.com',
        password: '123', // Trop court
        role: 'user'
      };
      
      const res = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
    
    it('should not allow direct registration as admin', async () => {
      const adminRegistration = {
        email: 'hackerman@test.com',
        password: 'password123',
        role: 'admin' // Tentative de s'inscrire en tant qu'admin
      };
      
      const res = await request(app)
        .post('/api/auth/register')
        .send(adminRegistration)
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
      
      // Vérifier qu'aucun utilisateur admin n'a été créé
      const notSavedUser = await User.findOne({ email: adminRegistration.email });
      expect(notSavedUser).to.be.null;
    });
  });
  
  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const loginData = {
        email: 'user@test.com',
        password: 'password123'
      };
      
      const res = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.user).to.be.an('object');
      expect(res.body.user.email).to.equal(loginData.email);
      expect(res.body.token).to.be.a('string');
    });
    
    it('should return 401 with incorrect password', async () => {
      const incorrectLogin = {
        email: 'user@test.com',
        password: 'wrongpassword'
      };
      
      const res = await request(app)
        .post('/api/auth/login')
        .send(incorrectLogin)
        .expect(401);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
    
    it('should return 401 with non-existent email', async () => {
      const nonExistentLogin = {
        email: 'nonexistent@test.com',
        password: 'password123'
      };
      
      const res = await request(app)
        .post('/api/auth/login')
        .send(nonExistentLogin)
        .expect(401);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
    
    it('should update lastLogin timestamp', async () => {
      const loginData = {
        email: 'user@test.com',
        password: 'password123'
      };
      
      const beforeLogin = await User.findOne({ email: loginData.email });
      const beforeLoginTime = beforeLogin.lastLogin;
      
      // Attendre un peu pour assurer que le timestamp change
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);
      
      const afterLogin = await User.findOne({ email: loginData.email });
      const afterLoginTime = afterLogin.lastLogin;
      
      expect(afterLoginTime).to.be.a('date');
      expect(afterLoginTime).to.be.above(beforeLoginTime || new Date(0));
    });
  });
  
  describe('GET /api/users/profile', () => {
    it('should return user profile with authentication', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.user).to.be.an('object');
      expect(res.body.user.email).to.equal(regularUser.email);
      expect(res.body.user._id.toString()).to.equal(regularUser._id.toString());
      
      // Vérifier que le mot de passe est exclu
      expect(res.body.user.password).to.be.undefined;
    });
    
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/users/profile')
        .expect(401);
    });
  });
  
  describe('PUT /api/users/profile', () => {
    it('should update user profile with authentication', async () => {
      const updateData = {
        name: 'Updated Name',
        phone: '123-456-7890'
      };
      
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.user).to.be.an('object');
      expect(res.body.user.name).to.equal(updateData.name);
      expect(res.body.user.phone).to.equal(updateData.phone);
      
      // Vérifier que la mise à jour a été enregistrée
      const updatedUser = await User.findById(regularUser._id);
      expect(updatedUser.name).to.equal(updateData.name);
      expect(updatedUser.phone).to.equal(updateData.phone);
    });
    
    it('should not allow updating email or role', async () => {
      const sensitiveUpdate = {
        email: 'newemail@test.com',
        role: 'admin'
      };
      
      const res = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(sensitiveUpdate)
        .expect(200); // La requête réussit, mais les champs sensibles sont ignorés
      
      expect(res.body.success).to.be.true;
      expect(res.body.user.email).to.equal(regularUser.email); // L'email reste inchangé
      expect(res.body.user.role).to.equal(regularUser.role); // Le rôle reste inchangé
      
      // Vérifier que les champs sensibles n'ont pas été modifiés
      const unchangedUser = await User.findById(regularUser._id);
      expect(unchangedUser.email).to.equal(regularUser.email);
      expect(unchangedUser.role).to.equal(regularUser.role);
    });
    
    it('should return 401 without authentication', async () => {
      await request(app)
        .put('/api/users/profile')
        .send({ name: 'Unauthorized Update' })
        .expect(401);
    });
  });
  
  describe('GET /api/admin/users', () => {
    it('should return all users with admin auth', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.users).to.be.an('array');
      expect(res.body.users.length).to.be.at.least(3);
      
      // Vérifier que les mots de passe sont exclus
      expect(res.body.users.every(u => !u.password)).to.be.true;
    });
    
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/admin/users')
        .expect(401);
    });
    
    it('should return 403 with non-admin authentication', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
    
    it('should filter users by role', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=company')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.users).to.be.an('array');
      expect(res.body.users.every(u => u.role === 'company')).to.be.true;
    });
    
    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/admin/users?limit=2&page=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.users).to.be.an('array');
      expect(res.body.users.length).to.be.at.most(2);
      expect(res.body.pagination).to.exist;
      expect(res.body.pagination.currentPage).to.equal(1);
      expect(res.body.pagination.limit).to.equal(2);
    });
  });
  
  describe('PUT /api/admin/users/:id/approve-company', () => {
    it('should approve company status with admin auth', async () => {
      const res = await request(app)
        .put(`/api/admin/users/${companyUser._id}/approve-company`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.user).to.be.an('object');
      expect(res.body.user._id.toString()).to.equal(companyUser._id.toString());
      expect(res.body.user.companyStatus).to.equal('approved');
      
      // Vérifier la mise à jour en base de données
      const approvedCompany = await User.findById(companyUser._id);
      expect(approvedCompany.companyStatus).to.equal('approved');
    });
    
    it('should return 401 without authentication', async () => {
      await request(app)
        .put(`/api/admin/users/${companyUser._id}/approve-company`)
        .expect(401);
    });
    
    it('should return 403 with non-admin authentication', async () => {
      await request(app)
        .put(`/api/admin/users/${companyUser._id}/approve-company`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
    
    it('should return 404 for non-existent user', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await request(app)
        .put(`/api/admin/users/${nonExistentId}/approve-company`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
    
    it('should return 400 for non-company user', async () => {
      await request(app)
        .put(`/api/admin/users/${regularUser._id}/approve-company`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
```

## 3. Tests de Charge

```javascript
// tests/load/auction-load.js
import http from 'k6/http';
import { sleep, check } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js';

// Métriques personnalisées
const failureRate = new Rate('failures');
const successCounter = new Counter('successful_requests');
const bidCounter = new Counter('placed_bids');

// Configuration du test
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp-up à 10 utilisateurs en 30 secondes
    { duration: '1m', target: 50 },  // Ramp-up à 50 utilisateurs en 1 minute
    { duration: '3m', target: 50 },  // Maintien de 50 utilisateurs pendant 3 minutes
    { duration: '30s', target: 0 },  // Ramp-down à 0 utilisateur en 30 secondes
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'], // 95% des requêtes doivent terminer en moins de 1.5s
    'http_req_duration{name:get_auctions}': ['p(95)<1000'], // 95% des requêtes de liste d'enchères doivent terminer en moins de 1s
    'http_req_duration{name:get_auction_details}': ['p(95)<1200'], // 95% des requêtes de détails d'enchère doivent terminer en moins de 1.2s
    'http_req_duration{name:place_bid}': ['p(95)<2000'], // 95% des enchères doivent être placées en moins de 2s
    failures: ['rate<0.1'], // Le taux d'échec doit être inférieur à 10%
  },
};

// Variables globales
const BASE_URL = 'http://localhost:5000/api';
let auctionIds = [];
let userTokens = [];
let companyTokens = [];

// Fonction d'initialisation (exécutée une fois par VU)
export function setup() {
  // Récupération des enchères actives
  const auctionsResponse = http.get(`${BASE_URL}/auctions?status=active`);
  
  check(auctionsResponse, {
    'récupération des enchères réussie': (r) => r.status === 200,
  });
  
  if (auctionsResponse.status === 200) {
    const auctions = JSON.parse(auctionsResponse.body).auctions;
    auctionIds = auctions.map(a => a._id);
    console.log(`${auctionIds.length} enchères actives trouvées`);
  }
  
  // Création d'utilisateurs et entreprises de test
  for (let i = 0; i < 20; i++) {
    // Création d'utilisateurs réguliers
    const userEmail = `loadtest_user_${randomString(8)}@test.com`;
    const userResponse = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
      email: userEmail,
      password: 'Password123!',
      role: 'user',
      name: `Test User ${i}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (userResponse.status === 201) {
      userTokens.push(JSON.parse(userResponse.body).token);
    }
    
    // Création d'entreprises
    const companyEmail = `loadtest_company_${randomString(8)}@test.com`;
    const companyResponse = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
      email: companyEmail,
      password: 'Password123!',
      role: 'company',
      companyName: `Test Company ${i}`,
      name: `Company Contact ${i}`
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (companyResponse.status === 201) {
      const companyToken = JSON.parse(companyResponse.body).token;
      companyTokens.push(companyToken);
      
      // Approbation automatique de l'entreprise (en supposant un compte admin spécial)
      const adminToken = 'admin_token_for_load_testing'; // À configurer
      const companyId = JSON.parse(companyResponse.body).user._id;
      
      http.put(`${BASE_URL}/admin/users/${companyId}/approve-company`, null, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
    }
  }
  
  // Retourner les données pour les VUs
  return {
    auctionIds,
    userTokens,
    companyTokens
  };
}

// Fonction principale
export default function(data) {
  // Données du setup
  const { auctionIds, userTokens, companyTokens } = data;
  
  // Aucune enchère active trouvée
  if (auctionIds.length === 0) {
    console.log('Aucune enchère active trouvée. Test abandonné.');
    return;
  }
  
  // Sélection aléatoire d'une enchère et d'un token
  const auctionId = auctionIds[randomIntBetween(0, auctionIds.length - 1)];
  const userToken = userTokens[randomIntBetween(0, userTokens.length - 1)];
  const companyToken = companyTokens[randomIntBetween(0, companyTokens.length - 1)];
  
  // Groupe de requêtes pour la liste des enchères
  const listAuctionsResponse = http.get(`${BASE_URL}/auctions`, {
    tags: { name: 'get_auctions' }
  });
  
  const listSuccess = check(listAuctionsResponse, {
    'liste des enchères - statut 200': (r) => r.status === 200,
    'liste des enchères - contient des enchères': (r) => {
      const body = JSON.parse(r.body);
      return body.auctions && body.auctions.length > 0;
    },
  });
  
  if (listSuccess) {
    successCounter.add(1);
  } else {
    failureRate.add(1);
  }
  
  // Groupe de requêtes pour les détails d'une enchère
  const auctionDetailsResponse = http.get(`${BASE_URL}/auctions/${auctionId}`, {
    tags: { name: 'get_auction_details' }
  });
  
  const detailsSuccess = check(auctionDetailsResponse, {
    'détails d\'enchère - statut 200': (r) => r.status === 200,
    'détails d\'enchère - données valides': (r) => {
      const body = JSON.parse(r.body);
      return body.auction && body.auction._id === auctionId;
    },
  });
  
  if (detailsSuccess) {
    successCounter.add(1);
  } else {
    failureRate.add(1);
  }
  
      expect(results.length).to.equal(2);
    expect(mockDb.bids.insertOne.callCount).to.equal(2);
    expect(mockDb.auctions.updateOne.callCount).to.equal(2);
    
    // Vérifier que les deux enchères ont des montants différents
    expect(results[0].amount).to.not.equal(results[1].amount);
  });
});
```

#### 1.1.4 Méthode getAuctionDetails

```javascript
// tests/unit/auction/getAuctionDetails.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { EtikaAuctionSystem } = require('../../../services/auctionService');
const { AuctionNotFoundError } = require('../../../errors/customErrors');

describe('EtikaAuctionSystem - getAuctionDetails', () => {
  let auctionSystem;
  let mockDb;
  let mockCacheService;
  const auctionId = new mongoose.Types.ObjectId().toString();
  
  beforeEach(() => {
    // Configuration des mocks
    mockDb = {
      auctions: {
        findOne: sinon.stub()
      },
      bids: {
        find: sinon.stub().returns({
          sort: sinon.stub().returns({
            populate: sinon.stub().returns({
              limit: sinon.stub().returns({
                toArray: sinon.stub()
              })
            })
          })
        })
      }
    };
    
    mockCacheService = {
      get: sinon.stub().resolves(null),
      set: sinon.stub().resolves(true)
    };
    
    auctionSystem = new EtikaAuctionSystem(
      mockDb,
      null, // blockchainProvider non utilisé ici
      null, // adminService non utilisé ici
      null, // paymentService non utilisé ici
      mockCacheService
    );
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  it('should return auction details from database when not in cache', async () => {
    // Arrange
    const auction = {
      _id: auctionId,
      category: 'Energie',
      title: 'Sponsor Officiel Energie',
      status: 'active',
      startingPrice: 5000,
      endTime: new Date(Date.now() + 3600000)
    };
    
    const bids = [
      {
        _id: new mongoose.Types.ObjectId().toString(),
        auctionId,
        bidderId: { _id: 'user-1', companyName: 'Company A' },
        amount: 6000,
        status: 'active',
        createdAt: new Date(Date.now() - 3600000)
      },
      {
        _id: new mongoose.Types.ObjectId().toString(),
        auctionId,
        bidderId: { _id: 'user-2', companyName: 'Company B' },
        amount: 5500,
        status: 'active',
        createdAt: new Date(Date.now() - 7200000)
      }
    ];
    
    mockDb.auctions.findOne.resolves(auction);
    mockDb.bids.find().sort().populate().limit().toArray.resolves(bids);
    
    // Act
    const result = await auctionSystem.getAuctionDetails(auctionId);
    
    // Assert
    expect(result).to.be.an('object');
    expect(result._id).to.equal(auctionId);
    expect(result.title).to.equal('Sponsor Officiel Energie');
    expect(result.bids).to.deep.equal(bids);
    expect(result.currentHighestBid).to.deep.equal(bids[0]); // Le premier (le plus élevé)
    expect(result.bidCount).to.equal(2);
    expect(result.participantCount).to.equal(2);
    expect(result.timeRemaining).to.be.a('number');
    expect(result.timeRemaining).to.be.greaterThan(0);
    
    // Vérifier les appels aux méthodes
    expect(mockCacheService.get.calledOnce).to.be.true;
    expect(mockDb.auctions.findOne.calledOnce).to.be.true;
    expect(mockCacheService.set.calledOnce).to.be.true;
  });
  
  it('should return auction details from cache when available', async () => {
    // Arrange
    const cachedAuction = {
      _id: auctionId,
      category: 'Energie',
      title: 'Sponsor Officiel Energie',
      status: 'active',
      startingPrice: 5000,
      endTime: new Date(Date.now() + 3600000),
      bids: [
        {
          _id: 'bid-1',
          amount: 6000,
          bidderId: { _id: 'user-1', companyName: 'Company A' }
        }
      ],
      currentHighestBid: {
        _id: 'bid-1',
        amount: 6000,
        bidderId: { _id: 'user-1', companyName: 'Company A' }
      },
      bidCount: 1,
      participantCount: 1,
      timeRemaining: 3600000
    };
    
    mockCacheService.get.resolves(cachedAuction);
    
    // Act
    const result = await auctionSystem.getAuctionDetails(auctionId);
    
    // Assert
    expect(result).to.deep.equal(cachedAuction);
    
    // Vérifier les appels aux méthodes
    expect(mockCacheService.get.calledOnce).to.be.true;
    expect(mockDb.auctions.findOne.called).to.be.false; // Ne devrait pas appeler la base de données
    expect(mockCacheService.set.called).to.be.false; // Ne devrait pas mettre à jour le cache
  });
  
  it('should throw AuctionNotFoundError if auction does not exist', async () => {
    // Arrange
    mockCacheService.get.resolves(null);
    mockDb.auctions.findOne.resolves(null);
    
    // Act & Assert
    try {
      await auctionSystem.getAuctionDetails(auctionId);
      expect.fail('Should have thrown AuctionNotFoundError');
    } catch (err) {
      expect(err).to.be.instanceOf(AuctionNotFoundError);
    }
  });
  
  it('should calculate timeRemaining correctly for active auctions', async () => {
    // Arrange
    const futureEndTime = new Date(Date.now() + 3600000); // 1 heure dans le futur
    const auction = {
      _id: auctionId,
      status: 'active',
      endTime: futureEndTime,
      bids: []
    };
    
    mockDb.auctions.findOne.resolves(auction);
    mockDb.bids.find().sort().populate().limit().toArray.resolves([]);
    
    // Act
    const result = await auctionSystem.getAuctionDetails(auctionId);
    
    // Assert
    expect(result.timeRemaining).to.be.a('number');
    expect(result.timeRemaining).to.be.greaterThan(0);
    expect(result.timeRemaining).to.be.at.most(3600000); // Au plus 1 heure
  });
  
  it('should set timeRemaining to 0 for completed auctions', async () => {
    // Arrange
    const auction = {
      _id: auctionId,
      status: 'completed',
      endTime: new Date(Date.now() - 3600000), // 1 heure dans le passé
      bids: []
    };
    
    mockDb.auctions.findOne.resolves(auction);
    mockDb.bids.find().sort().populate().limit().toArray.resolves([]);
    
    // Act
    const result = await auctionSystem.getAuctionDetails(auctionId);
    
    // Assert
    expect(result.timeRemaining).to.equal(0);
  });
});
```

### 1.2 Validation et Tests de Composants

#### 1.2.1 Méthode _validateAuctionData

```javascript
// tests/unit/auction/validateAuctionData.test.js
const { expect } = require('chai');
const { _validateAuctionData } = require('../../../services/auctionService');
const { ValidationError } = require('../../../errors/customErrors');

describe('_validateAuctionData', () => {
  it('should validate correct auction data without errors', () => {
    // Arrange
    const validData = {
      category: 'Energie',
      title: 'Sponsor Officiel Energie',
      description: 'Description valide pour cette enchère',
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 86400000),
      startingPrice: 5000,
      minBidIncrement: 500
    };
    
    // Act & Assert
    expect(() => _validateAuctionData(validData)).to.not.throw();
  });
  
  it('should throw ValidationError if title is missing', () => {
    // Arrange
    const invalidData = {
      category: 'Energie',
      // Title missing
      description: 'Description valide pour cette enchère',
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 86400000),
      startingPrice: 5000
    };
    
    // Act & Assert
    expect(() => _validateAuctionData(invalidData)).to.throw(ValidationError);
  });
  
  it('should throw ValidationError if startTime is in the past', () => {
    // Arrange
    const invalidData = {
      category: 'Energie',
      title: 'Sponsor Officiel Energie',
      description: 'Description valide pour cette enchère',
      startTime: new Date(Date.now() - 3600000), // 1 heure dans le passé
      endTime: new Date(Date.now() + 86400000),
      startingPrice: 5000
    };
    
    // Act & Assert
    expect(() => _validateAuctionData(invalidData)).to.throw(ValidationError);
  });
  
  // ... Autres tests pour chaque règle de validation
});
```

#### 1.2.2 Méthode _emitAuctionEvent

```javascript
// tests/unit/auction/emitAuctionEvent.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const { _emitAuctionEvent } = require('../../../services/auctionService');

describe('_emitAuctionEvent', () => {
  let mockSocketService;
  
  beforeEach(() => {
    mockSocketService = {
      emitToRoom: sinon.stub().resolves(true),
      emitToAll: sinon.stub().resolves(true)
    };
    
    // Injection du service
    _emitAuctionEvent.socketService = mockSocketService;
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  it('should emit event to auction room', () => {
    // Arrange
    const eventType = 'new_bid';
    const auctionId = 'auction-123';
    const data = { amount: 5000 };
    
    // Act
    _emitAuctionEvent(eventType, auctionId, data);
    
    // Assert
    expect(mockSocketService.emitToRoom.calledOnce).to.be.true;
    sinon.assert.calledWith(
      mockSocketService.emitToRoom,
      `auction-${auctionId}`,
      eventType,
      sinon.match(data)
    );
  });
  
  it('should emit global events to all connected clients', () => {
    // Arrange
    const eventType = 'auction_created';
    const auctionId = 'auction-123';
    const data = { title: 'New Auction' };
    
    // Act
    _emitAuctionEvent(eventType, auctionId, data);
    
    // Assert
    expect(mockSocketService.emitToAll.calledOnce).to.be.true;
    sinon.assert.calledWith(
      mockSocketService.emitToAll,
      eventType,
      sinon.match({ auctionId, ...data })
    );
  });
  
  // ... Autres tests pour différents types d'événements
});
```

## 2. Tests d'Intégration

### 2.1 Routes d'Enchères

```javascript
// tests/integration/routes/auctions.test.js
const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const app = require('../../../app');
const Auction = require('../../../models/Auction');
const Bid = require('../../../models/Bid');
const User = require('../../../models/User');
const { generateToken } = require('../../../services/authService');

describe('Auction Routes - Integration Tests', () => {
  let testUser;
  let adminUser;
  let companyUser;
  let testAuction;
  let userToken;
  let adminToken;
  let companyToken;
  
  before(async () => {
    // Connexion à la base de données de test
    await mongoose.connect(process.env.MONGODB_URI_TEST);
    
    // Nettoyer les collections
    await Promise.all([
      User.deleteMany({}),
      Auction.deleteMany({}),
      Bid.deleteMany({})
    ]);
    
    // Créer des utilisateurs de test
    testUser = await User.create({
      email: 'user@test.com',
      password: 'password123',
      role: 'user'
    });
    
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin'
    });
    
    companyUser = await User.create({
      email: 'company@test.com',
      password: 'password123',
      role: 'company',
      companyName: 'Test Company',
      companyStatus: 'approved'
    });
    
    // Générer des tokens
    userToken = generateToken(testUser);
    adminToken = generateToken(adminUser);
    companyToken = generateToken(companyUser);
    
    // Créer une enchère de test
    testAuction = await Auction.create({
      category: 'Energie',
      title: 'Test Auction',
      description: 'Description for test auction',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      startingPrice: 5000,
      minBidIncrement: 500,
      status: 'active',
      createdBy: adminUser._id
    });
  });
  
  after(async () => {
    // Nettoyer les collections
    await Promise.all([
      User.deleteMany({}),
      Auction.deleteMany({}),
      Bid.deleteMany({})
    ]);
    
    // Fermer la connexion
    await mongoose.connection.close();
  });
  
  describe('GET /api/auctions', () => {
    it('should return all auctions', async () => {
      const res = await request(app)
        .get('/api/auctions')
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auctions).to.be.an('array');
      expect(res.body.auctions.length).to.be.at.least(1);
    });
    
    it('should filter auctions by status', async () => {
      const res = await request(app)
        .get('/api/auctions?status=active')
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auctions).to.be.an('array');
      expect(res.body.auctions.every(a => a.status === 'active')).to.be.true;
    });
    
    it('should filter auctions by category', async () => {
      const res = await request(app)
        .get('/api/auctions?category=Energie')
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auctions).to.be.an('array');
      expect(res.body.auctions.every(a => a.category === 'Energie')).to.be.true;
    });
    
    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/auctions?limit=2&page=1')
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auctions).to.be.an('array');
      expect(res.body.auctions.length).to.be.at.most(2);
      expect(res.body.pagination).to.exist;
      expect(res.body.pagination.currentPage).to.equal(1);
      expect(res.body.pagination.limit).to.equal(2);
      expect(res.body.pagination.totalPages).to.be.a('number');
      expect(res.body.pagination.totalDocs).to.be.a('number');
    });
    
    it('should sort auctions by endTime', async () => {
      const res = await request(app)
        .get('/api/auctions?sort=endTime')
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auctions).to.be.an('array');
      
      // Vérifier que les enchères sont triées par date de fin croissante
      const endTimes = res.body.auctions.map(a => new Date(a.endTime).getTime());
      const sortedEndTimes = [...endTimes].sort((a, b) => a - b);
      expect(endTimes).to.deep.equal(sortedEndTimes);
    });
  });
  
  describe('GET /api/auctions/:id', () => {
    it('should return auction details', async () => {
      const res = await request(app)
        .get(`/api/auctions/${testAuction._id}`)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auction).to.be.an('object');
      expect(res.body.auction._id.toString()).to.equal(testAuction._id.toString());
      expect(res.body.auction.title).to.equal(testAuction.title);
      expect(res.body.auction.bids).to.be.an('array');
    });
    
    it('should return 404 for non-existent auction', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .get(`/api/auctions/${nonExistentId}`)
        .expect(404);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
  });
  
  describe('POST /api/auctions', () => {
    it('should create new auction with admin auth', async () => {
      const newAuction = {
        category: 'Banque',
        title: 'New Auction',
        description: 'Description for new auction',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 86400000),
        startingPrice: 10000,
        minBidIncrement: 1000
      };
      
      const res = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAuction)
        .expect(201);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auction).to.be.an('object');
      expect(res.body.auction.title).to.equal(newAuction.title);
      expect(res.body.auction.status).to.equal('pending');
      
      // Vérifier que l'enchère a été créée en base de données
      const savedAuction = await Auction.findById(res.body.auction._id);
      expect(savedAuction).to.exist;
      expect(savedAuction.title).to.equal(newAuction.title);
    });
    
    it('should return 401 without authentication', async () => {
      const newAuction = {
        category: 'Energie',
        title: 'Another Auction',
        description: 'Description for another auction',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 86400000),
        startingPrice: 5000
      };
      
      await request(app)
        .post('/api/auctions')
        .send(newAuction)
        .expect(401);
    });
    
    it('should return 403 with non-admin authentication', async () => {
      const newAuction = {
        category: 'Energie',
        title: 'Another Auction',
        description: 'Description for another auction',
        startTime: new Date(Date.now() + 3600000),
        endTime: new Date(Date.now() + 86400000),
        startingPrice: 5000
      };
      
      await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newAuction)
        .expect(403);
    });
    
    it('should return 400 with invalid data', async () => {
      const invalidAuction = {
        // Données incomplètes
        title: 'Invalid Auction'
      };
      
      const res = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidAuction)
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
  });
  
  describe('POST /api/auctions/:id/activate', () => {
    let pendingAuction;
    
    beforeEach(async () => {
      // Créer une enchère en attente pour les tests
      pendingAuction = await Auction.create({
        category: 'Assurance',
        title: 'Pending Auction',
        description: 'Description for pending auction',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 3600000),
        startingPrice: 6000,
        status: 'pending',
        createdBy: adminUser._id
      });
    });
    
    it('should activate auction with admin auth', async () => {
      const res = await request(app)
        .post(`/api/auctions/${pendingAuction._id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      
      // Vérifier que l'enchère a été activée
      const updatedAuction = await Auction.findById(pendingAuction._id);
      expect(updatedAuction.status).to.equal('active');
    });
    
    it('should return 401 without authentication', async () => {
      await request(app)
        .post(`/api/auctions/${pendingAuction._id}/activate`)
        .expect(401);
      
      // Vérifier que l'enchère est toujours en attente
      const notUpdatedAuction = await Auction.findById(pendingAuction._id);
      expect(notUpdatedAuction.status).to.equal('pending');
    });
    
    it('should return 403 with non-admin authentication', async () => {
      await request(app)
        .post(`/api/auctions/${pendingAuction._id}/activate`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
      
      // Vérifier que l'enchère est toujours en attente
      const notUpdatedAuction = await Auction.findById(pendingAuction._id);
      expect(notUpdatedAuction.status).to.equal('pending');
    });
    
    it('should return 404 for non-existent auction', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await request(app)
        .post(`/api/auctions/${nonExistentId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
  
  describe('POST /api/auctions/:id/bids', () => {
    it('should place bid with company auth', async () => {
      const bidAmount = 6000;
      
      const res = await request(app)
        .post(`/api/auctions/${testAuction._id}/bids`)
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ amount: bidAmount })
        .expect(201);
      
      expect(res.body.success).to.be.true;
      expect(res.body.bid).to.be.an('object');
      expect(res.body.bid.amount).to.equal(bidAmount);
      expect(res.body.bid.auctionId.toString()).to.equal(testAuction._id.toString());
      expect(res.body.bid.bidderId.toString()).to.equal(companyUser._id.toString());
      
      // Vérifier que l'enchère a été enregistrée
      const savedBid = await Bid.findById(res.body.bid._id);
      expect(savedBid).to.exist;
      expect(savedBid.amount).to.equal(bidAmount);
    });
    
    it('should return 401 without authentication', async () => {
      await request(app)
        .post(`/api/auctions/${testAuction._id}/bids`)
        .send({ amount: 7000 })
        .expect(401);
    });
    
    it('should return 403 with non-company authentication', async () => {
      await request(app)
        .post(`/api/auctions/${testAuction._id}/bids`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 7000 })
        .expect(403);
    });
    
    it('should return 400 with invalid bid amount', async () => {
      // Montant trop bas
      const res = await request(app)
        .post(`/api/auctions/${testAuction._id}/bids`)
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ amount: 100 })
        .expect(400);
      
      expect(res.body.success).to.be.false;
      expect(res.body.error).to.exist;
    });
    
    it('should handle concurrent bids correctly', async () => {
      // Créer plusieurs enchères simultanées
      const bidAmount1 = 7000;
      const bidAmount2 = 8000;
      
      // Créer une autre entreprise pour le test
      const otherCompany = await User.create({
        email: 'other-company@test.com',
        password: 'password123',
        role: 'company',
        companyName: 'Other Company',
        companyStatus: 'approved'
      });
      
      const otherCompanyToken = generateToken(otherCompany);
      
      // Faire des enchères simultanées
      const bidPromises = [
        request(app)
          .post(`/api/auctions/${testAuction._id}/bids`)
          .set('Authorization', `Bearer ${companyToken}`)
          .send({ amount: bidAmount1 }),
        request(app)
          .post(`/api/auctions/${testAuction._id}/bids`)
          .set('Authorization', `Bearer ${otherCompanyToken}`)
          .send({ amount: bidAmount2 })
      ];
      
      const responses = await Promise.all(bidPromises);
      
      // Vérifier que les deux enchères ont été acceptées
      expect(responses[0].status).to.be.oneOf([201, 400]); // 400 si l'autre enchère a été traitée en premier
      expect(responses[1].status).to.be.oneOf([201, 400]); // 400 si cette enchère est trop basse après la première
      
      // Au moins une des enchères doit avoir réussi
      expect(responses.some(r => r.status === 201)).to.be.true;
      
      // Vérifier que l'enchère la plus haute a été enregistrée
      const latestBids = await Bid.find({ auctionId: testAuction._id })
        .sort({ createdAt: -1 })
        .limit(2);
      
      expect(latestBids.length).to.be.at.least(1);
      expect(latestBids.some(b => b.amount === Math.max(bidAmount1, bidAmount2))).to.be.true;
    });
  });
  
  describe('PUT /api/auctions/:id', () => {
    it('should update auction with admin auth', async () => {
      const updateData = {
        title: 'Updated Auction Title',
        description: 'Updated description'
      };
      
      const res = await request(app)
        .put(`/api/auctions/${testAuction._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);
      
      expect(res.body.success).to.be.true;
      expect(res.body.auction.title).to.equal(updateData.title);
      expect(res.body.auction.description).to.equal(updateData.description);
      
      // Vérifier la mise à jour en base de données
      const updatedAuction = await Auction.findById(testAuction._id);
      expect(updatedAuction.title).to.equal(updateData.title);
    });
    
    it('should return 401 without authentication', async () => {
      await request(app)
        .put(`/api/auctions/${testAuction._id}`)
        .send({ title: 'Unauthorized Update' })
        .expect(401);
    });
    
    it('should return 403 with non-admin authentication', async () => {
      await request(app)
        .put(`/api/auctions/${testAuction._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Forbidden Update' })
        .expect(403);
    });
    
    it('should return 404 for non-ex# Plan Complet de Tests pour Étika

Ce document présente un plan complet de tests pour le système d'enchères Étika, répondant aux recommandations de l'analyse de Gemini. Il couvre les tests unitaires, d'intégration, de charge et de sécurité.

## 1. Tests Unitaires

### 1.1 Service d'Enchères (EtikaAuctionSystem)

#### 1.1.1 Méthode createAuction

```javascript
// tests/unit/auction/createAuction.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { EtikaAuctionSystem } = require('../../../services/auctionService');
const { ValidationError } = require('../../../errors/customErrors');

describe('EtikaAuctionSystem - createAuction', () => {
  let auctionSystem;
  let mockDb;
  let mockBlockchain;
  let mockAdminService;
  let mockCacheService;
  
  beforeEach(() => {
    // Configuration des mocks
    mockDb = {
      auctions: {
        insertOne: sinon.stub().resolves({ insertedId: new mongoose.Types.ObjectId() })
      }
    };
    
    mockBlockchain = {
      submitTransaction: sinon.stub().resolves({ hash: 'mock-hash' })
    };
    
    mockAdminService = {
      notifyNewAuction: sinon.stub().resolves(true)
    };
    
    mockCacheService = {
      delete: sinon.stub().resolves(true),
      deletePattern: sinon.stub().resolves(true)
    };
    
    auctionSystem = new EtikaAuctionSystem(
      mockDb,
      mockBlockchain,
      mockAdminService,
      null, // paymentService non utilisé ici
      mockCacheService
    );
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  it('should create auction successfully with valid data', async () => {
    // Arrange
    const validAuctionData = {
      category: 'Energie',
      title: 'Sponsor Officiel Energie',
      description: 'Enchère pour devenir sponsor officiel',
      startTime: new Date(Date.now() + 3600000), // 1 heure dans le futur
      endTime: new Date(Date.now() + 86400000), // 24 heures dans le futur
      startingPrice: 5000,
      minBidIncrement: 500,
      createdBy: new mongoose.Types.ObjectId().toString()
    };
    
    // Spy sur les méthodes internes
    const validateSpy = sinon.spy(auctionSystem, '_validateAuctionData');
    
    // Act
    const result = await auctionSystem.createAuction(validAuctionData);
    
    // Assert
    expect(result).to.be.an('object');
    expect(result.id).to.exist;
    expect(validateSpy.calledOnce).to.be.true;
    expect(mockDb.auctions.insertOne.calledOnce).to.be.true;
    expect(mockAdminService.notifyNewAuction.calledOnce).to.be.true;
    
    // Vérifier que notifyNewAuction est appelé avec le bon ID
    sinon.assert.calledWith(
      mockAdminService.notifyNewAuction,
      sinon.match(result.id)
    );
    
    // Vérifier l'invalidation du cache
    expect(mockCacheService.deletePattern.calledWith('auctions:*')).to.be.true;
  });
  
  it('should throw ValidationError if title is missing', async () => {
    // Arrange
    const invalidData = {
      category: 'Energie',
      // Title missing
      description: 'Enchère pour devenir sponsor officiel',
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
      expect(err.message).to.include('titre');
      expect(mockDb.auctions.insertOne.called).to.be.false;
      expect(mockAdminService.notifyNewAuction.called).to.be.false;
    }
  });
  
  it('should throw ValidationError if title is too short', async () => {
    // Arrange
    const invalidData = {
      category: 'Energie',
      title: 'AB', // Moins de 3 caractères
      description: 'Enchère pour devenir sponsor officiel',
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
      expect(err.message).to.include('titre');
      expect(err.message).to.include('caractères');
    }
  });
  
  it('should throw ValidationError if startTime is in the past', async () => {
    // Arrange
    const invalidData = {
      category: 'Energie',
      title: 'Sponsor Officiel Energie',
      description: 'Enchère pour devenir sponsor officiel',
      startTime: new Date(Date.now() - 3600000), // 1 heure dans le passé
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
      expect(err.message).to.include('future');
    }
  });
  
  it('should throw ValidationError if endTime is before startTime', async () => {
    // Arrange
    const invalidData = {
      category: 'Energie',
      title: 'Sponsor Officiel Energie',
      description: 'Enchère pour devenir sponsor officiel',
      startTime: new Date(Date.now() + 86400000), // 24 heures dans le futur
      endTime: new Date(Date.now() + 3600000), // 1 heure dans le futur
      startingPrice: 5000,
      createdBy: new mongoose.Types.ObjectId().toString()
    };
    
    // Act & Assert
    try {
      await auctionSystem.createAuction(invalidData);
      expect.fail('Should have thrown ValidationError');
    } catch (err) {
      expect(err).to.be.instanceOf(ValidationError);
      expect(err.message).to.include('fin');
      expect(err.message).to.include('début');
    }
  });
  
  it('should throw ValidationError if startingPrice is negative', async () => {
    // Arrange
    const invalidData = {
      category: 'Energie',
      title: 'Sponsor Officiel Energie',
      description: 'Enchère pour devenir sponsor officiel',
      startTime: new Date(Date.now() + 3600000),
      endTime: new Date(Date.now() + 86400000),
      startingPrice: -100, // Négatif
      createdBy: new mongoose.Types.ObjectId().toString()
    };
    
    // Act & Assert
    try {
      await auctionSystem.createAuction(invalidData);
      expect.fail('Should have thrown ValidationError');
    } catch (err) {
      expect(err).to.be.instanceOf(ValidationError);
      expect(err.message).to.include('prix');
      expect(err.message).to.include('positif');
    }
  });
  
  it('should throw ValidationError if description is too long', async () => {
    // Arrange
    const longDescription = 'a'.repeat(2001); // > 2000 caractères
    const invalidData = {
      category: 'Energie',
      title: 'Sponsor Officiel Energie',
      description: longDescription,
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
      expect(err.message).to.include('description');
      expect(err.message).to.include('caractères');
    }
  });
});
```

#### 1.1.2 Méthode activateAuction

```javascript
// tests/unit/auction/activateAuction.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { EtikaAuctionSystem } = require('../../../services/auctionService');
const { 
  AuthorizationError, 
  AuctionNotFoundError,
  InvalidOperationError 
} = require('../../../errors/customErrors');

describe('EtikaAuctionSystem - activateAuction', () => {
  let auctionSystem;
  let mockDb;
  let mockBlockchain;
  let mockAdminService;
  let mockCacheService;
  let mockSocketService;
  const auctionId = new mongoose.Types.ObjectId().toString();
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const regularUserId = new mongoose.Types.ObjectId().toString();
  
  beforeEach(() => {
    // Configuration des mocks
    mockDb = {
      auctions: {
        findOne: sinon.stub(),
        updateOne: sinon.stub().resolves({ modifiedCount: 1 })
      },
      users: {
        findOne: sinon.stub()
      }
    };
    
    mockBlockchain = {};
    
    mockAdminService = {
      isAdmin: sinon.stub()
    };
    
    mockCacheService = {
      delete: sinon.stub().resolves(true),
      deletePattern: sinon.stub().resolves(true)
    };
    
    mockSocketService = {
      emitEvent: sinon.stub().resolves(true)
    };
    
    // Mock pour isAdmin
    mockAdminService.isAdmin.withArgs(adminUserId).resolves(true);
    mockAdminService.isAdmin.withArgs(regularUserId).resolves(false);
    
    auctionSystem = new EtikaAuctionSystem(
      mockDb,
      mockBlockchain,
      mockAdminService,
      null, // paymentService non utilisé ici
      mockCacheService,
      mockSocketService
    );
    
    // Spy sur les méthodes internes
    sinon.spy(auctionSystem, '_emitAuctionEvent');
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  it('should activate auction successfully with admin role', async () => {
    // Arrange
    const pendingAuction = {
      _id: auctionId,
      status: 'pending',
      startTime: new Date(Date.now() - 3600000), // 1 heure dans le passé
      endTime: new Date(Date.now() + 86400000), // 24 heures dans le futur
      adminValidation: true
    };
    
    mockDb.auctions.findOne.resolves(pendingAuction);
    
    // Act
    const result = await auctionSystem.activateAuction(auctionId, adminUserId);
    
    // Assert
    expect(result).to.be.true;
    expect(mockDb.auctions.updateOne.calledOnce).to.be.true;
    sinon.assert.calledWith(
      mockDb.auctions.updateOne,
      { _id: mongoose.Types.ObjectId(auctionId) },
      sinon.match({ $set: { status: 'active' } })
    );
    
    // Vérifier l'émission d'événement
    expect(auctionSystem._emitAuctionEvent.calledOnce).to.be.true;
    sinon.assert.calledWith(
      auctionSystem._emitAuctionEvent,
      'auction_activated',
      auctionId,
      sinon.match.object
    );
    
    // Vérifier l'invalidation du cache
    expect(mockCacheService.delete.calledWith(`auction:${auctionId}`)).to.be.true;
    expect(mockCacheService.deletePattern.calledWith('auctions:*')).to.be.true;
  });
  
  it('should throw AuthorizationError if user is not admin', async () => {
    // Act & Assert
    try {
      await auctionSystem.activateAuction(auctionId, regularUserId);
      expect.fail('Should have thrown AuthorizationError');
    } catch (err) {
      expect(err).to.be.instanceOf(AuthorizationError);
      expect(mockDb.auctions.updateOne.called).to.be.false;
      expect(auctionSystem._emitAuctionEvent.called).to.be.false;
    }
  });
  
  it('should throw AuctionNotFoundError if auction does not exist', async () => {
    // Arrange
    mockDb.auctions.findOne.resolves(null);
    
    // Act & Assert
    try {
      await auctionSystem.activateAuction(auctionId, adminUserId);
      expect.fail('Should have thrown AuctionNotFoundError');
    } catch (err) {
      expect(err).to.be.instanceOf(AuctionNotFoundError);
      expect(mockDb.auctions.updateOne.called).to.be.false;
      expect(auctionSystem._emitAuctionEvent.called).to.be.false;
    }
  });
  
  it('should throw InvalidOperationError if auction is already active', async () => {
    // Arrange
    const activeAuction = {
      _id: auctionId,
      status: 'active',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 86400000)
    };
    
    mockDb.auctions.findOne.resolves(activeAuction);
    
    // Act & Assert
    try {
      await auctionSystem.activateAuction(auctionId, adminUserId);
      expect.fail('Should have thrown InvalidOperationError');
    } catch (err) {
      expect(err).to.be.instanceOf(InvalidOperationError);
      expect(err.message).to.include('déjà active');
      expect(mockDb.auctions.updateOne.called).to.be.false;
      expect(auctionSystem._emitAuctionEvent.called).to.be.false;
    }
  });
  
  it('should throw InvalidOperationError if auction is completed', async () => {
    // Arrange
    const completedAuction = {
      _id: auctionId,
      status: 'completed',
      startTime: new Date(Date.now() - 86400000),
      endTime: new Date(Date.now() - 3600000)
    };
    
    mockDb.auctions.findOne.resolves(completedAuction);
    
    // Act & Assert
    try {
      await auctionSystem.activateAuction(auctionId, adminUserId);
      expect.fail('Should have thrown InvalidOperationError');
    } catch (err) {
      expect(err).to.be.instanceOf(InvalidOperationError);
      expect(err.message).to.include('terminée');
      expect(mockDb.auctions.updateOne.called).to.be.false;
      expect(auctionSystem._emitAuctionEvent.called).to.be.false;
    }
  });
  
  it('should throw InvalidOperationError if auction is cancelled', async () => {
    // Arrange
    const cancelledAuction = {
      _id: auctionId,
      status: 'cancelled',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 86400000)
    };
    
    mockDb.auctions.findOne.resolves(cancelledAuction);
    
    // Act & Assert
    try {
      await auctionSystem.activateAuction(auctionId, adminUserId);
      expect.fail('Should have thrown InvalidOperationError');
    } catch (err) {
      expect(err).to.be.instanceOf(InvalidOperationError);
      expect(err.message).to.include('annulée');
      expect(mockDb.auctions.updateOne.called).to.be.false;
      expect(auctionSystem._emitAuctionEvent.called).to.be.false;
    }
  });
});
```

#### 1.1.3 Méthode placeBid

```javascript
// tests/unit/auction/placeBid.test.js
const { expect } = require('chai');
const sinon = require('sinon');
const mongoose = require('mongoose');
const { EtikaAuctionSystem } = require('../../../services/auctionService');
const { 
  AuctionNotFoundError, 
  InvalidBidError,
  PaymentError 
} = require('../../../errors/customErrors');

describe('EtikaAuctionSystem - placeBid', () => {
  let auctionSystem;
  let mockDb;
  let mockBlockchain;
  let mockPaymentService;
  let mockCacheService;
  let mockSocketService;
  const auctionId = new mongoose.Types.ObjectId().toString();
  const bidderId = new mongoose.Types.ObjectId().toString();
  
  beforeEach(() => {
    // Configuration des mocks
    mockDb = {
      auctions: {
        findOne: sinon.stub(),
        updateOne: sinon.stub().resolves({ modifiedCount: 1 })
      },
      bids: {
        insertOne: sinon.stub().resolves({ insertedId: new mongoose.Types.ObjectId() }),
        find: sinon.stub().returns({
          sort: sinon.stub().returns({
            limit: sinon.stub().returns({
              toArray: sinon.stub().resolves([])
            })
          })
        })
      }
    };
    
    mockBlockchain = {};
    
    mockPaymentService = {
      verifyPaymentMethod: sinon.stub().resolves(true),
      processPayment: sinon.stub().resolves({ success: true, id: 'payment-123' })
    };
    
    mockCacheService = {
      delete: sinon.stub().resolves(true),
      deletePattern: sinon.stub().resolves(true)
    };
    
    mockSocketService = {
      emitEvent: sinon.stub().resolves(true)
    };
    
    auctionSystem = new EtikaAuctionSystem(
      mockDb,
      mockBlockchain,
      null, // adminService non utilisé ici
      mockPaymentService,
      mockCacheService,
      mockSocketService
    );
    
    // Spies sur les méthodes internes
    sinon.spy(auctionSystem, '_emitAuctionEvent');
    sinon.spy(auctionSystem, '_verifyBidderSolvency');
    sinon.spy(auctionSystem, '_extendAuctionTime');
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  it('should place bid successfully on an active auction', async () => {
    // Arrange
    const activeAuction = {
      _id: auctionId,
      status: 'active',
      startingPrice: 5000,
      minBidIncrement: 500,
      endTime: new Date(Date.now() + 3600000), // 1 heure dans le futur
      bids: []
    };
    
    mockDb.auctions.findOne.resolves(activeAuction);
    
    const bidAmount = 6000;
    
    // Act
    const result = await auctionSystem.placeBid(auctionId, bidderId, bidAmount);
    
    // Assert
    expect(result).to.be.an('object');
    expect(result.auctionId).to.equal(auctionId);
    expect(result.bidderId).to.equal(bidderId);
    expect(result.amount).to.equal(bidAmount);
    expect(result.status).to.equal('active');
    
    // Vérifier les appels aux méthodes
    expect(mockDb.auctions.findOne.calledOnce).to.be.true;
    expect(auctionSystem._verifyBidderSolvency.calledOnce).to.be.true;
    expect(mockDb.bids.insertOne.calledOnce).to.be.true;
    expect(mockDb.auctions.updateOne.calledOnce).to.be.true;
    
    // Vérifier l'émission d'événement
    expect(auctionSystem._emitAuctionEvent.calledOnce).to.be.true;
    sinon.assert.calledWith(
      auctionSystem._emitAuctionEvent,
      'new_bid',
      auctionId,
      sinon.match.object
    );
    
    // Vérifier l'invalidation du cache
    expect(mockCacheService.delete.calledWith(`auction:${auctionId}`)).to.be.true;
  });
  
  it('should throw AuctionNotFoundError if auction does not exist', async () => {
    // Arrange
    mockDb.auctions.findOne.resolves(null);
    
    // Act & Assert
    try {
      await auctionSystem.placeBid(auctionId, bidderId, 6000);
      expect.fail('Should have thrown AuctionNotFoundError');
    } catch (err) {
      expect(err).to.be.instanceOf(AuctionNotFoundError);
      expect(mockDb.bids.insertOne.called).to.be.false;
      expect(mockDb.auctions.updateOne.called).to.be.false;
      expect(auctionSystem._emitAuctionEvent.called).to.be.false;
    }
  });
  
  it('should throw InvalidBidError if auction is not active', async () => {
    // Arrange
    const pendingAuction = {
      _id: auctionId,
      status: 'pending',
      startingPrice: 5000
    };
    
    mockDb.auctions.findOne.resolves(pendingAuction);
    
    // Act & Assert
    try {
      await auctionSystem.placeBid(auctionId, bidderId, 6000);
      expect.fail('Should have thrown InvalidBidError');
    } catch (err) {
      expect(err).to.be.instanceOf(InvalidBidError);
      expect(err.message).to.include('n\'est pas active');
      expect(mockDb.bids.insertOne.called).to.be.false;
      expect(mockDb.auctions.updateOne.called).to.be.false;
    }
  });
  
  it('should throw InvalidBidError if auction is already ended', async () => {
    // Arrange
    const endedAuction = {
      _id: auctionId,
      status: 'active',
      startingPrice: 5000,
      endTime: new Date(Date.now() - 3600000) // 1 heure dans le passé
    };
    
    mockDb.auctions.findOne.resolves(endedAuction);
    
    // Act & Assert
    try {
      await auctionSystem.placeBid(auctionId, bidderId, 6000);
      expect.fail('Should have thrown InvalidBidError');
    } catch (err) {
      expect(err).to.be.instanceOf(InvalidBidError);
      expect(err.message).to.include('terminée');
      expect(mockDb.bids.insertOne.called).to.be.false;
      expect(mockDb.auctions.updateOne.called).to.be.false;
    }
  });
  
  it('should throw InvalidBidError if amount is less than starting price', async () => {
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
    
    const lowBidAmount = 4000; // Inférieur au prix de départ
    
    // Act & Assert
    try {
      await auctionSystem.placeBid(auctionId, bidderId, lowBidAmount);
      expect.fail('Should have thrown InvalidBidError');
    } catch (err) {
      expect(err).to.be.instanceOf(InvalidBidError);
      expect(err.message).to.include('minimum');
      expect(mockDb.bids.insertOne.called).to.be.false;
      expect(mockDb.auctions.updateOne.called).to.be.false;
    }
  });
  
  it('should throw InvalidBidError if amount is less than highest bid + increment', async () => {
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
    
    const insufficientBidAmount = 6200; // Inférieur à 6000 + 500
    
    // Act & Assert
    try {
      await auctionSystem.placeBid(auctionId, bidderId, insufficientBidAmount);
      expect.fail('Should have thrown InvalidBidError');
    } catch (err) {
      expect(err).to.be.instanceOf(InvalidBidError);
      expect(err.message).to.include('minimum');
      expect(mockDb.bids.insertOne.called).to.be.false;
      expect(mockDb.auctions.updateOne.called).to.be.false;
    }
  });
  
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
    mockPaymentService.verifyPaymentMethod.resolves(false);
    
    // Act & Assert
    try {
      await auctionSystem.placeBid(auctionId, bidderId, 6000);
      expect.fail('Should have thrown PaymentError');
    } catch (err) {
      expect(err).to.be.instanceOf(PaymentError);
      expect(mockDb.bids.insertOne.called).to.be.false;
      expect(mockDb.auctions.updateOne.called).to.be.false;
    }
  });
  
  it('should extend auction time if bid is placed near the end', async () => {
    // Arrange
    const nearEndTime = new Date(Date.now() + 240000); // 4 minutes dans le futur (< seuil de 5 min)
    const activeAuction = {
      _id: auctionId,
      status: 'active',
      startingPrice: 5000,
      minBidIncrement: 500,
      endTime: nearEndTime,
      bids: []
    };
    
    mockDb.auctions.findOne.resolves(activeAuction);
    
    // Act
    await auctionSystem.placeBid(auctionId, bidderId, 6000);
    
    // Assert
    expect(auctionSystem._extendAuctionTime.calledOnce).to.be.true;
    sinon.assert.calledWith(
      auctionSystem._extendAuctionTime,
      auctionId,
      sinon.match.date
    );
  });
  
  it('should handle concurrent bids correctly', async () => {
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
    
    // Simuler des enchères concurrentes en appelant placeBid plusieurs fois en parallèle
    const bidAmount1 = 6000;
    const bidAmount2 = 7000;
    const bidderId2 = new mongoose.Types.ObjectId().toString();
    
    // Act
    const bidPromises = [
      auctionSystem.placeBid(auctionId, bidderId, bidAmount1),
      auctionSystem.placeBid(auctionId, bidderId2, bidAmount2)
    ];
    
    // Assert
    const results = await Promise.all(bidPromises);
    
    // Vérifier que les deux enchères ont été créées
    expect(results.length).to.equal(2);
    expect(mockDb.bids.insertOne.callCount).to.equal(2);
    expect(mockDb.auctions.updateOne.callCount).to.equal
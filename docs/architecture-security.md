# Architecture de Sécurité - Portail Commerçant Étika

## Table des matières

1. [Introduction](#1-introduction)
2. [Vue d'ensemble de l'architecture de sécurité](#2-vue-densemble-de-larchitecture-de-sécurité)
3. [Authentification et gestion des sessions](#3-authentification-et-gestion-des-sessions)
4. [Gestion des permissions et contrôle d'accès](#4-gestion-des-permissions-et-contrôle-daccès)
5. [Sécurisation des communications API](#5-sécurisation-des-communications-api)
6. [Protection des QR codes](#6-protection-des-qr-codes)
7. [Audit et traçabilité](#7-audit-et-traçabilité)
8. [Stockage sécurisé des données](#8-stockage-sécurisé-des-données)
9. [Bonnes pratiques de développement sécurisé](#9-bonnes-pratiques-de-développement-sécurisé)
10. [Tests de sécurité](#10-tests-de-sécurité)
11. [Gestion des vulnérabilités](#11-gestion-des-vulnérabilités)
12. [Plans d'évolution](#12-plans-dévolution)

## 1. Introduction

Ce document détaille l'architecture de sécurité du portail commerçant de l'écosystème Étika. L'interface web des commerçants constitue un point d'accès critique au système financier d'Étika, nécessitant des mesures de sécurité robustes pour protéger les transactions, les relations commerciales et les données sensibles.

### 1.1 Objectifs de sécurité

- **Confidentialité** : Protection des données sensibles contre les accès non autorisés
- **Intégrité** : Garantir que les données ne sont pas altérées
- **Disponibilité** : Assurer l'accès aux services lorsque nécessaire
- **Authentification** : Vérifier l'identité des utilisateurs
- **Autorisation** : Contrôler l'accès aux fonctionnalités selon les permissions
- **Non-répudiation** : Garantir qu'une transaction ne peut être niée
- **Traçabilité** : Journaliser les activités pour audit et détection d'anomalies

## 2. Vue d'ensemble de l'architecture de sécurité

L'architecture de sécurité s'articule autour de plusieurs couches de protection :

```
┌─────────────────────────────────────────────────────────────────┐
│                     Interface Utilisateur                        │
│ ┌───────────────┐ ┌────────────────┐ ┌────────────────────────┐ │
│ │ Composants UI │ │ Guards d'accès │ │ Validation des entrées │ │
│ └───────────────┘ └────────────────┘ └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Couche des Services                         │
│ ┌────────────────┐ ┌────────────┐ ┌────────────────────────────┐│
│ │ Auth Service   │ │ API Client │ │ Système d'audit et logging ││
│ └────────────────┘ └────────────┘ └────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Mécanismes de Sécurité Transversaux            │
│ ┌───────────────┐ ┌────────────────┐ ┌───────────────────────┐  │
│ │ Chiffrement   │ │ Signatures      │ │ Protection contre XSS │  │
│ │ des données   │ │ cryptographiques│ │ et injections        │  │
│ └───────────────┘ └────────────────┘ └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend & API Étika                        │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Authentification et gestion des sessions

### 3.1 Service d'authentification sécurisé

Le service d'authentification (`authService.ts`) gère l'ensemble du cycle de vie des sessions utilisateur :

- **Authentification par JWT** avec refresh tokens
- **Stockage des tokens chiffrés** dans le localStorage
- **Rotation automatique des tokens** avant expiration
- **Déconnexion sécurisée** avec nettoyage complet des données
- **Timeout d'inactivité** paramétrable
- **Validation des permissions** côté client

```javascript
// Exemple d'implémentation du stockage sécurisé des tokens
setTokens(token: string, refreshToken: string, expiresIn: number): void {
  try {
    // Chiffrer les tokens avant stockage
    const encryptedToken = encryptData(token);
    const encryptedRefreshToken = encryptData(refreshToken);
    
    // Calculer la date d'expiration
    const expiryTime = Date.now() + expiresIn * 1000;
    
    // Stocker les données
    localStorage.setItem(AUTH_TOKEN_KEY, encryptedToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, encryptedRefreshToken);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    
    // Décoder et stocker les données utilisateur
    const decodedToken = this.decodeToken(token);
    if (decodedToken) {
      const userData = {
        id: decodedToken.sub,
        merchantId: decodedToken.merchant_id,
        roles: decodedToken.roles,
        permissions: decodedToken.permissions
      };
      
      localStorage.setItem(USER_DATA_KEY, encryptData(JSON.stringify(userData)));
    }
    
    // Générer et stocker un nouveau token CSRF
    this.refreshCsrfToken();
  } catch (error) {
    console.error('Erreur lors du stockage des tokens:', error);
    this.logout();
  }
}
```

### 3.2 Structure du token JWT

Le token JWT contient les informations suivantes :

```json
{
  "sub": "user_id",
  "merchant_id": "merchant_id",
  "roles": ["merchant", "admin"],
  "permissions": ["transaction:create", "supplier:view"],
  "exp": 1677766824,
  "iat": 1677766824
}
```

### 3.3 Flux d'authentification

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant F as Frontend
    participant A as API Auth
    participant B as API Backend
    
    U->>F: Connexion (identifiants)
    F->>A: POST /auth/login
    A->>F: JWT + Refresh Token
    F->>F: Stocke tokens chiffrés
    
    Note over F: Délai (4h45)
    
    F->>F: Vérification d'expiration
    F->>A: POST /auth/refresh
    A->>F: Nouveaux tokens
    
    Note over F: Requête protégée
    
    F->>B: GET /resource avec Auth + CSRF
    B->>F: Réponse
```

## 4. Gestion des permissions et contrôle d'accès

### 4.1 Système de permissions granulaire

Le système de permissions est basé sur une combinaison de rôles et de permissions spécifiques :

- **Rôles** : Catégories larges d'utilisateurs (ex: `merchant`, `admin`)
- **Permissions** : Actions spécifiques autorisées (ex: `transaction:create`)

### 4.2 Composants de protection d'accès

Le composant `PermissionGuard` contrôle l'accès aux routes et fonctionnalités :

```javascript
<PermissionGuard 
  permissions={[Permission.TRANSACTION_CREATE]}
  roles={['merchant']}
  showDeniedPage={true}
>
  <MySecuredComponent />
</PermissionGuard>
```

### 4.3 Hooks personnalisés pour la vérification des permissions

```javascript
const canCreateTransaction = usePermission(Permission.TRANSACTION_CREATE);

// Conditionnellement rendre un composant
{canCreateTransaction && <CreateTransactionButton />}
```

### 4.4 Composant d'affichage conditionnel basé sur les permissions

```javascript
<PermissionGated 
  permission={Permission.SUPPLIER_UPDATE} 
  fallback={<ReadOnlyView />}
>
  <EditableView />
</PermissionGated>
```

## 5. Sécurisation des communications API

### 5.1 Client API sécurisé

Le client API (`secureClient.ts`) inclut de nombreuses mesures de sécurité :

- **Authentification automatique** avec en-têtes JWT
- **Gestion automatique du rafraîchissement des tokens** en cas d'expiration
- **Protection CSRF** pour les opérations sensibles
- **Handling d'erreurs spécifiques** à la sécurité
- **Journalisation des activités API** pour audit
- **Identifiants de requête uniques** pour le traçage
- **Retry automatique** en cas d'échec de communication

### 5.2 Exemple d'en-têtes de sécurité

```http
GET /api/transactions HTTP/1.1
Host: api.etika.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-CSRF-Token: 7f586b40a1b2c3d4e5f6
X-Request-ID: 1677766824-a1b2c3d4e5f6
```

### 5.3 Interception des requêtes et réponses

```javascript
// Intercepteur pour les requêtes
instance.interceptors.request.use(
  async (config: SecureRequestConfig): Promise<SecureRequestConfig> => {
    try {
      // Vérifier l'authentification si nécessaire
      const requiresAuth = config.requiresAuth !== false;
      
      if (requiresAuth) {
        // Vérifier si l'utilisateur est authentifié
        if (!authService.isAuthenticated()) {
          // Si non authentifié, essayer de rafraîchir le token
          try {
            await authService.refreshToken();
          } catch (error) {
            // Si le rafraîchissement échoue, rediriger vers la connexion
            authService.logout();
            throw new Error('Session expirée. Veuillez vous reconnecter.');
          }
        }
        
        // Ajouter le token d'authentification
        const token = authService.getToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
      
      // Ajouter le token CSRF pour les opérations sensibles
      const requiresCSRF = config.requiresCSRF || 
        ['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '');
      
      if (requiresCSRF) {
        const csrfToken = authService.getCsrfToken();
        if (csrfToken) {
          config.headers = config.headers || {};
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }
      
      return config;
    } catch (error) {
      console.error('Erreur dans l'intercepteur de requêtes:', error);
      return Promise.reject(error);
    }
  }
);
```

### 5.4 Sécurisation des méthodes d'API

Des fonctions dédiées garantissent que les bonnes pratiques de sécurité sont suivies :

```javascript
// POST sécurisé avec CSRF automatique
export const securePost = <T>(url: string, data?: any, config: SecureRequestConfig = {}) => {
  return secureApiClient.post<T>(url, data, {
    ...config,
    requiresCSRF: true
  });
};
```

## 6. Protection des QR codes

### 6.1 Mesures de sécurité pour les QR codes

Les QR codes générés par le système (`SecurePopQRCodeGenerator.tsx`) incluent plusieurs couches de protection :

- **Signatures cryptographiques** pour vérifier l'authenticité
- **Expiration temporelle** pour éviter la réutilisation
- **Verrouillage par PIN** optionnel
- **Basculement de visibilité** pour limiter l'exposition
- **Métadonnées d'origine** (ID marchand, timestamp)
- **Journalisation des générations et utilisations**

### 6.2 Structure des données de QR code

```json
{
  "type": "etika-pop",
  "version": "1.1",
  "transactionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "merchant": "Nom du Commerçant",
  "consumer": "Nom du Consommateur",
  "amount": 123.45,
  "timestamp": "2025-02-28T15:30:45.123Z",
  "expiresAt": "2025-02-28T15:35:45.123Z",
  "sig": "7f8e9d6c5b4a3210"
}
```

### 6.3 Génération de signatures sécurisées

```javascript
// Générer une signature pour vérifier l'authenticité
const merchantId = authService.getMerchantId() || 'unknown';
const dataToSign = `${transactionId}|${merchant}|${consumer}|${transactionAmount}|${timestamp}|${merchantId}`;
const signature = CryptoJS.HmacSHA256(dataToSign, process.env.REACT_APP_QR_SECRET || 'etika-secure-key').toString();
```

### 6.4 Mesures anti-fraude pour les QR codes

- **Limitation du nombre** de générations par période
- **Détection d'anomalies** sur les schémas d'utilisation
- **Verrouillage temporaire** en cas d'activité suspecte
- **Validation multi-parties** (consensus PoP)
- **Vérification de la position** optionnelle
- **Horodatage précis** pour éviter les attaques par rejeu

## 7. Audit et traçabilité

### 7.1 Système de journalisation d'activité

Le système d'audit (`activityLogger.ts`) capture de manière détaillée :

- **Actions utilisateur** (login, génération de QR code, etc.)
- **Accès aux ressources** (consultations, modifications)
- **Événements de sécurité** (tentatives d'accès non autorisées)
- **Activités API** (requêtes, réponses, erreurs)
- **Événements système** (démarrages, arrêts, synchronisations)

### 7.2 Structure des entrées de log

```typescript
interface ActivityLogEntry {
  type: ActivityType;
  timestamp: string;
  userId?: string;
  merchantId?: string;
  details?: Record<string, any>;
  targetId?: string;
  targetType?: string;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  sessionId?: string;
}
```

### 7.3 Stratégie de stockage et synchronisation

- **Stockage local** temporaire pour usage hors-ligne
- **Synchronisation avec le serveur** dès que possible
- **Limitation de taille** pour éviter la saturation
- **Prioritisation des logs critiques**
- **Nettoyage automatique** après synchronisation
- **Encryption des logs sensibles**

### 7.4 Détection d'activités suspectes

```javascript
export const detectSuspiciousActivity = (logs: ActivityLogEntry[]): boolean => {
  // Exemple : détecter trop de tentatives de génération de QR code en peu de temps
  const qrCodeGenerationLogs = logs.filter(log => 
    log.type === ActivityType.QR_CODE_GENERATE && 
    new Date(log.timestamp).getTime() > Date.now() - 60000 // Dernière minute
  );
  
  if (qrCodeGenerationLogs.length > 10) {
    logActivity({
      type: ActivityType.SUSPICIOUS_ACTIVITY,
      details: {
        reason: 'Trop de générations de QR code en peu de temps',
        count: qrCodeGenerationLogs.length
      },
      severity: 'warning'
    });
    return true;
  }
  
  return false;
};
```

## 8. Stockage sécurisé des données

### 8.1 Chiffrement des données sensibles en local

```javascript
// Fonctions de chiffrement/déchiffrement
export const encryptData = (data: string): string => {
  // Dans une implémentation réelle, utiliser Web Crypto API
  const key = process.env.REACT_APP_ENCRYPTION_KEY || 'default-secure-key';
  return CryptoJS.AES.encrypt(data, key).toString();
};

export const decryptData = (encryptedData: string): string => {
  const key = process.env.REACT_APP_ENCRYPTION_KEY || 'default-secure-key';
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};
```

### 8.2 Stratégie de gestion des données sensibles

1. **Minimisation des données** : Stocker uniquement les données nécessaires
2. **Durée de conservation limitée** : Supprimer les données après usage
3. **Isolation des domaines** : Séparer les données par contexte
4. **Chiffrement sélectif** : Chiffrer les données sensibles uniquement
5. **Accès basé sur le besoin** : Limiter l'accès aux seules fonctionnalités nécessaires

### 8.3 Clés de stockage sécurisées

```javascript
// Clés de stockage local avec préfixes spécifiques pour éviter les collisions
const AUTH_TOKEN_KEY = 'etika_auth_token';
const REFRESH_TOKEN_KEY = 'etika_refresh_token';
const TOKEN_EXPIRY_KEY = 'etika_token_expiry';
const USER_DATA_KEY = 'etika_user_data';
const CSRF_TOKEN_KEY = 'etika_csrf_token';
```

## 9. Bonnes pratiques de développement sécurisé

### 9.1 Validation des entrées

Toutes les entrées utilisateur sont validées avec des schémas Zod :

```javascript
const transactionSchema = z.object({
  consumerId: z.string().nonempty('Un consommateur est requis'),
  standardAmount: z.number().positive('Le montant doit être positif'),
  tokensExchanged: z.number().min(0, 'Les tokens doivent être positifs ou nuls'),
  suppliers: z.array(z.string()).optional(),
  receiptNumber: z.string().optional(),
  notes: z.string().optional(),
});
```

### 9.2 Protection contre les vulnérabilités courantes

- **XSS** : Échappement automatique des données dans les composants React
- **CSRF** : Tokens spécifiques pour les opérations d'écriture
- **Injections** : Validation stricte des entrées
- **Clickjacking** : En-têtes X-Frame-Options
- **MITM** : Protocole HTTPS obligatoire
- **Stockage sensible** : Chiffrement des données

### 9.3 Gestion des dépendances

- Analyse régulière des vulnérabilités avec npm audit
- Mise à jour automatique des dépendances non critiques
- Validation manuelle des mises à jour majeures
- Contrôle strict des versions dans package.json

## 10. Tests de sécurité

### 10.1 Types de tests de sécurité

- **Tests unitaires** pour les fonctions de sécurité
- **Tests d'intégration** pour les flux sécurisés
- **Tests de pénétration** réguliers
- **Revues de code** axées sur la sécurité
- **Audits de sécurité** par des tiers

### 10.2 Exemple de test pour le service d'authentification

```javascript
describe('Authentication Service', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should securely store tokens with encryption', () => {
    // Arrange
    const token = 'test-jwt-token';
    const refreshToken = 'test-refresh-token';
    const expiresIn = 3600;
    
    // Act
    authService.setTokens(token, refreshToken, expiresIn);
    
    // Assert
    const storedToken = localStorage.getItem('etika_auth_token');
    expect(storedToken).not.toBe(token); // Doit être chiffré
    expect(storedToken).not.toBeNull();
    
    // Verify decryption works
    expect(decryptData(storedToken!)).toBe(token);
  });
});
```

## 11. Gestion des vulnérabilités

### 11.1 Processus de notification et correction

1. **Découverte** d'une vulnérabilité (interne ou externe)
2. **Évaluation** de la sévérité et de l'impact
3. **Correction** dans une branche dédiée
4. **Validation** par tests de sécurité
5. **Déploiement** selon la criticité
6. **Communication** aux parties prenantes si nécessaire

### 11.2 Classification des vulnérabilités

| Niveau      | Temps de réponse | Critères |
|-------------|------------------|----------|
| Critique    | < 24h            | Accès non autorisé aux données, compromission des tokens |
| Haute       | < 72h            | Contournement de permissions, élévation de privilèges |
| Moyenne     | < 1 semaine      | Fuites d'informations non critiques, DoS limité |
| Basse       | Prochaine release | UI trompeur, problèmes mineurs d'UX de sécurité |

## 12. Plans d'évolution

### 12.1 Améliorations de sécurité planifiées

- **Authentification biométrique** pour les actions sensibles
- **Zero-knowledge proofs** pour certaines validations
- **WebAuthN/FIDO2** pour l'authentification sans mot de passe
- **Détection comportementale** des anomalies
- **Analyse de risque en temps réel** des transactions

### 12.2 Adaptabilité aux nouvelles exigences

L'architecture a été conçue pour s'adapter aux évolutions futures :

- **Plugins de sécurité** via un système de middlewares
- **Configuration externalisée** des paramètres de sécurité
- **API versionnées** pour compatibilité ascendante
- **Feature flags** pour activation progressive
- **Métriques de sécurité** pour surveillance continue

---

## Annexes

### A. Glossaire

- **JWT** : JSON Web Token, standard pour les tokens d'authentification
- **CSRF** : Cross-Site Request Forgery, attaque forçant un utilisateur à exécuter des actions indésirables
- **XSS** : Cross-Site Scripting, injection de code malveillant dans les pages web
- **MITM** : Man In The Middle, interception des communications
- **PoP** : Proof of Purchase, mécanisme de consensus d'Étika

### B. Liste des permissions

| Code Permission | Description | Rôles autorisés |
|-----------------|-------------|-----------------|
| dashboard:view | Accès au tableau de bord | merchant, admin |
| transaction:view | Consultation des transactions | merchant, admin |
| transaction:create | Création de transactions | merchant, admin |
| supplier:view | Consultation des fournisseurs | merchant, admin |
| supplier:create | Ajout de fournisseurs | merchant, admin |
| factoring:view | Consultation de l'affacturage | merchant, admin |
| admin:access | Accès à l'interface admin | admin |

### C. Références

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)

---

*Document version 1.0 - Dernière mise à jour : 28 février 2025*
// src/services/auth/authService.ts
import { jwtDecode } from 'jwt-decode';
import apiClient from 'services/api/client';
import { encryptData, decryptData } from 'utils/crypto';

// Types
interface LoginCredentials {
  email: string;
  password: string;
}

interface TokenResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

interface DecodedToken {
  sub: string;
  merchant_id: string;
  roles: string[];
  permissions: string[];
  exp: number;
  iat: number;
}

// Clés de stockage local sécurisées
const AUTH_TOKEN_KEY = 'etika_auth_token';
const REFRESH_TOKEN_KEY = 'etika_refresh_token';
const TOKEN_EXPIRY_KEY = 'etika_token_expiry';
const USER_DATA_KEY = 'etika_user_data';
const CSRF_TOKEN_KEY = 'etika_csrf_token';

// Intervalle pour la vérification d'expiration du token (en millisecondes)
const TOKEN_CHECK_INTERVAL = 60000; // 1 minute

let tokenCheckIntervalId: number | null = null;
let tokenRefreshPromise: Promise<string> | null = null;

/**
 * Service d'authentification avec gestion sécurisée des tokens
 */
const authService = {
  /**
   * Authentification de l'utilisateur
   */
  async login(credentials: LoginCredentials): Promise<boolean> {
    try {
      const response = await apiClient.post<TokenResponse>('/auth/login', credentials);
      const { token, refreshToken, expiresIn } = response.data;
      
      // Stockage sécurisé des tokens et données utilisateur
      this.setTokens(token, refreshToken, expiresIn);
      
      // Démarrer la vérification périodique du token
      this.startTokenExpiryCheck();
      
      return true;
    } catch (error) {
      console.error('Échec de connexion:', error);
      return false;
    }
  },

  /**
   * Déconnexion et nettoyage sécurisé des données
   */
  logout(): void {
    // Nettoyer le stockage local
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    localStorage.removeItem(CSRF_TOKEN_KEY);
    
    // Arrêter la vérification du token
    if (tokenCheckIntervalId !== null) {
      window.clearInterval(tokenCheckIntervalId);
      tokenCheckIntervalId = null;
    }
    
    // Nettoyer les cookies (CSRF et autres)
    document.cookie.split(';').forEach(cookie => {
      document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
    
    // Redirection vers la page de connexion
    window.location.href = '/login';
  },

  /**
   * Récupération sécurisée du token d'authentification
   */
  getToken(): string | null {
    try {
      const encryptedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!encryptedToken) return null;
      
      return decryptData(encryptedToken);
    } catch (error) {
      this.logout();
      return null;
    }
  },

  /**
   * Récupération du token CSRF pour les requêtes sensibles
   */
  getCsrfToken(): string | null {
    try {
      const encryptedToken = localStorage.getItem(CSRF_TOKEN_KEY);
      if (!encryptedToken) return null;
      
      return decryptData(encryptedToken);
    } catch (error) {
      return null;
    }
  },

  /**
   * Stockage sécurisé des tokens d'authentification
   */
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
  },

  /**
   * Décoder le token JWT pour extraire les informations
   */
  decodeToken(token: string): DecodedToken | null {
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (error) {
      console.error('Erreur de décodage du token:', error);
      return null;
    }
  },

  /**
   * Vérifier si l'utilisateur est authentifié
   */
  isAuthenticated(): boolean {
    try {
      const token = this.getToken();
      if (!token) return false;
      
      const decodedToken = this.decodeToken(token);
      if (!decodedToken) return false;
      
      // Vérifier l'expiration du token
      const currentTime = Date.now() / 1000;
      return decodedToken.exp > currentTime;
    } catch (error) {
      return false;
    }
  },

  /**
   * Vérifier si l'utilisateur a une permission spécifique
   */
  hasPermission(permission: string): boolean {
    try {
      const token = this.getToken();
      if (!token) return false;
      
      const decodedToken = this.decodeToken(token);
      if (!decodedToken || !decodedToken.permissions) return false;
      
      return decodedToken.permissions.includes(permission);
    } catch (error) {
      return false;
    }
  },

  /**
   * Vérifier si l'utilisateur a un rôle spécifique
   */
  hasRole(role: string): boolean {
    try {
      const token = this.getToken();
      if (!token) return false;
      
      const decodedToken = this.decodeToken(token);
      if (!decodedToken || !decodedToken.roles) return false;
      
      return decodedToken.roles.includes(role);
    } catch (error) {
      return false;
    }
  },

  /**
   * Démarrer la vérification périodique d'expiration du token
   */
  startTokenExpiryCheck(): void {
    // Arrêter tout intervalle existant
    if (tokenCheckIntervalId !== null) {
      window.clearInterval(tokenCheckIntervalId);
    }
    
    // Démarrer un nouvel intervalle
    tokenCheckIntervalId = window.setInterval(() => {
      this.checkTokenExpiry();
    }, TOKEN_CHECK_INTERVAL);
  },

  /**
   * Vérifier l'expiration du token et le rafraîchir si nécessaire
   */
  async checkTokenExpiry(): Promise<void> {
    try {
      const expiryTimeStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
      if (!expiryTimeStr) return;
      
      const expiryTime = parseInt(expiryTimeStr, 10);
      const currentTime = Date.now();
      
      // Rafraîchir si le token expire dans moins de 5 minutes
      if (expiryTime - currentTime < 5 * 60 * 1000) {
        await this.refreshToken();
      }
    } catch (error) {
      console.error('Erreur lors de la vérification d\'expiration du token:', error);
    }
  },

  /**
   * Rafraîchir le token d'authentification
   */
  async refreshToken(): Promise<string> {
    // Si un rafraîchissement est déjà en cours, retourner la promesse existante
    if (tokenRefreshPromise) {
      return tokenRefreshPromise;
    }
    
    tokenRefreshPromise = new Promise(async (resolve, reject) => {
      try {
        const encryptedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!encryptedRefreshToken) {
          this.logout();
          reject('Refresh token non disponible');
          return;
        }
        
        const refreshToken = decryptData(encryptedRefreshToken);
        
        const response = await apiClient.post<TokenResponse>('/auth/refresh', {
          refreshToken
        });
        
        const { token, refreshToken: newRefreshToken, expiresIn } = response.data;
        
        // Mettre à jour les tokens
        this.setTokens(token, newRefreshToken, expiresIn);
        
        // Rafraîchir également le token CSRF
        this.refreshCsrfToken();
        
        resolve(token);
      } catch (error) {
        console.error('Échec du rafraîchissement du token:', error);
        this.logout();
        reject(error);
      } finally {
        tokenRefreshPromise = null;
      }
    });
    
    return tokenRefreshPromise;
  },

  /**
   * Générer et stocker un nouveau token CSRF
   */
  refreshCsrfToken(): string {
    // Générer un token CSRF aléatoire
    const csrfToken = Array(32)
      .fill(0)
      .map(() => Math.round(Math.random() * 16).toString(16))
      .join('');
    
    // Stocker le token chiffré
    localStorage.setItem(CSRF_TOKEN_KEY, encryptData(csrfToken));
    
    return csrfToken;
  },

  /**
   * Obtenir l'ID du commerçant connecté
   */
  getMerchantId(): string | null {
    try {
      const encryptedUserData = localStorage.getItem(USER_DATA_KEY);
      if (!encryptedUserData) return null;
      
      const userData = JSON.parse(decryptData(encryptedUserData));
      return userData.merchantId || null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Vérifier l'inactivité de l'utilisateur et déconnecter après un délai
   */
  setupInactivityTimeout(timeoutMinutes: number = 30): void {
    let inactivityTimeout: number | null = null;
    
    // Réinitialiser le minuteur lors d'une activité
    const resetTimer = () => {
      if (inactivityTimeout !== null) {
        window.clearTimeout(inactivityTimeout);
      }
      
      inactivityTimeout = window.setTimeout(() => {
        // Déconnecter l'utilisateur après inactivité
        this.logout();
      }, timeoutMinutes * 60 * 1000);
    };
    
    // Surveiller les événements d'activité
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });
    
    // Initialiser le minuteur
    resetTimer();
  }
};

export default authService;

// Implémentation des fonctions de chiffrement (à placer dans utils/crypto.ts)
// Note: Dans une implémentation réelle, utilisez des algorithmes plus robustes
export const encryptData = (data: string): string => {
  // Implémentation simple pour la démonstration
  // En production, utilisez Web Crypto API ou une bibliothèque de chiffrement
  return btoa(data);
};

export const decryptData = (encryptedData: string): string => {
  // Implémentation simple pour la démonstration
  return atob(encryptedData);
};

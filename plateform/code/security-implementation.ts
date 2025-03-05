// authService.ts - Service d'authentification avancée

import * as jose from 'jose';
import { v4 as uuidv4 } from 'uuid';

// Interface pour les jetons d'authentification
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Interface pour le contexte de sécurité
interface SecurityContext {
  userId: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  ipAddress: string;
  lastActivity: number;
}

/**
 * Service d'authentification avancé avec support multi-facteur
 */
export class AuthService {
  private securityContext: SecurityContext | null = null;
  private refreshTokenTimeout: NodeJS.Timeout | null = null;
  private readonly TOKEN_REFRESH_MARGIN = 5 * 60 * 1000; // 5 minutes en ms
  
  /**
   * Authentification avec support MFA
   */
  async login(username: string, password: string, mfaCode?: string): Promise<boolean> {
    try {
      // 1. Authentification de base
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      // Vérification de l'état initial de la réponse
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresMfa) {
          // L'utilisateur doit fournir une authentification secondaire
          return this.handleMfaChallenge(username, errorData.mfaChallengeToken);
        }
        throw new Error(errorData.message || 'Authentification échouée');
      }
      
      // 2. Traitement des jetons
      const authData = await response.json();
      return this.handleAuthSuccess(authData);
    } catch (error) {
      console.error('Login error:', error);
      // Journalisation des tentatives d'authentification échouées
      this.logSecurityEvent('failed_login_attempt', { username });
      return false;
    }
  }
  
  /**
   * Gestion du challenge MFA si nécessaire
   */
  private async handleMfaChallenge(username: string, challengeToken: string): Promise<boolean> {
    // Déclencher l'UI pour obtenir le code MFA
    const event = new CustomEvent('mfa-required', {
      detail: { username, challengeToken }
    });
    window.dispatchEvent(event);
    return false; // L'authentification n'est pas encore terminée
  }
  
  /**
   * Soumission d'un code MFA pour finaliser l'authentification
   */
  async submitMfaCode(username: string, challengeToken: string, mfaCode: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, challengeToken, mfaCode }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Code MFA invalide');
      }
      
      const authData = await response.json();
      return this.handleAuthSuccess(authData);
    } catch (error) {
      console.error('MFA verification error:', error);
      this.logSecurityEvent('failed_mfa_attempt', { username });
      return false;
    }
  }
  
  /**
   * Traitement des informations d'authentification réussie
   */
  private async handleAuthSuccess(authData: AuthTokens): Promise<boolean> {
    // Stockage sécurisé des jetons
    this.storeTokens(authData);
    
    // Décodage du jeton pour extraire les informations utilisateur
    const decoded = await jose.jwtVerify(
      authData.accessToken,
      new TextEncoder().encode(process.env.REACT_APP_JWT_PUBLIC_KEY || '')
    ).catch(() => null);
    
    if (!decoded) {
      console.error('Invalid JWT token received');
      return false;
    }
    
    // Création du contexte de sécurité
    this.securityContext = {
      userId: decoded.payload.sub as string,
      roles: decoded.payload.roles as string[],
      permissions: decoded.payload.permissions as string[],
      sessionId: decoded.payload.sessionId as string || uuidv4(),
      ipAddress: decoded.payload.ip as string || 'unknown',
      lastActivity: Date.now(),
    };
    
    // Planification du rafraîchissement automatique du token
    this.scheduleTokenRefresh(authData.expiresAt);
    
    // Démarrage de la surveillance d'activité
    this.startActivityMonitoring();
    
    // Journalisation de la connexion réussie
    this.logSecurityEvent('successful_login', {
      userId: this.securityContext.userId,
      roles: this.securityContext.roles,
    });
    
    return true;
  }
  
  /**
   * Gestion du rafraîchissement automatique des tokens
   */
  private scheduleTokenRefresh(expiresAt: number): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
    
    const timeUntilRefresh = expiresAt - Date.now() - this.TOKEN_REFRESH_MARGIN;
    
    if (timeUntilRefresh <= 0) {
      // Le token est déjà expiré ou sur le point d'expirer
      this.refreshTokens();
    } else {
      this.refreshTokenTimeout = setTimeout(() => {
        this.refreshTokens();
      }, timeUntilRefresh);
    }
  }
  
  /**
   * Rafraîchissement des tokens d'authentification
   */
  private async refreshTokens(): Promise<void> {
    try {
      const currentRefreshToken = localStorage.getItem('refreshToken');
      if (!currentRefreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });
      
      if (!response.ok) {
        throw new Error('Token refresh failed');
      }
      
      const authData = await response.json();
      this.storeTokens(authData);
      this.scheduleTokenRefresh(authData.expiresAt);
      
      // Mise à jour du timestamp d'activité
      if (this.securityContext) {
        this.securityContext.lastActivity = Date.now();
      }
      
    } catch (error) {
      console.error('Token refresh error:', error);
      // En cas d'échec, déconnexion de sécurité
      this.logout();
    }
  }
  
  /**
   * Stockage sécurisé des tokens
   */
  private storeTokens(tokens: AuthTokens): void {
    // Stockage du token d'accès dans la mémoire seulement (pas dans localStorage)
    sessionStorage.setItem('accessToken', tokens.accessToken);
    
    // Stockage du refresh token dans localStorage (pour persistance entre sessions)
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('tokenExpiry', tokens.expiresAt.toString());
  }
  
  /**
   * Obtention du token d'authentification pour les requêtes API
   */
  getAccessToken(): string | null {
    return sessionStorage.getItem('accessToken');
  }
  
  /**
   * Surveillance d'inactivité pour déconnexion automatique
   */
  private startActivityMonitoring(): void {
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    
    // Événements à surveiller pour l'activité utilisateur
    const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    
    // Fonction de mise à jour de l'activité
    const updateActivity = () => {
      if (this.securityContext) {
        this.securityContext.lastActivity = Date.now();
      }
    };
    
    // Ajout des écouteurs d'événements
    activityEvents.forEach(eventType => {
      window.addEventListener(eventType, updateActivity);
    });
    
    // Vérification périodique de l'inactivité
    setInterval(() => {
      if (this.securityContext) {
        const inactiveTime = Date.now() - this.securityContext.lastActivity;
        if (inactiveTime > INACTIVITY_TIMEOUT) {
          // Déconnexion pour inactivité
          this.logout('Déconnexion automatique pour inactivité');
        }
      }
    }, 60000); // Vérification toutes les minutes
  }
  
  /**
   * Déconnexion avec invalidation de session
   */
  async logout(reason: string = 'user_initiated'): Promise<void> {
    try {
      // Tentative d'invalidation du token côté serveur
      if (this.securityContext?.sessionId) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAccessToken()}`
          },
          body: JSON.stringify({ 
            sessionId: this.securityContext.sessionId,
            reason
          }),
        }).catch(() => {
          // Ignorer les erreurs lors de la déconnexion
        });
      }
    } finally {
      // Nettoyage local, même en cas d'échec de la requête
      this.clearAuthData();
      
      // Redirection vers la page de connexion
      window.location.href = '/login';
    }
  }
  
  /**
   * Nettoyage des données d'authentification
   */
  private clearAuthData(): void {
    // Nettoyage du contexte de sécurité
    this.securityContext = null;
    
    // Suppression des tokens
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    
    // Annulation du rafraîchissement automatique
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
      this.refreshTokenTimeout = null;
    }
  }
  
  /**
   * Vérification des permissions utilisateur
   */
  hasPermission(permission: string): boolean {
    return !!this.securityContext?.permissions.includes(permission);
  }
  
  /**
   * Vérification d'appartenance à un rôle
   */
  hasRole(role: string): boolean {
    return !!this.securityContext?.roles.includes(role);
  }
  
  /**
   * Journalisation des événements de sécurité
   */
  private async logSecurityEvent(eventType: string, details: Record<string, any>): Promise<void> {
    try {
      await fetch('/api/security/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAccessToken() || ''}`,
        },
        body: JSON.stringify({
          eventType,
          timestamp: new Date().toISOString(),
          userId: this.securityContext?.userId || 'anonymous',
          sessionId: this.securityContext?.sessionId || 'none',
          ipAddress: this.securityContext?.ipAddress || 'unknown',
          userAgent: navigator.userAgent,
          details,
        }),
      });
    } catch (error) {
      // Journalisation locale en cas d'échec de l'envoi au serveur
      console.error('Failed to log security event:', eventType, error);
      
      // Stockage temporaire pour envoi ultérieur
      const pendingLogs = JSON.parse(localStorage.getItem('pendingSecurityLogs') || '[]');
      pendingLogs.push({
        eventType,
        timestamp: new Date().toISOString(),
        details,
      });
      localStorage.setItem('pendingSecurityLogs', JSON.stringify(pendingLogs));
    }
  }
}
// src/services/api/secureClient.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import authService from 'services/auth/authService';
import { logApiActivity } from 'services/monitoring/activityLogger';

// Types pour les options étendues
interface SecureRequestConfig extends AxiosRequestConfig {
  requiresAuth?: boolean;
  requiresCSRF?: boolean;
  skipErrorHandling?: boolean;
  activityLabel?: string;
}

/**
 * Crée un client API sécurisé avec une configuration avancée
 */
const createSecureApiClient = (baseConfig: AxiosRequestConfig = {}): AxiosInstance => {
  // Configuration par défaut
  const defaultConfig: AxiosRequestConfig = {
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 15000, // 15 secondes
    withCredentials: true, // Important pour la sécurité CSRF
    ...baseConfig
  };

  // Créer l'instance Axios
  const instance = axios.create(defaultConfig);

  // Intercepteur pour les requêtes
  instance.interceptors.request.use(
    async (config: SecureRequestConfig): Promise<SecureRequestConfig> => {
      try {
        // Vérifier l'authentification si nécessaire
        const requiresAuth = config.requiresAuth !== false; // Par défaut, toutes les requêtes nécessitent l'authentification
        
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
        
        // Ajouter un identifiant de requête unique pour le suivi
        const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        config.headers = config.headers || {};
        config.headers['X-Request-ID'] = requestId;
        
        // Journaliser l'activité API (audit)
        if (config.activityLabel) {
          logApiActivity({
            type: 'request',
            requestId,
            url: config.url || '',
            method: config.method || 'GET',
            label: config.activityLabel,
            timestamp: new Date().toISOString()
          });
        }
        
        return config;
      } catch (error) {
        console.error('Erreur dans l'intercepteur de requêtes:', error);
        return Promise.reject(error);
      }
    },
    (error: AxiosError): Promise<AxiosError> => {
      console.error('Erreur lors de la préparation de la requête:', error);
      return Promise.reject(error);
    }
  );

  // Intercepteur pour les réponses
  instance.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse => {
      // Journaliser les réponses pour audit si nécessaire
      const config = response.config as SecureRequestConfig;
      if (config.activityLabel) {
        const requestId = response.config.headers?.['X-Request-ID'] as string;
        logApiActivity({
          type: 'response',
          requestId,
          url: response.config.url || '',
          method: response.config.method || 'GET',
          status: response.status,
          label: config.activityLabel,
          timestamp: new Date().toISOString()
        });
      }
      
      return response;
    },
    async (error: AxiosError): Promise<any> => {
      // Obtenir la configuration originale
      const originalConfig = error.config as SecureRequestConfig;
      
      // Journaliser l'erreur pour audit si nécessaire
      if (originalConfig?.activityLabel) {
        const requestId = originalConfig.headers?.['X-Request-ID'] as string;
        logApiActivity({
          type: 'error',
          requestId,
          url: originalConfig.url || '',
          method: originalConfig.method || 'GET',
          status: error.response?.status || 0,
          label: originalConfig.activityLabel,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        });
      }
      
      // Ignorer la gestion des erreurs si demandé
      if (originalConfig?.skipErrorHandling) {
        return Promise.reject(error);
      }
      
      // Gérer les erreurs d'authentification (401)
      if (error.response?.status === 401) {
        // Éviter les boucles infinies
        if (originalConfig && !originalConfig._retry) {
          originalConfig._retry = true;
          
          try {
            // Essayer de rafraîchir le token
            const newToken = await authService.refreshToken();
            
            // Mettre à jour l'en-tête d'autorisation
            originalConfig.headers = originalConfig.headers || {};
            originalConfig.headers['Authorization'] = `Bearer ${newToken}`;
            
            // Réessayer la requête originale
            return instance(originalConfig);
          } catch (refreshError) {
            // Si le rafraîchissement échoue, déconnecter
            authService.logout();
            return Promise.reject(refreshError);
          }
        }
      }
      
      // Gérer les erreurs de validation (422)
      if (error.response?.status === 422) {
        const validationErrors = error.response.data?.errors || {};
        return Promise.reject({
          ...error,
          validationErrors
        });
      }
      
      // Gérer les erreurs d'autorisation (403)
      if (error.response?.status === 403) {
        console.error('Accès refusé:', error.response.data?.message || 'Vous n\'avez pas les permissions nécessaires.');
        // Possibilité de rediriger vers une page d'accès refusé
        // window.location.href = '/access-denied';
      }
      
      // Gérer les erreurs de timeout (408 ou erreur de réseau)
      if (error.code === 'ECONNABORTED' || error.response?.status === 408) {
        console.error('La requête a expiré. Veuillez réessayer.');
      }
      
      // Gérer les erreurs de serveur (500)
      if (error.response?.status && error.response.status >= 500) {
        console.error('Erreur serveur:', error.response.data?.message || 'Une erreur est survenue. Veuillez réessayer ultérieurement.');
      }
      
      return Promise.reject(error);
    }
  );

  return instance;
};

// Créer et exporter l'instance par défaut
const secureApiClient = createSecureApiClient();
export default secureApiClient;

// Fonction d'aide pour créer une requête sécurisée avec des options spécifiques
export const createSecureRequest = (config: SecureRequestConfig) => {
  return secureApiClient(config);
};

// Fonctions d'aide pour les méthodes communes
export const secureGet = <T>(url: string, config: SecureRequestConfig = {}) => {
  return secureApiClient.get<T>(url, config);
};

export const securePost = <T>(url: string, data?: any, config: SecureRequestConfig = {}) => {
  return secureApiClient.post<T>(url, data, {
    ...config,
    requiresCSRF: true
  });
};

export const securePut = <T>(url: string, data?: any, config: SecureRequestConfig = {}) => {
  return secureApiClient.put<T>(url, data, {
    ...config,
    requiresCSRF: true
  });
};

export const secureDelete = <T>(url: string, config: SecureRequestConfig = {}) => {
  return secureApiClient.delete<T>(url, {
    ...config,
    requiresCSRF: true
  });
};

export const securePatch = <T>(url: string, data?: any, config: SecureRequestConfig = {}) => {
  return secureApiClient.patch<T>(url, data, {
    ...config,
    requiresCSRF: true
  });
};

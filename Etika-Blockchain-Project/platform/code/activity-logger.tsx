// src/services/monitoring/activityLogger.ts
import authService from 'services/auth/authService';

// Types d'activités à journaliser
export enum ActivityType {
  // Actions système
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  SESSION_TIMEOUT = 'SESSION_TIMEOUT',
  
  // Actions utilisateur spécifiques au domaine
  TRANSACTION_CREATE = 'TRANSACTION_CREATE',
  TRANSACTION_VALIDATE = 'TRANSACTION_VALIDATE',
  TRANSACTION_VIEW = 'TRANSACTION_VIEW',
  
  SUPPLIER_ADD = 'SUPPLIER_ADD',
  SUPPLIER_EDIT = 'SUPPLIER_EDIT',
  SUPPLIER_SUSPEND = 'SUPPLIER_SUSPEND',
  SUPPLIER_REACTIVATE = 'SUPPLIER_REACTIVATE',
  SUPPLIER_TERMINATE = 'SUPPLIER_TERMINATE',
  
  FACTORING_CONDITION_UPDATE = 'FACTORING_CONDITION_UPDATE',
  FACTORING_PAYMENT_PROCESS = 'FACTORING_PAYMENT_PROCESS',
  
  QR_CODE_GENERATE = 'QR_CODE_GENERATE',
  QR_CODE_SCAN = 'QR_CODE_SCAN',
  
  // Actions API
  API_REQUEST = 'API_REQUEST',
  API_RESPONSE = 'API_RESPONSE',
  API_ERROR = 'API_ERROR',
  
  // Événements de sécurité
  SECURITY_EVENT = 'SECURITY_EVENT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

// Interface pour les entrées de log d'activité
export interface ActivityLogEntry {
  type: ActivityType | string;
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

// Interface pour les entrées de log d'API
export interface ApiActivityLogEntry {
  type: 'request' | 'response' | 'error';
  requestId: string;
  url: string;
  method: string;
  status?: number;
  label?: string;
  errorMessage?: string;
  timestamp: string;
}

// Taille maximale du stockage local pour les logs (en nombre d'entrées)
const MAX_LOCAL_LOG_SIZE = 1000;

// Clé pour le stockage local des logs
const ACTIVITY_LOGS_KEY = 'etika_activity_logs';

/**
 * Journaliser une activité utilisateur
 */
export const logActivity = (activity: Omit<ActivityLogEntry, 'timestamp' | 'userId' | 'merchantId' | 'ipAddress' | 'userAgent' | 'sessionId'>): void => {
  try {
    // Enrichir l'entrée avec les métadonnées
    const enrichedActivity: ActivityLogEntry = {
      ...activity,
      timestamp: new Date().toISOString(),
      userId: authService.getMerchantId() || undefined,
      merchantId: authService.getMerchantId() || undefined,
      ipAddress: window.localStorage.getItem('lastKnownIP') || undefined,
      userAgent: navigator.userAgent,
      sessionId: getSessionId(),
    };
    
    // Journaliser en local (pour usage hors ligne et synchronisation ultérieure)
    logLocalActivity(enrichedActivity);
    
    // Envoyer au serveur si possible
    sendActivityToServer(enrichedActivity);
    
    // Journaliser dans la console en développement
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ACTIVITY LOG] ${activity.type}:`, enrichedActivity);
    }
  } catch (error) {
    console.error('Erreur lors de la journalisation d\'activité:', error);
  }
};

/**
 * Journaliser une activité API
 */
export const logApiActivity = (activity: ApiActivityLogEntry): void => {
  try {
    // Convertir en activité standard
    const activityType = 
      activity.type === 'request' ? ActivityType.API_REQUEST :
      activity.type === 'response' ? ActivityType.API_RESPONSE :
      ActivityType.API_ERROR;
    
    const details: Record<string, any> = {
      requestId: activity.requestId,
      url: activity.url,
      method: activity.method,
      timestamp: activity.timestamp
    };
    
    if (activity.status) details.status = activity.status;
    if (activity.label) details.label = activity.label;
    if (activity.errorMessage) details.errorMessage = activity.errorMessage;
    
    // Journaliser l'activité
    logActivity({
      type: activityType,
      details,
      severity: activity.type === 'error' ? 'error' : 'info'
    });
  } catch (error) {
    console.error('Erreur lors de la journalisation d\'activité API:', error);
  }
};

/**
 * Journaliser une activité utilisateur localement
 */
const logLocalActivity = (activity: ActivityLogEntry): void => {
  try {
    // Récupérer les logs existants
    const logsJson = localStorage.getItem(ACTIVITY_LOGS_KEY);
    let logs: ActivityLogEntry[] = logsJson ? JSON.parse(logsJson) : [];
    
    // Ajouter la nouvelle entrée
    logs.push(activity);
    
    // Limiter la taille du stockage local
    if (logs.length > MAX_LOCAL_LOG_SIZE) {
      logs = logs.slice(-MAX_LOCAL_LOG_SIZE);
    }
    
    // Sauvegarder les logs
    localStorage.setItem(ACTIVITY_LOGS_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Erreur lors de la journalisation locale d\'activité:', error);
  }
};

/**
 * Envoyer une activité au serveur
 */
const sendActivityToServer = async (activity: ActivityLogEntry): Promise<void> => {
  try {
    // Si l'utilisateur n'est pas connecté, ne pas envoyer l'activité au serveur
    if (!authService.isAuthenticated()) {
      return;
    }
    
    // Envoyer l'activité au serveur (éviter d'utiliser secureApiClient pour éviter les dépendances circulaires)
    const token = authService.getToken();
    
    if (!token) return;
    
    // Utiliser fetch directement pour éviter les dépendances circulaires
    await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/audit/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(activity)
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi d\'activité au serveur:', error);
    
    // Stocker l'activité pour synchronisation ultérieure si envoi échoué
    storeActivityForSync(activity);
  }
};

/**
 * Stocker une activité pour synchronisation ultérieure
 */
const storeActivityForSync = (activity: ActivityLogEntry): void => {
  try {
    // Récupérer les activités en attente de synchronisation
    const pendingActivitiesJson = localStorage.getItem('etika_pending_activities');
    let pendingActivities: ActivityLogEntry[] = pendingActivitiesJson ? JSON.parse(pendingActivitiesJson) : [];
    
    // Ajouter la nouvelle activité
    pendingActivities.push(activity);
    
    // Limiter la taille pour éviter de saturer le stockage local
    if (pendingActivities.length > 100) {
      pendingActivities = pendingActivities.slice(-100);
    }
    
    // Sauvegarder les activités en attente
    localStorage.setItem('etika_pending_activities', JSON.stringify(pendingActivities));
  } catch (error) {
    console.error('Erreur lors du stockage d\'activité pour synchronisation:', error);
  }
};

/**
 * Synchroniser les activités en attente avec le serveur
 */
export const syncPendingActivities = async (): Promise<void> => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!authService.isAuthenticated()) {
      return;
    }
    
    // Récupérer les activités en attente
    const pendingActivitiesJson = localStorage.getItem('etika_pending_activities');
    if (!pendingActivitiesJson) return;
    
    const pendingActivities: ActivityLogEntry[] = JSON.parse(pendingActivitiesJson);
    if (pendingActivities.length === 0) return;
    
    // Récupérer le token
    const token = authService.getToken();
    if (!token) return;
    
    // Envoyer les activités au serveur
    const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/audit/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ activities: pendingActivities })
    });
    
    if (response.ok) {
      // Supprimer les activités synchronisées
      localStorage.removeItem('etika_pending_activities');
    }
  } catch (error) {
    console.error('Erreur lors de la synchronisation des activités:', error);
  }
};

/**
 * Obtenir un identifiant de session unique
 */
const getSessionId = (): string => {
  // Vérifier si un ID de session existe déjà
  let sessionId = sessionStorage.getItem('etika_session_id');
  
  // Si non, en créer un nouveau
  if (!sessionId) {
    sessionId = generateUniqueId();
    sessionStorage.setItem('etika_session_id', sessionId);
  }
  
  return sessionId;
};

/**
 * Générer un identifiant unique
 */
const generateUniqueId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

/**
 * Obtenir les logs d'activité stockés localement
 */
export const getLocalActivityLogs = (): ActivityLogEntry[] => {
  try {
    const logsJson = localStorage.getItem(ACTIVITY_LOGS_KEY);
    return logsJson ? JSON.parse(logsJson) : [];
  } catch (error) {
    console.error('Erreur lors de la récupération des logs d\'activité:', error);
    return [];
  }
};

/**
 * Effacer les logs d'activité stockés localement
 */
export const clearLocalActivityLogs = (): void => {
  try {
    localStorage.removeItem(ACTIVITY_LOGS_KEY);
  } catch (error) {
    console.error('Erreur lors de l\'effacement des logs d\'activité:', error);
  }
};

/**
 * Filtrer les logs d'activité par critères
 */
export const filterActivityLogs = (
  logs: ActivityLogEntry[],
  filters: {
    types?: ActivityType[] | string[];
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    severity?: ('info' | 'warning' | 'error' | 'critical')[];
  }
): ActivityLogEntry[] => {
  return logs.filter(log => {
    // Filtrer par type
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(log.type as ActivityType)) {
        return false;
      }
    }
    
    // Filtrer par date de début
    if (filters.startDate) {
      const logDate = new Date(log.timestamp);
      if (logDate < filters.startDate) {
        return false;
      }
    }
    
    // Filtrer par date de fin
    if (filters.endDate) {
      const logDate = new Date(log.timestamp);
      if (logDate > filters.endDate) {
        return false;
      }
    }
    
    // Filtrer par utilisateur
    if (filters.userId && log.userId !== filters.userId) {
      return false;
    }
    
    // Filtrer par sévérité
    if (filters.severity && filters.severity.length > 0) {
      if (!log.severity || !filters.severity.includes(log.severity)) {
        return false;
      }
    }
    
    return true;
  });
};

/**
 * Détecter des activités suspectes
 */
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
  
  // D'autres règles de détection peuvent être ajoutées ici
  
  return false;
};

// Exporter les fonctions utiles
export default {
  logActivity,
  logApiActivity,
  syncPendingActivities,
  getLocalActivityLogs,
  clearLocalActivityLogs,
  filterActivityLogs,
  detectSuspiciousActivity
};
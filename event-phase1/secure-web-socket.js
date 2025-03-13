// utils/secureWebSocket.js
// Service de gestion sécurisée des connexions WebSocket

import { io } from 'socket.io-client';
import { getSecureItem, STORAGE_KEYS } from './secureStorage';
import { logError } from './errorTracking';
import { API_URL } from '../config';
import NetInfo from '@react-native-community/netinfo';

class SecureWebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnecting = false;
    this.pendingEvents = [];
    this.maxReconnectAttempts = 5;
    this.currentReconnectAttempt = 0;
    this.reconnectDelay = 1000; // Délai initial de reconnexion en ms
    this.maxReconnectDelay = 30000; // Délai maximum de reconnexion (30 secondes)
    this.connectionTimeout = 10000; // Timeout de connexion (10 secondes)
    
    // Configurer l'écouteur d'état de connexion réseau
    this.unsubscribeNetInfo = NetInfo.addEventListener(this.handleNetworkChange);
  }
  
  /**
   * Gère les changements d'état de la connexion réseau
   * @param {Object} state - État de la connexion réseau
   */
  handleNetworkChange = (state) => {
    if (state.isConnected && !this.socket) {
      this.connect();
    } else if (!state.isConnected && this.socket) {
      this.disconnect();
    }
  };
  
  /**
   * Établit une connexion WebSocket sécurisée
   * @returns {Promise<Object>} - Instance du socket ou null en cas d'échec
   */
  async connect() {
    if (this.socket || this.isConnecting) {
      return this.socket;
    }
    
    this.isConnecting = true;
    
    try {
      // Récupérer le token d'authentification
      const token = await getSecureItem(STORAGE_KEYS.AUTH_TOKEN);
      
      // Créer une nouvelle connexion socket
      const socket = io(API_URL, {
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: this.maxReconnectDelay,
        timeout: this.connectionTimeout,
        auth: {
          token: token || ''
        }
      });
      
      // Configurer les gestionnaires d'événements de base
      socket.on('connect', this.handleConnect);
      socket.on('disconnect', this.handleDisconnect);
      socket.on('connect_error', this.handleConnectionError);
      socket.on('error', this.handleError);
      socket.on('reconnect', this.handleReconnect);
      socket.on('reconnect_failed', this.handleReconnectFailed);
      
      // Attendre la connexion ou le timeout
      await new Promise((resolve, reject) => {
        // Gestionnaire de connexion réussie
        const onConnect = () => {
          socket.off('connect_error', onConnectError);
          clearTimeout(timeoutId);
          resolve();
        };
        
        // Gestionnaire d'erreur de connexion
        const onConnectError = (error) => {
          socket.off('connect', onConnect);
          clearTimeout(timeoutId);
          reject(error);
        };
        
        // Configurer le timeout
        const timeoutId = setTimeout(() => {
          socket.off('connect', onConnect);
          socket.off('connect_error', onConnectError);
          reject(new Error('Connection timeout'));
        }, this.connectionTimeout);
        
        // Ajouter les écouteurs temporaires
        socket.once('connect', onConnect);
        socket.once('connect_error', onConnectError);
      });
      
      // Stocker la référence au socket
      this.socket = socket;
      
      // Restaurer les écouteurs précédemment enregistrés
      this.restoreListeners();
      
      // Envoyer les événements en attente
      this.processPendingEvents();
      
      // Réinitialiser le compteur de tentatives de reconnexion
      this.currentReconnectAttempt = 0;
      
      return socket;
    } catch (error) {
      logError('WebSocket connection error', error);
      this.handleConnectionFailure();
      return null;
    } finally {
      this.isConnecting = false;
    }
  }
  
  /**
   * Déconnecte proprement le WebSocket
   */
  disconnect() {
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (error) {
        logError('Error disconnecting WebSocket', error);
      } finally {
        this.socket = null;
      }
    }
  }
  
  /**
   * Nettoyage complet du service (à appeler lors de la déconnexion de l'utilisateur)
   */
  cleanup() {
    this.disconnect();
    this.listeners.clear();
    this.pendingEvents = [];
    
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }
  
  /**
   * Envoie un événement via le WebSocket
   * @param {string} event - Nom de l'événement
   * @param {any} data - Données à envoyer
   * @returns {Promise<boolean>} - Succès de l'envoi
   */
  async emit(event, data) {
    try {
      // Si pas de socket connecté, mettre l'événement en attente et tenter de se connecter
      if (!this.socket || !this.socket.connected) {
        // Stocker l'événement pour l'envoyer une fois connecté
        this.pendingEvents.push({ event, data });
        
        // Tenter de se connecter
        await this.connect();
        return true;
      }
      
      // Envoyer l'événement
      this.socket.emit(event, data);
      return true;
    } catch (error) {
      logError(`Error emitting event: ${event}`, error);
      return false;
    }
  }
  
  /**
   * Enregistre un écouteur pour un événement
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction de rappel
   */
  on(event, callback) {
    if (!event || typeof callback !== 'function') {
      return;
    }
    
    // Stocker l'écouteur dans notre map
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    this.listeners.get(event).push(callback);
    
    // Si le socket est connecté, ajouter directement l'écouteur
    if (this.socket && this.socket.connected) {
      this.socket.on(event, callback);
    }
  }
  
  /**
   * Supprime un écouteur pour un événement
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction de rappel (optionnel, supprime tous les écouteurs si non fourni)
   */
  off(event, callback) {
    // Si le socket est connecté, supprimer l'écouteur
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
    
    // Supprimer de notre map
    if (this.listeners.has(event)) {
      if (callback) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
        if (callbacks.length === 0) {
          this.listeners.delete(event);
        }
      } else {
        this.listeners.delete(event);
      }
    }
  }
  
  /**
   * Restaure tous les écouteurs enregistrés
   */
  restoreListeners() {
    if (!this.socket) return;
    
    // Pour chaque événement dans notre map
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket.on(event, callback);
      });
    });
  }
  
  /**
   * Traite les événements en attente
   */
  processPendingEvents() {
    if (!this.socket || !this.socket.connected || this.pendingEvents.length === 0) {
      return;
    }
    
    // Copier et vider la file d'attente
    const events = [...this.pendingEvents];
    this.pendingEvents = [];
    
    // Traiter chaque événement
    events.forEach(({ event, data }) => {
      try {
        this.socket.emit(event, data);
      } catch (error) {
        logError(`Error processing pending event: ${event}`, error);
      }
    });
  }
  
  // Gestionnaires d'événements internes
  
  handleConnect = () => {
    console.log('WebSocket connected');
    
    // Réinitialiser le compteur de tentatives
    this.currentReconnectAttempt = 0;
    
    // Traiter les événements en attente
    this.processPendingEvents();
  };
  
  handleDisconnect = (reason) => {
    console.log('WebSocket disconnected:', reason);
    
    // Si le serveur a forcé la déconnexion, ne pas tenter de reconnexion automatique
    if (reason === 'io server disconnect') {
      this.socket = null;
    }
  };
  
  handleConnectionError = (error) => {
    logError('WebSocket connection error', error);
    this.handleConnectionFailure();
  };
  
  handleError = (error) => {
    logError('WebSocket error', error);
  };
  
  handleReconnect = (attemptNumber) => {
    console.log(`WebSocket reconnected after ${attemptNumber} attempts`);
    this.currentReconnectAttempt = 0;
  };
  
  handleReconnectFailed = () => {
    logError('WebSocket reconnection failed after max attempts');
    this.socket = null;
  };
  
  handleConnectionFailure = () => {
    this.currentReconnectAttempt++;
    
    if (this.currentReconnectAttempt <= this.maxReconnectAttempts) {
      // Calculer le délai de reconnexion avec backoff exponentiel
      const delay = Math.min(
        this.reconnectDelay * Math.pow(1.5, this.currentReconnectAttempt - 1),
        this.maxReconnectDelay
      );
      
      // Planifier une tentative de reconnexion
      setTimeout(() => {
        this.connect().catch(error => {
          logError(`Reconnection attempt ${this.currentReconnectAttempt} failed`, error);
        });
      }, delay);
    }
  };
}

// Exporter une instance unique du service
export default new SecureWebSocketService();

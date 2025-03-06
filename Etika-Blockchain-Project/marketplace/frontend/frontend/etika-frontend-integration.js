/**
 * Client d'intégration frontend pour la plateforme ETIKA
 * 
 * Ce module fournit les fonctions nécessaires pour interagir avec l'API ETIKA
 * depuis une application frontend (React, Vue.js, etc.)
 */

class EtikaClient {
  /**
   * Initialise le client ETIKA
   * @param {string} apiUrl - URL de base de l'API ETIKA
   */
  constructor(apiUrl = 'http://localhost:3000/api') {
    this.apiUrl = apiUrl;
    this.token = localStorage.getItem('etika_token');
    this.user = JSON.parse(localStorage.getItem('etika_user') || 'null');
    this.eventListeners = {};
  }

  /**
   * Construit les entêtes HTTP avec authentification si disponible
   */
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Effectue une requête API
   */
  async _fetchApi(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;
    const fetchOptions = {
      ...options,
      headers: this._getHeaders()
    };

    try {
      const response = await fetch(url, fetchOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erreur HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`Erreur API (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Émet un événement
   */
  _emitEvent(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach(callback => callback(data));
    }
  }

  /**
   * S'abonne à un événement
   */
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);

    return () => this.off(eventName, callback);
  }

  /**
   * Se désabonne d'un événement
   */
  off(eventName, callback) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName] = this.eventListeners[eventName]
        .filter(cb => cb !== callback);
    }
  }

  /**
   * Connecte l'utilisateur avec une adresse blockchain
   * @param {string} address - Adresse blockchain de l'utilisateur
   * @param {string} signature - Signature cryptographique pour l'authentification
   */
  async login(address, signature = '') {
    const data = await this._fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ address, signature })
    });

    this.token = data.token;
    this.user = data.user;

    // Sauvegarder dans localStorage
    localStorage.setItem('etika_token', this.token);
    localStorage.setItem('etika_user', JSON.stringify(this.user));

    this._emitEvent('login', this.user);
    return this.user;
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('etika_token');
    localStorage.removeItem('etika_user');
    this._emitEvent('logout');
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  isLoggedIn() {
    return !!this.token && !!this.user;
  }

  /**
   * Vérifie si l'utilisateur est administrateur
   */
  isAdmin() {
    return this.user && this.user.role === 'admin';
  }

  /**
   * Vérifie l'état de l'API et du contrat
   */
  async checkStatus() {
    return this._fetchApi('/status');
  }

  /**
   * Initialise le service ETIKA
   */
  async initialize() {
    return this._fetchApi('/initialize', { method: 'POST' });
  }

  /**
   * Crée un nouveau compte utilisateur (admin seulement)
   */
  async createUser(address, role) {
    return this._fetchApi('/users/create', {
      method: 'POST',
      body: JSON.stringify({ address, role })
    });
  }

  /**
   * Enregistre un validateur
   */
  async registerValidator(address, role) {
    return this._fetchApi('/validators/register', {
      method: 'POST',
      body: JSON.stringify({ address, role })
    });
  }

  /**
   * Vote pour un validateur
   */
  async voteForValidator(candidateAddress) {
    return this._fetchApi('/validators/vote', {
      method: 'POST',
      body: JSON.stringify({ candidateAddress })
    });
  }

  /**
   * Crée une transaction de vente
   */
  async createSaleTransaction(params) {
    return this._fetchApi('/transactions/create', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  /**
   * Valide une transaction (PoP)
   */
  async validateTransaction(transactionId, signature = null) {
    return this._fetchApi('/transactions/validate', {
      method: 'POST',
      body: JSON.stringify({ transactionId, signature })
    });
  }

  /**
   * Récupère les détails d'une transaction
   */
  async getTransactionDetails(transactionId) {
    return this._fetchApi(`/transactions/${transactionId}`);
  }

  /**
   * Récupère le solde en tokens d'un utilisateur
   */
  async getTokenBalance(address) {
    return this._fetchApi(`/balances/tokens/${address}`);
  }

  /**
   * Récupère le solde en épargne d'un utilisateur
   */
  async getEpargneBalance(address) {
    return this._fetchApi(`/balances/epargne/${address}`);
  }

  /**
   * Convertit des tokens en épargne
   */
  async convertTokensToSavings(amount) {
    return this._fetchApi('/tokens/convert', {
      method: 'POST',
      body: JSON.stringify({ amount })
    });
  }

  /**
   * Configure la délégation d'épargne
   */
  async delegateSavings(delegateAddress) {
    return this._fetchApi('/savings/delegate', {
      method: 'POST',
      body: JSON.stringify({ delegateAddress })
    });
  }

  /**
   * Supprime la délégation d'épargne
   */
  async removeSavingsDelegation() {
    return this._fetchApi('/savings/undelegate', {
      method: 'POST'
    });
  }

  /**
   * Crée une enchère (admin seulement)
   */
  async createAuction(category, minBid, duration = null) {
    return this._fetchApi('/auctions/create', {
      method: 'POST',
      body: JSON.stringify({ category, minBid, duration })
    });
  }

  /**
   * Place une enchère
   */
  async placeBid(category, bidAmount, ecosystemCommitment) {
    return this._fetchApi('/auctions/bid', {
      method: 'POST',
      body: JSON.stringify({ category, bidAmount, ecosystemCommitment })
    });
  }

  /**
   * Récupère les détails d'une enchère
   */
  async getAuctionDetails(category) {
    return this._fetchApi(`/auctions/${category}`);
  }

  /**
   * Récupère les métriques de l'écosystème
   */
  async getEcosystemMetrics() {
    return this._fetchApi('/metrics/ecosystem');
  }

  /**
   * Crée une signature pour l'authentification
   * Cette fonction est un mock pour la démonstration.
   * Dans un environnement réel, elle utiliserait une bibliothèque Web3 pour signer un message avec une clé privée.
   */
  async createSignature(message) {
    if (!window.ethereum) {
      throw new Error('Aucun fournisseur Web3 détecté');
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const from = accounts[0];
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, from]
      });
      
      return { from, signature };
    } catch (error) {
      console.error('Erreur lors de la signature:', error);
      throw error;
    }
  }

  /**
   * Construit un message de transaction PoP pour la validation
   */
  buildPopMessage(transactionId, timestamp = Date.now()) {
    return `Je confirme la transaction ${transactionId} à ${new Date(timestamp).toISOString()}`;
  }

  /**
   * Formate les montants avec le symbole de devise
   */
  formatAmount(amount, withSymbol = true) {
    const formattedAmount = parseFloat(amount).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return withSymbol ? `${formattedAmount} ETK` : formattedAmount;
  }
}
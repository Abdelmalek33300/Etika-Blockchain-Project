import React, { useState, useEffect, createContext, useContext } from 'react';
import { EtikaClient } from './etika-frontend-integration';

// Création du contexte ETIKA
const EtikaContext = createContext(null);

/**
 * Provider principal pour le contexte ETIKA
 */
export const EtikaProvider = ({ children, apiUrl }) => {
  const [client] = useState(() => new EtikaClient(apiUrl));
  const [user, setUser] = useState(client.user);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [systemPaused, setSystemPaused] = useState(false);
  
  // Initialisation
  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const status = await client.checkStatus();
        setInitialized(status.initialized);
        setSystemPaused(status.systemPaused);
      } catch (error) {
        console.error('Erreur lors de la vérification du statut:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkInitialization();
    
    // Écouter les événements d'authentification
    const loginUnsubscribe = client.on('login', newUser => setUser(newUser));
    const logoutUnsubscribe = client.on('logout', () => setUser(null));
    
    return () => {
      loginUnsubscribe();
      logoutUnsubscribe();
    };
  }, [client]);
  
  // Valeur du contexte
  const contextValue = {
    client,
    user,
    initialized,
    loading,
    systemPaused,
    isLoggedIn: client.isLoggedIn(),
    isAdmin: client.isAdmin(),
    login: client.login.bind(client),
    logout: client.logout.bind(client),
    initialize: async () => {
      try {
        await client.initialize();
        setInitialized(true);
        return true;
      } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        return false;
      }
    }
  };
  
  return (
    <EtikaContext.Provider value={contextValue}>
      {children}
    </EtikaContext.Provider>
  );
};

/**
 * Hook pour utiliser le contexte ETIKA
 */
export const useEtika = () => {
  const context = useContext(EtikaContext);
  if (!context) {
    throw new Error('useEtika doit être utilisé dans un EtikaProvider');
  }
  return context;
};

/**
 * Composant de connexion wallet
 */
export const WalletConnector = ({ onConnect, buttonText = "Connecter Wallet" }) => {
  const { login, isLoggedIn, user } = useEtika();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('Aucun portefeuille Ethereum détecté. Veuillez installer MetaMask.');
      return;
    }
    
    setConnecting(true);
    setError(null);
    
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      
      // Dans un environnement réel, nous demanderions une signature pour l'authentification
      const mockSignature = "0x...";
      
      await login(address, mockSignature);
      if (onConnect) onConnect(address);
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError(err.message || 'Erreur lors de la connexion au portefeuille');
    } finally {
      setConnecting(false);
    }
  };
  
  if (isLoggedIn) {
    return (
      <div className="etika-wallet-connected">
        <span className="etika-address">
          {user.address.substring(0, 6)}...{user.address.substring(user.address.length - 4)}
        </span>
        {user.role === 'admin' && <span className="etika-admin-badge">Admin</span>}
      </div>
    );
  }
  
  return (
    <div className="etika-wallet-connector">
      <button 
        className="etika-connect-button"
        onClick={connectWallet}
        disabled={connecting}
      >
        {connecting ? 'Connexion...' : buttonText}
      </button>
      {error && <div className="etika-error-message">{error}</div>}
    </div>
  );
};

/**
 * Composant pour afficher les soldes (tokens et épargne)
 */
export const BalanceDisplay = ({ address }) => {
  const { client } = useEtika();
  const [balances, setBalances] = useState({ tokens: '0', epargne: '0' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchBalances = async () => {
      if (!address) return;
      
      try {
        setLoading(true);
        const [tokensData, epargneData] = await Promise.all([
          client.getTokenBalance(address),
          client.getEpargneBalance(address)
        ]);
        
        setBalances({
          tokens: tokensData.tokens,
          epargne: epargneData.epargne
        });
      } catch (err) {
        console.error('Erreur lors de la récupération des soldes:', err);
        setError('Impossible de charger les soldes');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBalances();
  }, [client, address]);
  
  if (loading) {
    return <div className="etika-balance-loading">Chargement des soldes...</div>;
  }
  
  if (error) {
    return <div className="etika-balance-error">{error}</div>;
  }
  
  return (
    <div className="etika-balance-display">
      <div className="etika-balance-item">
        <span className="etika-balance-label">Tokens:</span>
        <span className="etika-balance-value">
          {client.formatAmount(balances.tokens)}
        </span>
      </div>
      <div className="etika-balance-item">
        <span className="etika-balance-label">Épargne:</span>
        <span className="etika-balance-value etika-savings">
          {client.formatAmount(balances.epargne)}
        </span>
      </div>
    </div>
  );
};

/**
 * Composant de création de transaction de vente
 */
export const SaleTransactionCreator = ({ onSuccess }) => {
  const { client, user } = useEtika();
  const [formData, setFormData] = useState({
    saleType: 'RetailSale',
    consumer: '',
    merchant: '',
    supplier: '',
    amount: '',
    savingsPercentage: '15', // 1.5% par défaut
    items: [{ description: '', quantity: 1, unitPrice: '', supplierId: '' }],
    locationData: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Préremplir avec l'adresse de l'utilisateur connecté si c'est un commerçant
  useEffect(() => {
    if (user && user.role === 'merchant') {
      setFormData(prev => ({ ...prev, merchant: user.address }));
    }
  }, [user]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData(prev => ({ ...prev, items: newItems }));
  };
  
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitPrice: '', supplierId: '' }]
    }));
  };
  
  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData(prev => ({ ...prev, items: newItems }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    
    try {
      // Calculer le montant total si non fourni
      let totalAmount = formData.amount;
      if (!totalAmount) {
        totalAmount = formData.items.reduce(
          (sum, item) => sum + (item.quantity * item.unitPrice), 0
        );
      }
      
      const result = await client.createSaleTransaction({
        ...formData,
        amount: totalAmount,
        origin: 'Web Platform'
      });
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      // Réinitialiser le formulaire
      setFormData({
        saleType: 'RetailSale',
        consumer: '',
        merchant: user && user.role === 'merchant' ? user.address : '',
        supplier: '',
        amount: '',
        savingsPercentage: '15',
        items: [{ description: '', quantity: 1, unitPrice: '', supplierId: '' }],
        locationData: '',
        description: ''
      });
    } catch (err) {
      console.error('Erreur lors de la création de la transaction:', err);
      setError(err.message || 'Erreur lors de la création de la transaction');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <form className="etika-transaction-form" onSubmit={handleSubmit}>
      <h3>Nouvelle Transaction de Vente</h3>
      
      <div className="etika-form-group">
        <label>Type de vente</label>
        <select 
          name="saleType"
          value={formData.saleType}
          onChange={handleChange}
          required
        >
          <option value="DirectSale">Vente Directe</option>
          <option value="RetailSale">Vente au Détail</option>
          <option value="ComplexSale">Vente Complexe</option>
        </select>
      </div>
      
      <div className="etika-form-group">
        <label>Consommateur (adresse)</label>
        <input 
          type="text"
          name="consumer"
          value={formData.consumer}
          onChange={handleChange}
          placeholder="0x..."
          required
        />
      </div>
      
      <div className="etika-form-group">
        <label>Commerçant (adresse)</label>
        <input 
          type="text"
          name="merchant"
          value={formData.merchant}
          onChange={handleChange}
          placeholder="0x..."
          required
        />
      </div>
      
      <div className="etika-form-group">
        <label>Fournisseur (adresse, optionnel)</label>
        <input 
          type="text"
          name="supplier"
          value={formData.supplier}
          onChange={handleChange}
          placeholder="0x..."
        />
      </div>
      
      <div className="etika-form-group">
        <label>Pourcentage d'épargne (en millièmes)</label>
        <input 
          type="number"
          name="savingsPercentage"
          value={formData.savingsPercentage}
          onChange={handleChange}
          min="0"
          max="1000"
        />
        <small>15 = 1.5%</small>
      </div>
      
      <h4>Articles</h4>
      {formData.items.map((item, index) => (
        <div key={index} className="etika-item-row">
          <div className="etika-form-group">
            <label>Description</label>
            <input 
              type="text"
              value={item.description}
              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
              required
            />
          </div>
          
          <div className="etika-form-group">
            <label>Quantité</label>
            <input 
              type="number"
              value={item.quantity}
              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
              min="1"
              required
            />
          </div>
          
          <div className="etika-form-group">
            <label>Prix unitaire</label>
            <input 
              type="number"
              value={item.unitPrice}
              onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value))}
              min="0"
              step="0.01"
              required
            />
          </div>
          
          <button 
            type="button" 
            className="etika-remove-item"
            onClick={() => removeItem(index)}
            disabled={formData.items.length <= 1}
          >
            &times;
          </button>
        </div>
      ))}
      
      <button 
        type="button"
        className="etika-add-item"
        onClick={addItem}
      >
        + Ajouter un article
      </button>
      
      <div className="etika-form-group">
        <label>Données de localisation (optionnel)</label>
        <input 
          type="text"
          name="locationData"
          value={formData.locationData}
          onChange={handleChange}
          placeholder="Ville, Pays ou Coordonnées GPS"
        />
      </div>
      
      <div className="etika-form-group">
        <label>Description (optionnel)</label>
        <textarea 
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Description de la transaction..."
          rows="3"
        />
      </div>
      
      {error && <div className="etika-error-message">{error}</div>}
      
      <button 
        type="submit"
        className="etika-submit-button"
        disabled={submitting}
      >
        {submitting ? 'Création en cours...' : 'Créer la transaction'}
      </button>
    </form>
  );
};

/**
 * Composant pour valider une transaction PoP
 */
export const TransactionValidator = ({ transactionId, onSuccess }) => {
  const { client } = useEtika();
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchTransaction = async () => {
      if (!transactionId) return;
      
      try {
        setLoading(true);
        const txDetails = await client.getTransactionDetails(transactionId);
        setTransaction(txDetails);
      } catch (err) {
        console.error('Erreur lors de la récupération de la transaction:', err);
        setError('Transaction introuvable ou inaccessible');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransaction();
  }, [client, transactionId]);
  
  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    
    try {
      // Construire et signer le message PoP
      const message = client.buildPopMessage(transactionId);
      const { signature } = await client.createSignature(message);
      
      // Valider la transaction
      const result = await client.validateTransaction(transactionId, signature);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Erreur lors de la validation:', err);
      setError(err.message || 'Erreur lors de la validation');
    } finally {
      setValidating(false);
    }
  };
  
  if (loading) {
    return <div className="etika-loading">Chargement de la transaction...</div>;
  }
  
  if (error) {
    return <div className="etika-error-message">{error}</div>;
  }
  
  if (!transaction) {
    return <div className="etika-not-found">Transaction non trouvée</div>;
  }
  
  return (
    <div className="etika-transaction-validator">
      <h3>Validation de Transaction</h3>
      
      <div className="etika-transaction-details">
        <div className="etika-detail-row">
          <span className="etika-detail-label">ID:</span>
          <span className="etika-detail-value">{transaction.id}</span>
        </div>
        <div className="etika-detail-row">
          <span className="etika-detail-label">Type:</span>
          <span className="etika-detail-value">{transaction.tx_type}</span>
        </div>
        <div className="etika-detail-row">
          <span className="etika-detail-label">Montant:</span>
          <span className="etika-detail-value">
            {client.formatAmount(transaction.amount)}
          </span>
        </div>
        <div className="etika-detail-row">
          <span className="etika-detail-label">Statut:</span>
          <span className={`etika-status etika-status-${transaction.status.toLowerCase()}`}>
            {transaction.status}
          </span>
        </div>
        <div className="etika-detail-row">
          <span className="etika-detail-label">Validations:</span>
          <span className="etika-detail-value">
            {transaction.validated_by?.length || 0} / {transaction.required_validations}
          </span>
        </div>
      </div>
      
      <div className="etika-validation-action">
        <p>
          En validant cette transaction, vous certifiez son authenticité en tant que validateur.
          Cette action est irréversible.
        </p>
        
        <button
          className="etika-validate-button"
          onClick={handleValidate}
          disabled={validating}
        >
          {validating ? 'Validation en cours...' : 'Valider la transaction'}
        </button>
      </div>
    </div>
  );
};

/**
 * Composant pour afficher les métriques de l'écosystème
 */
export const EcosystemMetrics = () => {
  const { client } = useEtika();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const data = await client.getEcosystemMetrics();
        setMetrics(data);
      } catch (err) {
        console.error('Erreur lors de la récupération des métriques:', err);
        setError('Impossible de charger les métriques');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetrics();
    
    // Rafraîchir les métriques toutes les 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [client]);
  
  if (loading) {
    return <div className="etika-loading">Chargement des métriques...</div>;
  }
  
  if (error) {
    return <div className="etika-error-message">{error}</div>;
  }
  
  if (!metrics) {
    return <div className="etika-not-found">Aucune métrique disponible</div>;
  }
  
  return (
    <div className="etika-ecosystem-metrics">
      <h3>Métriques de l'Écosystème ETIKA</h3>
      
      <div className="etika-metrics-grid">
        <div className="etika-metric-card">
          <div className="etika-metric-value">{metrics.total_transactions}</div>
          <div className="etika-metric-label">Transactions</div>
        </div>
        
        <div className="etika-metric-card">
          <div className="etika-metric-value">{metrics.active_users}</div>
          <div className="etika-metric-label">Utilisateurs actifs</div>
        </div>
        
        <div className="etika-metric-card">
          <div className="etika-metric-value">{metrics.sponsors_count}</div>
          <div className="etika-metric-label">Sponsors officiels</div>
        </div>
        
        <div className="etika-metric-card">
          <div className="etika-metric-value">
            {client.formatAmount(metrics.average_transaction_amount)}
          </div>
          <div className="etika-metric-label">Montant moyen</div>
        </div>
        
        <div className="etika-metric-card">
          <div className="etika-metric-value">
            {client.formatAmount(metrics.total_auction_volume)}
          </div>
          <div className="etika-metric-label">Volume d'enchères</div>
        </div>
        
        <div className="etika-metric-card">
          <div className="etika-metric-value">
            {(metrics.total_carbon_saved / 1000).toFixed(2)} kg
          </div>
          <div className="etika-metric-label">CO2 économisé</div>
        </div>
        
        <div className="etika-metric-card">
          <div className="etika-metric-value">
            {client.formatAmount(metrics.local_economy_boost)}
          </div>
          <div className="etika-metric-label">Boost économie locale</div>
        </div>
        
        <div className="etika-metric-card">
          <div className="etika-metric-value">
            {client.formatAmount(metrics.total_supplier_payments)}
          </div>
          <div className="etika-metric-label">Paiements fournisseurs</div>
        </div>
      </div>
    </div>
  );
};

/**
 * Initialisation du système ETIKA (admin seulement)
 */
export const SystemInitializer = () => {
  const { initialize, initialized, loading, isAdmin } = useEtika();
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState(null);
  
  const handleInitialize = async () => {
    setInitializing(true);
    setError(null);
    
    try {
      const success = await initialize();
      if (!success) {
        setError('Erreur lors de l\'initialisation');
      }
    } catch (err) {
      console.error('Erreur d\'initialisation:', err);
      setError(err.message || 'Erreur lors de l\'initialisation');
    } finally {
      setInitializing(false);
    }
  };
  
  if (!isAdmin) {
    return null;
  }
  
  if (loading) {
    return <div className="etika-loading">Vérification de l'état du système...</div>;
  }
  
  if (initialized) {
    return (
      <div className="etika-system-status etika-system-initialized">
        Système ETIKA initialisé
      </div>
    );
  }
  
  return (
    <div className="etika-system-initializer">
      <div className="etika-system-status etika-system-not-initialized">
        Le système ETIKA n'est pas initialisé
      </div>
      
      <button
        className="etika-initialize-button"
        onClick={handleInitialize}
        disabled={initializing}
      >
        {initializing ? 'Initialisation en cours...' : 'Initialiser le système ETIKA'}
      </button>
      
      {error && <div className="etika-error-message">{error}</div>}
    </div>
  );
};

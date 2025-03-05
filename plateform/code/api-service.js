// src/services/api/client.ts
import axios from 'axios';

// Création d'une instance Axios avec une configuration de base
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 secondes
});

// Intercepteur pour ajouter le token d'authentification
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs de réponse
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Gérer les erreurs 401 (non autorisé) - token expiré
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Tentative de rafraîchissement du token
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(
            `${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/refresh`,
            { refreshToken }
          );
          
          const { token } = response.data;
          localStorage.setItem('auth_token', token);
          
          // Refaire la requête originale avec le nouveau token
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Si le rafraîchissement échoue, rediriger vers la page de connexion
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;

// src/services/api/transactions.ts
import { useMutation, useQuery, useQueryClient } from 'react-query';
import apiClient from './client';

// Types
interface CreateTransactionParams {
  consumer: string;
  merchant: string;
  suppliers: string[];
  standardAmount: number;
  tokensExchanged: number;
  receiptHash: string;
  notes?: string;
}

interface GetTransactionsParams {
  status?: 'pending' | 'validated' | 'failed';
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

// Hooks pour les requêtes liées aux transactions
export const useGetTransactions = (params: GetTransactionsParams = {}) => {
  return useQuery(
    ['transactions', params],
    async () => {
      const { data } = await apiClient.get('/transactions', { params });
      return data;
    },
    {
      keepPreviousData: true,
    }
  );
};

export const useGetRecentTransactions = (params: { limit: number }) => {
  return useQuery(
    ['transactions', 'recent', params],
    async () => {
      const { data } = await apiClient.get('/transactions/recent', { params });
      return data;
    },
    {
      refetchInterval: 60000, // Rafraîchir toutes les minutes
    }
  );
};

export const useGetTransactionById = (id: string) => {
  return useQuery(
    ['transaction', id],
    async () => {
      const { data } = await apiClient.get(`/transactions/${id}`);
      return data;
    },
    {
      enabled: !!id,
    }
  );
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async (params: CreateTransactionParams) => {
      const { data } = await apiClient.post('/transactions', params);
      return data;
    },
    {
      onSuccess: () => {
        // Invalider les requêtes relatives aux transactions pour forcer un rechargement
        queryClient.invalidateQueries(['transactions']);
      },
    }
  );
};

export const useValidateTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async (transactionId: string) => {
      const { data } = await apiClient.post(`/transactions/${transactionId}/validate`);
      return data;
    },
    {
      onSuccess: (_, transactionId) => {
        // Invalider les requêtes spécifiques
        queryClient.invalidateQueries(['transactions']);
        queryClient.invalidateQueries(['transaction', transactionId]);
      },
    }
  );
};

// src/services/api/suppliers.ts
import { useMutation, useQuery, useQueryClient } from 'react-query';
import apiClient from './client';

// Types
interface GetSuppliersParams {
  status?: 'active' | 'pending' | 'suspended' | 'terminated';
}

interface RegisterRelationshipParams {
  supplierId: string;
  category: string;
  immediatePaymentPercent: number;
  remainingPaymentDelay: number;
  interestRate: number;
}

interface UpdateFactoringParams {
  supplierId: string;
  immediatePaymentPercent: number;
  remainingPaymentDelay: number;
  interestRate: number;
}

interface ManageRelationshipParams {
  supplierId: string;
}

// Hooks pour les requêtes liées aux fournisseurs
export const useGetSupplierRelationships = (params: GetSuppliersParams = {}) => {
  return useQuery(
    ['suppliers', 'relationships', params],
    async () => {
      const { data } = await apiClient.get('/suppliers/relationships', { params });
      return data;
    }
  );
};

export const useGetSupplierById = (id: string) => {
  return useQuery(
    ['supplier', id],
    async () => {
      const { data } = await apiClient.get(`/suppliers/${id}`);
      return data;
    },
    {
      enabled: !!id,
    }
  );
};

export const useRegisterRelationship = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async (params: RegisterRelationshipParams) => {
      const { data } = await apiClient.post('/suppliers/relationships', params);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['suppliers', 'relationships']);
      },
    }
  );
};

export const useUpdateFactoringConditions = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async (params: UpdateFactoringParams) => {
      const { data } = await apiClient.put(`/suppliers/${params.supplierId}/factoring-conditions`, params);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['suppliers', 'relationships']);
      },
    }
  );
};

export const useSuspendRelationship = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async (params: ManageRelationshipParams) => {
      const { data } = await apiClient.post(`/suppliers/${params.supplierId}/suspend`);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['suppliers', 'relationships']);
      },
    }
  );
};

export const useReactivateRelationship = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async (params: ManageRelationshipParams) => {
      const { data } = await apiClient.post(`/suppliers/${params.supplierId}/reactivate`);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['suppliers', 'relationships']);
      },
    }
  );
};

export const useTerminateRelationship = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    async (params: ManageRelationshipParams) => {
      const { data } = await apiClient.post(`/suppliers/${params.supplierId}/terminate`);
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['suppliers', 'relationships']);
      },
    }
  );
};

// src/services/api/merchant.ts
import { useQuery } from 'react-query';
import apiClient from './client';

// Hooks pour les requêtes liées au commerçant
export const useGetMerchantProfile = () => {
  return useQuery(
    ['merchant', 'profile'],
    async () => {
      const { data } = await apiClient.get('/merchant/profile');
      return data;
    }
  );
};

export const useGetMerchantStats = () => {
  return useQuery(
    ['merchant', 'stats'],
    async () => {
      const { data } = await apiClient.get('/merchant/stats');
      return data;
    },
    {
      refetchInterval: 300000, // Rafraîchir toutes les 5 minutes
    }
  );
};

// src/services/api/consumers.ts
import { useQuery } from 'react-query';
import apiClient from './client';

// Types
interface GetConsumersParams {
  search?: string;
  limit?: number;
  offset?: number;
}

// Hooks pour les requêtes liées aux consommateurs
export const useGetConsumers = (params: GetConsumersParams = {}) => {
  return useQuery(
    ['consumers', params],
    async () => {
      const { data } = await apiClient.get('/consumers', { params });
      return data;
    }
  );
};

export const useGetConsumerById = (id: string) => {
  return useQuery(
    ['consumer', id],
    async () => {
      const { data } = await apiClient.get(`/consumers/${id}`);
      return data;
    },
    {
      enabled: !!id,
    }
  );
};

// src/services/blockchain/pop.ts
// Ce service gère l'interaction avec le mécanisme PoP (Proof of Purchase) de la blockchain Étika

/**
 * Génère un QR code pour la validation PoP d'une transaction
 * 
 * @param transactionData Les données de la transaction
 * @returns Chaîne de caractères à encoder dans un QR code
 */
export const generatePoPQRCode = (transactionData: {
  transactionId: string;
  merchant: string;
  consumer: string;
  amount: number;
  timestamp: string;
}) => {
  // Format spécifique pour le QR code PoP
  const qrData = {
    type: 'etika-pop',
    version: '1.0',
    ...transactionData
  };
  
  // Convertir en JSON pour QR code
  return JSON.stringify(qrData);
};

/**
 * Vérifie si une transaction PoP a été validée sur la blockchain
 * 
 * @param transactionId ID de la transaction
 * @returns Statut de validation et détails
 */
export const checkPoPValidationStatus = async (transactionId: string) => {
  try {
    const { data } = await apiClient.get(`/blockchain/pop/status/${transactionId}`);
    return {
      isValidated: data.status === 'validated',
      validations: data.validations || [],
      requiredValidations: data.requiredValidations || 0,
      status: data.status
    };
  } catch (error) {
    console.error('Erreur lors de la vérification du statut PoP:', error);
    return {
      isValidated: false,
      validations: [],
      requiredValidations: 0,
      status: 'error'
    };
  }
};

/**
 * Soumet une validation pour une transaction PoP
 * 
 * @param transactionId ID de la transaction
 * @param signature Signature cryptographique (simplifiée pour démo)
 * @returns Résultat de la validation
 */
export const submitPoPValidation = async (
  transactionId: string, 
  signature: string = 'demo-signature'
) => {
  try {
    const { data } = await apiClient.post(`/blockchain/pop/validate`, {
      transactionId,
      signature
    });
    return {
      success: true,
      newStatus: data.status,
      message: data.message
    };
  } catch (error) {
    console.error('Erreur lors de la validation PoP:', error);
    return {
      success: false,
      message: 'Échec de la validation'
    };
  }
};

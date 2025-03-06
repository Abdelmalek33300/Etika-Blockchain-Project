// apiSlice.ts - Service API centralisé avec gestion de cache intelligente
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { RootState } from './store';

// Configuration de base de RTK Query
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.REACT_APP_API_URL || '/api',
    prepareHeaders: (headers, { getState }) => {
      // Récupération automatique du token d'authentification
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
    // Fonction de transformation des erreurs pour standardisation
    validateStatus: (response, result) => {
      if (response.status === 403) {
        // Gestion spécifique des erreurs d'autorisation
        console.error('Accès refusé détecté');
        // Vous pourriez déclencher une action Redux ici
      }
      return response.status >= 200 && response.status < 300;
    },
  }),
  // Système de cache intelligent avec invalidation automatique
  tagTypes: ['User', 'Token', 'Transaction', 'Alert', 'Settings', 'System'],
  endpoints: () => ({}),
});

// tokenEndpoints.ts - Exemple d'endpoints pour la gestion des tokens
import { apiSlice } from './apiSlice';
import { TokenStats, TokenDistribution, TokenSettings } from '../types';

// Extension de l'API centrale avec des endpoints spécifiques
export const tokenApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Récupération des statistiques avec gestion de la mise en cache
    getTokenStats: builder.query<TokenStats, void>({
      query: () => '/tokens/stats',
      // Rafraîchissement automatique toutes les 30 secondes
      keepUnusedDataFor: 30,
      // Gestion des tags pour l'invalidation du cache
      providesTags: ['Token'],
    }),
    
    // Récupération de l'historique de distribution avec pagination
    getTokenDistribution: builder.query<TokenDistribution[], { page: number; limit: number }>({
      query: ({ page, limit }) => `/tokens/distribution?page=${page}&limit=${limit}`,
      // Transformation des données avant stockage dans le cache
      transformResponse: (response: any) => {
        // Normalisation des données
        return response.data.map((item: any) => ({
          id: item.id,
          date: new Date(item.timestamp),
          amount: parseFloat(item.amount),
          recipients: item.recipients,
          status: item.status,
        }));
      },
      // Fonction de fusion des résultats de pagination
      serializeQueryArgs: ({ endpointName }) => {
        return endpointName;
      },
      merge: (currentCache, newItems, { arg }) => {
        if (arg.page === 1) {
          return newItems;
        }
        return [...currentCache, ...newItems];
      },
      // Désactivation du remplacement du cache pour la pagination
      forceRefetch({ currentArg, previousArg }) {
        return currentArg !== previousArg;
      },
      providesTags: ['Token'],
    }),
    
    // Mise à jour des paramètres avec invalidation du cache
    updateTokenSettings: builder.mutation<void, TokenSettings>({
      query: (settings) => ({
        url: '/tokens/settings',
        method: 'PUT',
        body: settings,
      }),
      // Création d'un journal d'audit côté client
      onQueryStarted: async (settings, { dispatch, queryFulfilled }) => {
        try {
          await queryFulfilled;
          dispatch(
            // Action pour journaliser dans l'historique d'audit
            auditLogActions.addEntry({
              action: 'update_token_settings',
              details: JSON.stringify(settings),
              timestamp: new Date().toISOString(),
            })
          );
        } catch (err) {
          // Gestion des erreurs, potentiellement avec notifications
          console.error('Failed to update token settings:', err);
        }
      },
      // Invalidation du cache pour forcer le rechargement
      invalidatesTags: ['Token', 'Settings'],
    }),
  }),
});

// Export des hooks générés automatiquement
export const {
  useGetTokenStatsQuery,
  useGetTokenDistributionQuery,
  useUpdateTokenSettingsMutation,
} = tokenApiSlice;

// errorMiddleware.ts - Middleware de gestion des erreurs
import { isRejectedWithValue } from '@reduxjs/toolkit';
import type { Middleware } from 'redux';
import { showNotification } from '../features/notifications/notificationSlice';

/**
 * Middleware Redux pour la gestion centralisée des erreurs
 * - Transforme les erreurs API en notifications utilisateur
 * - Journalise les erreurs dans un système centralisé
 * - Gère spécifiquement certains codes d'erreur (auth, validation, etc.)
 */
export const errorMiddleware: Middleware = ({ dispatch }) => (next) => (action) => {
  // Ne s'applique qu'aux actions d'erreur de l'API
  if (isRejectedWithValue(action)) {
    // Extraction des informations d'erreur
    const { status, data } = action.payload || {};
    
    // Journalisation dans le système de traçabilité
    console.error('API Error:', status, data);
    
    // Catégorisation et gestion des erreurs
    if (status === 401) {
      // Erreur d'authentification -> déconnexion
      dispatch({ type: 'auth/logout' });
      dispatch(showNotification({
        type: 'error',
        title: 'Session expirée',
        message: 'Votre session a expiré. Veuillez vous reconnecter.',
      }));
    } else if (status === 403) {
      // Erreur d'autorisation
      dispatch(showNotification({
        type: 'error',
        title: 'Accès refusé',
        message: 'Vous n\'avez pas les droits nécessaires pour cette action.',
      }));
    } else if (status === 422) {
      // Erreur de validation -> affichage des champs problématiques
      const validationErrors = data?.errors || {};
      // Transformation pour l'affichage utilisateur
      const errorMessages = Object.entries(validationErrors)
        .map(([field, message]) => `${field}: ${message}`)
        .join('\n');
      
      dispatch(showNotification({
        type: 'error',
        title: 'Erreur de validation',
        message: errorMessages || 'Certaines données sont invalides.',
      }));
    } else {
      // Erreur générique
      dispatch(showNotification({
        type: 'error',
        title: 'Erreur système',
        message: data?.message || 'Une erreur est survenue. Veuillez réessayer.',
      }));
    }
    
    // Intégration avec système de monitoring externe
    if (window.Sentry) {
      window.Sentry.captureException(new Error(JSON.stringify({
        type: 'API_ERROR',
        status,
        endpoint: action.meta?.arg?.endpointName,
        data,
      })));
    }
  }
  
  return next(action);
};

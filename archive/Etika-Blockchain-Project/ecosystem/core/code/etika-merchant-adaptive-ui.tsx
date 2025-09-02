// src/components/merchant/MerchantContext.tsx - Contexte d'adaptation selon le type de commerçant
import React, { createContext, useContext, useState, useEffect } from 'react';
import { MerchantType } from '../../models/merchant';
import { useAuth } from '../../hooks/useAuth';

// Type des valeurs du contexte
interface MerchantContextType {
  merchantType: MerchantType;
  isHeadOffice: boolean;
  hasMultipleLocations: boolean;
  hasCentralizedProgram: boolean;
  hasEcommerceCapabilities: boolean;
  hasCustomizations: string[];
  features: FeatureAvailability;
}

// Disponibilité des fonctionnalités selon le type de commerçant
interface FeatureAvailability {
  hierarchyManagement: boolean;
  locationManagement: boolean;
  centralizedReporting: boolean;
  userManagement: boolean;
  advancedAnalytics: boolean;
  ecommerceIntegration: boolean;
  posIntegration: boolean;
  customLoyaltyRules: boolean;
  omniChannelSync: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  bulkOperations: boolean;
  whiteLabeling: boolean;
}

// Valeurs par défaut
const defaultMerchantContext: MerchantContextType = {
  merchantType: MerchantType.INDEPENDENT,
  isHeadOffice: false,
  hasMultipleLocations: false,
  hasCentralizedProgram: false,
  hasEcommerceCapabilities: false,
  hasCustomizations: [],
  features: {
    hierarchyManagement: false,
    locationManagement: false,
    centralizedReporting: false,
    userManagement: true,
    advancedAnalytics: false,
    ecommerceIntegration: false,
    posIntegration: true,
    customLoyaltyRules: true,
    omniChannelSync: false,
    apiAccess: false,
    webhooks: false,
    bulkOperations: false,
    whiteLabeling: false
  }
};

// Création du contexte
const MerchantContext = createContext<MerchantContextType>(defaultMerchantContext);

// Hook personnalisé pour utiliser le contexte
export const useMerchant = () => useContext(MerchantContext);

// Provider du contexte
export const MerchantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [merchantContext, setMerchantContext] = useState<MerchantContextType>(defaultMerchantContext);
  
  useEffect(() => {
    // Dans une application réelle, ces données viendraient de l'API
    // Cet exemple simule les différentes configurations selon le type
    const fetchMerchantConfiguration = async () => {
      try {
        // Ici on simule une réponse d'API
        const merchantData = {
          type: user?.merchantType || MerchantType.INDEPENDENT,
          settings: {
            hierarchySettings: {
              isHeadquarters: user?.merchantType === MerchantType.FRANCHISOR || 
                              user?.merchantType === MerchantType.CHAIN_HQ ||
                              user?.merchantType === MerchantType.COOPERATIVE,
              centralizedLoyaltyProgram: user?.merchantType !== MerchantType.INDEPENDENT,
              customizableSettings: ['tokenGenerationRate', 'minimumTokensForRedemption']
            },
            ecommerceSettings: {
              platform: user?.merchantType === MerchantType.ECOMMERCE ? 'Shopify' : undefined
            }
          },
          locations: user?.merchantType !== MerchantType.INDEPENDENT ? [{ id: '1' }, { id: '2' }] : []
        };
        
        // Configuration des fonctionnalités selon le type de commerçant
        let features: FeatureAvailability = { ...defaultMerchantContext.features };
        
        switch (merchantData.type) {
          case MerchantType.INDEPENDENT:
            // Configuration de base, utilise les valeurs par défaut
            break;
            
          case MerchantType.FRANCHISEE:
            features = {
              ...features,
              locationManagement: true,
              centralizedReporting: true,
              customLoyaltyRules: merchantData.settings.hierarchySettings.customizableSettings.includes('tokenGenerationRate'),
              apiAccess: true
            };
            break;
            
          case MerchantType.FRANCHISOR:
          case MerchantType.CHAIN_HQ:
            features = {
              ...features,
              hierarchyManagement: true,
              locationManagement: true,
              centralizedReporting: true,
              userManagement: true,
              advancedAnalytics: true,
              ecommerceIntegration: true,
              posIntegration: true,
              customLoyaltyRules: true,
              omniChannelSync: true,
              apiAccess: true,
              webhooks: true,
              bulkOperations: true,
              whiteLabeling: true
            };
            break;
            
          case MerchantType.ECOMMERCE:
            features = {
              ...features,
              ecommerceIntegration: true,
              apiAccess: true,
              webhooks: true
            };
            break;
            
          case MerchantType.OMNICHANNEL:
            features = {
              ...features,
              locationManagement: true,
              centralizedReporting: true,
              advancedAnalytics: true,
              ecommerceIntegration: true,
              posIntegration: true,
              customLoyaltyRules: true,
              omniChannelSync: true,
              apiAccess: true,
              webhooks: true
            };
            break;
            
          case MerchantType.COOPERATIVE:
            features = {
              ...features,
              hierarchyManagement: true,
              locationManagement: true,
              centralizedReporting: true,
              userManagement: true,
              advancedAnalytics: true,
              bulkOperations: true
            };
            break;
        }
        
        // Mise à jour du contexte
        setMerchantContext({
          merchantType: merchantData.type,
          isHeadOffice: merchantData.settings.hierarchySettings?.isHeadquarters || false,
          hasMultipleLocations: merchantData.locations.length > 0,
          hasCentralizedProgram: merchantData.settings.hierarchySettings?.centralizedLoyaltyProgram || false,
          hasEcommerceCapabilities: !!merchantData.settings.ecommerceSettings?.platform,
          hasCustomizations: merchantData.settings.hierarchySettings?.customizableSettings || [],
          features
        });
        
      } catch (error) {
        console.error('Erreur lors du chargement de la configuration commerçant:', error);
        // En cas d'erreur, on garde les valeurs par défaut
      }
    };
    
    fetchMerchantConfiguration();
  }, [user]);
  
  return (
    <MerchantContext.Provider value={merchantContext}>
      {children}
    </MerchantContext.Provider>
  );
};

// src/components/merchant/AdaptiveNavigation.tsx - Navigation adaptative selon le type de commerçant
import React from 'react';
import { List, ListItem, ListItemIcon, ListItemText, Collapse, Divider } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Store as StoreIcon,
  BusinessCenter as BusinessIcon,
  Group as GroupIcon,
  BarChart as AnalyticsIcon,
  Settings as SettingsIcon,
  ShoppingCart as EcommerceIcon,
  Receipt as TransactionsIcon,
  LocalOffer as TokensIcon,
  Loyalty as LoyaltyIcon,
  Code as ApiIcon,
  BrandingWatermark as BrandingIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useMerchant } from './MerchantContext';
import { MerchantType } from '../../models/merchant';

interface AdaptiveNavigationProps {
  expanded: Record<string, boolean>;
  toggleExpand: (section: string) => void;
}

const AdaptiveNavigation: React.FC<AdaptiveNavigationProps> = ({ expanded, toggleExpand }) => {
  const navigate = useNavigate();
  const merchant = useMerchant();
  
  // Navigation vers une route
  const navigateTo = (path: string) => {
    navigate(path);
  };
  
  return (
    <List component="nav">
      {/* Dashboard - disponible pour tous */}
      <ListItem button onClick={() => navigateTo('/merchant')}>
        <ListItemIcon>
          <DashboardIcon />
        </ListItemIcon>
        <ListItemText primary="Tableau de bord" />
      </ListItem>
      
      {/* Gestion des tokens - disponible pour tous */}
      <ListItem button onClick={() => navigateTo('/merchant/tokens')}>
        <ListItemIcon>
          <TokensIcon />
        </ListItemIcon>
        <ListItemText primary="Tokens" />
      </ListItem>
      
      {/* Transactions - disponible pour tous */}
      <ListItem button onClick={() => navigateTo('/merchant/transactions')}>
        <ListItemIcon>
          <TransactionsIcon />
        </ListItemIcon>
        <ListItemText primary="Transactions" />
      </ListItem>
      
      {/* Programme de fidélité - disponible pour tous */}
      <ListItem 
        button 
        onClick={() => navigateTo('/merchant/loyalty')}
        disabled={merchant.hasCentralizedProgram && !merchant.isHeadOffice}
      >
        <ListItemIcon>
          <LoyaltyIcon />
        </ListItemIcon>
        <ListItemText 
          primary="Programme de fidélité" 
          secondary={merchant.hasCentralizedProgram && !merchant.isHeadOffice ? "Géré par le siège" : ""}
        />
      </ListItem>
      
      {/* Gestion des points de vente - pour les structures avec plusieurs emplacements */}
      {merchant.features.locationManagement && (
        <ListItem button onClick={() => navigateTo('/merchant/locations')}>
          <ListItemIcon>
            <StoreIcon />
          </ListItemIcon>
          <ListItemText primary="Points de vente" />
        </ListItem>
      )}
      
      {/* E-commerce - pour les acteurs avec capacité e-commerce */}
      {merchant.features.ecommerceIntegration && (
        <ListItem button onClick={() => navigateTo('/merchant/ecommerce')}>
          <ListItemIcon>
            <EcommerceIcon />
          </ListItemIcon>
          <ListItemText primary="E-commerce" />
        </ListItem>
      )}
      
      <Divider sx={{ my: 1 }} />
      
      {/* Gestion hiérarchique - pour les franchiseurs, sièges, coopératives */}
      {merchant.features.hierarchyManagement && (
        <ListItem button onClick={() => toggleExpand('network')}>
          <ListItemIcon>
            <BusinessIcon />
          </ListItemIcon>
          <ListItemText primary={
            merchant.merchantType === MerchantType.FRANCHISOR ? "Réseau de franchise" :
            merchant.merchantType === MerchantType.CHAIN_HQ ? "Réseau d'enseignes" :
            merchant.merchantType === MerchantType.COOPERATIVE ? "Coopérative" : "Réseau"
          } />
        </ListItem>
      )}
      
      {/* Gestion des utilisateurs - disponible pour tous mais étendue pour certains */}
      {merchant.features.userManagement && (
        <ListItem button onClick={() => navigateTo('/merchant/users')}>
          <ListItemIcon>
            <GroupIcon />
          </ListItemIcon>
          <ListItemText primary="Utilisateurs" />
        </ListItem>
      )}
      
      {/* Analytique avancée - pour les structures complexes */}
      {merchant.features.advancedAnalytics && (
        <ListItem button onClick={() => navigateTo('/merchant/analytics')}>
          <ListItemIcon>
            <AnalyticsIcon />
          </ListItemIcon>
          <ListItemText primary="Analytique avancée" />
        </ListItem>
      )}
      
      {/* Accès API - pour les structures avec intégration technique */}
      {merchant.features.apiAccess && (
        <ListItem button onClick={() => navigateTo('/merchant/api')}>
          <ListItemIcon>
            <ApiIcon />
          </ListItemIcon>
          <ListItemText primary="API & Intégrations" />
        </ListItem>
      )}
      
      {/* White Labeling - pour les grandes enseignes */}
      {merchant.features.whiteLabeling && (
        <ListItem button onClick={() => navigateTo('/merchant/branding')}>
          <ListItemIcon>
            <BrandingIcon />
          </ListItemIcon>
          <ListItemText primary="Personnalisation marque" />
        </ListItem>
      )}
      
      <Divider sx={{ my: 1 }} />
      
      {/* Paramètres - disponible pour tous mais contenu différent */}
      <ListItem button onClick={() => navigateTo('/merchant/settings')}>
        <ListItemIcon>
          <SettingsIcon />
        </ListItemIcon>
        <ListItemText primary="Paramètres" />
      </ListItem>
    </List>
  );
};

export default AdaptiveNavigation;

// src/components/merchant/MerchantTypeIndicator.tsx - Composant indiquant le type de commerce
import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { 
  PersonOutline as IndependentIcon,
  AccountBalance as FranchiseIcon,
  Business as ChainIcon,
  ShoppingCart as EcommerceIcon,
  DevicesOther as OmniChannelIcon,
  People as CooperativeIcon
} from '@mui/icons-material';
import { MerchantType } from '../../models/merchant';
import { useMerchant } from './MerchantContext';

// Configuration d'affichage selon le type de commerçant
const merchantTypeConfig = {
  [MerchantType.INDEPENDENT]: {
    label: 'Indépendant',
    icon: <IndependentIcon fontSize="small" />,
    color: 'primary',
    tooltip: 'Commerce indépendant'
  },
  [MerchantType.FRANCHISEE]: {
    label: 'Franchisé',
    icon: <FranchiseIcon fontSize="small" />,
    color: 'secondary',
    tooltip: 'Magasin franchisé'
  },
  [MerchantType.FRANCHISOR]: {
    label: 'Franchiseur',
    icon: <FranchiseIcon fontSize="small" />,
    color: 'secondary',
    tooltip: 'Siège de réseau de franchise'
  },
  [MerchantType.CHAIN_STORE]: {
    label: 'Chaîne',
    icon: <ChainIcon fontSize="small" />,
    color: 'info',
    tooltip: 'Magasin d\'une chaîne'
  },
  [MerchantType.CHAIN_HQ]: {
    label: 'Siège',
    icon: <ChainIcon fontSize="small" />,
    color: 'info',
    tooltip: 'Siège d\'une chaîne de magasins'
  },
  [MerchantType.ECOMMERCE]: {
    label: 'E-commerce',
    icon: <EcommerceIcon fontSize="small" />,
    color: 'success',
    tooltip: 'Site de commerce en ligne'
  },
  [MerchantType.OMNICHANNEL]: {
    label: 'Omnicanal',
    icon: <OmniChannelIcon fontSize="small" />,
    color: 'warning',
    tooltip: 'Commerce physique et digital'
  },
  [MerchantType.COOPERATIVE]: {
    label: 'Coopérative',
    icon: <CooperativeIcon fontSize="small" />,
    color: 'error',
    tooltip: 'Groupement coopératif'
  },
  [MerchantType.COOPERATIVE_MEMBER]: {
    label: 'Membre Coop.',
    icon: <CooperativeIcon fontSize="small" />,
    color: 'error',
    tooltip: 'Membre d\'une coopérative'
  }
};

interface MerchantTypeIndicatorProps {
  type?: MerchantType;
  small?: boolean;
}

const MerchantTypeIndicator: React.FC<MerchantTypeIndicatorProps> = ({ type, small = false }) => {
  const merchant = useMerchant();
  const merchantType = type || merchant.merchantType;
  const config = merchantTypeConfig[merchantType];
  
  return (
    <Tooltip title={config.tooltip}>
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color as any}
        size={small ? 'small' : 'medium'}
        variant="outlined"
      />
    </Tooltip>
  );
};

export default MerchantTypeIndicator;

// src/components/merchant/AdaptiveDashboard.tsx - Dashboard adaptatif selon le type de commerçant
import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Typography, 
  CircularProgress,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import DashboardCard from '../dashboard/DashboardCard';
import { useMerchant } from './MerchantContext';
import MerchantTypeIndicator from './MerchantTypeIndicator';

// Composants spécifiques selon le type de commerce
import IndependentDashboard from './dashboards/IndependentDashboard';
import FranchiseeDashboard from './dashboards/FranchiseeDashboard';
import FranchisorDashboard from './dashboards/FranchisorDashboard';
import ChainStoreDashboard from './dashboards/ChainStoreDashboard';
import ChainHQDashboard from './dashboards/ChainHQDashboard';
import EcommerceDashboard from './dashboards/EcommerceDashboard';
import OmnichannelDashboard from './dashboards/OmnichannelDashboard';
import CooperativeDashboard from './dashboards/CooperativeDashboard';

const AdaptiveDashboard: React.FC = () => {
  const merchant = useMerchant();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  
  useEffect(() => {
    // Simuler le chargement des données
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }
  
  // Afficher le composant de dashboard spécifique selon le type de commerçant
  const renderDashboardByType = () => {
    switch (merchant.merchantType) {
      case MerchantType.INDEPENDENT:
        return <IndependentDashboard />;
      case MerchantType.FRANCHISEE:
        return <FranchiseeDashboard />;
      case MerchantType.FRANCHISOR:
        return <FranchisorDashboard />;
      case MerchantType.CHAIN_STORE:
        return <ChainStoreDashboard />;
      case MerchantType.CHAIN_HQ:
        return <ChainHQDashboard />;
      case MerchantType.ECOMMERCE:
        return <EcommerceDashboard />;
      case MerchantType.OMNICHANNEL:
        return <OmnichannelDashboard />;
      case MerchantType.COOPERATIVE:
      case MerchantType.COOPERATIVE_MEMBER:
        return <CooperativeDashboard />;
      default:
        return <IndependentDashboard />;
    }
  };
  
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Tableau de bord
          </Typography>
          <MerchantTypeIndicator />
        </Box>
        
        {/* Onglets spécifiques selon le type de commerçant */}
        {(merchant.hasMultipleLocations || merchant.isHeadOffice) && (
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label={merchant.isHeadOffice ? "Vue globale" : "Mon magasin"} />
            {merchant.hasMultipleLocations && <Tab label="Points de vente" />}
            {merchant.isHeadOffice && <Tab label="Performance réseau" />}
            {merchant.hasEcommerceCapabilities && <Tab label="E-commerce" />}
          </Tabs>
        )}
      </Box>
      
      {/* Contenu du dashboard */}
      {renderDashboardByType()}
    </Box>
  );
};

export default AdaptiveDashboard;

// src/components/merchant/AccessRestrictedNotice.tsx - Notification pour fonctionnalités non accessibles
import React from 'react';
import { Alert, AlertTitle, Button, Box } from '@mui/material';
import { useMerchant } from './MerchantContext';

interface AccessRestrictedNoticeProps {
  feature: string;
  description: string;
  requiredType?: MerchantType[];
  contactUrl?: string;
}

const AccessRestrictedNotice: React.FC<AccessRestrictedNoticeProps> = ({ 
  feature, 
  description, 
  requiredType, 
  contactUrl 
}) => {
  const merchant = useMerchant();
  
  // Afficher le type requis s'il est spécifié
  const requiredTypeText = requiredType
    ? requiredType.map(type => merchantTypeConfig[type]?.label).join(', ')
    : '';
  
  return (
    <Box my={3}>
      <Alert severity="info">
        <AlertTitle>Fonctionnalité limitée : {feature}</AlertTitle>
        <p>{description}</p>
        {requiredTypeText && (
          <p>Cette fonctionnalité est disponible pour : <strong>{requiredTypeText}</strong></p>
        )}
        {contactUrl && (
          <Button 
            variant="outlined" 
            size="small" 
            color="info"
            href={contactUrl} 
            sx={{ mt: 1 }}
          >
            Contacter le support
          </Button>
        )}
      </Alert>
    </Box>
  );
};

export default AccessRestrictedNotice;

// src/components/merchant/dashboards/IndependentDashboard.tsx - Dashboard pour commerçants indépendants
import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box,
  Button, 
  Divider 
} from '@mui/material';
import DashboardCard from '../../dashboard/DashboardCard';
import {
  LocalOffer as TokenIcon,
  ShoppingCart as CartIcon,
  People as CustomerIcon,
  TrendingUp as RevenueIcon
} from '@mui/icons-material';
import RecentTransactionsTable from '../../tables/RecentTransactionsTable';

// Dashboard simplifié optimisé pour les commerçants indépendants
const IndependentDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  useEffect(() => {
    // Simulation de données pour le dashboard
    setStats({
      tokensIssued: 2450,
      customerCount: 187,
      salesAmount: 14520,
      transactionCount: 432
    });
    
    setTransactions([
      { 
        id: 'TX123456',
        date: '2025-02-07T14:32:21',
        customer: 'Jean Dupont',
        amount: 65.30,
        tokens: 6,
        status: 'completed'
      },
      { 
        id: 'TX123457',
        date: '2025-02-07T11:15:42',
        customer: 'Marie Martin',
        amount: 42.75,
        tokens: 4,
        status: 'completed'
      },
      { 
        id: 'TX123458',
        date: '2025-02-06T16:48:33',
        customer: 'Pierre Durand',
        amount: 78.90,
        tokens: 7,
        status: 'completed'
      }
    ]);
  }, []);
  
  return (
    <Box>
      {/* Cartes de KPIs simplifiées */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Tokens émis"
            value={stats?.tokensIssued}
            icon={<TokenIcon color="primary" fontSize="large" />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Clients fidélisés"
            value={stats?.customerCount}
            icon={<CustomerIcon color="primary" fontSize="large" />}
            color="#388e3c"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Chiffre d'affaires"
            value={`${stats?.salesAmount.toLocaleString('fr-FR')} €`}
            icon={<RevenueIcon color="primary" fontSize="large" />}
            color="#f57c00"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Transactions"
            value={stats?.transactionCount}
            icon={<CartIcon color="primary" fontSize="large" />}
            color="#7b1fa2"
          />
        </Grid>
      </Grid>
      
      {/* Transactions récentes */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Transactions récentes
          </Typography>
          <Button variant="text">
            Voir toutes les transactions
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <RecentTransactionsTable transactions={transactions} />
      </Paper>
      
      {/* Guide de démarrage rapide */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Commencer avec Etika
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle1" gutterBottom>
                1. Configurer votre programme
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Personnalisez votre programme de fidélité en quelques clics.
              </Typography>
              <Button variant="outlined" size="small">
                Configurer
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle1" gutterBottom>
                2. Intégrer à votre caisse
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Connectez Etika à votre système d'encaissement.
              </Typography>
              <Button variant="outlined" size="small">
                Voir les options
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle1" gutterBottom>
                3. Communiquer avec vos clients
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Préparez votre communication pour le lancement.
              </Typography>
              <Button variant="outlined" size="small">
                Accéder aux outils
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default IndependentDashboard;abilities: false,
  hasCustomizations: [],
  features: {
    hierarchyManagement: false,
    locationManagement: false,
    centralizedReporting: false,
    userManagement: true,
    advancedAnalytics: false,
    ecommerceIntegration: false,
    posIntegration: true,
    customLoyaltyRules: true,
    omniChannelSync: false,
    apiAccess: false,
    webhooks: false,
    bulkOperations: false,
    whiteLabeling: false
  }
};

// Création du contexte
const MerchantContext = createContext<MerchantContextType>(defaultMerchantContext);

// Hook personnalisé pour utiliser le contexte
export const useMerchant = () => useContext(MerchantContext);

// Provider du contexte
export const MerchantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [merchantContext, setMerchantContext] = useState<MerchantContextType>(defaultMerchantContext);
  
  useEffect(() => {
    // Dans une application réelle, ces données viendraient de l'API
    // Cet exemple simule les différentes configurations selon le type
    const fetchMerchantConfiguration = async () => {
      try {
        // Ici on simule une réponse d'API
        const merchantData = {
          type: user?.merchantType || MerchantType.INDEPENDENT,
          settings: {
            hierarchySettings: {
              isHeadquarters: user?.merchantType === MerchantType.FRANCHISOR || 
                              user?.merchantType === MerchantType.CHAIN_HQ ||
                              user?.merchantType === MerchantType.COOPERATIVE,
              centralizedLoyaltyProgram: user?.merchantType !== MerchantType.INDEPENDENT,
              customizableSettings: ['tokenGenerationRate', 'minimumTokensForRedemption']
            },
            ecommerceSettings: {
              platform: user?.merchantType === MerchantType.ECOMMERCE ? 'Shopify' : undefined
            }
          },
          locations: user?.merchantType !== MerchantType.INDEPENDENT ? [{ id: '1' }, { id: '2' }] : []
        };
        
        // Configuration des fonctionnalités selon le type de commerçant
        let features: FeatureAvailability = { ...defaultMerchantContext.features };
        
        switch (merchantData.type) {
          case MerchantType.INDEPENDENT:
            // Configuration de base, utilise les valeurs par défaut
            break;
            
          case MerchantType.FRANCHISEE:
            features = {
              ...features,
              locationManagement: true,
              centralizedReporting: true,
              customLoyaltyRules: merchantData.settings.hierarchySettings.customizableSettings.includes('tokenGenerationRate'),
              apiAccess: true
            };
            break;
            
          case MerchantType.FRANCHISOR:
          case MerchantType.CHAIN_HQ:
            features = {
              ...features,
              hierarchyManagement: true,
              locationManagement: true,
              centralizedReporting: true,
              userManagement: true,
              advancedAnalytics: true,
              ecommerceIntegration: true,
              posIntegration: true,
              customLoyaltyRules: true,
              omniChannelSync: true,
              apiAccess: true,
              webhooks: true,
              bulkOperations: true,
              whiteLabeling: true
            };
            break;
            
          case MerchantType.ECOMMERCE:
            features = {
              ...features,
              ecommerceIntegration: true,
              apiAccess: true,
              webhooks: true
            };
            break;
            
          case MerchantType.OMNICHANNEL:
            features = {
              ...features,
              locationManagement: true,
              centralizedReporting: true,
              advancedAnalytics: true,
              ecommerceIntegration: true,
              posIntegration: true,
              customLoyaltyRules: true,
              omniChannelSync: true,
              apiAccess: true,
              webhooks: true
            };
            break;
            
          case MerchantType.COOPERATIVE:
            features = {
              ...features,
              hierarchyManagement: true,
              locationManagement: true,
              centralizedReporting: true,
              userManagement: true,
              advancedAnalytics: true,
              bulkOperations: true
            };
            break;
        }
        
        // Mise à jour du contexte
        setMerchantContext({
          merchantType: merchantData.type,
          isHeadOffice: merchantData.settings.hierarchySettings?.isHeadquarters || false,
          hasMultipleLocations: merchantData.locations.length > 0,
          hasCentralizedProgram: merchantData.settings.hierarchySettings?.centralizedLoyaltyProgram || false,
          hasEcommerceCapabilities: !!merchantData.settings.ecommerceSettings?.platform,
          hasCustomizations: merchantData.settings.hierarchySettings?.customizableSettings || [],
          features
        });
        
      } catch (error) {
        console.error('Erreur lors du chargement de la configuration commerçant:', error);
        // En cas d'erreur, on garde les valeurs par défaut
      }
    };
    
    fetchMerchantConfiguration();
  }, [user]);
  
  return (
    <MerchantContext.Provider value={merchantContext}>
      {children}
    </MerchantContext.Provider>
  );
};

// src/components/merchant/AdaptiveNavigation.tsx - Navigation adaptative selon le type de commerçant
import React from 'react';
import { List, ListItem, ListItemIcon, ListItemText, Collapse, Divider } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Store as StoreIcon,
  BusinessCenter as BusinessIcon,
  Group as GroupIcon,
  BarChart as AnalyticsIcon,
  Settings as SettingsIcon,
  ShoppingCart as EcommerceIcon,
  Receipt as TransactionsIcon,
  LocalOffer as TokensIcon,
  Loyalty as LoyaltyIcon,
  Code as ApiIcon,
  BrandingWatermark as BrandingIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useMerchant } from './MerchantContext';
import { MerchantType } from '../../models/merchant';

interface AdaptiveNavigationProps {
  expanded: Record<string, boolean>;
  toggleExpand: (section: string) => void;
}

const AdaptiveNavigation: React.FC<AdaptiveNavigationProps> = ({ expanded, toggleExpand }) => {
  const navigate = useNavigate();
  const merchant = useMerchant();
  
  // Navigation vers une route
  const navigateTo = (path: string) => {
    navigate(path);
  };
  
  return (
    <List component="nav">
      {/* Dashboard - disponible pour tous */}
      <ListItem button onClick={() => navigateTo('/merchant')}>
        <ListItemIcon>
          <DashboardIcon />
        </ListItemIcon>
        <ListItemText primary="Tableau de bord" />
      </ListItem>
      
      {/* Gestion des tokens - disponible pour tous */}
      <ListItem button onClick={() => navigateTo('/merchant/tokens')}>
        <ListItemIcon>
          <TokensIcon />
        </ListItemIcon>
        <ListItemText primary="Tokens" />
      </ListItem>
      
      {/* Transactions - disponible pour tous */}
      <ListItem button onClick={() => navigateTo('/merchant/transactions')}>
        <ListItemIcon>
          <TransactionsIcon />
        </ListItemIcon>
        <ListItemText primary="Transactions" />
      </ListItem>
      
      {/* Programme de fidélité - disponible pour tous */}
      <ListItem 
        button 
        onClick={() => navigateTo('/merchant/loyalty')}
        disabled={merchant.hasCentralizedProgram && !merchant.isHeadOffice}
      >
        <ListItemIcon>
          <LoyaltyIcon />
        </ListItemIcon>
        <ListItemText 
          primary="Programme de fidélité" 
          secondary={merchant.hasCentralizedProgram && !merchant.isHeadOffice ? "Géré par le siège" : ""}
        />
      </ListItem>
      
      {/* Gestion des points de vente - pour les structures avec plusieurs emplacements */}
      {merchant.features.locationManagement && (
        <ListItem button onClick={() => navigateTo('/merchant/locations')}>
          <ListItemIcon>
            <StoreIcon />
          </ListItemIcon>
          <ListItemText primary="Points de vente" />
        </ListItem>
      )}
      
      {/* E-commerce - pour les acteurs avec capacité e-commerce */}
      {merchant.features.ecommerceIntegration && (
        <ListItem button onClick={() => navigateTo('/merchant/ecommerce')}>
          <ListItemIcon>
            <EcommerceIcon />
          </ListItemIcon>
          <ListItemText primary="E-commerce" />
        </ListItem>
      )}
      
      <Divider sx={{ my: 1 }} />
      
      {/* Gestion hiérarchique - pour les franchiseurs, sièges, coopératives */}
      {merchant.features.hierarchyManagement && (
        <ListItem button onClick={() => toggleExpand('network')}>
          <ListItemIcon>
            <BusinessIcon />
          </ListItemIcon>
          <ListItemText primary={
            merchant.merchantType === MerchantType.FRANCHISOR ? "Réseau de franchise" :
            merchant.merchantType === MerchantType.CHAIN_HQ ? "Réseau d'enseignes" :
            merchant.merchantType === MerchantType.COOPERATIVE ? "Coopérative" : "Réseau"
          } />
        </ListItem>
      )}
      
      {/* Gestion des utilisateurs - disponible pour tous mais étendue pour certains */}
      {merchant.features.userManagement && (
        <ListItem button onClick={() => navigateTo('/merchant/users')}>
          <ListItemIcon>
            <GroupIcon />
          </ListItemIcon>
          <ListItemText primary="Utilisateurs" />
        </ListItem>
      )}
      
      {/* Analytique avancée - pour les structures complexes */}
      {merchant.features.advancedAnalytics && (
        <ListItem button onClick={() => navigateTo('/merchant/analytics')}>
          <ListItemIcon>
            <AnalyticsIcon />
          </ListItemIcon>
          <ListItemText primary="Analytique avancée" />
        </ListItem>
      )}
      
      {/* Accès API - pour les structures avec intégration technique */}
      {merchant.features.apiAccess && (
        <ListItem button onClick={() => navigateTo('/merchant/api')}>
          <ListItemIcon>
            <ApiIcon />
          </ListItemIcon>
          <ListItemText primary="API & Intégrations" />
        </ListItem>
      )}
      
      {/* White Labeling - pour les grandes enseignes */}
      {merchant.features.whiteLabeling && (
        <ListItem button onClick={() => navigateTo('/merchant/branding')}>
          <ListItemIcon>
            <BrandingIcon />
          </ListItemIcon>
          <ListItemText primary="Personnalisation marque" />
        </ListItem>
      )}
      
      <Divider sx={{ my: 1 }} />
      
      {/* Paramètres - disponible pour tous mais contenu différent */}
      <ListItem button onClick={() => navigateTo('/merchant/settings')}>
        <ListItemIcon>
          <SettingsIcon />
        </ListItemIcon>
        <ListItemText primary="Paramètres" />
      </ListItem>
    </List>
  );
};

export default AdaptiveNavigation;

// src/components/merchant/MerchantTypeIndicator.tsx - Composant indiquant le type de commerce
import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { 
  PersonOutline as IndependentIcon,
  AccountBalance as FranchiseIcon,
  Business as ChainIcon,
  ShoppingCart
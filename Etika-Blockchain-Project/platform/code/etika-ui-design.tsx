// Structure de base de l'application React avec espaces réservés

// src/App.tsx - Point d'entrée principal de l'application
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages communes
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// Espaces professionnels
import MerchantDashboard from './pages/merchant/Dashboard';
import MerchantTokens from './pages/merchant/Tokens';
import MerchantTransactions from './pages/merchant/Transactions';
import MerchantLoyalty from './pages/merchant/Loyalty';
import MerchantPayments from './pages/merchant/Payments';

import SupplierDashboard from './pages/supplier/Dashboard';
import SupplierTokens from './pages/supplier/Tokens';
import SupplierTransactions from './pages/supplier/Transactions';
import SupplierFinancials from './pages/supplier/Financials';

import SubcontractorDashboard from './pages/subcontractor/Dashboard';
import SubcontractorServices from './pages/subcontractor/Services';
import SubcontractorTokens from './pages/subcontractor/Tokens';

// Services partagés
import TokenManagement from './pages/shared/TokenManagement';
import Notifications from './pages/shared/Notifications';
import Profile from './pages/shared/Profile';
import OrganizationSettings from './pages/shared/OrganizationSettings';

// Administration
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import SystemSettings from './pages/admin/SystemSettings';

// Utilitaires et hooks
import { checkAuth } from './store/slices/authSlice';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleRoute } from './components/auth/RoleRoute';
import { useAuth } from './hooks/useAuth';
import theme from './theme';

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, userRoles } = useAuth();
  
  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Routes publiques */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>
          
          {/* Routes protégées avec MainLayout */}
          <Route element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            {/* Dashboard principal (adaptif selon le rôle) */}
            <Route path="/" element={<Dashboard />} />
            
            {/* Espace Commerçant */}
            <Route path="/merchant" element={
              <RoleRoute requiredRole="merchant">
                <MerchantDashboard />
              </RoleRoute>
            } />
            <Route path="/merchant/tokens" element={
              <RoleRoute requiredRole="merchant">
                <MerchantTokens />
              </RoleRoute>
            } />
            <Route path="/merchant/transactions" element={
              <RoleRoute requiredRole="merchant">
                <MerchantTransactions />
              </RoleRoute>
            } />
            <Route path="/merchant/loyalty" element={
              <RoleRoute requiredRole="merchant">
                <MerchantLoyalty />
              </RoleRoute>
            } />
            <Route path="/merchant/payments" element={
              <RoleRoute requiredRole="merchant">
                <MerchantPayments />
              </RoleRoute>
            } />
            
            {/* Espace Fournisseur */}
            <Route path="/supplier" element={
              <RoleRoute requiredRole="supplier">
                <SupplierDashboard />
              </RoleRoute>
            } />
            <Route path="/supplier/tokens" element={
              <RoleRoute requiredRole="supplier">
                <SupplierTokens />
              </RoleRoute>
            } />
            <Route path="/supplier/transactions" element={
              <RoleRoute requiredRole="supplier">
                <SupplierTransactions />
              </RoleRoute>
            } />
            <Route path="/supplier/financials" element={
              <RoleRoute requiredRole="supplier">
                <SupplierFinancials />
              </RoleRoute>
            } />
            
            {/* Espace Sous-traitant */}
            <Route path="/subcontractor" element={
              <RoleRoute requiredRole="subcontractor">
                <SubcontractorDashboard />
              </RoleRoute>
            } />
            <Route path="/subcontractor/services" element={
              <RoleRoute requiredRole="subcontractor">
                <SubcontractorServices />
              </RoleRoute>
            } />
            <Route path="/subcontractor/tokens" element={
              <RoleRoute requiredRole="subcontractor">
                <SubcontractorTokens />
              </RoleRoute>
            } />
            
            {/* Services partagés */}
            <Route path="/tokens" element={<TokenManagement />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/organization" element={<OrganizationSettings />} />
            
            {/* Administration */}
            <Route path="/admin" element={
              <RoleRoute requiredRole="admin">
                <AdminDashboard />
              </RoleRoute>
            } />
            <Route path="/admin/users" element={
              <RoleRoute requiredRole="admin">
                <UserManagement />
              </RoleRoute>
            } />
            <Route path="/admin/settings" element={
              <RoleRoute requiredRole="admin">
                <SystemSettings />
              </RoleRoute>
            } />
            
            {/* Route 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;

// src/layouts/MainLayout.tsx - Layout principal avec navigation adaptative
import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Collapse,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Payment as PaymentIcon,
  Loyalty as LoyaltyIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
  ExpandLess,
  ExpandMore,
  LocalOffer as LocalOfferIcon,
  SupervisorAccount as SupervisorAccountIcon,
} from '@mui/icons-material';

import { useAuth } from '../hooks/useAuth';

const drawerWidth = 260;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, userRoles, logout } = useAuth();
  
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuExpanded, setMenuExpanded] = useState<Record<string, boolean>>({
    merchant: false,
    supplier: false,
    subcontractor: false,
    admin: false,
  });
  
  const handleDrawerToggle = () => {
    setOpen(!open);
  };
  
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
    navigate('/login');
  };
  
  const navigateTo = (path: string) => {
    navigate(path);
  };
  
  const toggleMenuExpand = (section: string) => {
    setMenuExpanded({
      ...menuExpanded,
      [section]: !menuExpanded[section],
    });
  };
  
  const hasMerchantAccess = userRoles.includes('merchant');
  const hasSupplierAccess = userRoles.includes('supplier');
  const hasSubcontractorAccess = userRoles.includes('subcontractor');
  const hasAdminAccess = userRoles.includes('admin');
  
  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: { sm: open ? `calc(100% - ${drawerWidth}px)` : '100%' },
          ml: { sm: open ? `${drawerWidth}px` : 0 },
          transition: (theme) => theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Plateforme Etika
          </Typography>
          <IconButton color="inherit" onClick={() => navigate('/notifications')}>
            <NotificationsIcon />
          </IconButton>
          <IconButton
            onClick={handleProfileMenuOpen}
            size="small"
            sx={{ ml: 2 }}
            aria-controls="profile-menu"
            aria-haspopup="true"
          >
            <Avatar alt={user?.name || 'User'} src={user?.avatar || ''} />
          </IconButton>
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/profile'); }}>
              Mon Profil
            </MenuItem>
            <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/organization'); }}>
              Paramètres Organisation
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>Se déconnecter</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            ...(open ? {} : {
              overflowX: 'hidden',
              width: theme => theme.spacing(7),
              [theme.breakpoints.up('sm')]: {
                width: theme => theme.spacing(9),
              },
            }),
          },
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            px: [1],
          }}
        >
          <IconButton onClick={handleDrawerToggle}>
            <ChevronLeftIcon />
          </IconButton>
        </Toolbar>
        <Divider />
        <List component="nav">
          {/* Dashboard principal */}
          <ListItem button onClick={() => navigateTo('/')}>
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Tableau de bord" />
          </ListItem>
          
          <Divider sx={{ my: 1 }} />
          
          {/* Menu Commerçant */}
          {hasMerchantAccess && (
            <>
              <ListItem button onClick={() => toggleMenuExpand('merchant')}>
                <ListItemIcon>
                  <BusinessIcon />
                </ListItemIcon>
                <ListItemText primary="Espace Commerçant" />
                {menuExpanded.merchant ? <ExpandLess /> : <ExpandMore />}
              </ListItem>
              <Collapse in={menuExpanded.merchant} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant')}>
                    <ListItemIcon>
                      <DashboardIcon />
                    </ListItemIcon>
                    <ListItemText primary="Dashboard" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant/tokens')}>
                    <ListItemIcon>
                      <LocalOfferIcon />
                    </ListItemIcon>
                    <ListItemText primary="Tokens" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant/transactions')}>
                    <ListItemIcon>
                      <ReceiptIcon />
                    </ListItemIcon>
                    <ListItemText primary="Transactions" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant/loyalty')}>
                    <ListItemIcon>
                      <LoyaltyIcon />
                    </ListItemIcon>
                    <ListItemText primary="Fidélité" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant/payments')}>
                    <ListItemIcon>
                      <PaymentIcon />
                    </ListItemIcon>
                    <ListItemText primary="Paiements" />
                  </ListItem>
                </List>
              </Collapse>
            </>
          )}
          
          {/* Menu Fournisseur */}
          {hasSupplierAccess && (
            <>
              <ListItem button onClick={() => toggleMenuExpand('supplier')}>
                <ListItemIcon>
                  <BusinessIcon />
                </ListItemIcon>
                <ListItemText primary="Espace Fournisseur" />
                {menuExpanded.supplier ? <ExpandLess /> : <ExpandMore />}
              </ListItem>
              <Collapse in={menuExpanded.supplier} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/supplier')}>
                    <ListItemIcon>
                      <DashboardIcon />
                    </ListItemIcon>
                    <ListItemText primary="Dashboard" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/supplier/tokens')}>
                    <ListItemIcon>
                      <LocalOfferIcon />
                    </ListItemIcon>
                    <ListItemText primary="Tokens" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/supplier/transactions')}>
                    <ListItemIcon>
                      <ReceiptIcon />
                    </ListItemIcon>
                    <ListItemText primary="Transactions" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/supplier/financials')}>
                    <ListItemIcon>
                      <PaymentIcon />
                    </ListItemIcon>
                    <ListItemText primary="Finances" />
                  </ListItem>
                </List>
              </Collapse>
            </>
          )}
          
          {/* Menu Sous-traitant */}
          {hasSubcontractorAccess && (
            <>
              <ListItem button onClick={() => toggleMenuExpand('subcontractor')}>
                <ListItemIcon>
                  <BusinessIcon />
                </ListItemIcon>
                <ListItemText primary="Espace Sous-traitant" />
                {menuExpanded.subcontractor ? <ExpandLess /> : <ExpandMore />}
              </ListItem>
              <Collapse in={menuExpanded.subcontractor} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/subcontractor')}>
                    <ListItemIcon>
                      <DashboardIcon />
                    </ListItemIcon>
                    <ListItemText primary="Dashboard" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/subcontractor/services')}>
                    <ListItemIcon>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="Services" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/subcontractor/tokens')}>
                    <ListItemIcon>
                      <LocalOfferIcon />
                    </ListItemIcon>
                    <ListItemText primary="Tokens" />
                  </ListItem>
                </List>
              </Collapse>
            </>
          )}
          
          <Divider sx={{ my: 1 }} />
          
          {/* Services partagés */}
          <ListItem button onClick={() => navigateTo('/tokens')}>
            <ListItemIcon>
              <LocalOfferIcon />
            </ListItemIcon>
            <ListItemText primary="Gestion des tokens" />
          </ListItem>
          
          {/* Menu Administration */}
          {hasAdminAccess && (
            <>
              <Divider sx={{ my: 1 }} />
              <ListItem button onClick={() => toggleMenuExpand('admin')}>
                <ListItemIcon>
                  <SupervisorAccountIcon />
                </ListItemIcon>
                <ListItemText primary="Administration" />
                {menuExpanded.admin ? <ExpandLess /> : <ExpandMore />}
              </ListItem>
              <Collapse in={menuExpanded.admin} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/admin')}>
                    <ListItemIcon>
                      <DashboardIcon />
                    </ListItemIcon>
                    <ListItemText primary="Dashboard Admin" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/admin/users')}>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText primary="Utilisateurs" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/admin/settings')}>
                    <ListItemIcon>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary="Paramètres système" />
                  </ListItem>
                </List>
              </Collapse>
            </>
          )}
        </List>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: ['48px', '64px'],
          minHeight: '100vh',
          backgroundColor: (theme) => theme.palette.grey[100],
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;

// src/components/auth/ProtectedRoute.tsx - Composant pour protéger les routes
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // Afficher un spinner ou une animation de chargement
    return <div>Chargement en cours...</div>;
  }

  if (!isAuthenticated) {
    // Rediriger vers la page de connexion en conservant l'URL ciblée
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// src/components/auth/RoleRoute.tsx - Composant pour limiter l'accès selon le rôle
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface RoleRouteProps {
  children: JSX.Element;
  requiredRole: string;
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, requiredRole }) => {
  const { userRoles, isLoading } = useAuth();

  if (isLoading) {
    return <div>Chargement en cours...</div>;
  }

  if (!userRoles.includes(requiredRole)) {
    // Rediriger vers le dashboard principal si l'utilisateur n'a pas le rôle requis
    return <Navigate to="/" replace />;
  }

  return children;
};

// src/components/dashboard/DashboardCard.tsx - Composant réutilisable pour les cartes du dashboard
import React from 'react';
import { Card, CardContent, CardHeader, Typography, Box, IconButton, Tooltip } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  value?: string | number;
  icon?: React.ReactNode;
  color?: string;
  tooltip?: string;
  children?: React.ReactNode;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  subtitle,
  value,
  icon,
  color = '#1976d2',
  tooltip,
  children,
}) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title={
          <Box display="flex" alignItems="center">
            <Typography variant="h6" component="div">
              {title}
            </Typography>
            {tooltip && (
              <Tooltip title={tooltip}>
                <IconButton size="small" sx={{ ml: 1 }}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        }
        subheader={subtitle}
        action={icon}
        sx={{
          '& .MuiCardHeader-action': {
            margin: 0,
            alignSelf: 'center',
          },
        }}
      />
      <CardContent>
        {value !== undefined && (
          <Typography variant="h4" component="div" sx={{ color }}>
            {value}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
};

export default DashboardCard;

// src/pages/Dashboard.tsx - Dashboard principal adaptif
import React, { useEffect, useState } from 'react';
import { Grid, Box, Typography, Tabs, Tab, CircularProgress } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import DashboardCard from '../components/dashboard/DashboardCard';
import { LocalOffer as TokenIcon, TrendingUp as TrendingIcon, Loyalty as LoyaltyIcon } from '@mui/icons-material';

const Dashboard: React.FC = () => {
  const { user, userRoles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    // Simuler le chargement des données du dashboard
    const fetchDashboardData = async () => {
      try {
        // Ici, vous feriez un appel API pour récupérer les données réelles
        // Pour l'exemple, on simule un délai et des données fictives
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setDashboardData({
          tokens: {
            balance: 8750,
            received: 2350,
            sent: 1200,
          },
          transactions: {
            today: 23,
            thisWeek: 142,
            thisMonth: 587,
            volume: 54230,
          },
          loyalty: {
            activePrograms: 3,
            participatingCustomers: 843,
            redemptionRate: 68,
          },
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
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

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          Bienvenue, {user?.name || 'utilisateur'}
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Voici un aperçu de votre activité sur la plateforme Etika
        </Typography>
      </Box>

      {/* Onglets pour différentes vues du dashboard */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="dashboard tabs">
          <Tab label="Vue générale" />
          {userRoles.includes('merchant') && <Tab label="Commerçant" />}
          {userRoles.includes('supplier') && <Tab label="Fournisseur" />}
          {userRoles.includes('subcontractor') && <Tab label="Sous-traitant" />}
        </Tabs>
      </Box>

      {/* Vue générale - visible pour tous */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <DashboardCard
              title="Solde de tokens"
              value={dashboardData.tokens.balance}
              icon={<TokenIcon color="primary" />}
              tooltip="Votre solde actuel de tokens Etika"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <DashboardCard
              title="Transactions du mois"
              value={dashboardData.transactions.thisMonth}
              icon={<TrendingIcon color="primary" />}
              tooltip="Nombre total de transactions ce mois-ci"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <DashboardCard
              title="Volume d'échanges"
              value={`${dashboardData.transactions.volume} €`}
              icon={<LoyaltyIcon color="primary" />}
              tooltip="Volume total des transactions en euros"
            />
          </Grid>
          {/* Autres widgets communs */}
        </Grid>
      )}

      {/* Vue spécifique au commerçant */}
      {activeTab === 1 && userRoles.includes('merchant') && (
        <Grid container spacing={3}>
          {/* Widgets spécifiques au commerçant */}
          <Grid item xs={12} md={4}>
            <DashboardCard
              title="Programmes de fidélité"
              value={dashboardData.loyalty.activePrograms}
              subtitle="Programmes actifs"
              icon={<LoyaltyIcon color="primary" />}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <DashboardCard
              title="Clients participants"
              value={dashboardData.loyalty.participatingCustomers}
              subtitle="Clients dans vos programmes"
              icon={<LoyaltyIcon color="primary" />}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <DashboardCard
              title="Taux de conversion"
              value={`${dashboardData.loyalty.redemptionRate}%`}
              subtitle="Utilisation des tokens"
              icon={<LoyaltyIcon color="primary" />}
            />
          </Grid>
        </Grid>
      )}

      {/* Vues pour les autres rôles (fournisseur, sous-traitant) */}
      {/* Similaires à la vue commerçant mais avec des widgets différents */}
    </Box>
  );
};

export default Dashboard;Transactions';
import SupplierFinancials from './pages/supplier/Financials';

import SubcontractorDashboard from './pages/subcontractor/Dashboard';
import SubcontractorServices from './pages/subcontractor/Services';
import SubcontractorTokens from './pages/subcontractor/Tokens';

// Services partagés
import TokenManagement from './pages/shared/TokenManagement';
import Notifications from './pages/shared/Notifications';
import Profile from './pages/shared/Profile';
import OrganizationSettings from './pages/shared/OrganizationSettings';

// Administration
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import SystemSettings from './pages/admin/SystemSettings';

// Utilitaires et hooks
import { checkAuth } from './store/slices/authSlice';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleRoute } from './components/auth/RoleRoute';
import { useAuth } from './hooks/useAuth';
import theme from './theme';

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, userRoles } = useAuth();
  
  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Routes publiques */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>
          
          {/* Routes protégées avec MainLayout */}
          <Route element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            {/* Dashboard principal (adaptif selon le rôle) */}
            <Route path="/" element={<Dashboard />} />
            
            {/* Espace Commerçant */}
            <Route path="/merchant" element={
              <RoleRoute requiredRole="merchant">
                <MerchantDashboard />
              </RoleRoute>
            } />
            <Route path="/merchant/tokens" element={
              <RoleRoute requiredRole="merchant">
                <MerchantTokens />
              </RoleRoute>
            } />
            <Route path="/merchant/transactions" element={
              <RoleRoute requiredRole="merchant">
                <MerchantTransactions />
              </RoleRoute>
            } />
            <Route path="/merchant/loyalty" element={
              <RoleRoute requiredRole="merchant">
                <MerchantLoyalty />
              </RoleRoute>
            } />
            <Route path="/merchant/payments" element={
              <RoleRoute requiredRole="merchant">
                <MerchantPayments />
              </RoleRoute>
            } />
            
            {/* Espace Fournisseur */}
            <Route path="/supplier" element={
              <RoleRoute requiredRole="supplier">
                <SupplierDashboard />
              </RoleRoute>
            } />
            <Route path="/supplier/tokens" element={
              <RoleRoute requiredRole="supplier">
                <SupplierTokens />
              </RoleRoute>
            } />
            <Route path="/supplier/transactions" element={
              <RoleRoute requiredRole="supplier">
                <SupplierTransactions />
              </RoleRoute>
            } />
            <Route path="/supplier/financials" element={
              <RoleRoute requiredRole="supplier">
                <SupplierFinancials />
              </RoleRoute>
            } />
            
            {/* Espace Sous-traitant */}
            <Route path="/subcontractor" element={
              <RoleRoute requiredRole="subcontractor">
                <SubcontractorDashboard />
              </RoleRoute>
            } />
            <Route path="/subcontractor/services" element={
              <RoleRoute requiredRole="subcontractor">
                <SubcontractorServices />
              </RoleRoute>
            } />
            <Route path="/subcontractor/tokens" element={
              <RoleRoute requiredRole="subcontractor">
                <SubcontractorTokens />
              </RoleRoute>
            } />
            
            {/* Services partagés */}
            <Route path="/tokens" element={<TokenManagement />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/organization" element={<OrganizationSettings />} />
            
            {/* Administration */}
            <Route path="/admin" element={
              <RoleRoute requiredRole="admin">
                <AdminDashboard />
              </RoleRoute>
            } />
            <Route path="/admin/users" element={
              <RoleRoute requiredRole="admin">
                <UserManagement />
              </RoleRoute>
            } />
            <Route path="/admin/settings" element={
              <RoleRoute requiredRole="admin">
                <SystemSettings />
              </RoleRoute>
            } />
            
            {/* Route 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;

// src/layouts/MainLayout.tsx - Layout principal avec navigation adaptative
import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Collapse,
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Payment as PaymentIcon,
  Loyalty as LoyaltyIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
  ExpandLess,
  ExpandMore,
  LocalOffer as LocalOfferIcon,
  SupervisorAccount as SupervisorAccountIcon,
} from '@mui/icons-material';

import { useAuth } from '../hooks/useAuth';

const drawerWidth = 260;

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, userRoles, logout } = useAuth();
  
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuExpanded, setMenuExpanded] = useState<Record<string, boolean>>({
    merchant: false,
    supplier: false,
    subcontractor: false,
    admin: false,
  });
  
  const handleDrawerToggle = () => {
    setOpen(!open);
  };
  
  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
    navigate('/login');
  };
  
  const navigateTo = (path: string) => {
    navigate(path);
  };
  
  const toggleMenuExpand = (section: string) => {
    setMenuExpanded({
      ...menuExpanded,
      [section]: !menuExpanded[section],
    });
  };
  
  const hasMerchantAccess = userRoles.includes('merchant');
  const hasSupplierAccess = userRoles.includes('supplier');
  const hasSubcontractorAccess = userRoles.includes('subcontractor');
  const hasAdminAccess = userRoles.includes('admin');
  
  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: { sm: open ? `calc(100% - ${drawerWidth}px)` : '100%' },
          ml: { sm: open ? `${drawerWidth}px` : 0 },
          transition: (theme) => theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Plateforme Etika
          </Typography>
          <IconButton color="inherit" onClick={() => navigate('/notifications')}>
            <NotificationsIcon />
          </IconButton>
          <IconButton
            onClick={handleProfileMenuOpen}
            size="small"
            sx={{ ml: 2 }}
            aria-controls="profile-menu"
            aria-haspopup="true"
          >
            <Avatar alt={user?.name || 'User'} src={user?.avatar || ''} />
          </IconButton>
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/profile'); }}>
              Mon Profil
            </MenuItem>
            <MenuItem onClick={() => { handleProfileMenuClose(); navigate('/organization'); }}>
              Paramètres Organisation
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>Se déconnecter</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: 'border-box',
            ...(open ? {} : {
              overflowX: 'hidden',
              width: theme => theme.spacing(7),
              [theme.breakpoints.up('sm')]: {
                width: theme => theme.spacing(9),
              },
            }),
          },
        }}
      >
        <Toolbar
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            px: [1],
          }}
        >
          <IconButton onClick={handleDrawerToggle}>
            <ChevronLeftIcon />
          </IconButton>
        </Toolbar>
        <Divider />
        <List component="nav">
          {/* Dashboard principal */}
          <ListItem button onClick={() => navigateTo('/')}>
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Tableau de bord" />
          </ListItem>
          
          <Divider sx={{ my: 1 }} />
          
          {/* Menu Commerçant */}
          {hasMerchantAccess && (
            <>
              <ListItem button onClick={() => toggleMenuExpand('merchant')}>
                <ListItemIcon>
                  <BusinessIcon />
                </ListItemIcon>
                <ListItemText primary="Espace Commerçant" />
                {menuExpanded.merchant ? <ExpandLess /> : <ExpandMore />}
              </ListItem>
              <Collapse in={menuExpanded.merchant} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant')}>
                    <ListItemIcon>
                      <DashboardIcon />
                    </ListItemIcon>
                    <ListItemText primary="Dashboard" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant/tokens')}>
                    <ListItemIcon>
                      <LocalOfferIcon />
                    </ListItemIcon>
                    <ListItemText primary="Tokens" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant/transactions')}>
                    <ListItemIcon>
                      <ReceiptIcon />
                    </ListItemIcon>
                    <ListItemText primary="Transactions" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant/loyalty')}>
                    <ListItemIcon>
                      <LoyaltyIcon />
                    </ListItemIcon>
                    <ListItemText primary="Fidélité" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/merchant/payments')}>
                    <ListItemIcon>
                      <PaymentIcon />
                    </ListItemIcon>
                    <ListItemText primary="Paiements" />
                  </ListItem>
                </List>
              </Collapse>
            </>
          )}
          
          {/* Menu Fournisseur */}
          {hasSupplierAccess && (
            <>
              <ListItem button onClick={() => toggleMenuExpand('supplier')}>
                <ListItemIcon>
                  <BusinessIcon />
                </ListItemIcon>
                <ListItemText primary="Espace Fournisseur" />
                {menuExpanded.supplier ? <ExpandLess /> : <ExpandMore />}
              </ListItem>
              <Collapse in={menuExpanded.supplier} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/supplier')}>
                    <ListItemIcon>
                      <DashboardIcon />
                    </ListItemIcon>
                    <ListItemText primary="Dashboard" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/supplier/tokens')}>
                    <ListItemIcon>
                      <LocalOfferIcon />
                    </ListItemIcon>
                    <ListItemText primary="Tokens" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/supplier/transactions')}>
                    <ListItemIcon>
                      <ReceiptIcon />
                    </ListItemIcon>
                    <ListItemText primary="Transactions" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/supplier/financials')}>
                    <ListItemIcon>
                      <PaymentIcon />
                    </ListItemIcon>
                    <ListItemText primary="Finances" />
                  </ListItem>
                </List>
              </Collapse>
            </>
          )}
          
          {/* Autres menus similaires pour sous-traitants et administrateurs */}
          
          <Divider sx={{ my: 1 }} />
          
          {/* Services partagés */}
          <ListItem button onClick={() => navigateTo('/tokens')}>
            <ListItemIcon>
              <LocalOfferIcon />
            </ListItemIcon>
            <ListItemText primary="Gestion des tokens" />
          </ListItem>
          
          {/* Menu Administration */}
          {hasAdminAccess && (
            <>
              <Divider sx={{ my: 1 }} />
              <ListItem button onClick={() => toggleMenuExpand('admin')}>
                <ListItemIcon>
                  <SupervisorAccountIcon />
                </ListItemIcon>
                <ListItemText primary="Administration" />
                {menuExpanded.admin ? <ExpandLess /> : <ExpandMore />}
              </ListItem>
              <Collapse in={menuExpanded.admin} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/admin')}>
                    <ListItemIcon>
                      <DashboardIcon />
                    </ListItemIcon>
                    <ListItemText primary="Dashboard Admin" />
                  </ListItem>
                  <ListItem button sx={{ pl: 4 }} onClick={() => navigateTo('/admin/users')}>
                    <ListItemIcon>
                      <PersonIcon />
                    </ListItemIcon>
                    <ListItemText primary="Utilis
// Continuation de la page d'accueil MerchantPortalLanding.tsx
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center" mb={1}>
              <CalendarIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1" fontWeight="bold">
                28 janvier 2025
              </Typography>
            </Box>
            <Typography variant="subtitle1" gutterBottom>
              Mise à jour du système de tokens
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Notre blockchain a été optimisée pour garantir des transactions encore plus rapides.
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center" mb={1}>
              <CalendarIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1" fontWeight="bold">
                15 janvier 2025
              </Typography>
            </Box>
            <Typography variant="subtitle1" gutterBottom>
              Nouveau partenariat Etika avec Banque Centrale
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ce partenariat facilitera la conversion des tokens en monnaie traditionnelle.
            </Typography>
          </Grid>
        </Grid>
        
        <Box display="flex" justifyContent="center" mt={3}>
          <Button variant="outlined">
            Voir toutes les actualités
          </Button>
        </Box>
      </Paper>
      
      {/* Section d'aide et support */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom>
              Centre d'aide
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1" paragraph>
              Des questions sur l'utilisation de votre espace ou sur l'écosystème Etika ?
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Button variant="outlined" fullWidth>
                  FAQ
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button variant="outlined" fullWidth>
                  Tutoriels vidéo
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" color="primary" fullWidth>
                  Contacter le support
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom>
              Etika & Vous
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1" paragraph>
              Faites partie de la communauté Etika et découvrez comment maximiser votre impact.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Button variant="outlined" fullWidth>
                  Forum communautaire
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button variant="outlined" fullWidth>
                  Événements
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" color="secondary" fullWidth>
                  Programme de parrainage
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default MerchantPortalLanding;

// src/components/integration/BlockchainStatus.tsx - Composant pour afficher le statut de la blockchain
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  LinearProgress,
  Chip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Sync as SyncIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';

interface BlockchainStatusProps {
  showDetails?: boolean;
}

const BlockchainStatus: React.FC<BlockchainStatusProps> = ({ showDetails = false }) => {
  const [status, setStatus] = useState<'online' | 'syncing' | 'degraded' | 'offline'>('syncing');
  const [stats, setStats] = useState({
    blocks: 12456789,
    transactions: 89754623,
    nodes: 78,
    avgBlockTime: 3.2,
    syncProgress: 94,
    lastBlockTime: new Date().toISOString()
  });
  
  useEffect(() => {
    // Simuler un chargement et une mise à jour du statut
    const timer = setTimeout(() => {
      setStatus('online');
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const getStatusIcon = () => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon color="success" />;
      case 'syncing':
        return <SyncIcon color="warning" />;
      case 'degraded':
        return <WarningIcon color="warning" />;
      case 'offline':
        return <ErrorIcon color="error" />;
      default:
        return <SyncIcon color="default" />;
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case 'online':
        return 'En ligne - Fonctionnement optimal';
      case 'syncing':
        return 'Synchronisation en cours';
      case 'degraded':
        return 'Performances dégradées';
      case 'offline':
        return 'Hors ligne - Maintenance en cours';
      default:
        return 'Vérification du statut...';
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Statut blockchain Etika</Typography>
          <Chip
            icon={getStatusIcon()}
            label={getStatusText()}
            color={status === 'online' ? 'success' : status === 'offline' ? 'error' : 'warning'}
            variant="outlined"
          />
        </Box>
        
        {status === 'syncing' && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2">Synchronisation...</Typography>
              <Typography variant="body2">{stats.syncProgress}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={stats.syncProgress} sx={{ mt: 1 }} />
          </Box>
        )}
        
        {showDetails && (
          <Box mt={3}>
            <Typography variant="subtitle2" gutterBottom>
              Statistiques de la blockchain
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="caption" color="textSecondary">
                    Blocs
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {stats.blocks.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="caption" color="textSecondary">
                    Transactions
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {stats.transactions.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="caption" color="textSecondary">
                    Nœuds actifs
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {stats.nodes}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="caption" color="textSecondary">
                    Temps moyen de bloc
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {stats.avgBlockTime}s
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            <Box mt={2}>
              <Typography variant="body2" color="textSecondary">
                Dernier bloc: {formatDate(stats.lastBlockTime)}
              </Typography>
            </Box>
            
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <StorageIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Stockage blockchain" 
                  secondary="Capacité: 78%, Santé: Optimale" 
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <NetworkIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Réseau" 
                  secondary="Latence: 120ms, Connectivité: 100%" 
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <SpeedIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary="Performance" 
                  secondary="TPS: 1000+, Utilisation CPU: 45%" 
                />
              </ListItem>
            </List>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default BlockchainStatus;

// src/components/shared/MaintenanceWindow.tsx - Composant pour afficher des notifications de maintenance
import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Typography,
  Collapse,
  IconButton,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';

interface MaintenanceWindowProps {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  impact: 'none' | 'low' | 'medium' | 'high';
  onClose?: () => void;
}

const MaintenanceWindow: React.FC<MaintenanceWindowProps> = ({
  title,
  startDate,
  endDate,
  description,
  impact,
  onClose
}) => {
  // Sévérité de l'alerte selon l'impact
  const getSeverity = () => {
    switch (impact) {
      case 'none':
        return 'info';
      case 'low':
        return 'info';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      default:
        return 'info';
    }
  };
  
  // Formater les dates
  const formatDate = (date: Date) => {
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <Collapse in={true}>
      <Alert 
        severity={getSeverity()}
        action={
          onClose && (
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={onClose}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          )
        }
        sx={{ mb: 2 }}
      >
        <AlertTitle>{title}</AlertTitle>
        <Box display="flex" alignItems="center" mb={1}>
          <DateRangeIcon fontSize="small" sx={{ mr: 1 }} />
          <Typography variant="body2">
            {formatDate(startDate)} - {formatDate(endDate)}
          </Typography>
        </Box>
        <Typography variant="body2" paragraph>
          {description}
        </Typography>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Chip 
            label={`Impact: ${impact.charAt(0).toUpperCase() + impact.slice(1)}`} 
            size="small" 
            color={getSeverity() as any}
          />
          <Typography variant="caption" color="textSecondary">
            ID: MAINT-{Math.floor(Math.random() * 10000)}
          </Typography>
        </Box>
      </Alert>
    </Collapse>
  );
};

export default MaintenanceWindow;

// src/pages/shared/TokenManagement.tsx - Page complète de gestion des tokens partagée entre tous les types d'utilisateurs
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  TextField,
  Divider,
  Tabs,
  Tab,
  Card,
  CardContent,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  LocalOffer as TokenIcon,
  Send as SendIcon,
  Cached as ConvertIcon,
  Explore as ExploreIcon,
  AddCircle as AddIcon,
  History as HistoryIcon,
  Assessment as AssessmentIcon,
  CurrencyExchange as ExchangeIcon
} from '@mui/icons-material';
import BlockchainStatus from '../../components/integration/BlockchainStatus';
import MaintenanceWindow from '../../components/shared/MaintenanceWindow';

const TokenManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<any>(null);
  const [tokenHistory, setTokenHistory] = useState<any[]>([]);
  const [openSendDialog, setOpenSendDialog] = useState(false);
  const [openConvertDialog, setOpenConvertDialog] = useState(false);
  const [maintenanceVisible, setMaintenanceVisible] = useState(true);
  
  // Formulaires
  const [sendForm, setSendForm] = useState({
    recipient: '',
    amount: '',
    message: ''
  });
  
  const [convertForm, setConvertForm] = useState({
    amount: '',
    type: 'fiat'
  });
  
  useEffect(() => {
    // Simuler le chargement des données
    const timer = setTimeout(() => {
      setTokenData({
        balance: 8750,
        value: 8312.5, // Valeur en euros (conversion)
        received: {
          day: 150,
          week: 780,
          month: 2850
        },
        sent: {
          day: 75,
          week: 320,
          month: 1230
        },
        converted: {
          day: 0,
          week: 500,
          month: 1520
        },
        conversionRate: 0.95,
        tokenLimits: {
          daily: {
            limit: 1000,
            used: 75
          },
          monthly: {
            limit: 10000,
            used: 1230
          }
        }
      });
      
      // Simuler l'historique des transactions
      setTokenHistory([
        {
          id: 'TX7834562',
          timestamp: '2025-02-07T14:32:21',
          type: 'received',
          amount: 150,
          from: 'Marketplace Etika',
          to: 'Votre compte',
          status: 'completed',
          details: 'Vente de produits'
        },
        {
          id: 'TX7834561',
          timestamp: '2025-02-06T11:15:42',
          type: 'sent',
          amount: 75,
          from: 'Votre compte',
          to: 'Fournisseur ABC',
          status: 'completed',
          details: 'Paiement fournisseur'
        },
        {
          id: 'TX7834560',
          timestamp: '2025-02-05T16:48:33',
          type: 'converted',
          amount: 500,
          from: 'Votre compte',
          to: 'Compte bancaire',
          status: 'completed',
          details: 'Conversion en EUR'
        },
        {
          id: 'TX7834559',
          timestamp: '2025-02-03T09:22:15',
          type: 'received',
          amount: 300,
          from: 'Programme fidélité',
          to: 'Votre compte',
          status: 'completed',
          details: 'Bonus mensuel'
        },
        {
          id: 'TX7834558',
          timestamp: '2025-02-01T18:05:37',
          type: 'sent',
          amount: 120,
          from: 'Votre compte',
          to: 'Partenaire XYZ',
          status: 'completed',
          details: 'Paiement services'
        }
      ]);
      
      setLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  const handleOpenSendDialog = () => {
    setOpenSendDialog(true);
  };
  
  const handleCloseSendDialog = () => {
    setOpenSendDialog(false);
  };
  
  const handleOpenConvertDialog = () => {
    setOpenConvertDialog(true);
  };
  
  const handleCloseConvertDialog = () => {
    setOpenConvertDialog(false);
  };
  
  const handleSendFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSendForm({
      ...sendForm,
      [event.target.name]: event.target.value
    });
  };
  
  const handleConvertFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConvertForm({
      ...convertForm,
      [event.target.name]: event.target.value
    });
  };
  
  const handleConvertTypeChange = (event: any) => {
    setConvertForm({
      ...convertForm,
      type: event.target.value
    });
  };
  
  const handleSendTokens = () => {
    // Implémentation de l'envoi de tokens
    console.log('Sending tokens:', sendForm);
    handleCloseSendDialog();
  };
  
  const handleConvertTokens = () => {
    // Implémentation de la conversion de tokens
    console.log('Converting tokens:', convertForm);
    handleCloseConvertDialog();
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'received':
        return <AddIcon fontSize="small" color="success" />;
      case 'sent':
        return <SendIcon fontSize="small" color="primary" />;
      case 'converted':
        return <ConvertIcon fontSize="small" color="warning" />;
      default:
        return <HistoryIcon fontSize="small" />;
    }
  };
  
  const getTypeText = (type: string) => {
    switch (type) {
      case 'received':
        return 'Reçu';
      case 'sent':
        return 'Envoyé';
      case 'converted':
        return 'Converti';
      default:
        return type;
    }
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
      {maintenanceVisible && (
        <MaintenanceWindow
          title="Maintenance planifiée du système de tokens"
          startDate={new Date('2025-02-15T22:00:00')}
          endDate={new Date('2025-02-16T06:00:00')}
          description="Une maintenance planifiée aura lieu pour optimiser les performances de notre blockchain. Le service de tokens sera indisponible pendant cette période."
          impact="medium"
          onClose={() => setMaintenanceVisible(false)}
        />
      )}
      
      <Typography variant="h4" gutterBottom>
        Gestion des tokens
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {/* Cartes principales */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" flexDirection="column">
                    <Typography variant="h6" gutterBottom>
                      Solde actuel
                    </Typography>
                    <Box display="flex" alignItems="baseline">
                      <Typography variant="h3" color="primary" sx={{ mr: 1 }}>
                        {tokenData.balance.toLocaleString()}
                      </Typography>
                      <TokenIcon color="primary" />
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      Valeur estimée: {tokenData.value.toLocaleString()} €
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box display="flex" justifyContent="flex-end">
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<SendIcon />}
                      onClick={handleOpenSendDialog}
                      sx={{ mr: 1 }}
                    >
                      Envoyer
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ConvertIcon />}
                      onClick={handleOpenConvertDialog}
                    >
                      Convertir
                    </Button>
                  </Box>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom>
                Limites de transactions
              </Typography>
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Limite quotidienne</Typography>
                  <Typography variant="body2">
                    {tokenData.tokenLimits.daily.used}/{tokenData.tokenLimits.daily.limit}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={(tokenData.tokenLimits.daily.used / tokenData.tokenLimits.daily.limit) * 100} 
                />
              </Box>
              <Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Limite mensuelle</Typography>
                  <Typography variant="body2">
                    {tokenData.tokenLimits.monthly.used}/{tokenData.tokenLimits.monthly.limit}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={(tokenData.tokenLimits.monthly.used / tokenData.tokenLimits.monthly.limit) * 100} 
                />
              </Box>
            </CardContent>
          </Card>
          
          {/* Onglets et contenu */}
          <Paper sx={{ mb: 3 }}>
            <Tabs 
              value={activeTab} 
              onChange={handleTabChange}
              variant="fullWidth"
            >
              <Tab icon={<HistoryIcon />} label="Historique" />
              <Tab icon={<AssessmentIcon />} label="Statistiques" />
              <Tab icon={<ExploreIcon />} label="Explorer" />
            </Tabs>
            
            <Box p={3}>
              {activeTab === 0 && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Historique des transactions
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Montant</TableCell>
                          <TableCell>De</TableCell>
                          <TableCell>À</TableCell>
                          <TableCell>Statut</TableCell>
                          <TableCell>Détails</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tokenHistory.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                {getTypeIcon(transaction.type)}
                                <Typography variant="body2" sx={{ ml: 1 }}>
                                  {getTypeText(transaction.type)}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>{formatDate(transaction.timestamp)}</TableCell>
                            <TableCell>{transaction.amount}</TableCell>
                            <TableCell>{transaction.from}</TableCell>
                            <TableCell>{transaction.to}</TableCell>
                            <TableCell>
                              <Chip 
                                label={transaction.status} 
                                color={getStatusColor(transaction.status) as any}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{transaction.details}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
              
              {activeTab === 1 && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Statistiques des tokens
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Tokens reçus
                          </Typography>
                          <Box display="flex" justifyContent="space-between">
                            <Box>
                              <Typography variant="body2">Aujourd'hui</Typography>
                              <Typography variant="h6">{tokenData.received.day}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2">Cette semaine</Typography>
                              <Typography variant="h6">{tokenData.received.week}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2">Ce mois</Typography>
                              <Typography variant="h6">{tokenData.received.month}</Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Tokens envoyés
                          </Typography>
                          <Box display="flex" justifyContent="space-between">
                            <Box>
                              <Typography variant="body2">Aujourd'hui</Typography>
                              <Typography variant="h6">{tokenData.sent.day}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2">Cette semaine</Typography>
                              <Typography variant="h6">{tokenData.sent.week}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2">Ce mois</Typography>
                              <Typography variant="h6">{tokenData.sent.month}</Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                            Tokens convertis
                          </Typography>
                          <Box display="flex" justifyContent="space-between">
                            <Box>
                              <Typography variant="body2">Aujourd'hui</Typography>
                              <Typography variant="h6">{tokenData.converted.day}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2">Cette semaine</Typography>
                              <Typography variant="h6">{tokenData.converted.week}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2">Ce mois</Typography>
                              <Typography variant="h6">{tokenData.converted.month}</Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </>
              )}
              
              {activeTab === 2 && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Explorateur blockchain
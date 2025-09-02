// src/components/charts/SimplePieChart.tsx
import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface SimplePieChartProps {
  data: any[];
  dataKey: string;
  nameKey: string;
  colors: string[];
}

const SimplePieChart: React.FC<SimplePieChartProps> = ({ data, dataKey, nameKey, colors }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey={dataKey}
          nameKey={nameKey}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => value.toLocaleString('fr-FR')} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default SimplePieChart;

// src/components/charts/SimpleFunnelChart.tsx
import React from 'react';
import { 
  ResponsiveContainer, 
  FunnelChart, 
  Funnel, 
  LabelList, 
  Tooltip 
} from 'recharts';

interface SimpleFunnelChartProps {
  data: any[];
}

const SimpleFunnelChart: React.FC<SimpleFunnelChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <FunnelChart>
        <Tooltip formatter={(value) => value.toLocaleString('fr-FR')} />
        <Funnel
          dataKey="value"
          data={data}
          isAnimationActive
          labelLine
        >
          <LabelList 
            position="right" 
            fill="#000" 
            stroke="none" 
            dataKey="name" 
            formatter={(name: string) => name}
          />
          <LabelList 
            position="right" 
            fill="#666" 
            stroke="none" 
            dataKey="value" 
            formatter={(value: number) => value.toLocaleString('fr-FR')}
            offset={30}
          />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
};

export default SimpleFunnelChart;

// src/components/tables/RecentTransactionsTable.tsx
import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Transaction {
  id: string;
  date: string;
  customer: string;
  amount: number;
  tokens: number;
  status: string;
}

interface RecentTransactionsTableProps {
  transactions: Transaction[];
}

const RecentTransactionsTable: React.FC<RecentTransactionsTableProps> = ({ transactions }) => {
  // Fonction pour formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'dd MMM yyyy HH:mm', { locale: fr });
  };
  
  // Fonction pour obtenir la couleur du statut
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
  
  // Fonction pour traduire le statut
  const translateStatus = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Complétée';
      case 'pending':
        return 'En attente';
      case 'failed':
        return 'Échouée';
      default:
        return status;
    }
  };
  
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Client</TableCell>
            <TableCell align="right">Montant</TableCell>
            <TableCell align="right">Tokens</TableCell>
            <TableCell>Statut</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{transaction.id}</TableCell>
              <TableCell>{formatDate(transaction.date)}</TableCell>
              <TableCell>{transaction.customer}</TableCell>
              <TableCell align="right">{transaction.amount.toFixed(2)} €</TableCell>
              <TableCell align="right">{transaction.tokens}</TableCell>
              <TableCell>
                <Chip 
                  label={translateStatus(transaction.status)} 
                  color={getStatusColor(transaction.status) as any}
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default RecentTransactionsTable;

// src/components/merchant/dashboards/OmnichannelDashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box,
  Button, 
  Divider,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip
} from '@mui/material';
import DashboardCard from '../../dashboard/DashboardCard';
import {
  LocalOffer as TokenIcon,
  ShoppingCart as CartIcon,
  People as CustomerIcon,
  TrendingUp as RevenueIcon,
  DevicesOther as OmniChannelIcon,
  Store as StoreIcon,
  Computer as WebIcon
} from '@mui/icons-material';
import SimpleLineChart from '../../charts/SimpleLineChart';
import SimpleBarChart from '../../charts/SimpleBarChart';

// Dashboard pour les commerçants omnicanaux
const OmnichannelDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [channelData, setChannelData] = useState<any[]>([]);
  const [customerJourneys, setCustomerJourneys] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<string>('month');
  const [activeTab, setActiveTab] = useState(0);
  
  useEffect(() => {
    // Simulation de données pour le dashboard
    setStats({
      tokensIssued: 8420,
      customerCount: 1285,
      physicalRevenue: 143750,
      onlineRevenue: 78430,
      totalRevenue: 222180,
      transactionCount: 3875,
      crossChannelCustomers: 485
    });
    
    setChannelData([
      { month: 'Sep', physical: 118500, online: 62000, total: 180500 },
      { month: 'Oct', physical: 124800, online: 65300, total: 190100 },
      { month: 'Nov', physical: 132100, online: 69800, total: 201900 },
      { month: 'Dec', physical: 138300, online: 72400, total: 210700 },
      { month: 'Jan', physical: 140700, online: 74800, total: 215500 },
      { month: 'Feb', physical: 143750, online: 78430, total: 222180 }
    ]);
    
    setCustomerJourneys([
      { type: "Web → Magasin", count: 245, value: 35600 },
      { type: "Magasin → Web", count: 182, value: 26300 },
      { type: "Mobile → Magasin", count: 164, value: 21800 },
      { type: "Magasin → Mobile", count: 128, value: 18400 },
      { type: "Mobile → Web", count: 87, value: 12600 },
      { type: "Web → Mobile", count: 73, value: 10250 }
    ]);
  }, [timeRange]);
  
  const handleTimeRangeChange = (event: React.SyntheticEvent, newValue: string) => {
    setTimeRange(newValue);
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  return (
    <Box>
      {/* Filtres et onglets */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Vue globale" />
          <Tab label="Magasins physiques" />
          <Tab label="E-commerce" />
          <Tab label="Parcours omnicanal" />
        </Tabs>
        
        <Tabs value={timeRange} onChange={handleTimeRangeChange}>
          <Tab label="7 jours" value="week" />
          <Tab label="30 jours" value="month" />
          <Tab label="90 jours" value="quarter" />
          <Tab label="1 an" value="year" />
        </Tabs>
      </Box>
      
      {/* KPIs omnicanal */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <DashboardCard
            title="Chiffre d'affaires total"
            value={`${stats?.totalRevenue.toLocaleString('fr-FR')} €`}
            icon={<RevenueIcon color="primary" fontSize="large" />}
            color="#1976d2"
          >
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Chip 
                label={`Physique: ${stats?.physicalRevenue.toLocaleString('fr-FR')} €`} 
                size="small" 
                variant="outlined"
                icon={<StoreIcon fontSize="small" />}
              />
              <Chip 
                label={`En ligne: ${stats?.onlineRevenue.toLocaleString('fr-FR')} €`} 
                size="small" 
                variant="outlined"
                icon={<WebIcon fontSize="small" />}
              />
            </Box>
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={3}>
          <DashboardCard
            title="Clients omnicanal"
            value={stats?.crossChannelCustomers}
            icon={<OmniChannelIcon color="primary" fontSize="large" />}
            color="#388e3c"
          >
            <Typography variant="body2" sx={{ mt: 1 }}>
              {((stats?.crossChannelCustomers / stats?.customerCount) * 100).toFixed(1)}% de clients cross-canal
            </Typography>
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={3}>
          <DashboardCard
            title="Tokens émis"
            value={stats?.tokensIssued}
            icon={<TokenIcon color="primary" fontSize="large" />}
            color="#f57c00"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <DashboardCard
            title="Transactions"
            value={stats?.transactionCount}
            icon={<CartIcon color="primary" fontSize="large" />}
            color="#7b1fa2"
          />
        </Grid>
      </Grid>
      
      {/* Graphiques omnicanal selon l'onglet */}
      {activeTab === 0 && (
        <>
          {/* Vue globale */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Évolution du chiffre d'affaires par canal
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box height={300}>
              <SimpleLineChart 
                data={channelData}
                xAxisDataKey="month"
                series={[
                  { dataKey: "physical", name: "Magasins physiques (€)", color: "#1976d2" },
                  { dataKey: "online", name: "E-commerce (€)", color: "#f57c00" },
                  { dataKey: "total", name: "Total (€)", color: "#7b1fa2" }
                ]}
              />
            </Box>
          </Paper>
          
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Parcours clients cross-canal
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box height={300}>
              <SimpleBarChart 
                data={customerJourneys}
                xAxisDataKey="type"
                series={[
                  { dataKey: "count", name: "Nombre de clients", color: "#1976d2" }
                ]}
              />
            </Box>
          </Paper>
        </>
      )}
      
      {/* Onglets supplémentaires pour les canaux spécifiques */}
    </Box>
  );
};

export default OmnichannelDashboard;

// src/components/merchant/AdaptiveSettings.tsx - Paramètres adaptatifs selon le type de commerçant
import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Tabs, 
  Tab, 
  Grid, 
  Divider, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Switch, 
  FormControlLabel,
  Button,
  Alert
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { useMerchant } from './MerchantContext';
import { MerchantType } from '../../models/merchant';
import AccessRestrictedNotice from './AccessRestrictedNotice';

interface AdaptiveSettingsProps {
  activeTab: number;
  handleTabChange: (event: React.SyntheticEvent, newValue: number) => void;
}

const AdaptiveSettings: React.FC<AdaptiveSettingsProps> = ({ activeTab, handleTabChange }) => {
  const merchant = useMerchant();
  
  // Rendu des onglets de paramètres selon le type de commerçant
  const renderSettingsTabs = () => {
    const tabs = [
      <Tab label="Général" key="general" />,
      <Tab label="Programme de fidélité" key="loyalty" disabled={merchant.hasCentralizedProgram && !merchant.isHeadOffice} />,
      <Tab label="Tokens" key="tokens" />,
      <Tab label="Intégration" key="integration" />,
      <Tab label="Notifications" key="notifications" />
    ];
    
    // Ajout d'onglets spécifiques selon le type de commerçant
    if (merchant.hasEcommerceCapabilities) {
      tabs.push(<Tab label="E-commerce" key="ecommerce" />);
    }
    
    if (merchant.features.locationManagement) {
      tabs.push(<Tab label="Points de vente" key="locations" />);
    }
    
    if (merchant.features.hierarchyManagement) {
      tabs.push(<Tab label="Structure réseau" key="network" />);
    }
    
    if (merchant.features.whiteLabeling) {
      tabs.push(<Tab label="Personnalisation marque" key="branding" />);
    }
    
    if (merchant.features.apiAccess) {
      tabs.push(<Tab label="API & Développeurs" key="api" />);
    }
    
    return tabs;
  };
  
  // Rendu du contenu des paramètres selon l'onglet actif
  const renderSettingsContent = () => {
    switch (activeTab) {
      case 0:
        return renderGeneralSettings();
      case 1:
        return merchant.hasCentralizedProgram && !merchant.isHeadOffice
          ? renderRestrictedLoyaltySettings()
          : renderLoyaltySettings();
      case 2:
        return renderTokenSettings();
      case 3:
        return renderIntegrationSettings();
      // Ajoutez d'autres cas pour les onglets supplémentaires
      default:
        return <Typography>Configuration en cours de développement</Typography>;
    }
  };
  
  // Paramètres généraux
  const renderGeneralSettings = () => {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Nom de l'entreprise"
            variant="outlined"
            defaultValue="Ma Société"
            margin="normal"
          />
          <TextField
            fullWidth
            label="Adresse email"
            variant="outlined"
            type="email"
            defaultValue="contact@masociete.com"
            margin="normal"
          />
          <TextField
            fullWidth
            label="Téléphone"
            variant="outlined"
            defaultValue="+33 1 23 45 67 89"
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Adresse"
            variant="outlined"
            defaultValue="123 Rue du Commerce"
            margin="normal"
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Code postal"
                variant="outlined"
                defaultValue="75001"
                margin="normal"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Ville"
                variant="outlined"
                defaultValue="Paris"
                margin="normal"
              />
            </Grid>
          </Grid>
          <FormControl fullWidth margin="normal">
            <InputLabel>Pays</InputLabel>
            <Select
              label="Pays"
              defaultValue="FR"
            >
              <MenuItem value="FR">France</MenuItem>
              <MenuItem value="BE">Belgique</MenuItem>
              <MenuItem value="CH">Suisse</MenuItem>
              <MenuItem value="LU">Luxembourg</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>Préférences</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Langue</InputLabel>
                <Select
                  label="Langue"
                  defaultValue="fr"
                >
                  <MenuItem value="fr">Français</MenuItem>
                  <MenuItem value="en">Anglais</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Devise</InputLabel>
                <Select
                  label="Devise"
                  defaultValue="EUR"
                >
                  <MenuItem value="EUR">Euro (€)</MenuItem>
                  <MenuItem value="USD">Dollar ($)</MenuItem>
                  <MenuItem value="CHF">Franc suisse (CHF)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box mt={2}>
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Recevoir les notifications par email"
            />
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Recevoir le rapport hebdomadaire"
            />
          </Box>
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />}
            >
              Enregistrer les modifications
            </Button>
          </Box>
        </Grid>
      </Grid>
    );
  };
  
  // Paramètres du programme de fidélité restreints
  const renderRestrictedLoyaltySettings = () => {
    return (
      <AccessRestrictedNotice
        feature="Programme de fidélité"
        description="Les paramètres du programme de fidélité sont gérés au niveau central par votre franchiseur ou siège. Vous n'avez pas les permissions pour modifier ces paramètres."
        requiredType={[MerchantType.FRANCHISOR, MerchantType.CHAIN_HQ]}
        contactUrl="/contact-support"
      />
    );
  };
  
  // Paramètres du programme de fidélité
  const renderLoyaltySettings = () => {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>Configuration du programme de fidélité</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Ces paramètres définissent le fonctionnement de votre programme de fidélité basé sur les tokens Etika.
          </Alert>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Nom du programme"
            variant="outlined"
            defaultValue="Programme Fidélité Etika"
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description"
            variant="outlined"
            multiline
            rows={3}
            defaultValue="Gagnez des tokens à chaque achat et bénéficiez d'avantages exclusifs."
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Taux d'émission de tokens"
            variant="outlined"
            type="number"
            defaultValue="1"
            helperText="Nombre de tokens émis pour 10€ d'achat"
            margin="normal"
          />
          <TextField
            fullWidth
            label="Montant minimum d'achat"
            variant="outlined"
            type="number"
            defaultValue="5"
            helperText="Montant minimum pour gagner des tokens (en €)"
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Durée de validité des tokens</InputLabel>
            <Select
              label="Durée de validité des tokens"
              defaultValue="365"
            >
              <MenuItem value="90">3 mois</MenuItem>
              <MenuItem value="180">6 mois</MenuItem>
              <MenuItem value="365">1 an</MenuItem>
              <MenuItem value="730">2 ans</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>Options avancées</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Bonus pour première inscription"
          />
          <TextField
            fullWidth
            label="Tokens offerts à l'inscription"
            variant="outlined"
            type="number"
            defaultValue="5"
            margin="normal"
            disabled={!true}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Bonus pour anniversaire client"
          />
          <TextField
            fullWidth
            label="Tokens offerts pour l'anniversaire"
            variant="outlined"
            type="number"
            defaultValue="10"
            margin="normal"
            disabled={!true}
          />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />}
            >
              Enregistrer les modifications
            </Button>
          </Box>
        </Grid>
      </Grid>
    );
  };
  
  // Paramètres des tokens
  const renderTokenSettings = () => {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>Configuration des tokens</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Ces paramètres définissent la façon dont les tokens Etika sont utilisés dans votre établissement.
          </Alert>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Valeur d'un token en €"
            variant="outlined"
            type="number"
            defaultValue="0.50"
            margin="normal"
          />
          <TextField
            fullWidth
            label="Nombre minimum de tokens pour utilisation"
            variant="outlined"
            type="number"
            defaultValue="10"
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Mode d'utilisation des tokens</InputLabel>
            <Select
              label="Mode d'utilisation des tokens"
              defaultValue="discount"
            >
              <MenuItem value="discount">Réduction sur achat</MenuItem>
              <MenuItem value="catalog">Catalogue d'avantages</MenuItem>
              <MenuItem value="hybrid">Mode hybride</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Ordre d'utilisation des tokens</InputLabel>
            <Select
              label="Ordre d'utilisation des tokens"
              defaultValue="fifo"
            >
              <MenuItem value="fifo">Premier arrivé, premier utilisé (FIFO)</MenuItem>
              <MenuItem value="lifo">Dernier arrivé, premier utilisé (LIFO)</MenuItem>
              <MenuItem value="expiry">Priorité aux tokens expirant bientôt</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>Restrictions d'utilisation</Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Autoriser l'utilisation partielle des tokens"
          />
          <FormControlLabel
            control={<Switch />}
            label="Exclure certains produits"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Autoriser la combinaison avec d'autres promotions"
          />
          <FormControlLabel
            control={<Switch defaultChecked />}
            label="Plafonner l'utilisation par transaction"
          />
          <TextField
            fullWidth
            label="Plafond par transaction"
            variant="outlined"
            type="number"
            defaultValue="50"
            margin="normal"
            disabled={!true}
          />
        </Grid>
        <Grid item xs={12}>
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<SaveIcon />}
            >
              Enregistrer les modifications
            </Button>
          </Box>
        </Grid>
      </Grid>
    );
  };
  
  // Paramètres d'intégration
  const renderIntegrationSettings = () => {
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>Configuration de l'intégration</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Ces paramètres définissent comment Etika s'intègre avec votre système d'encaissement ou site e-commerce.
          </Alert>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth margin="normal">
            <InputLabel>Type d'intégration</InputLabel>
            <Select
              label="Type d'intégration"
              defaultValue="qr"
            >
              <MenuItem value="api">API directe</MenuItem>
              <MenuItem value="sdk">SDK</MenuItem>
              <MenuItem value="qr">QR Code</MenuItem>
              <MenuItem value="plugin">Plugin</MenuItem>
              <MenuItem value="manual">Saisie manuelle</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Système d'encaissement"
            variant="outlined"
            defaultValue="Caisse Connect"
            margin="normal"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          {/* Champs spécifiques selon le type d'intégration choisi */}
          <TextField
            fullWidth
            label="Identifiant point de vente"
            variant="outlined"
            defaultValue="POS-001"
            margin="normal"
          />
          <TextField
            fullWidth
            label="Terminal ID"
            variant="outlined"
            defaultValue="T-12345"
            margin="normal"
          />
        </Grid>
        {merchant.hasEcommerceCapabilities && (
          <>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>Intégration e-commerce</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Plateforme e-commerce</InputLabel>
                <Select
                  label="Plateforme e-commerce"
                  defaultValue="shopify"
                >
                  <MenuItem value="shopify">Shopify</MenuItem>
                  <MenuItem value="woocommerce">WooCommerce</MenuItem>
                  <MenuItem value="prestashop">PrestaShop</MenuItem>
                  <MenuItem value="magento">Magento</MenuItem>
                  <MenuItem value="custom">Solution personnalisée</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="URL de la boutique"
                variant="outlined"
                defaultValue="https://www.maboutique.com"
                margin="normal"
              />
            </Grid>
            
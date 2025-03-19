// src/pages/merchant/Dashboard.tsx - Dashboard spécifique à l'espace commerçant
import React, { useEffect, useState } from 'react';
import { 
  Grid, 
  Box, 
  Typography, 
  Paper, 
  CircularProgress,
  Card,
  CardContent,
  Button,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  LocalOffer as LocalOfferIcon,
  Payment as PaymentIcon,
  Loyalty as LoyaltyIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import DashboardCard from '../../components/dashboard/DashboardCard';
import TransactionChart from '../../components/charts/TransactionChart';
import TokenDistributionChart from '../../components/charts/TokenDistributionChart';
import RecentTransactionsTable from '../../components/tables/RecentTransactionsTable';

const MerchantDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [transactionsData, setTransactionsData] = useState<any>([]);
  const [timeRange, setTimeRange] = useState<string>('month');
  
  useEffect(() => {
    // Simuler le chargement des données du dashboard
    const fetchDashboardData = async () => {
      try {
        // Ici, ce serait un appel API réel
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // Données simulées
        setStatsData({
          issuedTokens: 12580,
          activeLoyaltyPrograms: 3,
          registeredCustomers: 2437,
          transactionVolume: 135750.42,
          avgTransactionValue: 55.70,
          totalTransactions: 2437,
          tokenRedemptionRate: 72.5
        });
        
        setChartData({
          transactions: [
            { date: '01/02', value: 4500 },
            { date: '02/02', value: 5200 },
            { date: '03/02', value: 4800 },
            { date: '04/02', value: 5100 },
            { date: '05/02', value: 6200 },
            { date: '06/02', value: 7800 },
            { date: '07/02', value: 8100 },
          ],
          tokenDistribution: [
            { name: 'Émis', value: 12580 },
            { name: 'Utilisés', value: 9120 },
            { name: 'Expirés', value: 860 },
            { name: 'En circulation', value: 2600 },
          ]
        });
        
        setTransactionsData([
          { 
            id: 'TX78945612',
            date: '2025-02-07T14:32:21',
            customer: 'Marie Dupont',
            amount: 89.50,
            tokens: 8,
            status: 'completed'
          },
          { 
            id: 'TX78945613',
            date: '2025-02-07T13:47:05',
            customer: 'Thomas Martin',
            amount: 134.25,
            tokens: 13,
            status: 'completed'
          },
          { 
            id: 'TX78945614',
            date: '2025-02-07T11:23:44',
            customer: 'Sophie Lefebvre',
            amount: 45.00,
            tokens: 4,
            status: 'completed'
          },
          { 
            id: 'TX78945615',
            date: '2025-02-07T10:12:38',
            customer: 'Pierre Dubois',
            amount: 212.75,
            tokens: 21,
            status: 'completed'
          },
          { 
            id: 'TX78945616',
            date: '2025-02-06T18:54:19',
            customer: 'Julie Moreau',
            amount: 67.30,
            tokens: 6,
            status: 'completed'
          },
        ]);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [timeRange]);
  
  const handleTimeRangeChange = (event: React.SyntheticEvent, newValue: string) => {
    setTimeRange(newValue);
    setLoading(true); // Recharger les données avec la nouvelle période
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Tableau de bord commerçant</Typography>
        <Box>
          <Tabs value={timeRange} onChange={handleTimeRangeChange} aria-label="time range tabs">
            <Tab label="7 jours" value="week" />
            <Tab label="30 jours" value="month" />
            <Tab label="90 jours" value="quarter" />
            <Tab label="1 an" value="year" />
          </Tabs>
        </Box>
      </Box>
      
      {/* Cartes de statistiques principales */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            title="Tokens émis"
            value={statsData.issuedTokens}
            icon={<LocalOfferIcon color="primary" fontSize="large" />}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            title="Transactions"
            value={statsData.totalTransactions}
            icon={<PaymentIcon color="primary" fontSize="large" />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            title="Clients enregistrés"
            value={statsData.registeredCustomers}
            icon={<PeopleIcon color="primary" fontSize="large" />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            title="Chiffre d'affaires"
            value={`${statsData.transactionVolume.toLocaleString('fr-FR')} €`}
            icon={<TrendingUpIcon color="primary" fontSize="large" />}
            color="#f44336"
          />
        </Grid>
      </Grid>
      
      {/* Graphiques */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Volume de transactions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box height={300}>
              <TransactionChart data={chartData.transactions} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Distribution des tokens
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box height={300}>
              <TokenDistributionChart data={chartData.tokenDistribution} />
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Statistiques supplémentaires */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <DashboardCard
            title="Programmes de fidélité actifs"
            value={statsData.activeLoyaltyPrograms}
            icon={<LoyaltyIcon color="primary" fontSize="large" />}
            color="#9c27b0"
          >
            <Button 
              variant="outlined" 
              size="small" 
              sx={{ mt: 2 }}
              onClick={() => navigate('/merchant/loyalty')}
            >
              Gérer les programmes
            </Button>
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardCard
            title="Valeur moyenne par transaction"
            value={`${statsData.avgTransactionValue.toFixed(2)} €`}
            icon={<TrendingUpIcon color="primary" fontSize="large" />}
            color="#009688"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardCard
            title="Taux d'utilisation des tokens"
            value={`${statsData.tokenRedemptionRate}%`}
            icon={<LocalOfferIcon color="primary" fontSize="large" />}
            color="#3f51b5"
          >
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Pourcentage de tokens utilisés par les clients
            </Typography>
          </DashboardCard>
        </Grid>
      </Grid>
      
      {/* Transactions récentes */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Transactions récentes
          </Typography>
          <Button 
            variant="text" 
            onClick={() => navigate('/merchant/transactions')}
          >
            Voir toutes les transactions
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <RecentTransactionsTable transactions={transactionsData} />
      </Paper>
    </Box>
  );
};

export default MerchantDashboard;
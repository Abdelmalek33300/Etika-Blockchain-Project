// src/pages/supplier/Dashboard.tsx - Dashboard spécifique à l'espace fournisseur
import React, { useEffect, useState } from 'react';
import { 
  Grid, 
  Box, 
  Typography, 
  Paper, 
  CircularProgress,
  Button,
  Tabs,
  Tab,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  AccountBalance as AccountBalanceIcon,
  LocalOffer as LocalOfferIcon,
  Business as BusinessIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import DashboardCard from '../../components/dashboard/DashboardCard';
import RevenueChart from '../../components/charts/RevenueChart';
import TokenValueChart from '../../components/charts/TokenValueChart';

const SupplierDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [partnersData, setPartnersData] = useState<any>([]);
  const [timeRange, setTimeRange] = useState<string>('month');
  
  useEffect(() => {
    // Simuler le chargement des données du dashboard
    const fetchDashboardData = async () => {
      try {
        // Ici, ce serait un appel API réel
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Données simulées
        setStatsData({
          tokenBalance: 28750,
          tokenValue: 28750 * 0.95, // Valeur en euros
          totalRevenue: 187430.25,
          pendingPayments: 42150.75,
          activePartners: 12,
          completedTransactions: 358,
          conversionRate: 0.95 // Taux de conversion token -> euros
        });
        
        setChartData({
          revenue: [
            { month: 'Sep', revenue: 135000 },
            { month: 'Oct', revenue: 152000 },
            { month: 'Nov', revenue: 148000 },
            { month: 'Dec', revenue: 162000 },
            { month: 'Jan', revenue: 178000 },
            { month: 'Feb', revenue: 187000 }
          ],
          tokenValue: [
            { date: '01/09/2024', value: 0.93 },
            { date: '01/10/2024', value: 0.94 },
            { date: '01/11/2024', value: 0.94 },
            { date: '01/12/2024', value: 0.94 },
            { date: '01/01/2025', value: 0.95 },
            { date: '01/02/2025', value: 0.95 }
          ]
        });
        
        setPartnersData([
          { 
            id: 1,
            name: 'Super Express',
            type: 'Commerçant',
            volume: 45600,
            tokens: 4750,
            status: 'active'
          },
          { 
            id: 2,
            name: 'Bio Market',
            type: 'Commerçant',
            volume: 38250,
            tokens: 3980,
            status: 'active'
          },
          { 
            id: 3,
            name: 'Tech Solutions',
            type: 'Commerçant',
            volume: 25400,
            tokens: 2630,
            status: 'active'
          },
          { 
            id: 4,
            name: 'Green Services',
            type: 'Sous-traitant',
            volume: 18700,
            tokens: 1950,
            status: 'active'
          },
          { 
            id: 5,
            name: 'Local Café',
            type: 'Commerçant',
            volume: 12800,
            tokens: 1340,
            status: 'active'
          }
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
        <Typography variant="h4">Tableau de bord fournisseur</Typography>
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
            title="Solde de tokens"
            value={statsData.tokenBalance.toLocaleString('fr-FR')}
            icon={<LocalOfferIcon color="primary" fontSize="large" />}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            title="Valeur en euros"
            value={`${statsData.tokenValue.toLocaleString('fr-FR')} €`}
            icon={<AccountBalanceIcon color="primary" fontSize="large" />}
            color="#4caf50"
            tooltip={`Basé sur un taux de conversion de ${statsData.conversionRate} €`}
          />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            title="Revenu total"
            value={`${statsData.totalRevenue.toLocaleString('fr-FR')} €`}
            icon={<TrendingUpIcon color="primary" fontSize="large" />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <DashboardCard
            title="Paiements en attente"
            value={`${statsData.pendingPayments.toLocaleString('fr-FR')} €`}
            icon={<ReceiptIcon color="primary" fontSize="large" />}
            color="#f44336"
          />
        </Grid>
      </Grid>
      
      {/* Graphiques */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Évolution du revenu
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box height={300}>
              <RevenueChart data={chartData.revenue} />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Valeur du token
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box height={300}>
              <TokenValueChart data={chartData.tokenValue} />
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Statistiques supplémentaires */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <DashboardCard
            title="Partenaires actifs"
            value={statsData.activePartners}
            icon={<BusinessIcon color="primary" fontSize="large" />}
            color="#9c27b0"
          >
            <Button 
              variant="outlined" 
              size="small" 
              sx={{ mt: 2 }}
              onClick={() => navigate('/supplier/partners')}
            >
              Voir les partenaires
            </Button>
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardCard
            title="Transactions complétées"
            value={statsData.completedTransactions}
            icon={<ReceiptIcon color="primary" fontSize="large" />}
            color="#009688"
            tooltip="Nombre total de transactions sur la période"
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardCard
            title="Taux de conversion"
            value={`${(statsData.conversionRate * 100).toFixed(0)}%`}
            icon={<LocalOfferIcon color="primary" fontSize="large" />}
            color="#3f51b5"
          >
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Valeur en euros pour 1 token
            </Typography>
          </DashboardCard>
        </Grid>
      </Grid>
      
      {/* Partenaires principaux */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Partenaires principaux
          </Typography>
          <Button 
            variant="text" 
            onClick={() => navigate('/supplier/partners')}
          >
            Voir tous les partenaires
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Partenaire</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Volume (€)</TableCell>
                <TableCell align="right">Tokens</TableCell>
                <TableCell>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {partnersData.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell>{partner.name}</TableCell>
                  <TableCell>{partner.type}</TableCell>
                  <TableCell align="right">{partner.volume.toLocaleString('fr-FR')} €</TableCell>
                  <TableCell align="right">{partner.tokens.toLocaleString('fr-FR')}</TableCell>
                  <TableCell>
                    <Chip 
                      label={partner.status === 'active' ? 'Actif' : 'Inactif'} 
                      color={partner.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default SupplierDashboard;
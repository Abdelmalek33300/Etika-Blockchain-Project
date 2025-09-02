// src/features/dashboard/DashboardPage.tsx
import React, { useState, useEffect } from 'react';
import { Container, Grid, Paper, Typography, Box, Button, Chip, Divider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  AccountBalance as AccountBalanceIcon,
  Storefront as StorefrontIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  LocalShipping as SupplierIcon,
  AccessTime as ClockIcon,
} from '@mui/icons-material';

// Composants
import MetricCard from 'components/ui/MetricCard';
import TransactionList from 'features/transactions/components/TransactionList';
import SuppliersList from 'features/suppliers/components/SuppliersList';
import TokensWidget from 'features/tokens/components/TokensWidget';
import FactoringOverview from 'features/factoring/components/FactoringOverview';
import ActivityFeed from 'components/ui/ActivityFeed';
import LoadingSpinner from 'components/ui/LoadingSpinner';

// Services
import { useGetMerchantStats } from 'services/api/merchant';
import { useGetRecentTransactions } from 'services/api/transactions';
import { useGetSupplierRelationships } from 'services/api/suppliers';

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  
  // Récupération des données via React Query
  const { 
    data: merchantStats, 
    isLoading: isLoadingStats 
  } = useGetMerchantStats();
  
  const { 
    data: transactions, 
    isLoading: isLoadingTransactions 
  } = useGetRecentTransactions({ limit: 5 });
  
  const { 
    data: suppliers, 
    isLoading: isLoadingSuppliers 
  } = useGetSupplierRelationships({ status: 'active' });

  // État pour les notifications (simulé pour la démonstration)
  const [notifications, setNotifications] = useState([
    { id: 1, message: 'Nouvelle transaction validée', time: '10:30', read: false },
    { id: 2, message: 'Paiement d\'affacturage effectué', time: '09:15', read: false },
    { id: 3, message: 'Nouvelle relation fournisseur', time: 'Hier', read: true },
  ]);

  // Simule un chargement des données pour la démonstration
  if (isLoadingStats || isLoadingTransactions || isLoadingSuppliers) {
    return <LoadingSpinner />;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Tableau de bord
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<ReceiptIcon />}
          href="/transactions/new"
        >
          Nouvelle transaction
        </Button>
      </Box>

      {/* Cartes métriques */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard 
            title="Tokens disponibles" 
            value="2,450" 
            icon={<AccountBalanceIcon />}
            trend="+12%"
            color={theme.palette.primary.main}
            onClick={() => console.log('Redirect to tokens page')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard 
            title="Ventes du mois" 
            value="€15,245" 
            icon={<StorefrontIcon />}
            trend="+8%"
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard 
            title="Transactions en attente" 
            value="5" 
            icon={<ReceiptIcon />}
            trend="-2"
            color={theme.palette.warning.main}
            onClick={() => console.log('Redirect to pending transactions')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard 
            title="Liquidité d'affacturage" 
            value="€8,720" 
            icon={<TrendingUpIcon />}
            trend="+€1,200"
            color={theme.palette.info.main}
            onClick={() => console.log('Redirect to factoring page')}
          />
        </Grid>
      </Grid>

      {/* Contenu principal */}
      <Grid container spacing={3}>
        {/* Colonne gauche */}
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Transactions récentes
              </Typography>
              <Button size="small" href="/transactions">
                Voir tout
              </Button>
            </Box>
            <TransactionList 
              transactions={transactions || []} 
              isLoading={isLoadingTransactions}
              compact
            />
          </Paper>

          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Aperçu de l'affacturage
              </Typography>
              <Button size="small" href="/factoring">
                Gérer
              </Button>
            </Box>
            <FactoringOverview />
          </Paper>
        </Grid>
        
        {/* Colonne droite */}
        <Grid item xs={12} md={4}>
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Tokens Étika
              </Typography>
              <Chip label="État: Actif" color="success" size="small" />
            </Box>
            <TokensWidget />
          </Paper>
          
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography component="h2" variant="h6" color="primary" gutterBottom>
                Fournisseurs actifs
              </Typography>
              <Button size="small" href="/suppliers">
                Gérer
              </Button>
            </Box>
            <SuppliersList 
              suppliers={suppliers || []} 
              isLoading={isLoadingSuppliers}
              compact
            />
          </Paper>
          
          <Paper
            sx={{
              p: 2,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography component="h2" variant="h6" color="primary" gutterBottom>
              Activité récente
            </Typography>
            <ActivityFeed activities={notifications} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DashboardPage;

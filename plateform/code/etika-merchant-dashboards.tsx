// src/components/merchant/dashboards/FranchiseeDashboard.tsx - Dashboard pour franchisés
import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box,
  Button, 
  Divider,
  Alert,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import DashboardCard from '../../dashboard/DashboardCard';
import {
  LocalOffer as TokenIcon,
  ShoppingCart as CartIcon,
  People as CustomerIcon,
  TrendingUp as RevenueIcon,
  Assessment as RankingIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import RecentTransactionsTable from '../../tables/RecentTransactionsTable';
import { Line } from 'recharts';
import SimpleLineChart from '../../charts/SimpleLineChart';

// Dashboard pour les franchisés incluant des éléments de comparaison au réseau
const FranchiseeDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [rankings, setRankings] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  
  useEffect(() => {
    // Simulation de données pour le dashboard
    setStats({
      tokensIssued: 3875,
      customerCount: 312,
      salesAmount: 24680,
      transactionCount: 587,
      networkRank: 4,
      networkTotal: 16
    });
    
    setRankings({
      tokenIssuance: {
        rank: 3,
        total: 16,
        value: 3875,
        networkAverage: 3200
      },
      customerRetention: {
        rank: 5,
        total: 16,
        value: 78.4,
        networkAverage: 72.1
      },
      averageTransaction: {
        rank: 7,
        total: 16,
        value: 42.5,
        networkAverage: 45.2
      }
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
    
    setPerformanceData([
      { month: 'Sep', myStore: 18500, networkAvg: 17200 },
      { month: 'Oct', myStore: 19800, networkAvg: 18100 },
      { month: 'Nov', myStore: 22100, networkAvg: 19500 },
      { month: 'Dec', myStore: 24300, networkAvg: 21800 },
      { month: 'Jan', myStore: 23700, networkAvg: 22000 },
      { month: 'Feb', myStore: 24680, networkAvg: 23100 }
    ]);
  }, []);
  
  return (
    <Box>
      {/* Message du franchiseur */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2">Message du franchiseur</Typography>
        <Typography variant="body2">
          Nouvelle campagne nationale à partir du 15 février. <Link href="/merchant/campaigns">Voir les détails</Link>
        </Typography>
      </Alert>
      
      {/* Cartes de KPIs avec comparaison réseau */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Tokens émis"
            value={stats?.tokensIssued}
            icon={<TokenIcon color="primary" fontSize="large" />}
            color="#1976d2"
          >
            <Typography variant="body2" sx={{ mt: 1 }}>
              Rang réseau: {stats?.networkRank}/{stats?.networkTotal}
            </Typography>
          </DashboardCard>
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
      
      {/* Graphique de performance comparée */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Performance comparée au réseau
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box height={300}>
          <SimpleLineChart 
            data={performanceData}
            xAxisDataKey="month"
            series={[
              { dataKey: "myStore", name: "Mon magasin", color: "#1976d2" },
              { dataKey: "networkAvg", name: "Moyenne réseau", color: "#9e9e9e" }
            ]}
          />
        </Box>
      </Paper>
      
      {/* Classement au sein du réseau */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Classement au sein du réseau
          </Typography>
          <Button 
            variant="text" 
            startIcon={<VisibilityIcon />}
            onClick={() => {}}
          >
            Voir le classement complet
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Indicateur</TableCell>
                <TableCell align="right">Valeur</TableCell>
                <TableCell align="right">Moyenne réseau</TableCell>
                <TableCell align="right">Rang</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Émission de tokens</TableCell>
                <TableCell align="right">{rankings?.tokenIssuance.value}</TableCell>
                <TableCell align="right">{rankings?.tokenIssuance.networkAverage}</TableCell>
                <TableCell align="right">{rankings?.tokenIssuance.rank}/{rankings?.tokenIssuance.total}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Taux de rétention client (%)</TableCell>
                <TableCell align="right">{rankings?.customerRetention.value}%</TableCell>
                <TableCell align="right">{rankings?.customerRetention.networkAverage}%</TableCell>
                <TableCell align="right">{rankings?.customerRetention.rank}/{rankings?.customerRetention.total}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Valeur moyenne des transactions (€)</TableCell>
                <TableCell align="right">{rankings?.averageTransaction.value} €</TableCell>
                <TableCell align="right">{rankings?.averageTransaction.networkAverage} €</TableCell>
                <TableCell align="right">{rankings?.averageTransaction.rank}/{rankings?.averageTransaction.total}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
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
    </Box>
  );
};

export default FranchiseeDashboard;

// src/components/merchant/dashboards/FranchisorDashboard.tsx - Dashboard pour franchiseurs
import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box,
  Button, 
  Divider,
  Chip,
  Tab,
  Tabs,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import DashboardCard from '../../dashboard/DashboardCard';
import {
  LocalOffer as TokenIcon,
  Business as BusinessIcon,
  TrendingUp as RevenueIcon,
  Map as MapIcon,
  DonutLarge as DonutIcon
} from '@mui/icons-material';
import SimpleBarChart from '../../charts/SimpleBarChart';
import SimplePieChart from '../../charts/SimplePieChart';

// Dashboard pour les franchiseurs avec vue sur l'ensemble du réseau
const FranchisorDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [topFranchisees, setTopFranchisees] = useState<any[]>([]);
  const [regionData, setRegionData] = useState<any[]>([]);
  const [tokenDistribution, setTokenDistribution] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<string>('month');
  const [region, setRegion] = useState<string>('all');
  const [tab, setTab] = useState<number>(0);
  
  useEffect(() => {
    // Simulation de données pour le dashboard
    setStats({
      totalFranchisees: 16,
      activeFranchisees: 16,
      totalTokensIssued: 52480,
      totalRevenue: 712500,
      retentionRate: 82.4,
      programParticipation: 74.2
    });
    
    setTopFranchisees([
      { name: "Paris Opéra", revenue: 62400, tokens: 5840, retention: 87.2 },
      { name: "Lyon Centre", revenue: 58700, tokens: 5320, retention: 84.5 },
      { name: "Bordeaux Lac", revenue: 54300, tokens: 4980, retention: 83.1 },
      { name: "Marseille Canebière", revenue: 51200, tokens: 4650, retention: 82.8 },
      { name: "Toulouse Wilson", revenue: 47800, tokens: 4410, retention: 81.6 }
    ]);
    
    setRegionData([
      { name: "Île-de-France", revenue: 187500, franchisees: 4, tokens: 16240 },
      { name: "Auvergne-Rhône-Alpes", revenue: 136800, franchisees: 3, tokens: 12500 },
      { name: "Nouvelle-Aquitaine", revenue: 124700, franchisees: 3, tokens: 10780 },
      { name: "PACA", revenue: 85600, franchisees: 2, tokens: 7580 },
      { name: "Occitanie", revenue: 78900, franchisees: 2, tokens: 6940 },
      { name: "Autres régions", revenue: 99000, franchisees: 2, tokens: 8440 }
    ]);
    
    setTokenDistribution([
      { name: "Émis non utilisés", value: 14200 },
      { name: "Utilisés", value: 36300 },
      { name: "Expirés", value: 1980 }
    ]);
  }, [timeRange, region]);
  
  const handleTimeRangeChange = (event: React.SyntheticEvent, newValue: string) => {
    setTimeRange(newValue);
  };
  
  const handleRegionChange = (event: any) => {
    setRegion(event.target.value);
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
  };
  
  return (
    <Box>
      {/* Filtres */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Tabs value={tab} onChange={handleTabChange}>
          <Tab label="Réseau" />
          <Tab label="Franchisés" />
          <Tab label="Régions" />
          <Tab label="Programmes" />
        </Tabs>
        
        <Box display="flex" alignItems="center" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Région</InputLabel>
            <Select
              value={region}
              label="Région"
              onChange={handleRegionChange}
            >
              <MenuItem value="all">Toutes</MenuItem>
              <MenuItem value="idf">Île-de-France</MenuItem>
              <MenuItem value="ara">Auvergne-Rhône-Alpes</MenuItem>
              <MenuItem value="na">Nouvelle-Aquitaine</MenuItem>
              <MenuItem value="paca">PACA</MenuItem>
              <MenuItem value="occ">Occitanie</MenuItem>
            </Select>
          </FormControl>
          
          <Tabs value={timeRange} onChange={handleTimeRangeChange}>
            <Tab label="7 jours" value="week" />
            <Tab label="30 jours" value="month" />
            <Tab label="90 jours" value="quarter" />
            <Tab label="1 an" value="year" />
          </Tabs>
        </Box>
      </Box>
      
      {/* KPIs réseau */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={4}>
          <DashboardCard
            title="Franchisés"
            value={`${stats?.activeFranchisees}/${stats?.totalFranchisees}`}
            icon={<BusinessIcon color="primary" fontSize="large" />}
            color="#1976d2"
          >
            <Typography variant="body2" sx={{ mt: 1 }}>
              Taux de participation : {stats?.programParticipation}%
            </Typography>
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardCard
            title="Tokens émis (réseau)"
            value={stats?.totalTokensIssued.toLocaleString('fr-FR')}
            icon={<TokenIcon color="primary" fontSize="large" />}
            color="#388e3c"
          >
            <Typography variant="body2" sx={{ mt: 1 }}>
              Moyenne par franchisé : {Math.round(stats?.totalTokensIssued / stats?.activeFranchisees).toLocaleString('fr-FR')}
            </Typography>
          </DashboardCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardCard
            title="Chiffre d'affaires réseau"
            value={`${stats?.totalRevenue.toLocaleString('fr-FR')} €`}
            icon={<RevenueIcon color="primary" fontSize="large" />}
            color="#f57c00"
          >
            <Typography variant="body2" sx={{ mt: 1 }}>
              Taux de rétention : {stats?.retentionRate}%
            </Typography>
          </DashboardCard>
        </Grid>
      </Grid>
      
      {/* Graphiques et tableaux selon l'onglet sélectionné */}
      {tab === 0 && (
        <>
          {/* Vue réseau */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Performance par région
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box height={300}>
                  <SimpleBarChart 
                    data={regionData}
                    xAxisDataKey="name"
                    series={[
                      { dataKey: "revenue", name: "Chiffre d'affaires (€)", color: "#1976d2" }
                    ]}
                  />
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
                  <SimplePieChart 
                    data={tokenDistribution}
                    dataKey="value"
                    nameKey="name"
                    colors={["#42a5f5", "#66bb6a", "#ef5350"]}
                  />
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Top 5 franchisés
                  </Typography>
                  <Button variant="text">
                    Voir tous les franchisés
                  </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Franchisé</TableCell>
                        <TableCell align="right">CA (€)</TableCell>
                        <TableCell align="right">Tokens émis</TableCell>
                        <TableCell align="right">Taux de rétention</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topFranchisees.map((franchisee) => (
                        <TableRow key={franchisee.name}>
                          <TableCell>{franchisee.name}</TableCell>
                          <TableCell align="right">{franchisee.revenue.toLocaleString('fr-FR')} €</TableCell>
                          <TableCell align="right">{franchisee.tokens}</TableCell>
                          <TableCell align="right">{franchisee.retention}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
      
      {/* Autres onglets similaires */}
    </Box>
  );
};

export default FranchisorDashboard;

// src/components/merchant/dashboards/EcommerceDashboard.tsx - Dashboard pour e-commerce
import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box,
  Button, 
  Divider,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import DashboardCard from '../../dashboard/DashboardCard';
import {
  LocalOffer as TokenIcon,
  ShoppingCart as CartIcon,
  People as CustomerIcon,
  ShoppingBasket as BasketIcon,
  TrendingUp as ConversionIcon
} from '@mui/icons-material';
import SimpleFunnelChart from '../../charts/SimpleFunnelChart';

// Dashboard optimisé pour e-commerce
const EcommerceDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [conversionSteps, setConversionSteps] = useState<any[]>([]);
  
  useEffect(() => {
    // Simulation de données pour le dashboard
    setStats({
      tokensIssued: 5280,
      customerCount: 745,
      ordersCount: 932,
      abandonedCarts: 312,
      conversionRate: 3.4,
      averageOrderValue: 68.9,
      reviewsWithTokens: 142
    });
    
    setFunnelData([
      { name: "Visiteurs", value: 27500 },
      { name: "Fiches produits", value: 12450 },
      { name: "Ajouts au panier", value: 3850 },
      { name: "Checkout", value: 1240 },
      { name: "Commandes", value: 932 }
    ]);
    
    setConversionSteps([
      { name: "Visiteurs → Produits", rate: 45.3, change: 2.1 },
      { name: "Produits → Panier", rate: 30.9, change: -1.5 },
      { name: "Panier → Checkout", rate: 32.2, change: 4.3 },
      { name: "Checkout → Commande", rate: 75.2, change: 1.7 }
    ]);
  }, []);
  
  return (
    <Box>
      {/* KPIs e-commerce */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Commandes"
            value={stats?.ordersCount}
            icon={<BasketIcon color="primary" fontSize="large" />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Tokens émis"
            value={stats?.tokensIssued}
            icon={<TokenIcon color="primary" fontSize="large" />}
            color="#388e3c"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Taux de conversion"
            value={`${stats?.conversionRate}%`}
            icon={<ConversionIcon color="primary" fontSize="large" />}
            color="#f57c00"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Panier moyen"
            value={`${stats?.averageOrderValue.toFixed(2)} €`}
            icon={<CartIcon color="primary" fontSize="large" />}
            color="#7b1fa2"
          />
        </Grid>
      </Grid>
      
      {/* Funnel de conversion */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Funnel de conversion
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={7}>
            <Box height={350}>
              <SimpleFunnelChart data={funnelData} />
            </Box>
          </Grid>
          <Grid item xs={12} md={5}>
            <Typography variant="subtitle1" gutterBottom>
              Taux de conversion par étape
            </Typography>
            {conversionSteps.map((step) => (
              <Box key={step.name} sx={{ mb: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">{step.name}</Typography>
                  <Box display="flex" alignItems="center">
                    <Typography variant="body2" fontWeight="bold">
                      {step.rate}%
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        ml: 1, 
                        color: step.change > 0 ? 'success.main' : 'error.main' 
                      }}
                    >
                      {step.change > 0 ? `+${step.change}%` : `${step.change}%`}
                    </Typography>
                  </Box>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={step.rate} 
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                />
              </Box>
            ))}
          </Grid>
        </Grid>
      </Paper>
      
      {/* Impact des tokens sur les comportements */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Impact des tokens sur les comportements
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card elevation={0} sx={{ bgcolor: 'background.default' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Récupération de paniers abandonnés
                </Typography>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="h4" color="primary" sx={{ mr: 1 }}>
                    32%
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    +7.5%
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Taux de récupération des paniers abandonnés grâce aux incentives en tokens
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card elevation={0} sx={{ bgcolor: 'background.default' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Avis clients avec tokens
                </Typography>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="h4" color="primary" sx={{ mr: 1 }}>
                    {stats?.reviewsWithTokens}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    +42%
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Nombre d'avis clients générés grâce aux récompenses en tokens
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card elevation={0} sx={{ bgcolor: 'background.default' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Valeur client (LTV)
                </Typography>
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography variant="h4" color="primary" sx={{ mr: 1 }}>
                    +18%
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Augmentation de la valeur client (LTV) pour les clients participant au programme de tokens
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default EcommerceDashboard;

// src/components/charts/SimpleLineChart.tsx
import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface SeriesConfig {
  dataKey: string;
  name: string;
  color: string;
}

interface SimpleLineChartProps {
  data: any[];
  xAxisDataKey: string;
  series: SeriesConfig[];
}

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, xAxisDataKey, series }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisDataKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        {series.map((serie, index) => (
          <Line
            key={index}
            type="monotone"
            dataKey={serie.dataKey}
            name={serie.name}
            stroke={serie.color}
            activeDot={{ r: 8 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default SimpleLineChart;

// src/components/charts/SimpleBarChart.tsx
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface SeriesConfig {
  dataKey: string;
  name: string;
  color: string;
}

interface SimpleBarChartProps {
  data: any[];
  xAxisDataKey: string;
  series: SeriesConfig[];
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, xAxisDataKey, series }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xAxisDataKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        {series.map((serie, index) => (
          <Bar
            key={index}
            dataKey={serie.dataKey}
            name={serie.name}
            fill={serie.color}
          />
        ))}
// Suite de la page TokenManagement.tsx - explorateur blockchain
                  <Typography variant="h6" gutterBottom>
                    Explorateur blockchain
                  </Typography>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    L'explorateur vous permet de visualiser les transactions sur la blockchain Etika et de vérifier leur statut en temps réel.
                  </Alert>
                  
                  <TextField
                    fullWidth
                    variant="outlined"
                    label="Rechercher une transaction (ID ou adresse)"
                    placeholder="Entrez un ID de transaction ou une adresse"
                    sx={{ mb: 3 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button variant="contained" size="small">
                            Rechercher
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                  />
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Transactions récentes sur la blockchain
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Hash</TableCell>
                            <TableCell>Bloc</TableCell>
                            <TableCell>Horodatage</TableCell>
                            <TableCell>De</TableCell>
                            <TableCell>À</TableCell>
                            <TableCell>Montant</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            <TableCell>0x8f3...</TableCell>
                            <TableCell>12456789</TableCell>
                            <TableCell>07/02/2025 14:32:21</TableCell>
                            <TableCell>0x74a...</TableCell>
                            <TableCell>0x2b9...</TableCell>
                            <TableCell>150</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>0x6a2...</TableCell>
                            <TableCell>12456788</TableCell>
                            <TableCell>07/02/2025 14:31:05</TableCell>
                            <TableCell>0x1f7...</TableCell>
                            <TableCell>0x8dc...</TableCell>
                            <TableCell>320</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>0x3d7...</TableCell>
                            <TableCell>12456787</TableCell>
                            <TableCell>07/02/2025 14:30:47</TableCell>
                            <TableCell>0xc4b...</TableCell>
                            <TableCell>0x74a...</TableCell>
                            <TableCell>75</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </>
              )}
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          {/* Statut blockchain */}
          <BlockchainStatus showDetails={true} />
          
          {/* Taux de conversion */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Taux de conversion
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center">
                  <TokenIcon color="primary" sx={{ mr: 1 }} />
                  <Typography>1 Token Etika</Typography>
                </Box>
                <ExchangeIcon />
                <Box display="flex" alignItems="center">
                  <Typography>{tokenData.conversionRate.toFixed(2)} €</Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="textSecondary">
                Taux mis à jour le 07/02/2025 à 12:00
              </Typography>
              <Box mt={2}>
                <Button 
                  variant="outlined" 
                  startIcon={<ConvertIcon />}
                  fullWidth
                  onClick={handleOpenConvertDialog}
                >
                  Convertir des tokens
                </Button>
              </Box>
            </CardContent>
          </Card>
          
          {/* Informations et ressources */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ressources
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <List>
                <ListItem button>
                  <ListItemIcon>
                    <ExploreIcon />
                  </ListItemIcon>
                  <ListItemText primary="Explorer la blockchain" />
                </ListItem>
                <ListItem button>
                  <ListItemIcon>
                    <AssessmentIcon />
                  </ListItemIcon>
                  <ListItemText primary="Rapports et analyses" />
                </ListItem>
                <ListItem button>
                  <ListItemIcon>
                    <ExchangeIcon />
                  </ListItemIcon>
                  <ListItemText primary="Historique des taux" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Dialog d'envoi de tokens */}
      <Dialog open={openSendDialog} onClose={handleCloseSendDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Envoyer des tokens</DialogTitle>
        <DialogContent>
          <DialogContentText gutterBottom>
            Envoyez des tokens à un autre participant de l'écosystème Etika.
          </DialogContentText>
          <TextField
            margin="dense"
            id="recipient"
            name="recipient"
            label="Destinataire (ID ou adresse)"
            type="text"
            fullWidth
            variant="outlined"
            value={sendForm.recipient}
            onChange={handleSendFormChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            id="amount"
            name="amount"
            label="Montant"
            type="number"
            fullWidth
            variant="outlined"
            value={sendForm.amount}
            onChange={handleSendFormChange}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">Tokens</InputAdornment>,
            }}
          />
          <TextField
            margin="dense"
            id="message"
            name="message"
            label="Message ou référence (optionnel)"
            type="text"
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={sendForm.message}
            onChange={handleSendFormChange}
          />
          <Box mt={2}>
            <Typography variant="body2">
              Solde disponible: <strong>{tokenData.balance} tokens</strong>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSendDialog}>Annuler</Button>
          <Button 
            onClick={handleSendTokens} 
            variant="contained" 
            color="primary"
            disabled={!sendForm.recipient || !sendForm.amount || parseInt(sendForm.amount) <= 0 || parseInt(sendForm.amount) > tokenData.balance}
          >
            Envoyer
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog de conversion de tokens */}
      <Dialog open={openConvertDialog} onClose={handleCloseConvertDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Convertir des tokens</DialogTitle>
        <DialogContent>
          <DialogContentText gutterBottom>
            Convertissez vos tokens Etika en devise traditionnelle ou en autres actifs numériques.
          </DialogContentText>
          <Box my={2}>
            <Alert severity="info">
              Taux de conversion actuel: 1 Token = {tokenData.conversionRate.toFixed(2)} €
            </Alert>
          </Box>
          <TextField
            margin="dense"
            id="amount"
            name="amount"
            label="Montant à convertir"
            type="number"
            fullWidth
            variant="outlined"
            value={convertForm.amount}
            onChange={handleConvertFormChange}
            sx={{ mb: 2 }}
            InputProps={{
              endAdornment: <InputAdornment position="end">Tokens</InputAdornment>,
            }}
          />
          <FormControl fullWidth variant="outlined" margin="dense">
            <InputLabel id="convert-type-label">Convertir en</InputLabel>
            <Select
              labelId="convert-type-label"
              id="type"
              name="type"
              value={convertForm.type}
              onChange={handleConvertTypeChange}
              label="Convertir en"
            >
              <MenuItem value="fiat">EUR (Devise)</MenuItem>
              <MenuItem value="eth">ETH (Ethereum)</MenuItem>
              <MenuItem value="btc">BTC (Bitcoin)</MenuItem>
            </Select>
          </FormControl>
          
          <Box mt={3} p={2} bgcolor="background.default" borderRadius={1}>
            <Typography variant="subtitle2" gutterBottom>
              Résumé de la conversion
            </Typography>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2">Montant en tokens:</Typography>
              <Typography variant="body2">{convertForm.amount || '0'} Tokens</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2">Taux de conversion:</Typography>
              <Typography variant="body2">{tokenData.conversionRate.toFixed(2)} €</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2">Vous recevrez:</Typography>
              <Typography variant="body2" fontWeight="bold">
                {!convertForm.amount ? '0.00' : (parseInt(convertForm.amount) * tokenData.conversionRate).toFixed(2)} {convertForm.type === 'fiat' ? '€' : convertForm.type.toUpperCase()}
              </Typography>
            </Box>
          </Box>
          
          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 2 }}>
            Note: La conversion peut prendre jusqu'à 24 heures ouvrées pour être traitée. Des frais peuvent s'appliquer.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConvertDialog}>Annuler</Button>
          <Button 
            onClick={handleConvertTokens} 
            variant="contained" 
            color="primary"
            disabled={!convertForm.amount || parseInt(convertForm.amount) <= 0 || parseInt(convertForm.amount) > tokenData.balance}
          >
            Convertir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TokenManagement;

// src/pages/supplier/Dashboard.tsx - Page de Tableau de bord pour les fournisseurs
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  Divider, 
  Button, 
  Card, 
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Receipt as ReceiptIcon,
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  LocalOffer as TokenIcon,
  AccountBalance as AccountIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '../../components/dashboard/DashboardCard';
import BlockchainStatus from '../../components/integration/BlockchainStatus';
import SimpleLineChart from '../../components/charts/SimpleLineChart';

// Dashboard principal pour les fournisseurs axé sur les flux financiers
const SupplierDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  
  useEffect(() => {
    // Simuler le chargement des données
    const timer = setTimeout(() => {
      setStats({
        totalRevenue: 248750,
        pendingPayments: 36450,
        tokensBalance: 14250,
        tokensValue: 13537.5,
        transactionsCount: 583,
        partnersCount: 47
      });
      
      setRevenueData([
        { month: 'Sep', revenue: 185000, tokens: 9250 },
        { month: 'Oct', revenue: 197500, tokens: 9875 },
        { month: 'Nov', revenue: 210000, tokens: 10500 },
        { month: 'Dec', revenue: 223500, tokens: 11175 },
        { month: 'Jan', revenue: 236000, tokens: 11800 },
        { month: 'Feb', revenue: 248750, tokens: 12437 }
      ]);
      
      setTransactions([
        {
          id: 'INV-12345',
          date: '2025-02-07',
          type: 'paiement',
          partner: 'Super Express',
          amount: 15780,
          tokens: 1578,
          status: 'completed'
        },
        {
          id: 'INV-12344',
          date: '2025-02-05',
          type: 'paiement',
          partner: 'Bio Market',
          amount: 12350,
          tokens: 1235,
          status: 'completed'
        },
        {
          id: 'INV-12343',
          date: '2025-02-02',
          type: 'conversion',
          partner: 'Banque Etika',
          amount: 9500,
          tokens: 10000,
          status: 'completed'
        },
        {
          id: 'INV-12342',
          date: '2025-01-28',
          type: 'paiement',
          partner: 'Tech Solutions',
          amount: 8750,
          tokens: 875,
          status: 'completed'
        },
        {
          id: 'INV-12341',
          date: '2025-01-25',
          type: 'paiement',
          partner: 'Green Services',
          amount: 6320,
          tokens: 632,
          status: 'completed'
        }
      ]);
      
      setLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Tableau de bord fournisseur
      </Typography>
      
      {/* Cartes statistiques principales */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Revenu total"
            value={`${stats.totalRevenue.toLocaleString()} €`}
            icon={<TrendingUpIcon color="primary" fontSize="large" />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Paiements en attente"
            value={`${stats.pendingPayments.toLocaleString()} €`}
            icon={<ReceiptIcon color="primary" fontSize="large" />}
            color="#f57c00"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Solde de tokens"
            value={stats.tokensBalance.toLocaleString()}
            icon={<TokenIcon color="primary" fontSize="large" />}
            color="#388e3c"
            tooltip={`Valeur: ${stats.tokensValue.toLocaleString()} €`}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <DashboardCard
            title="Partenaires commerciaux"
            value={stats.partnersCount}
            icon={<AssignmentIcon color="primary" fontSize="large" />}
            color="#7b1fa2"
          />
        </Grid>
      </Grid>
      
      {/* Graphique de revenus */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Évolution du revenu
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box height={300}>
              <SimpleLineChart 
                data={revenueData}
                xAxisDataKey="month"
                series={[
                  { dataKey: "revenue", name: "Revenu (€)", color: "#1976d2" },
                  { dataKey: "tokens", name: "Tokens reçus", color: "#388e3c" }
                ]}
              />
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Statut du système
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <BlockchainStatus />
            
            <Box mt={3}>
              <Typography variant="subtitle1" gutterBottom>
                Actions rapides
              </Typography>
              <List>
                <ListItem button onClick={() => navigate('/tokens')}>
                  <ListItemIcon>
                    <TokenIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Gérer mes tokens" />
                </ListItem>
                <ListItem button onClick={() => navigate('/finances')}>
                  <ListItemIcon>
                    <AccountIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary="Tableau de trésorerie" />
                </ListItem>
              </List>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Transactions récentes */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Dernières transactions
          </Typography>
          <Button variant="text" onClick={() => navigate('/transactions')}>
            Voir toutes les transactions
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Référence</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Partenaire</TableCell>
                <TableCell align="right">Montant (€)</TableCell>
                <TableCell align="right">Tokens</TableCell>
                <TableCell>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.id}</TableCell>
                  <TableCell>{transaction.date}</TableCell>
                  <TableCell>{transaction.type}</TableCell>
                  <TableCell>{transaction.partner}</TableCell>
                  <TableCell align="right">{transaction.amount.toLocaleString()}</TableCell>
                  <TableCell align="right">{transaction.tokens.toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip
                      label={transaction.status}
                      color={transaction.status === 'completed' ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* Informations sur l'écosystème */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Votre participation à l'écosystème Etika
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6">93%</Typography>
                </Box>
                <Typography variant="body2" color="textSecondary">
                  Taux de conformité aux standards Etika
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6">47</Typography>
                </Box>
                <Typography variant="body2" color="textSecondary">
                  Partenaires dans l'écosystème
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <TokenIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">75,840</Typography>
                </Box>
                <Typography variant="body2" color="textSecondary">
                  Total des tokens en circulation
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default SupplierDashboard;

// Conclusion de l'intégration du portail fournisseurs dans la plateforme Etika

/**
 * RÉSUMÉ DE L'IMPLÉMENTATION
 * 
 * Le portail fournisseurs a été conçu pour s'intégrer parfaitement dans la plateforme centrale Etika.
 * Il se concentre sur la gestion des flux financiers et des tokens, sans gérer les stocks ou marchandises.
 * 
 * Points clés de l'implémentation:
 * 
 * 1. Architecture adaptative
 *    - Interface qui s'adapte aux différents types de commerçants et fournisseurs
 *    - Modèle de données flexible pour tous les types d'acteurs
 *    - Navigation contextuelle selon le profil d'utilisateur
 * 
 * 2. Gestion des tokens et flux financiers
 *    - Interface complète de gestion des tokens
 *    - Outils d'envoi et de conversion
 *    - Tableaux de bord financiers
 *    - Intégration avec la blockchain Etika
 * 
 * 3. Intégration avec les systèmes externes
 *    - Options d'intégration diverses selon le type de commerce
 *    - APIs et webhooks pour l'interconnexion
 *    - Support pour e-commerce et points de vente physiques
 * 
 * 4. Sécurité et conformité
 *    - Authentification et autorisation robustes
 *    - Traçabilité des transactions
 *    - Gestion des limites et vérifications
 * 
 * Cette implémentation forme un espace réservé complet pour les fournisseurs
 * au sein de la plateforme Etika, leur permettant de participer pleinement
 * à l'écosystème sans avoir à gérer leurs stocks ou marchandises dans le système.
 */
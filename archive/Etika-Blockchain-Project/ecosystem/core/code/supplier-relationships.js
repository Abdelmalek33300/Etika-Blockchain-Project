// src/features/suppliers/components/SupplierRelationshipManager.tsx
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  Divider,
  Grid,
  Card,
  CardContent,
  CardActions,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Slider,
  InputAdornment,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  Pause as PauseIcon,
  PlayArrow as ResumeIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  LocalShipping as SupplierIcon,
  AttachMoney as PaymentIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Services
import { 
  useGetSupplierRelationships, 
  useRegisterRelationship,
  useUpdateFactoringConditions,
  useSuspendRelationship,
  useReactivateRelationship,
  useTerminateRelationship
} from 'services/api/suppliers';

// Types
interface SupplierRelationship {
  id: string;
  supplier: {
    id: string;
    name: string;
    category: string;
  };
  status: 'pending' | 'active' | 'suspended' | 'terminated';
  factoringConditions: {
    immediatePaymentPercent: number;
    remainingPaymentDelay: number;
    interestRate: number;
  };
  createdAt: string;
  paymentHistory: {
    amount: number;
    timestamp: string;
  }[];
}

// Schema de validation pour le formulaire de relation
const relationshipSchema = z.object({
  supplierId: z.string().nonempty('Un fournisseur est requis'),
  category: z.string().nonempty('Une catégorie est requise'),
  immediatePaymentPercent: z.number().min(50, 'Minimum 50%').max(100, 'Maximum 100%'),
  remainingPaymentDelay: z.number().min(1, 'Minimum 1 jour').max(90, 'Maximum 90 jours'),
  interestRate: z.number().min(0, 'Minimum 0%').max(30, 'Maximum 30%'),
});

type RelationshipFormData = z.infer<typeof relationshipSchema>;

// Composant principal
const SupplierRelationshipManager: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedRelationship, setSelectedRelationship] = useState<SupplierRelationship | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  // Récupération des données via React Query
  const { data: relationships, isLoading } = useGetSupplierRelationships();
  
  // Mutations
  const registerMutation = useRegisterRelationship();
  const updateConditionsMutation = useUpdateFactoringConditions();
  const suspendMutation = useSuspendRelationship();
  const reactivateMutation = useReactivateRelationship();
  const terminateMutation = useTerminateRelationship();

  // Configuration du formulaire pour nouvelle relation
  const { control: newControl, handleSubmit: handleNewSubmit, reset: resetNewForm, formState: { errors: newErrors } } = useForm<RelationshipFormData>({
    resolver: zodResolver(relationshipSchema),
    defaultValues: {
      immediatePaymentPercent: 80,
      remainingPaymentDelay: 30,
      interestRate: 5
    }
  });

  // Configuration du formulaire pour édition de relation
  const { control: editControl, handleSubmit: handleEditSubmit, reset: resetEditForm, formState: { errors: editErrors } } = useForm<RelationshipFormData>({
    resolver: zodResolver(relationshipSchema),
    defaultValues: {
      immediatePaymentPercent: 80,
      remainingPaymentDelay: 30,
      interestRate: 5
    }
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenNewDialog = () => {
    resetNewForm({
      supplierId: '',
      category: '',
      immediatePaymentPercent: 80,
      remainingPaymentDelay: 30,
      interestRate: 5
    });
    setIsNewDialogOpen(true);
  };

  const handleOpenEditDialog = (relationship: SupplierRelationship) => {
    setSelectedRelationship(relationship);
    resetEditForm({
      supplierId: relationship.supplier.id,
      category: relationship.supplier.category,
      immediatePaymentPercent: relationship.factoringConditions.immediatePaymentPercent,
      remainingPaymentDelay: relationship.factoringConditions.remainingPaymentDelay,
      interestRate: relationship.factoringConditions.interestRate
    });
    setIsEditDialogOpen(true);
  };

  const handleOpenDeleteDialog = (relationship: SupplierRelationship) => {
    setSelectedRelationship(relationship);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenHistoryDialog = (relationship: SupplierRelationship) => {
    setSelectedRelationship(relationship);
    setIsHistoryDialogOpen(true);
  };

  const handleRegisterRelationship = async (data: RelationshipFormData) => {
    try {
      await registerMutation.mutateAsync({
        supplierId: data.supplierId,
        category: data.category,
        immediatePaymentPercent: data.immediatePaymentPercent,
        remainingPaymentDelay: data.remainingPaymentDelay,
        interestRate: data.interestRate
      });
      setIsNewDialogOpen(false);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de la relation:", error);
    }
  };

  const handleUpdateFactoringConditions = async (data: RelationshipFormData) => {
    if (!selectedRelationship) return;
    
    try {
      await updateConditionsMutation.mutateAsync({
        supplierId: selectedRelationship.supplier.id,
        immediatePaymentPercent: data.immediatePaymentPercent,
        remainingPaymentDelay: data.remainingPaymentDelay,
        interestRate: data.interestRate
      });
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Erreur lors de la mise à jour des conditions:", error);
    }
  };

  const handleSuspendRelationship = async () => {
    if (!selectedRelationship) return;
    
    try {
      await suspendMutation.mutateAsync({
        supplierId: selectedRelationship.supplier.id
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Erreur lors de la suspension de la relation:", error);
    }
  };

  const handleReactivateRelationship = async (relationshipId: string) => {
    try {
      await reactivateMutation.mutateAsync({
        supplierId: relationshipId
      });
    } catch (error) {
      console.error("Erreur lors de la réactivation de la relation:", error);
    }
  };

  const handleTerminateRelationship = async () => {
    if (!selectedRelationship) return;
    
    try {
      await terminateMutation.mutateAsync({
        supplierId: selectedRelationship.supplier.id
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Erreur lors de la terminaison de la relation:", error);
    }
  };

  const filteredRelationships = relationships?.filter(relationship => {
    if (tabValue === 0) return true; // Tous
    if (tabValue === 1) return relationship.status === 'active';
    if (tabValue === 2) return relationship.status === 'pending';
    if (tabValue === 3) return relationship.status === 'suspended' || relationship.status === 'terminated';
    return false;
  });

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'active':
        return <Chip label="Actif" color="success" size="small" />;
      case 'pending':
        return <Chip label="En attente" color="warning" size="small" />;
      case 'suspended':
        return <Chip label="Suspendu" color="error" size="small" />;
      case 'terminated':
        return <Chip label="Terminé" color="default" size="small" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h1">
          Relations Fournisseurs
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleOpenNewDialog}
        >
          Nouvelle relation
        </Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="supplier relationships tabs">
          <Tab label="Tous" />
          <Tab label="Actifs" />
          <Tab label="En attente" />
          <Tab label="Suspendus/Terminés" />
        </Tabs>
      </Box>

      {filteredRelationships && filteredRelationships.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Aucune relation fournisseur trouvée
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            sx={{ mt: 2 }}
            onClick={handleOpenNewDialog}
          >
            Ajouter un fournisseur
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredRelationships?.map((relationship) => (
            <Grid item xs={12} md={6} lg={4} key={relationship.id}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="h6" component="div">
                      {relationship.supplier.name}
                    </Typography>
                    {getStatusChip(relationship.status)}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Catégorie: {relationship.supplier.category}
                  </Typography>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Typography variant="subtitle2">
                    Conditions d'affacturage:
                  </Typography>
                  
                  <Grid container spacing={1} sx={{ mt: 0.5 }}>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Paiement immédiat:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {relationship.factoringConditions.immediatePaymentPercent}%
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Délai restant:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {relationship.factoringConditions.remainingPaymentDelay} jours
                      </Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        Taux d'intérêt:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {relationship.factoringConditions.interestRate}%
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
                
                <CardActions>
                  <Tooltip title="Modifier les conditions">
                    <IconButton 
                      size="small" 
                      color="primary"
                      onClick={() => handleOpenEditDialog(relationship)}
                      disabled={relationship.status !== 'active'}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  {relationship.status === 'active' && (
                    <Tooltip title="Suspendre">
                      <IconButton 
                        size="small" 
                        color="warning"
                        onClick={() => handleOpenDeleteDialog(relationship)}
                      >
                        <PauseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  
                  {relationship.status === 'suspended' && (
                    <Tooltip title="Réactiver">
                      <IconButton 
                        size="small" 
                        color="success"
                        onClick={() => handleReactivateRelationship(relationship.supplier.id)}
                      >
                        <ResumeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  
                  <Tooltip title="Historique des paiements">
                    <IconButton 
                      size="small" 
                      onClick={() => handleOpenHistoryDialog(relationship)}
                    >
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  {relationship.status === 'pending' && (
                    <Box flexGrow={1} display="flex" justifyContent="flex-end">
                      <Chip 
                        label="En attente de confirmation" 
                        size="small" 
                        color="warning"
                      />
                    </Box>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog pour créer une nouvelle relation */}
      <Dialog 
        open={isNewDialogOpen} 
        onClose={() => setIsNewDialogOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Créer une nouvelle relation fournisseur</DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            Établissez une relation commerciale avec un nouveau fournisseur et définissez
            les conditions d'affacturage qui s'appliqueront.
          </DialogContentText>
          
          <Grid container spacing={3} component="form" noValidate>
            <Grid item xs={12} md={6}>
              <Controller
                name="supplierId"
                control={newControl}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Fournisseur"
                    select
                    fullWidth
                    margin="normal"
                    error={!!newErrors.supplierId}
                    helperText={newErrors.supplierId?.message}
                    SelectProps={{
                      native: true,
                    }}
                  >
                    <option value=""></option>
                    <option value="supplier-1">Fournisseur Alimentaire SA</option>
                    <option value="supplier-2">Électronique Distrib</option>
                    <option value="supplier-3">Textile Global SRL</option>
                  </TextField>
                )}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Controller
                name="category"
                control={newControl}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Catégorie"
                    select
                    fullWidth
                    margin="normal"
                    error={!!newErrors.category}
                    helperText={newErrors.category?.message}
                    SelectProps={{
                      native: true,
                    }}
                  >
                    <option value=""></option>
                    <option value="alimentation">Alimentation</option>
                    <option value="electronique">Électronique</option>
                    <option value="textile">Textile</option>
                    <option value="services">Services</option>
                  </TextField>
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Conditions d'affacturage
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography id="immediate-payment-slider-label" gutterBottom>
                Paiement immédiat (%)
              </Typography>
              <Controller
                name="immediatePaymentPercent"
                control={newControl}
                render={({ field }) => (
                  <>
                    <Slider
                      {...field}
                      aria-labelledby="immediate-payment-slider-label"
                      valueLabelDisplay="auto"
                      step={5}
                      marks
                      min={50}
                      max={100}
                      onChange={(_, value) => field.onChange(value)}
                    />
                    <TextField
                      value={field.value}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      error={!!newErrors.immediatePaymentPercent}
                      helperText={newErrors.immediatePaymentPercent?.message}
                    />
                  </>
                )}
              />
              <Typography variant="caption" color="text.secondary">
                Pourcentage du montant payé immédiatement au fournisseur lors d'une vente
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography id="payment-delay-slider-label" gutterBottom>
                Délai de paiement restant (jours)
              </Typography>
              <Controller
                name="remainingPaymentDelay"
                control={newControl}
                render={({ field }) => (
                  <>
                    <Slider
                      {...field}
                      aria-labelledby="payment-delay-slider-label"
                      valueLabelDisplay="auto"
                      step={5}
                      marks
                      min={5}
                      max={90}
                      onChange={(_, value) => field.onChange(value)}
                    />
                    <TextField
                      value={field.value}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">jours</InputAdornment>,
                      }}
                      error={!!newErrors.remainingPaymentDelay}
                      helperText={newErrors.remainingPaymentDelay?.message}
                    />
                  </>
                )}
              />
              <Typography variant="caption" color="text.secondary">
                Délai de paiement pour le montant restant
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography id="interest-rate-slider-label" gutterBottom>
                Taux d'intérêt (%)
              </Typography>
              <Controller
                name="interestRate"
                control={newControl}
                render={({ field }) => (
                  <>
                    <Slider
                      {...field}
                      aria-labelledby="interest-rate-slider-label"
                      valueLabelDisplay="auto"
                      step={0.5}
                      marks
                      min={0}
                      max={10}
                      onChange={(_, value) => field.onChange(value)}
                    />
                    <TextField
                      value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      error={!!newErrors.interestRate}
                      helperText={newErrors.interestRate?.message}
                    />
                  </>
                )}
              />
              <Typography variant="caption" color="text.secondary">
                Taux d'intérêt appliqué au montant restant
              </Typography>
            </Grid>
          </Grid>
          
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              Une fois créée, la relation devra être confirmée par le fournisseur avant d'être active.
              Le fournisseur recevra une notification automatique.
            </Typography>
          </Alert>
          
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsNewDialogOpen(false)}>
            Annuler
          </Button>
          <Button 
            variant="contained" 
            onClick={handleNewSubmit(handleRegisterRelationship)}
            disabled={registerMutation.isLoading}
            startIcon={registerMutation.isLoading ? <CircularProgress size={16} /> : <LinkIcon />}
          >
            Créer la relation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour éditer les conditions d'affacturage */}
      <Dialog 
        open={isEditDialogOpen} 
        onClose={() => setIsEditDialogOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Modifier les conditions d'affacturage</DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            Mettez à jour les conditions d'affacturage pour le fournisseur {selectedRelationship?.supplier.name}.
            Les nouvelles conditions seront appliquées aux prochaines transactions.
          </DialogContentText>
          
          <Grid container spacing={3} component="form" noValidate>
            <Grid item xs={12} md={4}>
              <Typography id="edit-immediate-payment-slider-label" gutterBottom>
                Paiement immédiat (%)
              </Typography>
              <Controller
                name="immediatePaymentPercent"
                control={editControl}
                render={({ field }) => (
                  <>
                    <Slider
                      {...field}
                      aria-labelledby="edit-immediate-payment-slider-label"
                      valueLabelDisplay="auto"
                      step={5}
                      marks
                      min={50}
                      max={100}
                      onChange={(_, value) => field.onChange(value)}
                    />
                    <TextField
                      value={field.value}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      error={!!editErrors.immediatePaymentPercent}
                      helperText={editErrors.immediatePaymentPercent?.message}
                    />
                  </>
                )}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography id="edit-payment-delay-slider-label" gutterBottom>
                Délai de paiement restant (jours)
              </Typography>
              <Controller
                name="remainingPaymentDelay"
                control={editControl}
                render={({ field }) => (
                  <>
                    <Slider
                      {...field}
                      aria-labelledby="edit-payment-delay-slider-label"
                      valueLabelDisplay="auto"
                      step={5}
                      marks
                      min={5}
                      max={90}
                      onChange={(_, value) => field.onChange(value)}
                    />
                    <TextField
                      value={field.value}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">jours</InputAdornment>,
                      }}
                      error={!!editErrors.remainingPaymentDelay}
                      helperText={editErrors.remainingPaymentDelay?.message}
                    />
                  </>
                )}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography id="edit-interest-rate-slider-label" gutterBottom>
                Taux d'intérêt (%)
              </Typography>
              <Controller
                name="interestRate"
                control={editControl}
                render={({ field }) => (
                  <>
                    <Slider
                      {...field}
                      aria-labelledby="edit-interest-rate-slider-label"
                      valueLabelDisplay="auto"
                      step={0.5}
                      marks
                      min={0}
                      max={10}
                      onChange={(_, value) => field.onChange(value)}
                    />
                    <TextField
                      value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      error={!!editErrors.interestRate}
                      helperText={editErrors.interestRate?.message}
                    />
                  </>
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>
            Annuler
          </Button>
          <Button 
            variant="contained" 
            onClick={handleEditSubmit(handleUpdateFactoringConditions)}
            disabled={updateConditionsMutation.isLoading}
            startIcon={updateConditionsMutation.isLoading ? <CircularProgress size={16} /> : <EditIcon />}
          >
            Mettre à jour
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour suspendre/terminer une relation */}
      <Dialog 
        open={isDeleteDialogOpen} 
        onClose={() => setIsDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Gérer la relation fournisseur</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Que souhaitez-vous faire avec la relation fournisseur avec {selectedRelationship?.supplier.name} ?
          </DialogContentText>
          
          <Box sx={{ mt: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              color="warning"
              startIcon={<PauseIcon />}
              onClick={handleSuspendRelationship}
              disabled={suspendMutation.isLoading}
              sx={{ mb: 2 }}
            >
              Suspendre temporairement
              {suspendMutation.isLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
            </Button>
            
            <Alert severity="info" sx={{ mb: 2 }}>
              La suspension temporaire arrête les paiements d'affacturage mais conserve l'historique et les paramètres.
              La relation peut être réactivée ultérieurement.
            </Alert>
            
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleTerminateRelationship}
              disabled={terminateMutation.isLoading}
            >
              Mettre fin définitivement
              {terminateMutation.isLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
            </Button>
            
            <Alert severity="warning" sx={{ mt: 2 }}>
              Mettre fin à la relation est définitif. Vous devrez créer une nouvelle relation si besoin.
              L'historique des transactions sera conservé.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDeleteDialogOpen(false)}>
            Annuler
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog pour l'historique des paiements */}
      <Dialog 
        open={isHistoryDialogOpen} 
        onClose={() => setIsHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Historique des paiements - {selectedRelationship?.supplier.name}
        </DialogTitle>
        <DialogContent>
          {selectedRelationship?.paymentHistory && selectedRelationship.paymentHistory.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Montant</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedRelationship.paymentHistory.map((payment, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {new Date(payment.timestamp).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell align="right">
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'EUR'
                        }).format(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={index % 2 === 0 ? "Paiement immédiat" : "Paiement restant"} 
                          size="small"
                          color={index % 2 === 0 ? "success" : "info"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                Aucun historique de paiement disponible
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsHistoryDialogOpen(false)}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default SupplierRelationshipManager;
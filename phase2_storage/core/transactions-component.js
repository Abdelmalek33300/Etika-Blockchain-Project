// src/features/transactions/components/TransactionCreator.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Stepper, 
  Step, 
  StepLabel, 
  Button, 
  Typography, 
  Paper, 
  Grid,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { 
  ShoppingBag as ShoppingBagIcon,
  QrCode2 as QrCodeIcon,
  Receipt as ReceiptIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import QRCode from 'react-qr-code';

// Services
import { useCreateTransaction } from 'services/api/transactions';
import { useGetSupplierRelationships } from 'services/api/suppliers';
import { useGetConsumers } from 'services/api/consumers';

// Validation schema
const transactionSchema = z.object({
  consumerId: z.string().nonempty('Un consommateur est requis'),
  standardAmount: z.number().positive('Le montant doit être positif'),
  tokensExchanged: z.number().min(0, 'Les tokens doivent être positifs ou nuls'),
  suppliers: z.array(z.string()).optional(),
  receiptNumber: z.string().optional(),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

// Étapes du processus de création
const steps = ['Détails de la transaction', 'Validation QR code', 'Confirmation'];

const TransactionCreator: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  
  // Récupération des données via React Query
  const { data: suppliers, isLoading: isLoadingSuppliers } = useGetSupplierRelationships({ status: 'active' });
  const { data: consumers, isLoading: isLoadingConsumers } = useGetConsumers();
  
  // Mutation pour créer une transaction
  const createTransactionMutation = useCreateTransaction();
  
  // Configuration du formulaire
  const { control, handleSubmit, formState: { errors }, watch } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      standardAmount: 0,
      tokensExchanged: 0,
      suppliers: [],
    }
  });
  
  // Valeur actuelle du montant pour calculer les tokens
  const watchedAmount = watch('standardAmount', 0);
  
  // Calcule une estimation des tokens à échanger (5% du montant pour cet exemple)
  const estimatedTokens = (watchedAmount || 0) * 0.05;
  
  const handleNext = () => {
    if (activeStep === 0) {
      handleSubmit(onSubmitTransactionDetails)();
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };
  
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  
  const onSubmitTransactionDetails = async (data: TransactionFormData) => {
    try {
      // Création de la transaction
      const result = await createTransactionMutation.mutateAsync({
        consumer: data.consumerId,
        merchant: "current-merchant-id", // Dans une app réelle, ceci viendrait de l'authentification
        suppliers: data.suppliers || [],
        standardAmount: data.standardAmount,
        tokensExchanged: data.tokensExchanged || estimatedTokens,
        receiptHash: data.receiptNumber || "generated-hash", // Dans une app réelle, un hash serait généré
        notes: data.notes,
      });
      
      // Stockage des informations pour les étapes suivantes
      setTransactionId(result.transactionId);
      
      // Création des données QR code
      const qrCodeData = JSON.stringify({
        transactionId: result.transactionId,
        merchant: "current-merchant-name",
        amount: data.standardAmount,
        timestamp: new Date().toISOString(),
        type: "pop-transaction"
      });
      
      setQrData(qrCodeData);
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    } catch (error) {
      console.error("Erreur lors de la création de la transaction:", error);
      // Gérer l'erreur...
    }
  };
  
  const isLoading = isLoadingSuppliers || isLoadingConsumers || createTransactionMutation.isLoading;

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" component="h1" gutterBottom>
        Créer une nouvelle transaction
      </Typography>
      
      <Stepper activeStep={activeStep} sx={{ mt: 3, mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}
      
      {!isLoading && (
        <>
          {activeStep === 0 && (
            <Box component="form" noValidate sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="consumerId"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.consumerId}>
                        <InputLabel id="consumer-select-label">Consommateur</InputLabel>
                        <Select
                          {...field}
                          labelId="consumer-select-label"
                          label="Consommateur"
                        >
                          {(consumers || []).map((consumer) => (
                            <MenuItem key={consumer.id} value={consumer.id}>
                              {consumer.name} ({consumer.phoneNumber})
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.consumerId && (
                          <Typography color="error" variant="caption">
                            {errors.consumerId.message}
                          </Typography>
                        )}
                      </FormControl>
                    )}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Controller
                    name="standardAmount"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Montant (€)"
                        type="number"
                        fullWidth
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        error={!!errors.standardAmount}
                        helperText={errors.standardAmount?.message}
                        InputProps={{
                          startAdornment: <Typography sx={{ mr: 1 }}>€</Typography>,
                        }}
                      />
                    )}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Controller
                    name="tokensExchanged"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Tokens échangés"
                        type="number"
                        fullWidth
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        error={!!errors.tokensExchanged}
                        helperText={
                          errors.tokensExchanged?.message || 
                          `Suggestion: ${estimatedTokens.toFixed(2)} tokens (5% du montant)`
                        }
                      />
                    )}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Controller
                    name="receiptNumber"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Numéro de ticket de caisse"
                        fullWidth
                        placeholder="Optionnel"
                      />
                    )}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Controller
                    name="suppliers"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel id="suppliers-select-label">Fournisseurs</InputLabel>
                        <Select
                          {...field}
                          labelId="suppliers-select-label"
                          label="Fournisseurs"
                          multiple
                          value={field.value || []}
                        >
                          {(suppliers || []).map((supplier) => (
                            <MenuItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Controller
                    name="notes"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Notes"
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Informations complémentaires sur la transaction (optionnel)"
                      />
                    )}
                  />
                </Grid>
              </Grid>
              
              <Alert severity="info" sx={{ mt: 3 }}>
                Cette transaction générera une épargne de {(watchedAmount * 0.05).toFixed(2)}€ pour le consommateur.
              </Alert>
            </Box>
          )}
          
          {activeStep === 1 && qrData && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
              <Typography variant="h6" gutterBottom>
                QR Code pour validation PoP
              </Typography>
              
              <Paper elevation={3} sx={{ p: 3, mb: 3, backgroundColor: 'white' }}>
                <QRCode 
                  value={qrData} 
                  size={256}
                />
              </Paper>
              
              <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 500 }}>
                Présentez ce QR code au consommateur et aux fournisseurs pour qu'ils puissent le scanner et
                valider la transaction via le mécanisme de consensus PoP (Proof of Purchase).
              </Typography>
              
              <Alert severity="warning" sx={{ mt: 3, width: '100%' }}>
                La transaction ne sera finalisée qu'après validation par toutes les parties concernées!
              </Alert>
            </Box>
          )}
          
          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
              <CheckIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
              
              <Typography variant="h6" gutterBottom>
                Transaction créée avec succès!
              </Typography>
              
              <Typography variant="body1" align="center" sx={{ mb: 3 }}>
                ID de la transaction: <strong>{transactionId}</strong>
              </Typography>
              
              <Alert severity="info" sx={{ width: '100%', mb: 3 }}>
                La transaction est maintenant en attente de validation par les participants.
                Vous pouvez suivre son statut dans la section "Transactions".
              </Alert>
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  startIcon={<ReceiptIcon />}
                  href={`/transactions/${transactionId}`}
                >
                  Voir les détails
                </Button>
                <Button 
                  variant="outlined" 
                  startIcon={<QrCodeIcon />}
                  onClick={() => setActiveStep(1)}
                >
                  Afficher QR code
                </Button>
              </Box>
            </Box>
          )}
          
          <Divider sx={{ my: 3 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              disabled={activeStep === 0 || activeStep === steps.length - 1}
              onClick={handleBack}
            >
              Retour
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={activeStep === steps.length - 1 || createTransactionMutation.isLoading}
              endIcon={activeStep === 0 ? <ShoppingBagIcon /> : <QrCodeIcon />}
            >
              {activeStep === steps.length - 2 ? 'Terminer' : 'Suivant'}
              {createTransactionMutation.isLoading && <CircularProgress size={24} sx={{ ml: 1 }} />}
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default TransactionCreator;

// src/features/transactions/components/TransactionList.tsx
import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Typography,
  Skeleton,
  Tooltip
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  CheckCircle as ValidatedIcon,
  HourglassEmpty as PendingIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Utilitaires
import { formatCurrency } from 'utils/formatters';

// Types
interface Transaction {
  id: string;
  consumer: {
    id: string;
    name: string;
  };
  standardAmount: number;
  tokensExchanged: number;
  timestamp: string;
  status: 'pending' | 'validated' | 'failed';
  validationCount: number;
  requiredValidations: number;
}

interface TransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
  compact?: boolean;
  onViewDetails?: (id: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  isLoading = false,
  compact = false,
  onViewDetails
}) => {
  const getStatusChip = (status: string, validationCount: number, requiredValidations: number) => {
    switch (status) {
      case 'validated':
        return (
          <Chip 
            icon={<ValidatedIcon />} 
            label="Validé" 
            color="success" 
            size={compact ? "small" : "medium"} 
          />
        );
      case 'pending':
        return (
          <Tooltip title={`${validationCount}/${requiredValidations} validations`}>
            <Chip 
              icon={<PendingIcon />} 
              label={compact ? "En attente" : `${validationCount}/${requiredValidations} validations`} 
              color="warning" 
              size={compact ? "small" : "medium"} 
            />
          </Tooltip>
        );
      case 'failed':
        return (
          <Chip 
            icon={<ErrorIcon />} 
            label="Échoué" 
            color="error" 
            size={compact ? "small" : "medium"} 
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <TableContainer component={Paper} elevation={0}>
        <Table size={compact ? "small" : "medium"}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Consommateur</TableCell>
              <TableCell align="right">Montant</TableCell>
              <TableCell align="center">Statut</TableCell>
              {!compact && <TableCell align="right">Tokens</TableCell>}
              {!compact && <TableCell>Date</TableCell>}
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...Array(compact ? 3 : 5)].map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton width={60} /></TableCell>
                <TableCell><Skeleton width={120} /></TableCell>
                <TableCell align="right"><Skeleton width={80} /></TableCell>
                <TableCell align="center"><Skeleton width={100} /></TableCell>
                {!compact && <TableCell align="right"><Skeleton width={60} /></TableCell>}
                {!compact && <TableCell><Skeleton width={100} /></TableCell>}
                <TableCell align="center"><Skeleton width={40} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  if (transactions.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Aucune transaction trouvée
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table size={compact ? "small" : "medium"}>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Consommateur</TableCell>
            <TableCell align="right">Montant</TableCell>
            <TableCell align="center">Statut</TableCell>
            {!compact && <TableCell align="right">Tokens</TableCell>}
            {!compact && <TableCell>Date</TableCell>}
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {transaction.id.substring(0, 8)}...
                </Typography>
              </TableCell>
              <TableCell>{transaction.consumer.name}</TableCell>
              <TableCell align="right">{formatCurrency(transaction.standardAmount)}</TableCell>
              <TableCell align="center">
                {getStatusChip(transaction.status, transaction.validationCount, transaction.requiredValidations)}
              </TableCell>
              {!compact && <TableCell align="right">{transaction.tokensExchanged.toFixed(2)}</TableCell>}
              {!compact && (
                <TableCell>
                  {format(new Date(transaction.timestamp), 'dd MMM yyyy, HH:mm', { locale: fr })}
                </TableCell>
              )}
              <TableCell align="center">
                <IconButton 
                  size="small" 
                  color="primary"
                  onClick={() => onViewDetails && onViewDetails(transaction.id)}
                  href={`/transactions/${transaction.id}`}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TransactionList;
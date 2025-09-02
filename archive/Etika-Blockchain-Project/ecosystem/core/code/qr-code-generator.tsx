// src/components/qrcode/PopQRCodeGenerator.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Divider,
  Alert,
  TextField,
  InputAdornment,
  Grid,
  Tooltip,
  IconButton,
  Snackbar
} from '@mui/material';
import {
  QrCode2 as QrCodeIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import QRCode from 'react-qr-code';

// Services et utilitaires
import { generatePoPQRCode, checkPoPValidationStatus } from 'services/blockchain/pop';
import { useGetTransactionById } from 'services/api/transactions';

interface PopQRCodeGeneratorProps {
  transactionId: string;
  merchantName?: string;
  consumerName?: string;
  amount?: number;
  onValidationComplete?: () => void;
}

const PopQRCodeGenerator: React.FC<PopQRCodeGeneratorProps> = ({
  transactionId,
  merchantName,
  consumerName,
  amount,
  onValidationComplete
}) => {
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrSize, setQrSize] = useState<number>(256);
  const [validationStatus, setValidationStatus] = useState<{
    isValidated: boolean;
    validations: { actor: string; timestamp: string }[];
    requiredValidations: number;
    status: string;
  } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);
  const [statusTimer, setStatusTimer] = useState<NodeJS.Timeout | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');

  // Récupérer les détails de la transaction si non fournis en props
  const { data: transactionData, isLoading: isTransactionLoading } = useGetTransactionById(
    !merchantName || !consumerName || !amount ? transactionId : ''
  );

  // Générer le QR code au chargement du composant
  useEffect(() => {
    generateQRCode();
    
    // Démarrer la vérification du statut
    checkValidationStatus();
    
    // Vérifier le statut toutes les 5 secondes
    const timer = setInterval(checkValidationStatus, 5000);
    setStatusTimer(timer);
    
    // Nettoyer l'intervalle à la destruction du composant
    return () => {
      if (statusTimer) {
        clearInterval(statusTimer);
      }
    };

export default PopQRCodeGenerator;
  }, [transactionId, merchantName, consumerName, amount, transactionData]);

  // Arrêter la vérification automatique lorsque la validation est complète
  useEffect(() => {
    if (validationStatus?.isValidated && statusTimer) {
      clearInterval(statusTimer);
      setStatusTimer(null);
      
      // Déclencher le callback si fourni
      if (onValidationComplete) {
        onValidationComplete();
      }
    }
  }, [validationStatus?.isValidated, statusTimer, onValidationComplete]);

  const generateQRCode = () => {
    // Utiliser les données fournies en props ou celles récupérées de l'API
    const merchant = merchantName || transactionData?.merchant?.name || 'Commerçant';
    const consumer = consumerName || transactionData?.consumer?.name || 'Consommateur';
    const transactionAmount = amount || transactionData?.standardAmount || 0;
    
    // Générer les données du QR code
    const qrData = generatePoPQRCode({
      transactionId,
      merchant,
      consumer,
      amount: transactionAmount,
      timestamp: new Date().toISOString()
    });
    
    setQrCodeData(qrData);
  };

  const checkValidationStatus = async () => {
    setCheckingStatus(true);
    
    try {
      const status = await checkPoPValidationStatus(transactionId);
      setValidationStatus(status);
      
      // Si le statut a changé vers validé, afficher un message
      if (status.isValidated && validationStatus && !validationStatus.isValidated) {
        setSnackbarMessage('Transaction validée avec succès !');
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du statut:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleRefresh = () => {
    generateQRCode();
    checkValidationStatus();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const qrCodeElement = document.getElementById('pop-qrcode');
      if (qrCodeElement) {
        printWindow.document.write(`
          <html>
            <head>
              <title>QR Code PoP - Transaction ${transactionId}</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                .container { max-width: 500px; margin: 0 auto; }
                .header { margin-bottom: 20px; }
                .footer { margin-top: 20px; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Code QR pour validation PoP</h1>
                  <p>Transaction: ${transactionId.substring(0, 8)}...</p>
                  <p>Montant: ${amount || transactionData?.standardAmount || 0}€</p>
                </div>
                ${qrCodeElement.outerHTML}
                <div class="footer">
                  <p>Scannez ce QR code avec l'application Étika pour valider la transaction</p>
                  <p>Système Étika - Proof of Purchase</p>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleShare = async () => {
    if (qrCodeData && navigator.share) {
      try {
        await navigator.share({
          title: 'QR Code PoP Étika',
          text: `Validation de transaction PoP pour ${transactionId.substring(0, 8)}...`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Erreur lors du partage:', error);
      }
    } else {
      setSnackbarMessage('Partage non supporté par ce navigateur');
      setSnackbarOpen(true);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(transactionId);
    setSnackbarMessage('ID de transaction copié !');
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const renderValidationStatus = () => {
    if (!validationStatus) return null;
    
    const { isValidated, validations, requiredValidations, status } = validationStatus;
    
    if (isValidated) {
      return (
        <Alert severity="success" sx={{ mt: 2 }} icon={<QrCodeIcon />}>
          <Typography variant="subtitle2" gutterBottom>
            Transaction validée avec succès!
          </Typography>
          <Typography variant="body2">
            Toutes les validations requises ont été reçues. La transaction est maintenant confirmée sur la blockchain.
          </Typography>
        </Alert>
      );
    }
    
    if (status === 'pending') {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            En attente de validation: {validations.length} / {requiredValidations}
          </Typography>
          <Typography variant="body2">
            Présentez ce QR code à tous les participants pour qu'ils le scannent avec leur application Étika.
          </Typography>
          {validations.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" gutterBottom>
                Participants ayant déjà validé:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {validations.map((v, index) => (
                  <Typography key={index} variant="caption" component="li">
                    {v.actor} ({new Date(v.timestamp).toLocaleTimeString()})
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </Alert>
      );
    }
    
    if (status === 'error' || status === 'failed') {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Erreur de validation
          </Typography>
          <Typography variant="body2">
            Une erreur s'est produite lors de la validation. Veuillez réessayer ou contacter le support.
          </Typography>
        </Alert>
      );
    }
    
    return null;
  };

  if (isTransactionLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" component="h2">
          QR Code pour validation PoP
        </Typography>
        <Tooltip title="Les codes QR permettent de valider les transactions selon le mécanisme Proof of Purchase">
          <IconButton size="small" color="info">
            <InfoIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {qrCodeData ? (
            <Box 
              sx={{ 
                p: 3, 
                bgcolor: 'white', 
                borderRadius: 1, 
                boxShadow: 1, 
                mb: 2,
                transition: 'all 0.3s ease'
              }}
            >
              <QRCode 
                id="pop-qrcode"
                value={qrCodeData} 
                size={qrSize}
                level="H" // Haute correction d'erreur
              />
            </Box>
          ) : (
            <Box sx={{ p: 3, mb: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          )}
          
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Tooltip title="Actualiser">
              <IconButton onClick={handleRefresh} color="primary" disabled={checkingStatus}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Imprimer">
              <IconButton onClick={handlePrint} color="primary">
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Partager">
              <IconButton onClick={handleShare} color="primary">
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copier l'ID de transaction">
              <IconButton onClick={handleCopyId} color="primary">
                <CopyIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          <TextField
            label="Taille du QR"
            type="number"
            value={qrSize}
            onChange={(e) => setQrSize(Number(e.target.value))}
            InputProps={{
              endAdornment: <InputAdornment position="end">px</InputAdornment>,
            }}
            sx={{ width: 150 }}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" gutterBottom>
            Détails de la transaction
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary">ID:</Typography>
            </Grid>
            <Grid item xs={8}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {transactionId.substring(0, 8)}...
              </Typography>
            </Grid>
            
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary">Montant:</Typography>
            </Grid>
            <Grid item xs={8}>
              <Typography variant="body2">
                {amount || transactionData?.standardAmount || 0}€
              </Typography>
            </Grid>
            
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary">Commerçant:</Typography>
            </Grid>
            <Grid item xs={8}>
              <Typography variant="body2">
                {merchantName || transactionData?.merchant?.name || 'Commerçant'}
              </Typography>
            </Grid>
            
            <Grid item xs={4}>
              <Typography variant="body2" color="text.secondary">Consommateur:</Typography>
            </Grid>
            <Grid item xs={8}>
              <Typography variant="body2">
                {consumerName || transactionData?.consumer?.name || 'Consommateur'}
              </Typography>
            </Grid>
          </Grid>
          
          <Typography variant="subtitle1" gutterBottom>
            Statut de validation
          </Typography>
          
          {checkingStatus ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Vérification du statut...</Typography>
            </Box>
          ) : (
            renderValidationStatus()
          )}
          
          <Box sx={{ mt: 3 }}>
            <Button 
              variant="outlined" 
              color="primary"
              onClick={checkValidationStatus}
              disabled={checkingStatus}
              startIcon={checkingStatus ? <CircularProgress size={16} /> : <RefreshIcon />}
              fullWidth
            >
              Vérifier le statut
            </Button>
          </Box>
          
          <Alert severity="info" sx={{ mt: 2 }} icon={<QrCodeIcon />}>
            <Typography variant="body2">
              Veuillez présenter ce QR code à tous les participants impliqués dans la transaction
              pour qu'ils puissent le scanner avec l'application Étika et valider la transaction.
            </Typography>
          </Alert>
        </Grid>
      </Grid>
      
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Paper>
  );
};
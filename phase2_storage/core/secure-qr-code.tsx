// src/components/qrcode/SecurePopQRCodeGenerator.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Fade
} from '@mui/material';
import {
  QrCode2 as QrCodeIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  Info as InfoIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Timer as TimerIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import QRCode from 'react-qr-code';
import CryptoJS from 'crypto-js'; // Assurez-vous d'installer ce package

// Services et utilitaires
import { checkPoPValidationStatus } from 'services/blockchain/pop';
import { useGetTransactionById } from 'services/api/transactions';
import { logActivity, ActivityType } from 'services/monitoring/activityLogger';
import authService from 'services/auth/authService';
import { usePermission, Permission } from 'components/auth/PermissionGuard';

// Types
interface ValidationStatus {
  isValidated: boolean;
  validations: { actor: string; timestamp: string }[];
  requiredValidations: number;
  status: string;
}

interface SecurePopQRCodeGeneratorProps {
  transactionId: string;
  merchantName?: string;
  consumerName?: string;
  amount?: number;
  onValidationComplete?: () => void;
  expirationTime?: number; // Temps d'expiration en secondes
  requirePin?: boolean; // Exiger un code PIN pour l'accès
}

/**
 * Composant de génération de QR code PoP sécurisé
 */
const SecurePopQRCodeGenerator: React.FC<SecurePopQRCodeGeneratorProps> = ({
  transactionId,
  merchantName,
  consumerName,
  amount,
  onValidationComplete,
  expirationTime = 300, // 5 minutes par défaut
  requirePin = false
}) => {
  // État du QR code
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrSize, setQrSize] = useState<number>(256);
  const [isQrVisible, setIsQrVisible] = useState<boolean>(true);
  const [isQrLocked, setIsQrLocked] = useState<boolean>(requirePin);
  const [qrPin, setQrPin] = useState<string>('');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [isPinDialogOpen, setIsPinDialogOpen] = useState<boolean>(false);
  const [qrSignature, setQrSignature] = useState<string>('');
  
  // État du timer d'expiration
  const [timeRemaining, setTimeRemaining] = useState<number>(expirationTime);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // État de validation
  const [validationStatus, setValidationStatus] = useState<ValidationStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);
  const [statusTimer, setStatusTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Notifications et erreurs
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('info');
  
  // Récupérer les permissions de l'utilisateur
  const canViewDetails = usePermission(Permission.TRANSACTION_VIEW);
  
  // Récupérer les détails de la transaction si non fournis en props
  const { data: transactionData, isLoading: isTransactionLoading } = useGetTransactionById(
    !merchantName || !consumerName || !amount ? transactionId : ''
  );

  // Générer ou régénérer le QR code
  const generateQRCode = () => {
    try {
      // Utiliser les données fournies en props ou celles récupérées de l'API
      const merchant = merchantName || transactionData?.merchant?.name || 'Commerçant';
      const consumer = consumerName || transactionData?.consumer?.name || 'Consommateur';
      const transactionAmount = amount || transactionData?.standardAmount || 0;
      const timestamp = new Date().toISOString();
      
      // Générer un PIN aléatoire si nécessaire
      if (requirePin && !qrPin) {
        const newPin = Math.floor(100000 + Math.random() * 900000).toString();
        setQrPin(newPin);
      }
      
      // Données de base du QR
      const qrDataObject = {
        type: 'etika-pop',
        version: '1.1',
        transactionId,
        merchant,
        consumer,
        amount: transactionAmount,
        timestamp,
        expiresAt: new Date(Date.now() + timeRemaining * 1000).toISOString()
      };
      
      // Générer une signature pour vérifier l'authenticité
      const merchantId = authService.getMerchantId() || 'unknown';
      const dataToSign = `${transactionId}|${merchant}|${consumer}|${transactionAmount}|${timestamp}|${merchantId}`;
      const signature = CryptoJS.HmacSHA256(dataToSign, process.env.REACT_APP_QR_SECRET || 'etika-secure-key').toString();
      
      setQrSignature(signature);
      
      // Ajouter la signature aux données du QR
      const secureQrData = {
        ...qrDataObject,
        sig: signature.substring(0, 16) // Version courte de la signature pour le QR
      };
      
      // Convertir en JSON pour QR code
      const qrJson = JSON.stringify(secureQrData);
      
      // Journaliser l'activité
      logActivity({
        type: ActivityType.QR_CODE_GENERATE,
        details: {
          transactionId,
          expiresAt: secureQrData.expiresAt,
          isRefresh: qrCodeData !== null
        },
        targetId: transactionId,
        targetType: 'transaction'
      });
      
      setQrCodeData(qrJson);
      setIsExpired(false);
      setTimeRemaining(expirationTime);
      
      // Démarrer le timer d'expiration
      startExpirationTimer();
      
      return qrJson;
    } catch (error) {
      console.error('Erreur lors de la génération du QR code:', error);
      
      setSnackbarMessage('Erreur lors de la génération du QR code');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      
      return null;
    }
  };

  // Démarrer le timer d'expiration
  const startExpirationTimer = () => {
    // Nettoyer l'ancien timer s'il existe
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Créer un nouveau timer
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1;
        
        // Si le temps est écoulé, marquer comme expiré et arrêter le timer
        if (newTime <= 0) {
          setIsExpired(true);
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          return 0;
        }
        
        return newTime;
      });
    }, 1000);
  };

  // Vérifier le statut de validation
  const checkValidationStatus = async () => {
    setCheckingStatus(true);
    
    try {
      const status = await checkPoPValidationStatus(transactionId);
      setValidationStatus(status);
      
      // Si le statut a changé vers validé, afficher un message
      if (status.isValidated && validationStatus && !validationStatus.isValidated) {
        setSnackbarMessage('Transaction validée avec succès !');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        
        // Journaliser la validation
        logActivity({
          type: ActivityType.TRANSACTION_VALIDATE,
          details: {
            transactionId,
            validatorCount: status.validations.length
          },
          targetId: transactionId,
          targetType: 'transaction',
          severity: 'info'
        });
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du statut:', error);
      
      setSnackbarMessage('Erreur lors de la vérification du statut');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Gérer la régénération du QR code
  const handleRefresh = () => {
    generateQRCode();
    checkValidationStatus();
  };

  // Gérer l'impression du QR code
  const handlePrint = () => {
    // Journaliser l'impression
    logActivity({
      type: 'QR_CODE_PRINT',
      details: {
        transactionId
      },
      targetId: transactionId,
      targetType: 'transaction'
    });
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const qrCodeElement = document.getElementById('secure-pop-qrcode');
      const merchant = merchantName || transactionData?.merchant?.name || 'Commerçant';
      const consumer = consumerName || transactionData?.consumer?.name || 'Consommateur';
      const transactionAmount = amount || transactionData?.standardAmount || 0;
      
      if (qrCodeElement) {
        printWindow.document.write(`
          <html>
            <head>
              <title>QR Code PoP Sécurisé - Transaction ${transactionId}</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
                .container { max-width: 500px; margin: 0 auto; }
                .header { margin-bottom: 20px; }
                .footer { margin-top: 20px; font-size: 12px; color: #666; }
                .security-info { margin-top: 15px; border: 1px solid #ccc; padding: 10px; background-color: #f9f9f9; }
                .expires { color: #d32f2f; font-weight: bold; }
                .qr-container { padding: 15px; border: 2px dashed #2196f3; display: inline-block; background: white; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Code QR pour validation PoP</h1>
                  <p><strong>Transaction:</strong> ${transactionId.substring(0, 8)}...</p>
                  <p><strong>Montant:</strong> ${transactionAmount}€</p>
                  <p><strong>Commerçant:</strong> ${merchant}</p>
                  <p><strong>Consommateur:</strong> ${consumer}</p>
                </div>
                <div class="qr-container">
                  ${qrCodeElement.outerHTML}
                </div>
                <div class="security-info">
                  <p><strong>Signature de sécurité:</strong> ${qrSignature.substring(0, 16)}...</p>
                  <p class="expires"><strong>Expire le:</strong> ${new Date(Date.now() + timeRemaining * 1000).toLocaleString()}</p>
                  ${requirePin ? `<p><strong>Code PIN:</strong> ${qrPin}</p>` : ''}
                </div>
                <div class="footer">
                  <p>Scannez ce QR code avec l'application Étika pour valider la transaction</p>
                  <p>Système Étika - Proof of Purchase Sécurisé</p>
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

  // Gérer le partage du QR code
  const handleShare = async () => {
    // Journaliser le partage
    logActivity({
      type: 'QR_CODE_SHARE',
      details: {
        transactionId
      },
      targetId: transactionId,
      targetType: 'transaction'
    });
    
    if (qrCodeData && navigator.share) {
      try {
        await navigator.share({
          title: 'QR Code PoP Étika Sécurisé',
          text: `Validation de transaction PoP pour ${transactionId.substring(0, 8)}...`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Erreur lors du partage:', error);
      }
    } else {
      setSnackbarMessage('Partage non supporté par ce navigateur');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
    }
  };

  // Gérer la copie de l'ID de transaction
  const handleCopyId = () => {
    navigator.clipboard.writeText(transactionId);
    setSnackbarMessage('ID de transaction copié !');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };

  // Gérer la fermeture des snackbars
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Ouvrir la boîte de dialogue de PIN
  const handleOpenPinDialog = () => {
    setEnteredPin('');
    setIsPinDialogOpen(true);
  };

  // Vérifier le PIN
  const handleVerifyPin = () => {
    if (enteredPin === qrPin) {
      setIsQrLocked(false);
      setIsPinDialogOpen(false);
      
      // Journaliser le déverrouillage
      logActivity({
        type: 'QR_CODE_UNLOCK',
        details: {
          transactionId,
          method: 'pin'
        },
        targetId: transactionId,
        targetType: 'transaction'
      });
    } else {
      setSnackbarMessage('Code PIN incorrect');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      
      // Journaliser la tentative incorrecte
      logActivity({
        type: 'QR_CODE_UNLOCK_FAILED',
        details: {
          transactionId,
          method: 'pin'
        },
        targetId: transactionId,
        targetType: 'transaction',
        severity: 'warning'
      });
    }
  };

  // Basculer la visibilité du QR code
  const toggleQrVisibility = () => {
    setIsQrVisible(!isQrVisible);
  };

  // Mettre en forme le temps restant
  const formatTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Afficher le statut de validation
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

  // Initialiser le QR code et les vérifications au chargement
  useEffect(() => {
    // Générer le QR code initial
    generateQRCode();
    
    // Vérifier le statut de validation
    checkValidationStatus();
    
    // Configurer la vérification périodique du statut
    const timer = setInterval(checkValidationStatus, 5000);
    setStatusTimer(timer);
    
    // Nettoyage à la destruction du composant
    return () => {
      if (statusTimer) clearInterval(statusTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
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

  // Si les données sont en cours de chargement
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
        <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center' }}>
          <LockIcon color="primary" sx={{ mr: 1 }} />
          QR Code PoP Sécurisé
        </Typography>
        <Tooltip title="Ce QR code inclut des mesures de sécurité avancées">
          <IconButton size="small" color="info">
            <InfoIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {isQrLocked ? (
            <Box 
              sx={{ 
                p: 3, 
                bgcolor: 'background.paper', 
                borderRadius: 1, 
                boxShadow: 1, 
                mb: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: qrSize,
                width: qrSize
              }}
            >
              <LockIcon sx={{ fontSize: 64, color: 'action.active', mb: 2 }} />
              <Typography variant="body2" align="center">
                QR code verrouillé pour votre sécurité
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleOpenPinDialog}
                sx={{ mt: 2 }}
                startIcon={<LockOpenIcon />}
              >
                Déverrouiller
              </Button>
            </Box>
          ) : qrCodeData && !isExpired ? (
            <Fade in={isQrVisible}>
              <Box 
                sx={{ 
                  p: 3, 
                  bgcolor: 'white', 
                  borderRadius: 1, 
                  boxShadow: 1, 
                  mb: 2,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <QRCode 
                  id="secure-pop-qrcode"
                  value={qrCodeData} 
                  size={qrSize}
                  level="H" // Haute correction d'erreur
                />
                
                {!isQrVisible && (
                  <Box 
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      bgcolor: 'rgba(0,0,0,0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <VisibilityOffIcon sx={{ fontSize: 64, color: 'white' }} />
                  </Box>
                )}
                
                <Box 
                  sx={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <TimerIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="caption" fontFamily="monospace">
                    {formatTimeRemaining()}
                  </Typography>
                </Box>
              </Box>
            </Fade>
          ) : isExpired ? (
            <Box 
              sx={{ 
                p: 3, 
                bgcolor: 'background.paper', 
                borderRadius: 1, 
                boxShadow: 1, 
                mb: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: qrSize,
                width: qrSize
              }}
            >
              <Typography variant="h6" color="error" gutterBottom>
                QR Code expiré
              </Typography>
              <Typography variant="body2" align="center" sx={{ mb: 2 }}>
                Le QR code a expiré pour des raisons de sécurité.
              </Typography>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleRefresh}
                startIcon={<RefreshIcon />}
              >
                Générer un nouveau QR
              </Button>
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
              <IconButton onClick={handlePrint} color="primary" disabled={isQrLocked || isExpired || !qrCodeData}>
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Partager">
              <IconButton onClick={handleShare} color="primary" disabled={isQrLocked || isExpired || !qrCodeData}>
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copier l'ID de transaction">
              <IconButton onClick={handleCopyId} color="primary">
                <CopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={isQrVisible ? "Masquer le QR code" : "Afficher le QR code"}>
              <IconButton onClick={toggleQrVisibility} color="primary" disabled={isQrLocked || isExpired || !qrCodeData}>
                {isQrVisible ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </Tooltip>
          </Box>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={7}>
              <TextField
                label="Taille du QR"
                type="number"
                value={qrSize}
                onChange={(e) => setQrSize(Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">px</InputAdornment>,
                }}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                <TimerIcon fontSize="small" sx={{ mr: 0.5 }} />
                Expire dans: {formatTimeRemaining()}
              </Typography>
            </Grid>
          </Grid>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <LockIcon fontSize="small" sx={{ mr: 0.5, color: 'primary.main' }} />
            QR code sécurisé avec informations numériques signées
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            Ce QR code est protégé par une signature cryptographique et expire après {expirationTime} secondes pour prévenir les fraudes.
            {requirePin && " Un code PIN est requis pour le déverrouiller."}
          </Alert>
          
          {canViewDetails && (
            <>
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
                
                <Grid item xs={4}>
                  <Typography variant="body2" color="text.secondary">Signature:</Typography>
                </Grid>
                <Grid item xs={8}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {qrSignature.substring(0, 16)}...
                  </Typography>
                </Grid>
              </Grid>
            </>
          )}
          
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
        </Grid>
      </Grid>
      
      {/* Boîte de dialogue pour le PIN */}
      <Dialog 
        open={isPinDialogOpen} 
        onClose={() => setIsPinDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Saisir le code PIN</DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            Veuillez saisir le code PIN à 6 chiffres pour déverrouiller le QR code.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Code PIN"
            type="password"
            fullWidth
            variant="outlined"
            value={enteredPin}
            onChange={(e) => setEnteredPin(e.target.value)}
            inputProps={{ maxLength: 6, pattern: '[0-9]*', inputMode: 'numeric' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsPinDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleVerifyPin} variant="contained" color="primary">
            Déverrouiller
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar pour les notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Paper>
  );
};

export default SecurePopQRCodeGenerator;
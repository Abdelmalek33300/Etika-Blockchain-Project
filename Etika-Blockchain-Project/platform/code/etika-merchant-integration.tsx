// src/components/merchant/integration/IntegrationSelector.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  CardActionArea, 
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { 
  Store as StoreIcon, 
  ShoppingCart as EcommerceIcon, 
  QrCode as QrCodeIcon,
  Code as ApiIcon,
  CloudDownload as DownloadIcon,
  Extension as PluginIcon
} from '@mui/icons-material';
import { useMerchant } from '../MerchantContext';
import { MerchantType, PosIntegrationType } from '../../../models/merchant';

// Interface pour les options d'intégration
interface IntegrationOption {
  id: PosIntegrationType;
  title: string;
  description: string;
  icon: React.ReactNode;
  compatibleWith: MerchantType[];
  difficulty: 'easy' | 'medium' | 'hard';
  setupTime: string;
  prerequisites: string[];
  image: string;
}

const integrationOptions: IntegrationOption[] = [
  {
    id: PosIntegrationType.QR_CODE,
    title: "QR Code Simple",
    description: "Solution la plus simple : générez un QR code que vos clients scannent avec leur app mobile pour obtenir des tokens.",
    icon: <QrCodeIcon fontSize="large" />,
    compatibleWith: Object.values(MerchantType),
    difficulty: 'easy',
    setupTime: "5 minutes",
    prerequisites: ["Imprimante pour les QR codes ou affichage digital"],
    image: "/assets/integrations/qr-code.png"
  },
  {
    id: PosIntegrationType.PLUGIN,
    title: "Plugin pour caisse",
    description: "Intégrez Etika directement dans votre système de caisse existant via un plugin prêt à l'emploi.",
    icon: <PluginIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.INDEPENDENT, 
      MerchantType.FRANCHISEE, 
      MerchantType.CHAIN_STORE, 
      MerchantType.COOPERATIVE_MEMBER
    ],
    difficulty: 'medium',
    setupTime: "30 minutes",
    prerequisites: ["Système de caisse compatible", "Accès administrateur à votre système"],
    image: "/assets/integrations/pos-plugin.png"
  },
  {
    id: PosIntegrationType.API,
    title: "Intégration API",
    description: "Solution avancée et sur mesure : intégrez directement l'API Etika à votre infrastructure technique.",
    icon: <ApiIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.FRANCHISOR, 
      MerchantType.CHAIN_HQ, 
      MerchantType.ECOMMERCE, 
      MerchantType.OMNICHANNEL
    ],
    difficulty: 'hard',
    setupTime: "1-3 jours",
    prerequisites: ["Compétences de développement", "Infrastructure technique"],
    image: "/assets/integrations/api-integration.png"
  },
  {
    id: PosIntegrationType.ECOMMERCE_WIDGET,
    title: "Widget E-commerce",
    description: "Ajoutez un widget sur votre site e-commerce pour l'attribution et l'utilisation des tokens.",
    icon: <EcommerceIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.ECOMMERCE, 
      MerchantType.OMNICHANNEL
    ],
    difficulty: 'medium',
    setupTime: "1 heure",
    prerequisites: ["Site e-commerce compatible", "Accès au code"],
    image: "/assets/integrations/ecommerce-widget.png"
  },
  {
    id: PosIntegrationType.TERMINAL,
    title: "Terminal dédié",
    description: "Utilisez un terminal spécifique pour gérer les tokens Etika de manière dédiée.",
    icon: <StoreIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.FRANCHISEE, 
      MerchantType.CHAIN_STORE, 
      MerchantType.INDEPENDENT
    ],
    difficulty: 'medium',
    setupTime: "1-2 jours (livraison)",
    prerequisites: ["Connexion internet", "Prise électrique disponible"],
    image: "/assets/integrations/dedicated-terminal.png"
  },
  {
    id: PosIntegrationType.SDK,
    title: "Kit de développement (SDK)",
    description: "Intégrez Etika dans vos propres applications avec notre SDK pour développeurs.",
    icon: <DownloadIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.FRANCHISOR, 
      MerchantType.CHAIN_HQ, 
      MerchantType.ECOMMERCE, 
      MerchantType.OMNICHANNEL
    ],
    difficulty: 'hard',
    setupTime: "Variable",
    prerequisites: ["Équipe de développement", "Projet logiciel existant"],
    image: "/assets/integrations/sdk-development.png"
  }
];

// Composant principal
const IntegrationSelector: React.FC = () => {
  const merchant = useMerchant();
  const [selectedOption, setSelectedOption] = useState<IntegrationOption | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  
  // Filtre les options compatibles avec le type de commerçant
  const compatibleOptions = integrationOptions.filter(option => 
    option.compatibleWith.includes(merchant.merchantType)
  );
  
  const handleOpenDialog = (option: IntegrationOption) => {
    setSelectedOption(option);
    setOpenDialog(true);
  };
  
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
  
  // Couleur selon le niveau de difficulté
  const getDifficultyColor = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch(difficulty) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'error';
      default: return 'default';
    }
  };
  
  // Texte selon le niveau de difficulté
  const getDifficultyText = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch(difficulty) {
      case 'easy': return 'Simple';
      case 'medium': return 'Intermédiaire';
      case 'hard': return 'Avancé';
      default: return '';
    }
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Choisissez votre méthode d'intégration
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Plusieurs options sont disponibles pour intégrer Etika dans votre activité. Choisissez celle qui correspond le mieux à vos besoins et à votre infrastructure technique.
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {compatibleOptions.map((option) => (
          <Grid item xs={12} md={6} lg={4} key={option.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardActionArea onClick={() => handleOpenDialog(option)}>
                <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                  {option.icon}
                </Box>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6" component="div">
                      {option.title}
                    </Typography>
                    <Chip 
                      label={getDifficultyText(option.difficulty)} 
                      color={getDifficultyColor(option.difficulty)} 
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {option.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Temps de mise en place estimé: {option.setupTime}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* Dialog de détails et configuration */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedOption && (
          <>
            <DialogTitle>{selectedOption.title}</DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', mb: 2 }}>
                    {selectedOption.icon}
                  </Box>
                  <DialogContentText gutterBottom>
                    {selectedOption.description}
                  </DialogContentText>
                  <Typography variant="subtitle2" gutterBottom>
                    Prérequis:
                  </Typography>
                  <ul>
                    {selectedOption.prerequisites.map((prerequisite, index) => (
                      <li key={index}>
                        <Typography variant="body2">{prerequisite}</Typography>
                      </li>
                    ))}
                  </ul>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Guide d'installation rapide
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="body2" component="div">
                      {selectedOption.id === PosIntegrationType.QR_CODE && (
                        <ol>
                          <li>Générez votre QR code unique depuis votre dashboard</li>
                          <li>Imprimez-le ou affichez-le à proximité de votre caisse</li>
                          <li>Informez vos clients qu'ils peuvent scanner le code pour recevoir leurs tokens</li>
                          <li>Utilisez l'application mobile Etika pour valider les transactions</li>
                        </ol>
                      )}
                      {selectedOption.id === PosIntegrationType.PLUGIN && (
                        <ol>
                          <li>Identifiez votre système de caisse dans la liste des compatibilités</li>
                          <li>Téléchargez le plugin correspondant</li>
                          <li>Suivez les instructions d'installation spécifiques à votre système</li>
                          <li>Redémarrez votre caisse et activez le plugin</li>
                          <li>Configurez vos paramètres de fidélité</li>
                        </ol>
                      )}
                      {selectedOption.id === PosIntegrationType.API && (
                        <ol>
                          <li>Générez vos clés API dans les paramètres développeur</li>
                          <li>Consultez notre documentation API complète</li>
                          <li>Développez l'intégration selon vos besoins spécifiques</li>
                          <li>Testez l'intégration dans l'environnement de sandbox</li>
                          <li>Passez en production après validation</li>
                        </ol>
                      )}
                      {/* Autres guides pour les autres types d'intégration */}
                    </Typography>
                  </Paper>
                  <Box mt={2}>
                    <Button variant="outlined" fullWidth>
                      Voir le guide complet
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Annuler</Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleCloseDialog}
              >
                Démarrer l'intégration
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default IntegrationSelector;

// src/components/merchant/integration/PosSystemConnector.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Stepper, 
  Step, 
  StepLabel, 
  StepContent,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { useMerchant } from '../MerchantContext';
import { MerchantType } from '../../../models/merchant';

// Composant d'intégration avec les systèmes de point de vente
const PosSystemConnector: React.FC = () => {
  const merchant = useMerchant();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [posSystem, setPosSystem] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  
  // Étapes du processus d'intégration
  const steps = [
    {
      label: 'Sélectionner votre système de caisse',
      description: `Choisissez votre système de caisse parmi notre liste de systèmes compatibles.`,
      content: (
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Système de caisse</InputLabel>
          <Select
            value={posSystem}
            label="Système de caisse"
            onChange={(e) => setPosSystem(e.target.value)}
          >
            <MenuItem value="caisse_connect">Caisse Connect</MenuItem>
            <MenuItem value="lightspeed">Lightspeed</MenuItem>
            <MenuItem value="square">Square</MenuItem>
            <MenuItem value="shopify_pos">Shopify POS</MenuItem>
            <MenuItem value="custom">Autre (configuration manuelle)</MenuItem>
          </Select>
        </FormControl>
      )
    },
    {
      label: 'Configuration du système',
      description: 'Configurez les paramètres de connexion avec votre système de caisse.',
      content: (
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Identifiant du point de vente"
                variant="outlined"
                placeholder="POS-12345"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL du système (si applicable)"
                variant="outlined"
                placeholder="https://api.votrecaisse.com"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Clé API (si applicable)"
                variant="outlined"
                placeholder="api_key_xxxxx"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary" paragraph>
                Note: Ces informations sont généralement disponibles dans les paramètres d'administration de votre système de caisse.
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: 'Test de connexion',
      description: `Vérifiez que la connexion avec votre système de caisse fonctionne correctement.`,
      content: (
        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" my={3}>
              <CircularProgress />
            </Box>
          ) : testResult === null ? (
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => {
                setLoading(true);
                // Simulation d'un test de connexion
                setTimeout(() => {
                  setLoading(false);
                  // Résultat aléatoire pour la démo
                  setTestResult(Math.random() > 0.3 ? 'success' : 'error');
                }, 2000);
              }}
            >
              Tester la connexion
            </Button>
          ) : testResult === 'success' ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Connexion réussie ! Votre système de caisse est correctement configuré pour fonctionner avec Etika.
            </Alert>
          ) : (
            <Alert severity="error" sx={{ mt: 2 }}>
              Échec de la connexion. Veuillez vérifier vos paramètres et réessayer.
            </Alert>
          )}
        </Box>
      )
    },
    {
      label: 'Configuration des règles d\'attribution',
      description: 'Définissez comment les tokens sont attribués lors des transactions.',
      content: (
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Taux d'attribution (tokens par 10€)"
                variant="outlined"
                type="number"
                defaultValue="1"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Montant minimum de transaction (€)"
                variant="outlined"
                type="number"
                defaultValue="5"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Moment d'attribution</InputLabel>
                <Select
                  defaultValue="checkout"
                  label="Moment d'attribution"
                >
                  <MenuItem value="checkout">À la caisse</MenuItem>
                  <MenuItem value="delivery">À la livraison</MenuItem>
                  <MenuItem value="manual">Attribution manuelle</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: 'Activation',
      description: `Activez l'intégration pour commencer à utiliser Etika avec votre système de caisse.`,
      content: (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Vous êtes sur le point d'activer l'intégration entre Etika et votre système de caisse. Cela permettra d'automatiser l'attribution et l'utilisation des tokens.
          </Alert>
          <Button 
            variant="contained" 
            color="primary" 
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => {
              // Simulation d'activation
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                // Passer à la confirmation
                setActiveStep((prevActiveStep) => prevActiveStep + 1);
              }, 1500);
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Activer l'intégration"}
          </Button>
        </Box>
      )
    },
  ];
  
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };
  
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  
  const handleReset = () => {
    setActiveStep(0);
    setPosSystem('');
    setTestResult(null);
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Intégration avec votre système de caisse
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Suivez les étapes ci-dessous pour connecter Etika à votre système de caisse et automatiser l'attribution des tokens.
      </Typography>
      
      <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 3 }}>
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>{step.label}</StepLabel>
            <StepContent>
              <Typography variant="body2" color="textSecondary">{step.description}</Typography>
              {step.content}
              <Box sx={{ mb: 2, mt: 3 }}>
                <div>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    sx={{ mt: 1, mr: 1 }}
                    disabled={
                      (index === 0 && !posSystem) || 
                      (index === 2 && testResult !== 'success')
                    }
                  >
                    {index === steps.length - 1 ? 'Terminer' : 'Continuer'}
                  </Button>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Retour
                  </Button>
                </div>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>
      
      {activeStep === steps.length && (
        <Paper square elevation={0} sx={{ p: 3, mt: 3, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom>
            Intégration terminée avec succès !
          </Typography>
          <Typography variant="body1" paragraph>
            Votre système de caisse est maintenant connecté à Etika. Vous pouvez commencer à émettre et accepter des tokens lors des transactions.
          </Typography>
          <Button onClick={handleReset} sx={{ mt: 1, mr: 1 }}>
            Réinitialiser
          </Button>
          <Button variant="contained" color="primary" sx={{ mt: 1, mr: 1 }}>
            Aller au tableau de bord
          </Button>
        </Paper>
      )}
      
      {/* Section d'aide et de support */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Besoin d'aide avec l'intégration ?
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Documentation technique
            </Typography>
            <Typography variant="body2" paragraph>
              Consultez notre documentation détaillée pour chaque système de caisse compatible.
            </Typography>
            <Button variant="outlined" size="small">
              Accéder à la documentation
            </Button>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Support technique
            </Typography>
            <Typography variant="body2" paragraph>
              Notre équipe est disponible pour vous aider avec votre intégration.
            </Typography>
            <Button variant="outlined" size="small">
              Contacter le support
            </Button>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Intégration personnalisée
            </Typography>
            <Typography variant="body2" paragraph>
              Besoin d'une solution sur mesure ? Nos experts peuvent vous accompagner.
            </Typography>
            <Button variant="outlined" size="small">
              Demander un devis
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default PosSystemConnector;

// src/components/merchant/integration/EcommerceIntegration.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Tabs,
  Tab,
  Divider,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Card,
  CardContent
} from '@mui/material';
import { 
  ContentCopy as CopyIcon, 
  Code as CodeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Healing as HealingIcon
} from '@mui/icons-material';
import { useMerchant } from '../MerchantContext';
import { MerchantType } from '../../../models/merchant';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Composant d'intégration e-commerce
const EcommerceIntegration: React.FC = () => {
  const merchant = useMerchant();
  const [activeTab, setActiveTab] = useState(0);
  const [platform, setPlatform] = useState('shopify');
  const [apiKey, setApiKey] = useState('ek_live_12345abcdef');
  const [webhookUrl, setWebhookUrl] = useState('https://api.etika.com/webhooks/ecom_12345');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  const handlePlatformChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setPlatform(event.target.value as string);
  };
  
  const handleCopyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };
  
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
  // Exemple de code pour différentes plateformes
  const getCodeSample = () => {
    switch (platform) {
      case 'shopify':
        return `<!-- Ajouter ce code dans le fichier theme.liquid -->
<script>
  // Etika Tokens Integration
  var etikaConfig = {
    apiKey: "${apiKey}",
    shopId: "{{ shop.id }}",
    customerId: "{{ customer.id }}"
  };
  
  (function() {
    var e = document.createElement('script');
    e.src = 'https://cdn.etika.com/js/shopify-integration.js';
    e.async = true;
    document.head.appendChild(e);
  })();
</script>

<!-- Ajouter ce code dans checkout.liquid pour l'attribution de tokens -->
<div id="etika-token-attribution"></div>`;

      case 'woocommerce':
        return `// Ajouter ce code dans functions.php de votre thème WordPress
function etika_tokens_integration() {
  if (is_checkout() || is_cart()) {
    ?>
    <script>
      // Etika Tokens Integration
      var etikaConfig = {
        apiKey: "${apiKey}",
        shopId: "<?php echo get_current_blog_id(); ?>",
        customerId: "<?php echo get_current_user_id(); ?>"
      };
      
      (function() {
        var e = document.createElement('script');
        e.src = 'https://cdn.etika.com/js/woocommerce-integration.js';
        e.async = true;
        document.head.appendChild(e);
      })();
    </script>
    <?php
  }
}
add_action('wp_footer', 'etika_tokens_integration');

// Ajouter ce hook pour l'attribution des tokens après commande
function etika_order_completed($order_id) {
  $order = wc_get_order($order_id);
  $total = $order->get_total();
  
  // Appel API pour attribution des tokens
  $response = wp_remote_post('https://api.etika.com/v1/tokens/attribute', [
    'headers' => [
      'Authorization' => 'Bearer ${apiKey}',
      'Content-Type' => 'application/json'
    ],
    'body' => json_encode([
      'orderId' => $order_id,
      'customerId' => $order->get_customer_id(),
      'amount' => $total
    ])
  ]);
}
add_action('woocommerce_order_status_completed', 'etika_order_completed');`;

      case 'prestashop':
        return `// Code à ajouter dans un module PrestaShop personnalisé

// Dans le fichier principal du module
public function hookDisplayFooter($params)
{
    $customer_id = $this->context->customer->id;
    $shop_id = $this->context->shop->id;
    
    $this->context->smarty->assign([
        'etika_api_key' => '${apiKey}',
        'etika_shop_id' => $shop_id,
        'etika_customer_id' => $customer_id
    ]);
    
    return $this->display(__FILE__, 'views/templates/hook/footer.tpl');
}

// Dans le fichier views/templates/hook/footer.tpl
<script>
  // Etika Tokens Integration
  var etikaConfig = {
    apiKey: "{$etika_api_key}",
    shopId: "{$etika_shop_id}",
    customerId: "{$etika_customer_id}"
  };
  
  (function() {
    var e = document.createElement('script');
    e.src = 'https://cdn.etika.com/js/prestashop-integration.js';
    e.async = true;
    document.head.appendChild(e);
  })();
</script>

// Hook pour l'attribution des tokens après commande
public function hookActionOrderStatusUpdate($params)
{
    $order = $params['order'];
    
    // Vérifier si la commande est en statut "payé"
    if ($params['newOrderStatus']->id == _PS_OS_PAYMENT_) {
        $total = $order->total_paid;
        $customer_id = $order->id_customer;
        
        // Appel à l'API Etika
        $api_url = 'https://api.etika.com/v1/tokens/attribute';
        $data = [
            'orderId' => $order// src/components/merchant/integration/IntegrationSelector.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  CardActionArea, 
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { 
  Store as StoreIcon, 
  ShoppingCart as EcommerceIcon, 
  QrCode as QrCodeIcon,
  Code as ApiIcon,
  CloudDownload as DownloadIcon,
  Extension as PluginIcon
} from '@mui/icons-material';
import { useMerchant } from '../MerchantContext';
import { MerchantType, PosIntegrationType } from '../../../models/merchant';

// Interface pour les options d'intégration
interface IntegrationOption {
  id: PosIntegrationType;
  title: string;
  description: string;
  icon: React.ReactNode;
  compatibleWith: MerchantType[];
  difficulty: 'easy' | 'medium' | 'hard';
  setupTime: string;
  prerequisites: string[];
  image: string;
}

const integrationOptions: IntegrationOption[] = [
  {
    id: PosIntegrationType.QR_CODE,
    title: "QR Code Simple",
    description: "Solution la plus simple : générez un QR code que vos clients scannent avec leur app mobile pour obtenir des tokens.",
    icon: <QrCodeIcon fontSize="large" />,
    compatibleWith: Object.values(MerchantType),
    difficulty: 'easy',
    setupTime: "5 minutes",
    prerequisites: ["Imprimante pour les QR codes ou affichage digital"],
    image: "/assets/integrations/qr-code.png"
  },
  {
    id: PosIntegrationType.PLUGIN,
    title: "Plugin pour caisse",
    description: "Intégrez Etika directement dans votre système de caisse existant via un plugin prêt à l'emploi.",
    icon: <PluginIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.INDEPENDENT, 
      MerchantType.FRANCHISEE, 
      MerchantType.CHAIN_STORE, 
      MerchantType.COOPERATIVE_MEMBER
    ],
    difficulty: 'medium',
    setupTime: "30 minutes",
    prerequisites: ["Système de caisse compatible", "Accès administrateur à votre système"],
    image: "/assets/integrations/pos-plugin.png"
  },
  {
    id: PosIntegrationType.API,
    title: "Intégration API",
    description: "Solution avancée et sur mesure : intégrez directement l'API Etika à votre infrastructure technique.",
    icon: <ApiIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.FRANCHISOR, 
      MerchantType.CHAIN_HQ, 
      MerchantType.ECOMMERCE, 
      MerchantType.OMNICHANNEL
    ],
    difficulty: 'hard',
    setupTime: "1-3 jours",
    prerequisites: ["Compétences de développement", "Infrastructure technique"],
    image: "/assets/integrations/api-integration.png"
  },
  {
    id: PosIntegrationType.ECOMMERCE_WIDGET,
    title: "Widget E-commerce",
    description: "Ajoutez un widget sur votre site e-commerce pour l'attribution et l'utilisation des tokens.",
    icon: <EcommerceIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.ECOMMERCE, 
      MerchantType.OMNICHANNEL
    ],
    difficulty: 'medium',
    setupTime: "1 heure",
    prerequisites: ["Site e-commerce compatible", "Accès au code"],
    image: "/assets/integrations/ecommerce-widget.png"
  },
  {
    id: PosIntegrationType.TERMINAL,
    title: "Terminal dédié",
    description: "Utilisez un terminal spécifique pour gérer les tokens Etika de manière dédiée.",
    icon: <StoreIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.FRANCHISEE, 
      MerchantType.CHAIN_STORE, 
      MerchantType.INDEPENDENT
    ],
    difficulty: 'medium',
    setupTime: "1-2 jours (livraison)",
    prerequisites: ["Connexion internet", "Prise électrique disponible"],
    image: "/assets/integrations/dedicated-terminal.png"
  },
  {
    id: PosIntegrationType.SDK,
    title: "Kit de développement (SDK)",
    description: "Intégrez Etika dans vos propres applications avec notre SDK pour développeurs.",
    icon: <DownloadIcon fontSize="large" />,
    compatibleWith: [
      MerchantType.FRANCHISOR, 
      MerchantType.CHAIN_HQ, 
      MerchantType.ECOMMERCE, 
      MerchantType.OMNICHANNEL
    ],
    difficulty: 'hard',
    setupTime: "Variable",
    prerequisites: ["Équipe de développement", "Projet logiciel existant"],
    image: "/assets/integrations/sdk-development.png"
  }
];

// Composant principal
const IntegrationSelector: React.FC = () => {
  const merchant = useMerchant();
  const [selectedOption, setSelectedOption] = useState<IntegrationOption | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  
  // Filtre les options compatibles avec le type de commerçant
  const compatibleOptions = integrationOptions.filter(option => 
    option.compatibleWith.includes(merchant.merchantType)
  );
  
  const handleOpenDialog = (option: IntegrationOption) => {
    setSelectedOption(option);
    setOpenDialog(true);
  };
  
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
  
  // Couleur selon le niveau de difficulté
  const getDifficultyColor = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch(difficulty) {
      case 'easy': return 'success';
      case 'medium': return 'warning';
      case 'hard': return 'error';
      default: return 'default';
    }
  };
  
  // Texte selon le niveau de difficulté
  const getDifficultyText = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch(difficulty) {
      case 'easy': return 'Simple';
      case 'medium': return 'Intermédiaire';
      case 'hard': return 'Avancé';
      default: return '';
    }
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Choisissez votre méthode d'intégration
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Plusieurs options sont disponibles pour intégrer Etika dans votre activité. Choisissez celle qui correspond le mieux à vos besoins et à votre infrastructure technique.
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {compatibleOptions.map((option) => (
          <Grid item xs={12} md={6} lg={4} key={option.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardActionArea onClick={() => handleOpenDialog(option)}>
                <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                  {option.icon}
                </Box>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6" component="div">
                      {option.title}
                    </Typography>
                    <Chip 
                      label={getDifficultyText(option.difficulty)} 
                      color={getDifficultyColor(option.difficulty)} 
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {option.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Temps de mise en place estimé: {option.setupTime}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* Dialog de détails et configuration */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedOption && (
          <>
            <DialogTitle>{selectedOption.title}</DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', mb: 2 }}>
                    {selectedOption.icon}
                  </Box>
                  <DialogContentText gutterBottom>
                    {selectedOption.description}
                  </DialogContentText>
                  <Typography variant="subtitle2" gutterBottom>
                    Prérequis:
                  </Typography>
                  <ul>
                    {selectedOption.prerequisites.map((prerequisite, index) => (
                      <li key={index}>
                        <Typography variant="body2">{prerequisite}</Typography>
                      </li>
                    ))}
                  </ul>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Guide d'installation rapide
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="body2" component="div">
                      {selectedOption.id === PosIntegrationType.QR_CODE && (
                        <ol>
                          <li>Générez votre QR code unique depuis votre dashboard</li>
                          <li>Imprimez-le ou affichez-le à proximité de votre caisse</li>
                          <li>Informez vos clients qu'ils peuvent scanner le code pour recevoir leurs tokens</li>
                          <li>Utilisez l'application mobile Etika pour valider les transactions</li>
                        </ol>
                      )}
                      {selectedOption.id === PosIntegrationType.PLUGIN && (
                        <ol>
                          <li>Identifiez votre système de caisse dans la liste des compatibilités</li>
                          <li>Téléchargez le plugin correspondant</li>
                          <li>Suivez les instructions d'installation spécifiques à votre système</li>
                          <li>Redémarrez votre caisse et activez le plugin</li>
                          <li>Configurez vos paramètres de fidélité</li>
                        </ol>
                      )}
                      {selectedOption.id === PosIntegrationType.API && (
                        <ol>
                          <li>Générez vos clés API dans les paramètres développeur</li>
                          <li>Consultez notre documentation API complète</li>
                          <li>Développez l'intégration selon vos besoins spécifiques</li>
                          <li>Testez l'intégration dans l'environnement de sandbox</li>
                          <li>Passez en production après validation</li>
                        </ol>
                      )}
                      {/* Autres guides pour les autres types d'intégration */}
                    </Typography>
                  </Paper>
                  <Box mt={2}>
                    <Button variant="outlined" fullWidth>
                      Voir le guide complet
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>Annuler</Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleCloseDialog}
              >
                Démarrer l'intégration
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default IntegrationSelector;

// src/components/merchant/integration/PosSystemConnector.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Stepper, 
  Step, 
  StepLabel, 
  StepContent,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { useMerchant } from '../MerchantContext';
import { MerchantType } from '../../../models/merchant';

// Composant d'intégration avec les systèmes de point de vente
const PosSystemConnector: React.FC = () => {
  const merchant = useMerchant();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [posSystem, setPosSystem] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  
  // Étapes du processus d'intégration
  const steps = [
    {
      label: 'Sélectionner votre système de caisse',
      description: `Choisissez votre système de caisse parmi notre liste de systèmes compatibles.`,
      content: (
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Système de caisse</InputLabel>
          <Select
            value={posSystem}
            label="Système de caisse"
            onChange={(e) => setPosSystem(e.target.value)}
          >
            <MenuItem value="caisse_connect">Caisse Connect</MenuItem>
            <MenuItem value="lightspeed">Lightspeed</MenuItem>
            <MenuItem value="square">Square</MenuItem>
            <MenuItem value="shopify_pos">Shopify POS</MenuItem>
            <MenuItem value="custom">Autre (configuration manuelle)</MenuItem>
          </Select>
        </FormControl>
      )
    },
    {
      label: 'Configuration du système',
      description: 'Configurez les paramètres de connexion avec votre système de caisse.',
      content: (
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Identifiant du point de vente"
                variant="outlined"
                placeholder="POS-12345"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL du système (si applicable)"
                variant="outlined"
                placeholder="https://api.votrecaisse.com"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Clé API (si applicable)"
                variant="outlined"
                placeholder="api_key_xxxxx"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="textSecondary" paragraph>
                Note: Ces informations sont généralement disponibles dans les paramètres d'administration de votre système de caisse.
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: 'Test de connexion',
      description: `Vérifiez que la connexion avec votre système de caisse fonctionne correctement.`,
      content: (
        <Box sx={{ mt: 2 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" my={3}>
              <CircularProgress />
            </Box>
          ) : testResult === null ? (
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => {
                setLoading(true);
                // Simulation d'un test de connexion
                setTimeout(() => {
                  setLoading(false);
                  // Résultat aléatoire pour la démo
                  setTestResult(Math.random() > 0.3 ? 'success' : 'error');
                }, 2000);
              }}
            >
              Tester la connexion
            </Button>
          ) : testResult === 'success' ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              Connexion réussie ! Votre système de caisse est correctement configuré pour fonctionner avec Etika.
            </Alert>
          ) : (
            <Alert severity="error" sx={{ mt: 2 }}>
              Échec de la connexion. Veuillez vérifier vos paramètres et réessayer.
            </Alert>
          )}
        </Box>
      )
    },
    {
      label: 'Configuration des règles d\'attribution',
      description: 'Définissez comment les tokens sont attribués lors des transactions.',
      content: (
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Taux d'attribution (tokens par 10€)"
                variant="outlined"
                type="number"
                defaultValue="1"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Montant minimum de transaction (€)"
                variant="outlined"
                type="number"
                defaultValue="5"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Moment d'attribution</InputLabel>
                <Select
                  defaultValue="checkout"
                  label="Moment d'attribution"
                >
                  <MenuItem value="checkout">À la caisse</MenuItem>
                  <MenuItem value="delivery">À la livraison</MenuItem>
                  <MenuItem value="manual">Attribution manuelle</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: 'Activation',
      description: `Activez l'intégration pour commencer à utiliser Etika avec votre système de caisse.`,
      content: (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Vous êtes sur le point d'activer l'intégration entre Etika et votre système de caisse. Cela permettra d'automatiser l'attribution et l'utilisation des tokens.
          </Alert>
          <Button 
            variant="contained" 
            color="primary" 
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => {
              // Simulation d'activation
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                // Passer à la confirmation
                setActiveStep((prevActiveStep) => prevActiveStep + 1);
              }, 1500);
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "Activer l'intégration"}
          </Button>
        </Box>
      )
    },
  ];
  
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };
  
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  
  const handleReset = () => {
    setActiveStep(0);
    setPosSystem('');
    setTestResult(null);
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Intégration avec votre système de caisse
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Suivez les étapes ci-dessous pour connecter Etika à votre système de caisse et automatiser l'attribution des tokens.
      </Typography>
      
      <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 3 }}>
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>{step.label}</StepLabel>
            <StepContent>
              <Typography variant="body2" color="textSecondary">{step.description}</Typography>
              {step.content}
              <Box sx={{ mb: 2, mt: 3 }}>
                <div>
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    sx={{ mt: 1, mr: 1 }}
                    disabled={
                      (index === 0 && !posSystem) || 
                      (index === 2 && testResult !== 'success')
                    }
                  >
                    {index === steps.length - 1 ? 'Terminer' : 'Continuer'}
                  </Button>
                  <Button
                    disabled={index === 0}
                    onClick={handleBack}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Retour
                  </Button>
                </div>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>
      
      {activeStep === steps.length && (
        <Paper square elevation={0} sx={{ p: 3, mt: 3, bgcolor: 'background.default' }}>
          <Typography variant="h6" gutterBottom>
            Intégration terminée avec succès !
          </Typography>
          <Typography variant="body1" paragraph>
            Votre système de caisse est maintenant connecté à Etika. Vous pouvez commencer à émettre et accepter des tokens lors des transactions.
          </Typography>
          <Button onClick={handleReset} sx={{ mt: 1, mr: 1 }}>
            Réinitialiser
          </Button>
          <Button variant="contained" color="primary" sx={{ mt: 1, mr: 1 }}>
            Aller au tableau de bord
          </Button>
        </Paper>
      )}
      
      {/* Section d'aide et de support */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Besoin d'aide avec l'intégration ?
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Documentation technique
            </Typography>
            <Typography variant="body2" paragraph>
              Consultez notre documentation détaillée pour chaque système de caisse compatible.
            </Typography>
            <Button variant="outlined" size="small">
              Accéder à la documentation
            </Button>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Support technique
            </Typography>
            <Typography variant="body2" paragraph>
              Notre équipe est disponible pour vous aider avec votre intégration.
            </Typography>
            <Button variant="outlined" size="small">
              Contacter le support
            </Button>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Intégration personnalisée
            </Typography>
            <Typography variant="body2" paragraph>
              Besoin d'une solution sur mesure ? Nos experts peuvent vous accompagner.
            </Typography>
            <Button variant="outlined" size="small">
              Demander un devis
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default PosSystemConnector;

// src/components/merchant/integration/EcommerceIntegration.tsx
import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Tabs,
  Tab,
  Divider,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Card,
  CardContent
} from '@mui/material';
import { 
  ContentCopy as CopyIcon, 
  Code as CodeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Healing as HealingIcon
} from '@mui/icons-material';
import { useMerchant } from '../MerchantContext';
import { MerchantType } from '../../../models/merchant';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Composant d'intégration e-commerce
const EcommerceIntegration: React.FC = () => {
  const merchant = useMerchant();
  const [activeTab, setActiveTab] = useState(0);
  const [platform, setPlatform] = useState('shopify');
  const [apiKey, setApiKey] = useState('ek_live_12345abcdef');
  const [webhookUrl, setWebhookUrl] = useState('https://api.etika.com/webhooks/ecom_12345');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  const handlePlatformChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setPlatform(event.target.value as string);
  };
  
  const handleCopyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };
  
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };
  
  // Exemple de code pour différentes plateformes
  const getCodeSample = () => {
    switch (platform) {
      case 'shopify':
        return `<!-- Ajouter ce code dans le fichier theme.liquid -->
<script>
  // Etika Tokens Integration
  var etikaConfig = {
    apiKey: "${apiKey}",
    shopId: "{{ shop.id }}",
    customerId: "{{ customer.id }}"
  };
  
  (function() {
    var e = document.createElement('script');
    e.src = 'https://cdn.etika.com/js/shopify-integration.js';
    e.async = true;
    document.head.appendChild(e);
  })();
</script>

<!-- Ajouter ce code dans checkout.liquid pour l'attribution de tokens -->
<div id="etika-token-attribution"></div>`;

      case 'woocommerce':
        return `// Ajouter ce code dans functions.php de votre thème WordPress
function etika_tokens_integration() {
  if (is_checkout() || is_cart()) {
    ?>
    <script>
      // Etika Tokens Integration
      var etikaConfig = {
        apiKey: "${apiKey}",
        shopId: "<?php echo get_current_blog_id(); ?>",
        customerId: "<?php echo get_current_user_id(); ?>"
      };
      
      (function() {
        var e = document.createElement('script');
        e.src = 'https://cdn.etika.com/js/woocommerce-integration.js';
        e.async = true;
        document.head.appendChild(e);
      })();
    </script>
    <?php
  }
}
add_action('wp_footer', 'etika_tokens_integration');

// Ajouter ce hook pour l'attribution des tokens après commande
function etika_order_completed($order_id) {
  $order = wc_get_order($order_id);
  $total = $order->get_total();
  
  // Appel API pour attribution des tokens
  $response = wp_remote_post('https://api.etika.com/v1/tokens/attribute', [
    'headers' => [
      'Authorization' => 'Bearer ${apiKey}',
      'Content-Type' => 'application/json'
    ],
    'body' => json_encode([
      'orderId' => $order_id,
      'customerId' => $order->get_customer_id(),
      'amount' => $total
    ])
  ]);
}
add_action('woocommerce_order_status_completed', 'etika_order_completed');`;

      case 'prestashop':
        return `// Code à ajouter dans un module PrestaShop personnalisé

// Dans le fichier principal du module
public function hookDisplayFooter($params)
{
    $customer_id = $this->context->customer->id;
    $shop_id = $this->context->shop->id;
    
    $this->context->smarty->assign([
        'etika_api_key' => '${apiKey}',
        'etika_shop_id' => $shop_id,
        'etika_customer_id' => $customer_id
    ]);
    
    return $this->display(__FILE__, 'views/templates/hook/footer.tpl');
}

// Dans le fichier views/templates/hook/footer.tpl
<script>
  // Etika Tokens Integration
  var etikaConfig = {
    apiKey: "{$etika_api_key}",
    shopId: "{$etika_shop_id}",
    customerId: "{$etika_customer_id}"
  };
  
  (function() {
    var e = document.createElement('script');
    e.src = 'https://cdn.etika.com/js/prestashop-integration.js';
    e.async = true;
    document.head.appendChild(e);
  })();
</script>

// Hook pour l'attribution des tokens après commande
public function hookActionOrderStatusUpdate($params)
{
    $order = $params['order'];
    
    // Vérifier si la commande est en statut "payé"
    if ($params['newOrderStatus']->id == _PS_OS_PAYMENT_) {
        $total = $order->total_
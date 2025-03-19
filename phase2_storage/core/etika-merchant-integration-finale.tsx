// Complément du fichier EcommerceIntegration.tsx
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
  
  const handlePlatformChange = (event: any) => {
    setPlatform(event.target.value);
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
            'orderId' => $order->id,
            'customerId' => $customer_id,
            'amount' => $total
        ];
        
        $options = [
            'http' => [
                'header'  => "Content-type: application/json\r\nAuthorization: Bearer ${apiKey}\r\n",
                'method'  => 'POST',
                'content' => json_encode($data)
            ]
        ];
        
        $context  = stream_context_create($options);
        $result = file_get_contents($api_url, false, $context);
    }
}`;

      case 'magento':
        return `// Intégration Magento 2 - Ajouter à un module personnalisé

// Dans le fichier view/frontend/layout/default.xml
<?xml version="1.0"?>
<page xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="urn:magento:framework:View/Layout/etc/page_configuration.xsd">
    <body>
        <referenceContainer name="before.body.end">
            <block class="Vendor\\Module\\Block\\EtikaIntegration" name="etika_integration" template="Vendor_Module::etika_integration.phtml" />
        </referenceContainer>
    </body>
</page>

// Dans le fichier view/frontend/templates/etika_integration.phtml
<?php
$customerId = $block->getCustomerId();
$storeId = $block->getStoreId();
?>
<script>
    // Etika Tokens Integration
    var etikaConfig = {
        apiKey: "<?php echo $block->getApiKey(); ?>",
        shopId: "<?php echo $storeId; ?>",
        customerId: "<?php echo $customerId; ?>"
    };
    
    (function() {
        var e = document.createElement('script');
        e.src = 'https://cdn.etika.com/js/magento-integration.js';
        e.async = true;
        document.head.appendChild(e);
    })();
</script>

// Dans le fichier Observer/OrderComplete.php
namespace Vendor\\Module\\Observer;

use Magento\\Framework\\Event\\ObserverInterface;
use Magento\\Framework\\Event\\Observer;

class OrderComplete implements ObserverInterface
{
    protected $curl;
    
    public function __construct(
        \\Magento\\Framework\\HTTP\\Client\\Curl $curl
    ) {
        $this->curl = $curl;
    }
    
    public function execute(Observer $observer)
    {
        $order = $observer->getEvent()->getOrder();
        $customerId = $order->getCustomerId();
        $total = $order->getGrandTotal();
        
        // Préparation de la requête API
        $apiUrl = 'https://api.etika.com/v1/tokens/attribute';
        $this->curl->addHeader('Content-Type', 'application/json');
        $this->curl->addHeader('Authorization', 'Bearer ${apiKey}');
        
        $params = [
            'orderId' => $order->getIncrementId(),
            'customerId' => $customerId,
            'amount' => $total
        ];
        
        $this->curl->post($apiUrl, json_encode($params));
    }
}`;

      default:
        return `// Aucun exemple de code disponible pour cette plateforme
// Contactez notre équipe de support pour une intégration personnalisée`;
    }
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Intégration E-commerce
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Intégrez Etika à votre site e-commerce pour permettre l'attribution et l'utilisation des tokens lors des achats en ligne.
      </Typography>
      
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="Configuration" />
        <Tab label="Code d'intégration" />
        <Tab label="Webhooks" />
        <Tab label="Test" />
      </Tabs>
      
      {activeTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Paramètres d'intégration
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>Plateforme E-commerce</InputLabel>
                <Select
                  value={platform}
                  label="Plateforme E-commerce"
                  onChange={handlePlatformChange}
                >
                  <MenuItem value="shopify">Shopify</MenuItem>
                  <MenuItem value="woocommerce">WooCommerce (WordPress)</MenuItem>
                  <MenuItem value="prestashop">PrestaShop</MenuItem>
                  <MenuItem value="magento">Magento 2</MenuItem>
                  <MenuItem value="custom">Solution personnalisée</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="URL de la boutique"
                variant="outlined"
                defaultValue="https://maboutique.com"
                margin="normal"
              />
              <TextField
                fullWidth
                label="Clé API"
                variant="outlined"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                margin="normal"
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <Tooltip title="Copier">
                      <IconButton onClick={() => handleCopyToClipboard(apiKey, "Clé API copiée dans le presse-papier")}>
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Options d'attribution des tokens
              </Typography>
              <TextField
                fullWidth
                label="Taux d'attribution (tokens par 10€)"
                variant="outlined"
                type="number"
                defaultValue="1"
                margin="normal"
              />
              <TextField
                fullWidth
                label="Montant minimum de commande (€)"
                variant="outlined"
                type="number"
                defaultValue="10"
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Moment d'attribution</InputLabel>
                <Select
                  defaultValue="payment"
                  label="Moment d'attribution"
                >
                  <MenuItem value="payment">Au paiement</MenuItem>
                  <MenuItem value="shipping">À l'expédition</MenuItem>
                  <MenuItem value="delivery">À la livraison</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Options avancées
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth margin="normal">
                    <InputLabel>Environnement</InputLabel>
                    <Select
                      defaultValue="production"
                      label="Environnement"
                    >
                      <MenuItem value="sandbox">Sandbox (test)</MenuItem>
                      <MenuItem value="production">Production</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Webhook URL de notification"
                    variant="outlined"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    margin="normal"
                    InputProps={{
                      endAdornment: (
                        <Tooltip title="Copier">
                          <IconButton onClick={() => handleCopyToClipboard(webhookUrl, "URL de webhook copiée dans le presse-papier")}>
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="flex-end" mt={2}>
                <Button variant="contained" color="primary">
                  Enregistrer les paramètres
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Code d'intégration pour {platform === 'shopify' ? 'Shopify' : 
                                      platform === 'woocommerce' ? 'WooCommerce' : 
                                      platform === 'prestashop' ? 'PrestaShop' : 
                                      platform === 'magento' ? 'Magento 2' : 'votre plateforme'}
            </Typography>
            <Button 
              variant="outlined" 
              startIcon={<CopyIcon />}
              onClick={() => handleCopyToClipboard(getCodeSample(), "Code d'intégration copié dans le presse-papier")}
            >
              Copier le code
            </Button>
          </Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Ajoutez ce code à votre site e-commerce pour intégrer Etika et permettre l'attribution et l'utilisation des tokens.
          </Alert>
          <Box sx={{ bgcolor: '#282a36', borderRadius: 1, mt: 2 }}>
            <SyntaxHighlighter 
              language={platform === 'shopify' ? 'html' : 'php'} 
              style={dracula}
              showLineNumbers
            >
              {getCodeSample()}
            </SyntaxHighlighter>
          </Box>
          <Box mt={3}>
            <Typography variant="subtitle1" gutterBottom>
              Étapes d'installation
            </Typography>
            <ol>
              <li>Copiez le code ci-dessus</li>
              <li>Accédez à l'administration de votre plateforme e-commerce</li>
              <li>Collez le code à l'emplacement indiqué dans les commentaires</li>
              <li>Enregistrez les modifications</li>
              <li>Testez l'intégration en effectuant une commande test</li>
            </ol>
          </Box>
        </Paper>
      )}
      
      {activeTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Configuration des Webhooks
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Les webhooks permettent à Etika de notifier votre système lorsque des événements importants se produisent, comme l'utilisation de tokens.
          </Alert>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    URL de Webhook
                  </Typography>
                  <TextField
                    fullWidth
                    value={webhookUrl}
                    variant="outlined"
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <Tooltip title="Copier">
                          <IconButton onClick={() => handleCopyToClipboard(webhookUrl, "URL de webhook copiée dans le presse-papier")}>
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                      ),
                    }}
                  />
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                    Configurez votre système pour accepter les requêtes POST à cette URL
                  </Typography>
                </CardContent>
              </Card>
              
              <Typography variant="subtitle1" gutterBottom>
                Événements disponibles
              </Typography>
              <Grid container spacing={1}>
                {['token.created', 'token.used', 'token.expired', 'customer.registered'].map((event) => (
                  <Grid item xs={6} key={event}>
                    <FormControlLabel
                      control={<Switch defaultChecked />}
                      label={event}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Format de la payload
              </Typography>
              <Box sx={{ bgcolor: '#282a36', borderRadius: 1, p: 2, mb: 2 }}>
                <SyntaxHighlighter language="json" style={dracula}>
                  {`{
  "event": "token.used",
  "timestamp": "2025-02-07T14:32:21Z",
  "data": {
    "token_id": "tk_12345",
    "merchant_id": "mer_6789",
    "customer_id": "cus_54321",
    "amount": 50,
    "transaction_id": "txn_123456789"
  }
}`}
                </SyntaxHighlighter>
              </Box>
              <Typography variant="subtitle1" gutterBottom>
                Test de Webhook
              </Typography>
              <Button 
                variant="outlined" 
                color="primary" 
                startIcon={<HealingIcon />}
                fullWidth
              >
                Envoyer un webhook test
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {activeTab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Tester l'intégration
          </Typography>
          <Alert severity="warning" sx={{ mb: 3 }}>
            Utilisez cet environnement de test pour vérifier que votre intégration fonctionne correctement avant de passer en production.
          </Alert>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Simuler une commande
              </Typography>
              <TextField
                fullWidth
                label="Montant de la commande"
                variant="outlined"
                type="number"
                defaultValue="100"
                margin="normal"
              />
              <TextField
                fullWidth
                label="ID Client (test)"
                variant="outlined"
                defaultValue="cust_test_123"
                margin="normal"
              />
              <Button 
                variant="contained" 
                color="primary"
                fullWidth
                sx={{ mt: 2 }}
              >
                Simuler une commande
              </Button>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Vérifier les tokens attribués
              </Typography>
              <TextField
                fullWidth
                label="ID Client"
                variant="outlined"
                defaultValue="cust_test_123"
                margin="normal"
              />
              <Button 
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
              >
                Vérifier les tokens
              </Button>
              
              <Paper sx={{ p: 2, mt: 3, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Résultat:
                </Typography>
                <Box display="flex" alignItems="center">
                  <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                  <Typography>
                    10 tokens attribués avec succès au client cust_test_123
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {/* Documentation et aides */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Ressources d'aide à l'intégration
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Documentation complète
            </Typography>
            <Typography variant="body2" paragraph>
              Consultez notre documentation détaillée pour l'intégration e-commerce.
            </Typography>
            <Button variant="text" startIcon={<CodeIcon />}>
              Voir la documentation
            </Button>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Plugins officiels
            </Typography>
            <Typography variant="body2" paragraph>
              Téléchargez nos plugins pour faciliter l'intégration.
            </Typography>
            <Button variant="text" startIcon={<DownloadIcon />}>
              Télécharger les plugins
            </Button>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Support technique
            </Typography>
            <Typography variant="body2" paragraph>
              Besoin d'aide ? Notre équipe est là pour vous assister.
            </Typography>
            <Button variant="text">
              Contacter le support
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Snackbar de notification */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default EcommerceIntegration;

// src/pages/merchant/MerchantPortalLanding.tsx - Page d'accueil du portail pour tous types de commerçants
import React from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Button,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Divider
} from '@mui/material';
import { 
  Speed as SpeedIcon,
  LocalOffer as TokenIcon,
  Store as StoreIcon, 
  Computer as OnlineIcon,
  Assessment as AnalyticsIcon,
  EventNote as CalendarIcon
} from '@mui/icons-material';
import { useMerchant } from '../../components/merchant/MerchantContext';
import MerchantTypeIndicator from '../../components/merchant/MerchantTypeIndicator';
import { useNavigate } from 'react-router-dom';

const MerchantPortalLanding: React.FC = () => {
  const merchant = useMerchant();
  const navigate = useNavigate();
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Bienvenue dans votre espace commerçant
          </Typography>
          <MerchantTypeIndicator />
        </Box>
        <Button 
          variant="contained" 
          color="primary"
          onClick={() => navigate('/merchant')}
        >
          Accéder à mon tableau de bord
        </Button>
      </Box>
      
      {/* Cartes de démarrage rapide */}
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Démarrage rapide
      </Typography>
      <Grid container spacing={3} sx={{ mb: 6 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <TokenIcon />
                </Avatar>
                <Typography variant="h6">
                  Programme de fidélité
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Configurez votre programme de fidélité basé sur les tokens Etika pour fidéliser vos clients.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => navigate('/merchant/loyalty')}>
                Configurer
              </Button>
            </CardActions>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  {merchant.hasEcommerceCapabilities ? <OnlineIcon /> : <StoreIcon />}
                </Avatar>
                <Typography variant="h6">
                  {merchant.hasEcommerceCapabilities ? 'Intégration e-commerce' : 'Connecter votre caisse'}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                {merchant.hasEcommerceCapabilities 
                  ? 'Intégrez Etika à votre boutique en ligne pour attribuer des tokens lors des achats.'
                  : 'Connectez votre système de caisse à Etika pour automatiser l\'attribution des tokens.'}
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                onClick={() => navigate(merchant.hasEcommerceCapabilities ? '/merchant/ecommerce' : '/merchant/pos')}
              >
                Configurer
              </Button>
            </CardActions>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <AnalyticsIcon />
                </Avatar>
                <Typography variant="h6">
                  Statistiques et performance
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" paragraph>
                Consultez les statistiques de votre activité et mesurez l'impact de votre programme de fidélité.
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" onClick={() => navigate('/merchant/analytics')}>
                Consulter
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
      
      {/* Section Actualités */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Actualités et mises à jour
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box display="flex" alignItems="center" mb={1}>
              <CalendarIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1" fontWeight="bold">
                03 février 2025
              </Typography>
            </Box>
            <Typography variant="subtitle1" gutterBottom>
              Nouvelle fonctionnalité de campagne promotionnelle disponible
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Créez des campagnes ciblées pour booster votre programme de fidélité.
            </Typography>
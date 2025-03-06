// etika-payment-integration/src/main.rs
// Module principal d'intégration des cartes de paiement

mod transaction_manager;
mod fallback;

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, mpsc};
use uuid::Uuid;
use serde::{Serialize, Deserialize};
use clap::{App, Arg, SubCommand};

// Re-exports
pub use crate::lib::{
    PaymentCard, PaymentTransaction, TransactionStatus, CardType, CardExpiry,
    Amount, PopMetadata, PaymentConnector, PaymentConnectorManager, PaymentConfig,
    PaymentConnectorFactory, ConnectorType, PaymentError, PaymentResult
};

use crate::transaction_manager::{
    TransactionManager, TransactionManagerConfig, PopConsensusClient, 
    TokenSystemClient, EtikaPopConsensusClient, EtikaTokenSystemClient,
    PopError, TokenError, PopStatus
};

use crate::fallback::{
    FallbackManager, FallbackConfig, FallbackType, FailedTransaction,
    FallbackNotification, FallbackNotificationStatus
};

// ======== Configuration ========

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PaymentIntegrationConfig {
    // Configuration des connecteurs de paiement
    pub payment_connector_config: PaymentConfig,
    
    // Configuration du gestionnaire de transactions
    pub transaction_manager_config: TransactionManagerConfig,
    
    // Configuration du gestionnaire de fallback
    pub fallback_config: FallbackConfig,
    
    // Endpoints API
    pub pop_consensus_api_endpoint: String,
    pub token_system_api_endpoint: String,
    pub platform_api_endpoint: String,
    
    // Timeouts (secondes)
    pub pop_consensus_timeout_seconds: u64,
    pub token_system_timeout_seconds: u64,
    
    // Métriques et monitoring
    pub metrics_enabled: bool,
    pub metrics_endpoint: Option<String>,
    
    // Environnement (dev, test, prod)
    pub environment: String,
}

impl Default for PaymentIntegrationConfig {
    fn default() -> Self {
        Self {
            payment_connector_config: PaymentConfig {
                visa_api_key: "test_visa_key".into(),
                visa_api_secret: "test_visa_secret".into(),
                visa_endpoint: "https://sandbox.api.visa.com".into(),
                mastercard_api_key: "test_mastercard_key".into(),
                mastercard_merchant_id: "test_merchant".into(),
                mastercard_endpoint: "https://sandbox.api.mastercard.com".into(),
            },
            transaction_manager_config: TransactionManagerConfig::default(),
            fallback_config: FallbackConfig::default(),
            pop_consensus_api_endpoint: "http://localhost:3001/api/v1".into(),
            token_system_api_endpoint: "http://localhost:3002/api/v1".into(),
            platform_api_endpoint: "http://localhost:3000/api/v1".into(),
            pop_consensus_timeout_seconds: 5,
            token_system_timeout_seconds: 5,
            metrics_enabled: false,
            metrics_endpoint: None,
            environment: "development".into(),
        }
    }
}

// ======== API de la plateforme ========

/// Structure pour les requêtes de paiement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentRequest {
    pub merchant_id: String,
    pub consumer_id: String,
    pub amount: Amount,
    pub card_token: String,
    pub card_type: String,
    pub card_expiry_month: u8,
    pub card_expiry_year: u16,
    pub receipt_data: String,
    pub supplier_ids: Vec<String>,
    pub token_refs: Vec<String>,
}

/// Structure pour les réponses de paiement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentResponse {
    pub transaction_id: String,
    pub status: String,
    pub transaction_time: String,
    pub error: Option<String>,
}

// ======== Service d'intégration des paiements ========

/// Service principal d'intégration des cartes de paiement
pub struct PaymentIntegrationService {
    /// Gestionnaire de connecteurs de paiement
    payment_connector_manager: Arc<PaymentConnectorManager>,
    
    /// Gestionnaire de transactions synchronisées
    transaction_manager: Arc<TransactionManager>,
    
    /// Gestionnaire de fallback
    fallback_manager: Arc<Mutex<FallbackManager>>,
    
    /// Clients pour les systèmes externes
    pop_client: Arc<dyn PopConsensusClient>,
    token_client: Arc<dyn TokenSystemClient>,
    
    /// Configuration
    config: PaymentIntegrationConfig,
    
    /// Canal pour recevoir les notifications de fallback
    _fallback_notification_rx: Option<mpsc::Receiver<FallbackNotification>>,
    
    /// État de service
    running: bool,
}

impl PaymentIntegrationService {
    /// Crée une nouvelle instance du service
    pub fn new(config: PaymentIntegrationConfig) -> Self {
        // Créer les clients pour les systèmes externes
        let pop_client = Arc::new(EtikaPopConsensusClient::new(
            config.pop_consensus_api_endpoint.clone(),
            config.pop_consensus_timeout_seconds,
        ));
        
        let token_client = Arc::new(EtikaTokenSystemClient::new(
            config.token_system_api_endpoint.clone(),
            config.token_system_timeout_seconds,
        ));
        
        // Créer le gestionnaire de connecteurs
        let payment_connector_manager = Arc::new(PaymentConnectorManager::new(
            config.payment_connector_config.clone(),
        ));
        
        // Créer le gestionnaire de transactions
        let transaction_manager = Arc::new(TransactionManager::new(
            payment_connector_manager.clone(),
            pop_client.clone(),
            token_client.clone(),
            config.transaction_manager_config.clone(),
        ));
        
        // Créer le gestionnaire de fallback
        let (mut fallback_manager, fallback_notification_rx) = FallbackManager::new(
            transaction_manager.clone(),
            payment_connector_manager.clone(),
            pop_client.clone(),
            token_client.clone(),
            config.fallback_config.clone(),
        );
        
        // Créer le service
        let mut service = Self {
            payment_connector_manager,
            transaction_manager,
            fallback_manager: Arc::new(Mutex::new(fallback_manager)),
            pop_client,
            token_client,
            config,
            _fallback_notification_rx: Some(fallback_notification_rx),
            running: false,
        };
        
        service
    }
    
    /// Démarre le service
    pub async fn start(&mut self) -> Result<(), String> {
        if self.running {
            return Err("Service déjà démarré".into());
        }
        
        println!("Démarrage du service d'intégration des paiements...");
        
        // Démarrer le gestionnaire de transactions
        let mut transaction_manager = match Arc::get_mut(&mut self.transaction_manager) {
            Some(manager) => manager,
            None => return Err("Impossible d'accéder au gestionnaire de transactions".into()),
        };
        
        transaction_manager.start();
        
        // Démarrer le gestionnaire de fallback
        let mut fallback_manager = self.fallback_manager.lock().await;
        fallback_manager.start();
        
        // Configurer le gestionnaire de notifications
        let fallback_notification_rx = self._fallback_notification_rx.take()
            .ok_or_else(|| "Récepteur de notifications déjà consommé".to_string())?;
            
        let notification_task = tokio::spawn(async move {
            Self::process_fallback_notifications(fallback_notification_rx).await;
        });
        
        // Marquer le service comme démarré
        self.running = true;
        
        println!("Service d'intégration des paiements démarré");
        
        Ok(())
    }
    
    /// Traite les notifications de fallback
    async fn process_fallback_notifications(mut rx: mpsc::Receiver<FallbackNotification>) {
        while let Some(notification) = rx.recv().await {
            println!("Notification de fallback: {:?}", notification);
            
            // Ici, on pourrait envoyer les notifications à un système externe,
            // une file d'attente de messages, ou un tableau de bord d'administration
        }
    }
    
    /// Traite une requête de paiement
    pub async fn process_payment_request(&self, request: PaymentRequest) -> Result<PaymentResponse, String> {
        if !self.running {
            return Err("Service non démarré".into());
        }
        
        println!("Traitement de la requête de paiement pour le consommateur {}", request.consumer_id);
        
        // Créer un ID de transaction unique
        let transaction_id = Uuid::new_v4().to_string();
        
        // Créer la carte de paiement
        let card_type = match request.card_type.to_lowercase().as_str() {
            "visa" => CardType::Visa,
            "mastercard" => CardType::Mastercard,
            "amex" | "american_express" => CardType::AmericanExpress,
            "cb" | "cartes_bancaires" => CardType::CartesBancaires,
            other => CardType::Other(other.to_string()),
        };
        
        let card = PaymentCard {
            token: request.card_token.clone(),
            card_type,
            expiry: CardExpiry {
                month: request.card_expiry_month,
                year: request.card_expiry_year,
            },
            issuer_id: None,
        };
        
        // Créer les métadonnées PoP
        let pop_metadata = PopMetadata {
            receipt_data: request.receipt_data.clone(),
            supplier_ids: request.supplier_ids.clone(),
            token_refs: request.token_refs.clone(),
        };
        
        // Créer la transaction
        let transaction = PaymentTransaction {
            id: transaction_id.clone(),
            amount: request.amount.clone(),
            timestamp: chrono::Utc::now(),
            merchant_id: request.merchant_id.clone(),
            consumer_id: request.consumer_id.clone(),
            pop_metadata,
            status: TransactionStatus::Initiated,
        };
        
        // Traiter la transaction synchronisée
        let result = self.transaction_manager.process_synchronized_transaction(transaction.clone(), card.clone()).await;
        
        match result {
            Ok(updated_transaction) => {
                // Transaction réussie
                Ok(PaymentResponse {
                    transaction_id: updated_transaction.id,
                    status: format!("{:?}", updated_transaction.status),
                    transaction_time: updated_transaction.timestamp.to_rfc3339(),
                    error: None,
                })
            },
            Err(e) => {
                // Transaction échouée, enregistrer dans le fallback
                let fallback_type = match &e {
                    PaymentError::CardDeclined(_) | PaymentError::AuthenticationError(_) => {
                        FallbackType::PaymentFailure
                    },
                    PaymentError::PopError(_) => FallbackType::PopFailure,
                    PaymentError::Timeout(_) => FallbackType::Timeout,
                    _ => FallbackType::PaymentFailure,
                };
                
                // Déterminer l'état de la transaction pour le fallback
                let payment_completed = matches!(transaction.status, 
                    TransactionStatus::PaymentCompleted | TransactionStatus::PopProcessing | 
                    TransactionStatus::PopCompleted | TransactionStatus::Completed);
                    
                let pop_completed = matches!(transaction.status,
                    TransactionStatus::PopCompleted | TransactionStatus::Completed);
                    
                // Ajouter au gestionnaire de fallback
                let mut fallback_manager = self.fallback_manager.lock().await;
                let _ = fallback_manager.add_failed_transaction(
                    transaction.clone(),
                    Some(card),
                    fallback_type,
                    format!("{}", e),
                    payment_completed,
                    None, // Nous n'avons pas d'ID de validation PoP ici
                    pop_completed,
                    false, // Les tokens ne sont pas activés si la transaction a échoué
                ).await;
                
                // Retourner l'erreur au client
                Ok(PaymentResponse {
                    transaction_id: transaction.id,
                    status: format!("{:?}", transaction.status),
                    transaction_time: transaction.timestamp.to_rfc3339(),
                    error: Some(format!("{}", e)),
                })
            }
        }
    }
    
    /// Vérifie le statut d'une transaction
    pub async fn check_transaction_status(&self, transaction_id: &str) -> Result<PaymentResponse, String> {
        if !self.running {
            return Err("Service non démarré".into());
        }
        
        // Chercher d'abord dans les transactions en fallback
        let fallback_manager = self.fallback_manager.lock().await;
        if let Some(failed_tx) = fallback_manager.get_failed_transaction(transaction_id).await {
            return Ok(PaymentResponse {
                transaction_id: failed_tx.transaction.id,
                status: format!("{:?}", failed_tx.transaction.status),
                transaction_time: failed_tx.transaction.timestamp.to_rfc3339(),
                error: Some(failed_tx.error_details),
            });
        }
        
        // Si non trouvée en fallback, essayer de la récupérer depuis les connecteurs
        // Cela nécessiterait d'implémenter un mécanisme de stockage des transactions
        // Pour cette démo, on retourne simplement une erreur
        
        Err(format!("Transaction {} non trouvée", transaction_id))
    }
    
    /// Arrête le service
    pub async fn shutdown(&mut self) -> Result<(), String> {
        if !self.running {
            return Err("Service non démarré".into());
        }
        
        println!("Arrêt du service d'intégration des paiements...");
        
        // Arrêter le gestionnaire de fallback
        let mut fallback_manager = self.fallback_manager.lock().await;
        fallback_manager.shutdown().await;
        
        // Arrêter le gestionnaire de transactions
        let mut transaction_manager = match Arc::get_mut(&mut self.transaction_manager) {
            Some(manager) => manager,
            None => return Err("Impossible d'accéder au gestionnaire de transactions".into()),
        };
        
        transaction_manager.shutdown().await;
        
        // Marquer le service comme arrêté
        self.running = false;
        
        println!("Service d'intégration des paiements arrêté");
        
        Ok(())
    }
}

// ======== Interface REST pour le service ========

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

async fn handle_payment_request(
    service: Arc<Mutex<PaymentIntegrationService>>,
    request: PaymentRequest
) -> ApiResponse<PaymentResponse> {
    let service = service.lock().await;
    
    match service.process_payment_request(request).await {
        Ok(response) => {
            let success = response.error.is_none();
            ApiResponse {
                success,
                data: Some(response),
                error: response.error,
            }
        },
        Err(e) => ApiResponse {
            success: false,
            data: None,
            error: Some(e),
        },
    }
}

async fn handle_status_check(
    service: Arc<Mutex<PaymentIntegrationService>>,
    transaction_id: String
) -> ApiResponse<PaymentResponse> {
    let service = service.lock().await;
    
    match service.check_transaction_status(&transaction_id).await {
        Ok(response) => {
            let success = response.error.is_none();
            ApiResponse {
                success,
                data: Some(response),
                error: response.error,
            }
        },
        Err(e) => ApiResponse {
            success: false,
            data: None,
            error: Some(e),
        },
    }
}

// ======== Fonction principale ========

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parser les arguments de ligne de commande
    let matches = App::new("etika-payment-integration")
        .version("0.1.0")
        .author("Équipe Étika")
        .about("Service d'intégration des cartes de paiement pour Étika")
        .arg(Arg::with_name("config")
            .short("c")
            .long("config")
            .value_name("FILE")
            .help("Chemin vers le fichier de configuration")
            .takes_value(true))
        .arg(Arg::with_name("port")
            .short("p")
            .long("port")
            .value_name("PORT")
            .help("Port d'écoute pour l'API REST")
            .takes_value(true)
            .default_value("3003"))
        .subcommand(SubCommand::with_name("serve")
            .about("Démarre le serveur API REST"))
        .subcommand(SubCommand::with_name("export-fallback")
            .about("Exporte les transactions en fallback vers un fichier JSON")
            .arg(Arg::with_name("output")
                .short("o")
                .long("output")
                .value_name("FILE")
                .help("Chemin du fichier de sortie")
                .takes_value(true)
                .required(true)))
        .subcommand(SubCommand::with_name("import-fallback")
            .about("Importe des transactions en fallback depuis un fichier JSON")
            .arg(Arg::with_name("input")
                .short("i")
                .long("input")
                .value_name("FILE")
                .help("Chemin du fichier d'entrée")
                .takes_value(true)
                .required(true)))
        .get_matches();
    
    // Charger la configuration
    let config_path = matches.value_of("config").unwrap_or("config/default.json");
    let config = if std::path::Path::new(config_path).exists() {
        let config_str = std::fs::read_to_string(config_path)?;
        serde_json::from_str::<PaymentIntegrationConfig>(&config_str)?
    } else {
        println!("Fichier de configuration non trouvé, utilisation des valeurs par défaut");
        PaymentIntegrationConfig::default()
    };
    
    // Créer le service
    let mut service = PaymentIntegrationService::new(config);
    
    // Traiter les sous-commandes
    if let Some(_) = matches.subcommand_matches("serve") {
        // Démarrer le service
        service.start().await?;
        
        // Configurer le serveur REST
        let port = matches.value_of("port").unwrap_or("3003").parse::<u16>()?;
        println!("Serveur API REST démarré sur le port {}", port);
        
        // Ici, on mettrait en place un serveur REST (avec warp, actix-web, etc.)
        // Pour cette démo, on simule simplement l'attente d'une commande de l'utilisateur
        
        println!("Appuyez sur Entrée pour arrêter le service");
        let mut input = String::new();
        std::io::stdin().read_line(&mut input)?;
        
        // Arrêter le service
        service.shutdown().await?;
    } else if let Some(export_matches) = matches.subcommand_matches("export-fallback") {
        // Exporter les transactions en fallback
        service.start().await?;
        
        let output_path = export_matches.value_of("output").unwrap();
        
        let fallback_manager = service.fallback_manager.lock().await;
        let json_data = fallback_manager.export_failed_transactions().await?;
        
        std::fs::write(output_path, json_data)?;
        println!("Transactions en fallback exportées vers {}", output_path);
        
        service.shutdown().await?;
    } else if let Some(import_matches) = matches.subcommand_matches("import-fallback") {
        // Importer des transactions en fallback
        service.start().await?;
        
        let input_path = import_matches.value_of("input").unwrap();
        let json_data = std::fs::read_to_string(input_path)?;
        
        let mut fallback_manager = service.fallback_manager.lock().await;
        let count = fallback_manager.import_failed_transactions(&json_data).await?;
        
        println!("{} transactions importées depuis {}", count, input_path);
        
        service.shutdown().await?;
    } else {
        // Pas de sous-commande, afficher l'aide
        println!("{}", matches.usage());
    }
    
    Ok(())
}

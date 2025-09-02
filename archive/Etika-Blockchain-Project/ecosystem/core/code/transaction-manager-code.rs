// etika-payment-integration/src/transaction_manager.rs
// Gestionnaire de transactions pour la synchronisation entre transaction standard et PoP

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use async_trait::async_trait;
use tokio::sync::{Mutex, oneshot, mpsc};
use tokio::time::timeout;
use uuid::Uuid;
use thiserror::Error;
use serde::{Serialize, Deserialize};

use crate::{
    PaymentCard, PaymentTransaction, TransactionStatus, 
    PaymentConnector, PaymentConnectorManager, PaymentError, PaymentResult,
    CardType, Amount, PopMetadata
};

// ======== Erreurs liées au PoP ========

#[derive(Error, Debug)]
pub enum PopError {
    #[error("Validation échouée: {0}")]
    ValidationFailed(String),
    
    #[error("Timeout de validation: {0}")]
    Timeout(String),
    
    #[error("Erreur de communication: {0}")]
    CommunicationError(String),
    
    #[error("Données invalides: {0}")]
    InvalidData(String),
    
    #[error("Erreur interne: {0}")]
    InternalError(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PopStatus {
    Pending,
    InProgress,
    Validated,
    Rejected(String),
    Expired,
}

// ======== Erreurs liées aux tokens ========

#[derive(Error, Debug)]
pub enum TokenError {
    #[error("Activation échouée: {0}")]
    ActivationFailed(String),
    
    #[error("Tokens insuffisants: {0}")]
    InsufficientTokens(String),
    
    #[error("Erreur de communication: {0}")]
    CommunicationError(String),
    
    #[error("Erreur interne: {0}")]
    InternalError(String),
}

// ======== Interfaces avec les systèmes externes ========

/// Interface pour communiquer avec le système de consensus PoP
#[async_trait]
pub trait PopConsensusClient: Send + Sync {
    /// Initie une validation PoP
    async fn initiate_pop_validation(
        &self, 
        transaction_id: &str, 
        pop_metadata: &PopMetadata
    ) -> Result<String, PopError>;
    
    /// Vérifie le statut d'une validation PoP
    async fn check_pop_status(&self, validation_id: &str) -> Result<PopStatus, PopError>;
    
    /// Annule une validation PoP
    async fn cancel_pop_validation(&self, validation_id: &str) -> Result<(), PopError>;
}

/// Interface pour communiquer avec le système de tokens
#[async_trait]
pub trait TokenSystemClient: Send + Sync {
    /// Active des tokens après une transaction réussie
    async fn activate_tokens(
        &self,
        transaction_id: &str,
        consumer_id: &str,
        token_refs: &[String],
        amount: &Amount
    ) -> Result<(), TokenError>;
    
    /// Vérifie la disponibilité des tokens pour une transaction
    async fn check_tokens_availability(
        &self,
        consumer_id: &str,
        token_refs: &[String]
    ) -> Result<bool, TokenError>;
}

// ======== Implémentation de clients pour les systèmes externes ========

/// Implémentation du client PoP qui communique avec etika-pop-consensus
pub struct EtikaPopConsensusClient {
    api_endpoint: String,
    client: reqwest::Client,
    timeout: Duration,
}

impl EtikaPopConsensusClient {
    pub fn new(api_endpoint: String, timeout_seconds: u64) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_seconds))
            .build()
            .expect("Échec de construction du client HTTP");
            
        Self {
            api_endpoint,
            client,
            timeout: Duration::from_secs(timeout_seconds),
        }
    }
    
    async fn make_api_request<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        method: reqwest::Method,
        payload: Option<&T>
    ) -> Result<R, PopError> {
        let url = format!("{}{}", self.api_endpoint, path);
        
        let mut request_builder = self.client
            .request(method, &url)
            .header("Content-Type", "application/json");
            
        if let Some(data) = payload {
            request_builder = request_builder.json(data);
        }
        
        let response = request_builder.send().await
            .map_err(|e| PopError::CommunicationError(e.to_string()))?;
            
        if !response.status().is_success() {
            let error_text = response.text().await
                .unwrap_or_else(|_| "Erreur inconnue".into());
            return Err(PopError::ValidationFailed(error_text));
        }
        
        response.json::<R>().await
            .map_err(|e| PopError::InternalError(format!("Erreur de désérialisation: {}", e)))
    }
}

#[async_trait]
impl PopConsensusClient for EtikaPopConsensusClient {
    async fn initiate_pop_validation(
        &self,
        transaction_id: &str,
        pop_metadata: &PopMetadata
    ) -> Result<String, PopError> {
        // Structure de requête pour validation PoP
        #[derive(Serialize)]
        struct PopValidationRequest {
            transaction_id: String,
            receipt_data: String,
            supplier_ids: Vec<String>,
            token_references: Vec<String>,
        }
        
        // Structure de réponse
        #[derive(Deserialize)]
        struct PopValidationResponse {
            validation_id: String,
            status: String,
            error: Option<String>,
        }
        
        let request = PopValidationRequest {
            transaction_id: transaction_id.to_string(),
            receipt_data: pop_metadata.receipt_data.clone(),
            supplier_ids: pop_metadata.supplier_ids.clone(),
            token_references: pop_metadata.token_refs.clone(),
        };
        
        let response: PopValidationResponse = self.make_api_request(
            "/validations",
            reqwest::Method::POST,
            Some(&request)
        ).await?;
        
        if let Some(error) = response.error {
            return Err(PopError::ValidationFailed(error));
        }
        
        if response.status != "INITIATED" {
            return Err(PopError::ValidationFailed(format!("Statut invalide: {}", response.status)));
        }
        
        Ok(response.validation_id)
    }
    
    async fn check_pop_status(&self, validation_id: &str) -> Result<PopStatus, PopError> {
        // Structure de réponse
        #[derive(Deserialize)]
        struct PopStatusResponse {
            status: String,
            validation_id: String,
            error: Option<String>,
        }
        
        let path = format!("/validations/{}", validation_id);
        let response: PopStatusResponse = self.make_api_request(
            &path,
            reqwest::Method::GET,
            Option::<&()>::None
        ).await?;
        
        if let Some(error) = response.error {
            return Err(PopError::InternalError(error));
        }
        
        let status = match response.status.as_str() {
            "PENDING" => PopStatus::Pending,
            "IN_PROGRESS" => PopStatus::InProgress,
            "VALIDATED" => PopStatus::Validated,
            "REJECTED" => PopStatus::Rejected("Validation rejetée".into()),
            "EXPIRED" => PopStatus::Expired,
            other => return Err(PopError::InvalidData(format!("Statut non reconnu: {}", other))),
        };
        
        Ok(status)
    }
    
    async fn cancel_pop_validation(&self, validation_id: &str) -> Result<(), PopError> {
        // Structure de requête
        #[derive(Serialize)]
        struct CancelRequest {
            reason: String,
        }
        
        // Structure de réponse
        #[derive(Deserialize)]
        struct CancelResponse {
            status: String,
            error: Option<String>,
        }
        
        let request = CancelRequest {
            reason: "Transaction payment failed".into(),
        };
        
        let path = format!("/validations/{}/cancel", validation_id);
        let response: CancelResponse = self.make_api_request(
            &path,
            reqwest::Method::POST,
            Some(&request)
        ).await?;
        
        if let Some(error) = response.error {
            return Err(PopError::InternalError(error));
        }
        
        if response.status != "CANCELLED" {
            return Err(PopError::InternalError(format!("Échec d'annulation: {}", response.status)));
        }
        
        Ok(())
    }
}

/// Implémentation du client Token qui communique avec etika-token-system
pub struct EtikaTokenSystemClient {
    api_endpoint: String,
    client: reqwest::Client,
    timeout: Duration,
}

impl EtikaTokenSystemClient {
    pub fn new(api_endpoint: String, timeout_seconds: u64) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout_seconds))
            .build()
            .expect("Échec de construction du client HTTP");
            
        Self {
            api_endpoint,
            client,
            timeout: Duration::from_secs(timeout_seconds),
        }
    }
    
    async fn make_api_request<T: Serialize, R: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        method: reqwest::Method,
        payload: Option<&T>
    ) -> Result<R, TokenError> {
        let url = format!("{}{}", self.api_endpoint, path);
        
        let mut request_builder = self.client
            .request(method, &url)
            .header("Content-Type", "application/json");
            
        if let Some(data) = payload {
            request_builder = request_builder.json(data);
        }
        
        let response = request_builder.send().await
            .map_err(|e| TokenError::CommunicationError(e.to_string()))?;
            
        if !response.status().is_success() {
            let error_text = response.text().await
                .unwrap_or_else(|_| "Erreur inconnue".into());
            return Err(TokenError::ActivationFailed(error_text));
        }
        
        response.json::<R>().await
            .map_err(|e| TokenError::InternalError(format!("Erreur de désérialisation: {}", e)))
    }
}

#[async_trait]
impl TokenSystemClient for EtikaTokenSystemClient {
    async fn activate_tokens(
        &self,
        transaction_id: &str,
        consumer_id: &str,
        token_refs: &[String],
        amount: &Amount
    ) -> Result<(), TokenError> {
        // Structure de requête
        #[derive(Serialize)]
        struct ActivationRequest {
            transaction_id: String,
            consumer_id: String,
            token_references: Vec<String>,
            amount: u64,
            currency: String,
        }
        
        // Structure de réponse
        #[derive(Deserialize)]
        struct ActivationResponse {
            success: bool,
            error: Option<String>,
        }
        
        let request = ActivationRequest {
            transaction_id: transaction_id.to_string(),
            consumer_id: consumer_id.to_string(),
            token_references: token_refs.to_vec(),
            amount: amount.value,
            currency: amount.currency.clone(),
        };
        
        let response: ActivationResponse = self.make_api_request(
            "/tokens/activate",
            reqwest::Method::POST,
            Some(&request)
        ).await?;
        
        if !response.success {
            return Err(TokenError::ActivationFailed(
                response.error.unwrap_or_else(|| "Échec d'activation des tokens".into())
            ));
        }
        
        Ok(())
    }
    
    async fn check_tokens_availability(
        &self,
        consumer_id: &str,
        token_refs: &[String]
    ) -> Result<bool, TokenError> {
        // Structure de requête
        #[derive(Serialize)]
        struct AvailabilityRequest {
            consumer_id: String,
            token_references: Vec<String>,
        }
        
        // Structure de réponse
        #[derive(Deserialize)]
        struct AvailabilityResponse {
            available: bool,
            error: Option<String>,
        }
        
        let request = AvailabilityRequest {
            consumer_id: consumer_id.to_string(),
            token_references: token_refs.to_vec(),
        };
        
        let response: AvailabilityResponse = self.make_api_request(
            "/tokens/check-availability",
            reqwest::Method::POST,
            Some(&request)
        ).await?;
        
        if let Some(error) = response.error {
            return Err(TokenError::InternalError(error));
        }
        
        Ok(response.available)
    }
}

// ======== État de transaction dans le manager ========

#[derive(Debug, Clone)]
pub struct TransactionState {
    pub transaction: PaymentTransaction,
    pub payment_completed: bool,
    pub pop_validation_id: Option<String>,
    pub pop_completed: bool,
    pub tokens_activated: bool,
    pub started_at: Instant,
    pub last_updated: Instant,
    pub completion_sender: Option<oneshot::Sender<PaymentResult<PaymentTransaction>>>,
}

/// Résultat de la transaction synchronisée
#[derive(Debug, Clone)]
pub enum SynchronizedTransactionResult {
    Success(PaymentTransaction),
    PaymentFailed(PaymentError),
    PopFailed(PopError),
    TokenActivationFailed(TokenError),
    Timeout,
}

// ======== Gestionnaire de transactions ========

/// Configuration du gestionnaire de transactions
#[derive(Clone)]
pub struct TransactionManagerConfig {
    pub transaction_timeout_seconds: u64,
    pub polling_interval_ms: u64,
    pub max_retry_attempts: u32,
    pub fallback_enabled: bool,
}

impl Default for TransactionManagerConfig {
    fn default() -> Self {
        Self {
            transaction_timeout_seconds: 10, // Timeout global de 10 secondes
            polling_interval_ms: 200,        // 200ms entre les vérifications de statut
            max_retry_attempts: 3,           // 3 tentatives max
            fallback_enabled: true,          // Fallback activé par défaut
        }
    }
}

/// Le gestionnaire principal qui orchestre les transactions synchronisées
pub struct TransactionManager {
    payment_connector_manager: Arc<PaymentConnectorManager>,
    pop_client: Arc<dyn PopConsensusClient>,
    token_client: Arc<dyn TokenSystemClient>,
    transactions: Arc<Mutex<HashMap<String, TransactionState>>>,
    config: TransactionManagerConfig,
    _shutdown_signal: Option<oneshot::Sender<()>>,
    _task_handle: Option<tokio::task::JoinHandle<()>>,
}

impl TransactionManager {
    pub fn new(
        payment_connector_manager: Arc<PaymentConnectorManager>,
        pop_client: Arc<dyn PopConsensusClient>,
        token_client: Arc<dyn TokenSystemClient>,
        config: TransactionManagerConfig,
    ) -> Self {
        let transactions = Arc::new(Mutex::new(HashMap::new()));
        
        // Créer le canal pour le signal d'arrêt
        let (shutdown_tx, _shutdown_rx) = oneshot::channel::<()>();
        
        // Un gestionnaire vide sans tâche de surveillance
        Self {
            payment_connector_manager,
            pop_client,
            token_client,
            transactions,
            config,
            _shutdown_signal: Some(shutdown_tx),
            _task_handle: None,
        }
    }
    
    /// Démarre le gestionnaire et sa tâche de surveillance
    pub fn start(&mut self) {
        // Créer un nouveau canal pour le signal d'arrêt
        let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
        self._shutdown_signal = Some(shutdown_tx);
        
        // Cloner les références pour la tâche de surveillance
        let transactions = self.transactions.clone();
        let pop_client = self.pop_client.clone();
        let token_client = self.token_client.clone();
        let config = self.config.clone();
        
        // Créer et démarrer la tâche de surveillance
        let handle = tokio::spawn(async move {
            let polling_interval = Duration::from_millis(config.polling_interval_ms);
            let mut interval = tokio::time::interval(polling_interval);
            
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        Self::poll_transactions(
                            &transactions,
                            &pop_client,
                            &token_client,
                            &config
                        ).await;
                    }
                    _ = &mut shutdown_rx => {
                        println!("Arrêt du gestionnaire de transactions");
                        break;
                    }
                }
            }
        });
        
        self._task_handle = Some(handle);
    }
    
    /// Méthode asynchrone qui vérifie périodiquement les transactions en cours
    async fn poll_transactions(
        transactions: &Arc<Mutex<HashMap<String, TransactionState>>>,
        pop_client: &Arc<dyn PopConsensusClient>,
        token_client: &Arc<dyn TokenSystemClient>,
        config: &TransactionManagerConfig,
    ) {
        let mut transactions_lock = transactions.lock().await;
        let now = Instant::now();
        
        // Collecter les IDs des transactions à traiter
        let mut completed_ids = Vec::new();
        let mut timed_out_ids = Vec::new();
        
        for (id, state) in transactions_lock.iter_mut() {
            // Vérifier le timeout
            if now.duration_since(state.started_at) > Duration::from_secs(config.transaction_timeout_seconds) {
                timed_out_ids.push(id.clone());
                continue;
            }
            
            // Si la transaction est déjà complète, ne rien faire
            if state.payment_completed && state.pop_completed && state.tokens_activated {
                completed_ids.push(id.clone());
                continue;
            }
            
            // Mise à jour du timestamp
            state.last_updated = now;
            
            // Traiter la transaction selon son état
            if state.payment_completed && state.pop_validation_id.is_some() && !state.pop_completed {
                // Vérifier l'état de la validation PoP
                if let Some(validation_id) = &state.pop_validation_id {
                    match pop_client.check_pop_status(validation_id).await {
                        Ok(PopStatus::Validated) => {
                            state.pop_completed = true;
                            
                            // Activer les tokens une fois le PoP validé
                            if !state.tokens_activated {
                                let token_refs = &state.transaction.pop_metadata.token_refs;
                                let result = token_client.activate_tokens(
                                    &state.transaction.id,
                                    &state.transaction.consumer_id,
                                    token_refs,
                                    &state.transaction.amount
                                ).await;
                                
                                match result {
                                    Ok(_) => {
                                        state.tokens_activated = true;
                                        state.transaction.status = TransactionStatus::Completed;
                                    },
                                    Err(e) => {
                                        // En cas d'échec d'activation des tokens, on marque quand même 
                                        // la transaction comme complétée mais on log l'erreur
                                        println!("Erreur d'activation des tokens: {:?}", e);
                                        state.transaction.status = TransactionStatus::Completed;
                                        // On pourrait implémenter une logique de retry ou de réconciliation ici
                                    }
                                }
                            }
                        },
                        Ok(PopStatus::Rejected(reason)) => {
                            state.transaction.status = TransactionStatus::Failed(format!("PoP rejeté: {}", reason));
                            completed_ids.push(id.clone());
                        },
                        Ok(PopStatus::Expired) => {
                            state.transaction.status = TransactionStatus::Failed("PoP expiré".into());
                            completed_ids.push(id.clone());
                        },
                        Ok(_) => {
                            // Statut en cours, continuer à surveiller
                        },
                        Err(e) => {
                            println!("Erreur de vérification PoP: {:?}", e);
                            // On pourrait implémenter une logique de retry ici
                        }
                    }
                }
            }
        }
        
        // Traiter les transactions terminées
        for id in completed_ids {
            if let Some(state) = transactions_lock.remove(&id) {
                if let Some(sender) = state.completion_sender {
                    let _ = sender.send(Ok(state.transaction.clone()));
                }
            }
        }
        
        // Traiter les transactions en timeout
        for id in timed_out_ids {
            if let Some(mut state) = transactions_lock.remove(&id) {
                state.transaction.status = TransactionStatus::Failed("Transaction timeout".into());
                
                // Annuler la validation PoP si elle était en cours
                if let Some(validation_id) = &state.pop_validation_id {
                    let _ = pop_client.cancel_pop_validation(validation_id).await;
                }
                
                if let Some(sender) = state.completion_sender {
                    let _ = sender.send(Err(PaymentError::Timeout("Transaction globale timeout".into())));
                }
            }
        }
    }
    
    /// Traite une transaction synchronisée (paiement + PoP)
    pub async fn process_synchronized_transaction(
        &self,
        transaction: PaymentTransaction,
        card: PaymentCard
    ) -> PaymentResult<PaymentTransaction> {
        // Créer un canal pour recevoir le résultat final
        let (completion_tx, completion_rx) = oneshot::channel();
        
        // Vérifier d'abord la disponibilité des tokens
        let token_availability = self.token_client.check_tokens_availability(
            &transaction.consumer_id,
            &transaction.pop_metadata.token_refs
        ).await;
        
        if let Err(e) = token_availability {
            return Err(PaymentError::InternalError(format!("Erreur de vérification des tokens: {}", e)));
        }
        
        if let Ok(false) = token_availability {
            return Err(PaymentError::InternalError("Tokens insuffisants ou invalides".into()));
        }
        
        // Créer l'état initial de la transaction
        let transaction_state = TransactionState {
            transaction: transaction.clone(),
            payment_completed: false,
            pop_validation_id: None,
            pop_completed: false,
            tokens_activated: false,
            started_at: Instant::now(),
            last_updated: Instant::now(),
            completion_sender: Some(completion_tx),
        };
        
        // Ajouter la transaction au gestionnaire
        {
            let mut transactions = self.transactions.lock().await;
            transactions.insert(transaction.id.clone(), transaction_state);
        }
        
        // Obtenir le connecteur approprié pour le type de carte
        let connector = self.payment_connector_manager.get_connector_for_card(&card.card_type).await;
        
        // Traiter le paiement standard
        let payment_result = connector.process_payment(&transaction, &card).await;
        
        // Mettre à jour l'état de la transaction selon le résultat du paiement
        {
            let mut transactions = self.transactions.lock().await;
            if let Some(state) = transactions.get_mut(&transaction.id) {
                match &payment_result {
                    Ok(updated_transaction) => {
                        // Paiement réussi, initier la validation PoP
                        state.payment_completed = true;
                        state.transaction.status = updated_transaction.status.clone();
                        
                        // Initier la validation PoP en parallèle
                        let pop_result = self.pop_client.initiate_pop_validation(
                            &transaction.id,
                            &transaction.pop_metadata
                        ).await;
                        
                        match pop_result {
                            Ok(validation_id) => {
                                state.pop_validation_id = Some(validation_id);
                                state.transaction.status = TransactionStatus::PopProcessing;
                            },
                            Err(e) => {
                                // Échec de l'initiation PoP, annuler la transaction de paiement
                                println!("Erreur d'initiation PoP: {:?}", e);
                                let _ = connector.cancel_transaction(&transaction.id).await;
                                state.transaction.status = TransactionStatus::Failed("Échec d'initiation PoP".into());
                                
                                if let Some(sender) = state.completion_sender.take() {
                                    let _ = sender.send(Err(PaymentError::PopError(e.to_string())));
                                }
                            }
                        }
                    },
                    Err(e) => {
                        // Échec du paiement, ne pas initier la validation PoP
                        state.transaction.status = TransactionStatus::Failed(format!("Paiement échoué: {}", e));
                        
                        if let Some(sender) = state.completion_sender.take() {
                            let _ = sender.send(Err(e.clone()));
                        }
                    }
                }
            }
        }
        
        // Attendre le résultat final avec timeout
        match timeout(
            Duration::from_secs(self.config.transaction_timeout_seconds),
            completion_rx
        ).await {
            Ok(result) => result.unwrap_or_else(|_| Err(PaymentError::InternalError("Canal fermé".into()))),
            Err(_) => Err(PaymentError::Timeout("Attente de résultat timeout".into())),
        }
    }
    
    /// Arrête le gestionnaire proprement
    pub async fn shutdown(&mut self) {
        if let Some(signal) = self._shutdown_signal.take() {
            let _ = signal.send(());
        }
        
        if let Some(handle) = self._task_handle.take() {
            let _ = handle.await;
        }
    }
}
        
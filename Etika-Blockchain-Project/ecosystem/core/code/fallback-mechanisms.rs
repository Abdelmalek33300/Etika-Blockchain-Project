// etika-payment-integration/src/fallback.rs
// Implémentation des mécanismes de fallback pour les situations d'échec

use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, mpsc};
use tokio::time::interval;
use serde::{Serialize, Deserialize};

use crate::{
    PaymentTransaction, PaymentCard, TransactionStatus,
    PaymentConnectorManager, PopError, TokenError, PaymentError, PaymentResult,
    transaction_manager::{TransactionManager, PopConsensusClient, TokenSystemClient}
};

// ======== Configuration des mécanismes de fallback ========

#[derive(Clone, Debug)]
pub struct FallbackConfig {
    /// Intervalle de traitement des transactions en file d'attente (ms)
    pub queue_processing_interval_ms: u64,
    
    /// Nombre maximal de tentatives de retry
    pub max_retry_attempts: u32,
    
    /// Délai avant la première tentative de retry (ms)
    pub initial_retry_delay_ms: u64,
    
    /// Facteur multiplicatif pour le délai de retry (backoff exponentiel)
    pub retry_backoff_factor: f64,
    
    /// Capacité maximale des files d'attente
    pub queue_capacity: usize,
    
    /// Durée de rétention des transactions échouées (heures)
    pub failed_transaction_retention_hours: u64,
}

impl Default for FallbackConfig {
    fn default() -> Self {
        Self {
            queue_processing_interval_ms: 5000, // 5 secondes
            max_retry_attempts: 5,
            initial_retry_delay_ms: 1000, // 1 seconde
            retry_backoff_factor: 1.5,
            queue_capacity: 1000,
            failed_transaction_retention_hours: 24,
        }
    }
}

// ======== Types de fallback ========

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum FallbackType {
    /// Échec du paiement standard
    PaymentFailure,
    
    /// Échec du consensus PoP
    PopFailure,
    
    /// Échec d'activation des tokens
    TokenActivationFailure,
    
    /// Timeout global
    Timeout,
    
    /// Incohérence entre les systèmes
    Inconsistency,
}

// ======== État des transactions en fallback ========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailedTransaction {
    /// Transaction d'origine
    pub transaction: PaymentTransaction,
    
    /// Type de fallback requis
    pub fallback_type: FallbackType,
    
    /// Détails de l'erreur
    pub error_details: String,
    
    /// Nombre de tentatives effectuées
    pub retry_attempts: u32,
    
    /// Date/heure de la prochaine tentative
    pub next_retry_time: chrono::DateTime<chrono::Utc>,
    
    /// Date/heure de la première tentative
    pub first_attempt_time: chrono::DateTime<chrono::Utc>,
    
    /// États spécifiques au type de fallback
    pub payment_completed: bool,
    pub pop_validation_id: Option<String>,
    pub pop_completed: bool,
    pub tokens_activated: bool,
    
    /// Données de carte tokenisées (si disponibles)
    pub card_token: Option<String>,
    pub card_type: Option<String>,
}

impl FailedTransaction {
    /// Crée une nouvelle transaction échouée
    pub fn new(
        transaction: PaymentTransaction,
        fallback_type: FallbackType,
        error_details: String,
        payment_completed: bool,
        pop_validation_id: Option<String>,
        pop_completed: bool,
        tokens_activated: bool,
        card_token: Option<String>,
        card_type: Option<String>,
    ) -> Self {
        let now = chrono::Utc::now();
        let initial_retry_delay = chrono::Duration::seconds(1);
        
        Self {
            transaction,
            fallback_type,
            error_details,
            retry_attempts: 0,
            next_retry_time: now + initial_retry_delay,
            first_attempt_time: now,
            payment_completed,
            pop_validation_id,
            pop_completed,
            tokens_activated,
            card_token,
            card_type,
        }
    }
    
    /// Calcule le prochain délai de retry (backoff exponentiel)
    pub fn calculate_next_retry_time(&mut self, config: &FallbackConfig) {
        let base_delay_ms = config.initial_retry_delay_ms as f64 * 
            config.retry_backoff_factor.powf(self.retry_attempts as f64);
            
        // Ajouter un peu de jitter (±10%) pour éviter les tempêtes de requêtes
        let jitter_factor = 0.9 + (rand::random::<f64>() * 0.2);
        let delay_ms = (base_delay_ms * jitter_factor) as i64;
        
        self.next_retry_time = chrono::Utc::now() + chrono::Duration::milliseconds(delay_ms);
        self.retry_attempts += 1;
    }
    
    /// Vérifie si la transaction a dépassé le nombre maximal de tentatives
    pub fn has_exceeded_max_retries(&self, config: &FallbackConfig) -> bool {
        self.retry_attempts >= config.max_retry_attempts
    }
    
    /// Vérifie si la transaction a dépassé la durée de rétention
    pub fn has_exceeded_retention_period(&self, config: &FallbackConfig) -> bool {
        let retention_duration = chrono::Duration::hours(config.failed_transaction_retention_hours as i64);
        let elapsed_since_first_attempt = chrono::Utc::now() - self.first_attempt_time;
        
        elapsed_since_first_attempt > retention_duration
    }
}

// ======== Gestionnaire de mécanismes de fallback ========

pub struct FallbackManager {
    /// Files d'attente pour les différents types de fallback
    payment_queue: Arc<Mutex<VecDeque<FailedTransaction>>>,
    pop_queue: Arc<Mutex<VecDeque<FailedTransaction>>>,
    token_queue: Arc<Mutex<VecDeque<FailedTransaction>>>,
    
    /// Archive des transactions définitivement échouées
    failed_archive: Arc<Mutex<Vec<FailedTransaction>>>,
    
    /// Dépendances
    transaction_manager: Arc<TransactionManager>,
    payment_connector_manager: Arc<PaymentConnectorManager>,
    pop_client: Arc<dyn PopConsensusClient>,
    token_client: Arc<dyn TokenSystemClient>,
    
    /// Configuration
    config: FallbackConfig,
    
    /// Canal pour les notifications
    notification_tx: mpsc::Sender<FallbackNotification>,
    
    /// Contrôle du cycle de vie
    _shutdown_signal: Option<tokio::sync::oneshot::Sender<()>>,
    _task_handle: Option<tokio::task::JoinHandle<()>>,
}

/// Notification de changement d'état des transactions en fallback
#[derive(Debug, Clone)]
pub struct FallbackNotification {
    pub transaction_id: String,
    pub fallback_type: FallbackType,
    pub status: FallbackNotificationStatus,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum FallbackNotificationStatus {
    Added,
    RetryScheduled,
    RetrySucceeded,
    RetryFailed,
    MaxRetriesExceeded,
    RetentionExceeded,
    ManuallyResolved,
}

impl FallbackManager {
    pub fn new(
        transaction_manager: Arc<TransactionManager>,
        payment_connector_manager: Arc<PaymentConnectorManager>,
        pop_client: Arc<dyn PopConsensusClient>,
        token_client: Arc<dyn TokenSystemClient>,
        config: FallbackConfig,
    ) -> (Self, mpsc::Receiver<FallbackNotification>) {
        let (notification_tx, notification_rx) = mpsc::channel(100);
        
        let manager = Self {
            payment_queue: Arc::new(Mutex::new(VecDeque::with_capacity(config.queue_capacity))),
            pop_queue: Arc::new(Mutex::new(VecDeque::with_capacity(config.queue_capacity))),
            token_queue: Arc::new(Mutex::new(VecDeque::with_capacity(config.queue_capacity))),
            failed_archive: Arc::new(Mutex::new(Vec::new())),
            transaction_manager,
            payment_connector_manager,
            pop_client,
            token_client,
            config,
            notification_tx,
            _shutdown_signal: None,
            _task_handle: None,
        };
        
        (manager, notification_rx)
    }
    
    /// Démarre le gestionnaire de fallback et ses tâches de surveillance
    pub fn start(&mut self) {
        // Créer un nouveau canal pour le signal d'arrêt
        let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();
        self._shutdown_signal = Some(shutdown_tx);
        
        // Cloner les références pour les tâches
        let payment_queue = self.payment_queue.clone();
        let pop_queue = self.pop_queue.clone();
        let token_queue = self.token_queue.clone();
        let failed_archive = self.failed_archive.clone();
        
        let transaction_manager = self.transaction_manager.clone();
        let payment_connector_manager = self.payment_connector_manager.clone();
        let pop_client = self.pop_client.clone();
        let token_client = self.token_client.clone();
        
        let config = self.config.clone();
        let notification_tx = self.notification_tx.clone();
        
        // Créer et démarrer la tâche de surveillance
        let handle = tokio::spawn(async move {
            let processing_interval = Duration::from_millis(config.queue_processing_interval_ms);
            let mut interval = interval(processing_interval);
            
            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        // Traiter les files d'attente
                        Self::process_payment_queue(
                            &payment_queue,
                            &failed_archive,
                            &payment_connector_manager,
                            &config,
                            &notification_tx
                        ).await;
                        
                        Self::process_pop_queue(
                            &pop_queue,
                            &failed_archive,
                            &pop_client,
                            &config,
                            &notification_tx
                        ).await;
                        
                        Self::process_token_queue(
                            &token_queue,
                            &failed_archive,
                            &token_client,
                            &config,
                            &notification_tx
                        ).await;
                        
                        // Nettoyer les transactions expirées de l'archive
                        Self::clean_expired_transactions(&failed_archive, &config).await;
                    }
                    _ = &mut shutdown_rx => {
                        println!("Arrêt du gestionnaire de fallback");
                        break;
                    }
                }
            }
        });
        
        self._task_handle = Some(handle);
    }
    
    /// Ajoute une transaction à la file d'attente de fallback appropriée
    pub async fn add_failed_transaction(
        &self,
        transaction: PaymentTransaction,
        card: Option<PaymentCard>,
        fallback_type: FallbackType,
        error_details: String,
        payment_completed: bool,
        pop_validation_id: Option<String>,
        pop_completed: bool,
        tokens_activated: bool,
    ) -> Result<(), String> {
        // Créer l'objet de transaction échouée
        let card_token = card.as_ref().map(|c| c.token.clone());
        let card_type = card.as_ref().map(|c| format!("{:?}", c.card_type));
        
        let failed_tx = FailedTransaction::new(
            transaction.clone(),
            fallback_type.clone(),
            error_details,
            payment_completed,
            pop_validation_id,
            pop_completed,
            tokens_activated,
            card_token,
            card_type,
        );
        
        // Déterminer la file d'attente appropriée
        let queue = match fallback_type {
            FallbackType::PaymentFailure => &self.payment_queue,
            FallbackType::PopFailure => &self.pop_queue,
            FallbackType::TokenActivationFailure => &self.token_queue,
            FallbackType::Timeout | FallbackType::Inconsistency => {
                // Pour les timeouts et incohérences, on les place dans la file appropriée
                // selon l'état de la transaction
                if !payment_completed {
                    &self.payment_queue
                } else if !pop_completed {
                    &self.pop_queue
                } else {
                    &self.token_queue
                }
            }
        };
        
        // Ajouter à la file d'attente
        let mut queue_lock = queue.lock().await;
        if queue_lock.len() >= self.config.queue_capacity {
            return Err("File d'attente pleine".into());
        }
        
        queue_lock.push_back(failed_tx);
        
        // Envoyer une notification
        let notification = FallbackNotification {
            transaction_id: transaction.id.clone(),
            fallback_type,
            status: FallbackNotificationStatus::Added,
            message: format!("Transaction {} ajoutée à la file de fallback", transaction.id),
        };
        
        let _ = self.notification_tx.send(notification).await;
        
        Ok(())
    }
    
    /// Traite la file d'attente de paiements échoués
    async fn process_payment_queue(
        payment_queue: &Arc<Mutex<VecDeque<FailedTransaction>>>,
        failed_archive: &Arc<Mutex<Vec<FailedTransaction>>>,
        payment_connector_manager: &Arc<PaymentConnectorManager>,
        config: &FallbackConfig,
        notification_tx: &mpsc::Sender<FallbackNotification>,
    ) {
        let now = chrono::Utc::now();
        let mut to_retry = Vec::new();
        
        // Extraire les transactions prêtes pour retry
        {
            let mut queue = payment_queue.lock().await;
            let mut i = 0;
            
            while i < queue.len() {
                if let Some(tx) = queue.get(i) {
                    if tx.next_retry_time <= now {
                        let tx = queue.remove(i).unwrap();
                        to_retry.push(tx);
                    } else {
                        i += 1;
                    }
                }
            }
        }
        
        // Traiter les transactions à retenter
        for mut tx in to_retry {
            let transaction_id = tx.transaction.id.clone();
            
            // Vérifier si on a dépassé le nombre max de tentatives
            if tx.has_exceeded_max_retries(config) || tx.has_exceeded_retention_period(config) {
                // Archiver la transaction définitivement échouée
                let mut archive = failed_archive.lock().await;
                archive.push(tx.clone());
                
                // Envoyer une notification
                let status = if tx.has_exceeded_max_retries(config) {
                    FallbackNotificationStatus::MaxRetriesExceeded
                } else {
                    FallbackNotificationStatus::RetentionExceeded
                };
                
                let notification = FallbackNotification {
                    transaction_id,
                    fallback_type: tx.fallback_type.clone(),
                    status,
                    message: format!("Échec définitif après {} tentatives", tx.retry_attempts),
                };
                
                let _ = notification_tx.send(notification).await;
                continue;
            }
            
            // Tenter de refaire le paiement
            let retry_result = if let (Some(token), Some(card_type_str)) = (&tx.card_token, &tx.card_type) {
                // Reconstruire une carte de paiement à partir des données sauvegardées
                // Note: Dans une implémentation réelle, il faudrait plus de sécurité et des champs complets
                let card_type = match card_type_str.as_str() {
                    "Visa" => crate::CardType::Visa,
                    "Mastercard" => crate::CardType::Mastercard,
                    "AmericanExpress" => crate::CardType::AmericanExpress,
                    "CartesBancaires" => crate::CardType::CartesBancaires,
                    other => crate::CardType::Other(other.to_string()),
                };
                
                let card = PaymentCard {
                    token: token.clone(),
                    card_type,
                    expiry: crate::CardExpiry { month: 12, year: 2030 }, // Données fictives pour le retry
                    issuer_id: None,
                };
                
                // Obtenir le connecteur adéquat
                let connector = payment_connector_manager.get_connector_for_card(&card.card_type).await;
                
                // Retenter la transaction
                connector.process_payment(&tx.transaction, &card).await
            } else {
                Err(PaymentError::InternalError("Données de carte manquantes pour retry".into()))
            };
            
            match retry_result {
                Ok(updated_tx) => {
                    // Paiement réussi, mettre à jour et passer à la file d'attente PoP
                    tx.payment_completed = true;
                    tx.transaction.status = updated_tx.status;
                    
                    // Envoyer une notification de succès
                    let notification = FallbackNotification {
                        transaction_id: tx.transaction.id.clone(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::RetrySucceeded,
                        message: "Paiement réussi après retry".into(),
                    };
                    
                    let _ = notification_tx.send(notification).await;
                    
                    // Transférer vers la file d'attente PoP
                    let mut pop_queue = payment_queue.lock().await;
                    pop_queue.push_back(tx);
                },
                Err(e) => {
                    // Échec, mettre à jour et replacer dans la file d'attente
                    tx.error_details = format!("Retry échoué: {}", e);
                    tx.calculate_next_retry_time(config);
                    
                    // Envoyer une notification d'échec
                    let notification = FallbackNotification {
                        transaction_id: tx.transaction.id.clone(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::RetryFailed,
                        message: format!("Échec du retry de paiement: {}", e),
                    };
                    
                    let _ = notification_tx.send(notification).await;
                    
                    // Remettre dans la file d'attente
                    let mut queue = payment_queue.lock().await;
                    queue.push_back(tx);
                }
            }
        }
    }
    
    /// Traite la file d'attente de validations PoP échouées
    async fn process_pop_queue(
        pop_queue: &Arc<Mutex<VecDeque<FailedTransaction>>>,
        failed_archive: &Arc<Mutex<Vec<FailedTransaction>>>,
        pop_client: &Arc<dyn PopConsensusClient>,
        config: &FallbackConfig,
        notification_tx: &mpsc::Sender<FallbackNotification>,
    ) {
        let now = chrono::Utc::now();
        let mut to_retry = Vec::new();
        
        // Extraire les transactions prêtes pour retry
        {
            let mut queue = pop_queue.lock().await;
            let mut i = 0;
            
            while i < queue.len() {
                if let Some(tx) = queue.get(i) {
                    if tx.next_retry_time <= now {
                        let tx = queue.remove(i).unwrap();
                        to_retry.push(tx);
                    } else {
                        i += 1;
                    }
                }
            }
        }
        
        // Traiter les transactions à retenter
        for mut tx in to_retry {
            let transaction_id = tx.transaction.id.clone();
            
            // Vérifier si on a dépassé le nombre max de tentatives
            if tx.has_exceeded_max_retries(config) || tx.has_exceeded_retention_period(config) {
                // Archiver la transaction définitivement échouée
                let mut archive = failed_archive.lock().await;
                archive.push(tx.clone());
                
                // Envoyer une notification
                let status = if tx.has_exceeded_max_retries(config) {
                    FallbackNotificationStatus::MaxRetriesExceeded
                } else {
                    FallbackNotificationStatus::RetentionExceeded
                };
                
                let notification = FallbackNotification {
                    transaction_id,
                    fallback_type: tx.fallback_type.clone(),
                    status,
                    message: format!("Échec définitif de validation PoP après {} tentatives", tx.retry_attempts),
                };
                
                let _ = notification_tx.send(notification).await;
                continue;
            }
            
            // Tenter de refaire la validation PoP
            let pop_metadata = &tx.transaction.pop_metadata;
            let retry_result = if let Some(validation_id) = &tx.pop_validation_id {
                // Si on avait déjà initié une validation, vérifier son statut
                pop_client.check_pop_status(validation_id).await
            } else {
                // Sinon, initier une nouvelle validation
                match pop_client.initiate_pop_validation(&tx.transaction.id, pop_metadata).await {
                    Ok(id) => {
                        tx.pop_validation_id = Some(id.clone());
                        // Vérifier immédiatement le statut de la nouvelle validation
                        pop_client.check_pop_status(&id).await
                    },
                    Err(e) => Err(e),
                }
            };
            
            match retry_result {
                Ok(crate::transaction_manager::PopStatus::Validated) => {
                    // Validation réussie, transférer vers la file d'attente des tokens
                    tx.pop_completed = true;
                    
                    // Envoyer une notification de succès
                    let notification = FallbackNotification {
                        transaction_id: tx.transaction.id.clone(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::RetrySucceeded,
                        message: "Validation PoP réussie après retry".into(),
                    };
                    
                    let _ = notification_tx.send(notification).await;
                    
                    // Transférer vers la file d'attente des tokens
                    let mut token_queue = pop_queue.lock().await;
                    token_queue.push_back(tx);
                },
                Ok(status) => {
                    // Validation toujours en cours ou dans un autre état, mettre à jour et replacer
                    tx.error_details = format!("Validation PoP en cours: {:?}", status);
                    tx.calculate_next_retry_time(config);
                    
                    // Envoyer une notification
                    let notification = FallbackNotification {
                        transaction_id: tx.transaction.id.clone(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::RetryScheduled,
                        message: format!("Validation PoP en attente: {:?}", status),
                    };
                    
                    let _ = notification_tx.send(notification).await;
                    
                    // Remettre dans la file d'attente
                    let mut queue = pop_queue.lock().await;
                    queue.push_back(tx);
                },
                Err(e) => {
                    // Échec, mettre à jour et replacer dans la file d'attente
                    tx.error_details = format!("Retry de validation PoP échoué: {}", e);
                    tx.calculate_next_retry_time(config);
                    
                    // Envoyer une notification d'échec
                    let notification = FallbackNotification {
                        transaction_id: tx.transaction.id.clone(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::RetryFailed,
                        message: format!("Échec du retry de validation PoP: {}", e),
                    };
                    
                    let _ = notification_tx.send(notification).await;
                    
                    // Remettre dans la file d'attente
                    let mut queue = pop_queue.lock().await;
                    queue.push_back(tx);
                }
            }
        }
    }
    
    /// Traite la file d'attente d'activations de tokens échouées
    async fn process_token_queue(
        token_queue: &Arc<Mutex<VecDeque<FailedTransaction>>>,
        failed_archive: &Arc<Mutex<Vec<FailedTransaction>>>,
        token_client: &Arc<dyn TokenSystemClient>,
        config: &FallbackConfig,
        notification_tx: &mpsc::Sender<FallbackNotification>,
    ) {
        let now = chrono::Utc::now();
        let mut to_retry = Vec::new();
        
        // Extraire les transactions prêtes pour retry
        {
            let mut queue = token_queue.lock().await;
            let mut i = 0;
            
            while i < queue.len() {
                if let Some(tx) = queue.get(i) {
                    if tx.next_retry_time <= now {
                        let tx = queue.remove(i).unwrap();
                        to_retry.push(tx);
                    } else {
                        i += 1;
                    }
                }
            }
        }
        
        // Traiter les transactions à retenter
        for mut tx in to_retry {
            let transaction_id = tx.transaction.id.clone();
            
            // Vérifier si on a dépassé le nombre max de tentatives
            if tx.has_exceeded_max_retries(config) || tx.has_exceeded_retention_period(config) {
                // Archiver la transaction définitivement échouée
                let mut archive = failed_archive.lock().await;
                archive.push(tx.clone());
                
                // Envoyer une notification
                let status = if tx.has_exceeded_max_retries(config) {
                    FallbackNotificationStatus::MaxRetriesExceeded
                } else {
                    FallbackNotificationStatus::RetentionExceeded
                };
                
                let notification = FallbackNotification {
                    transaction_id,
                    fallback_type: tx.fallback_type.clone(),
                    status,
                    message: format!("Échec définitif d'activation de tokens après {} tentatives", tx.retry_attempts),
                };
                
                let _ = notification_tx.send(notification).await;
                continue;
            }
            
            // Tenter d'activer les tokens
            let token_refs = &tx.transaction.pop_metadata.token_refs;
            let retry_result = token_client.activate_tokens(
                &tx.transaction.id,
                &tx.transaction.consumer_id,
                token_refs,
                &tx.transaction.amount
            ).await;
            
            match retry_result {
                Ok(_) => {
                    // Activation réussie, la transaction est complète
                    tx.tokens_activated = true;
                    tx.transaction.status = TransactionStatus::Completed;
                    
                    // Envoyer une notification de succès
                    let notification = FallbackNotification {
                        transaction_id: tx.transaction.id.clone(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::RetrySucceeded,
                        message: "Activation des tokens réussie après retry".into(),
                    };
                    
                    let _ = notification_tx.send(notification).await;
                    
                    // La transaction est complète, l'archiver comme réussie
                    let mut archive = failed_archive.lock().await;
                    tx.error_details = "Résolu avec succès après retry".into();
                    archive.push(tx);
                },
                Err(e) => {
                    // Échec, mettre à jour et replacer dans la file d'attente
                    tx.error_details = format!("Retry d'activation de tokens échoué: {}", e);
                    tx.calculate_next_retry_time(config);
                    
                    // Envoyer une notification d'échec
                    let notification = FallbackNotification {
                        transaction_id: tx.transaction.id.clone(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::RetryFailed,
                        message: format!("Échec du retry d'activation de tokens: {}", e),
                    };
                    
                    let _ = notification_tx.send(notification).await;
                    
                    // Remettre dans la file d'attente
                    let mut queue = token_queue.lock().await;
                    queue.push_back(tx);
                }
            }
        }
    }
    
    /// Nettoie les transactions expirées de l'archive
    async fn clean_expired_transactions(
        failed_archive: &Arc<Mutex<Vec<FailedTransaction>>>,
        config: &FallbackConfig,
    ) {
        let mut archive = failed_archive.lock().await;
        let retention_duration = chrono::Duration::hours(config.failed_transaction_retention_hours as i64);
        let now = chrono::Utc::now();
        
        archive.retain(|tx| {
            let age = now - tx.first_attempt_time;
            age <= retention_duration
        });
    }
    
    /// Récupère une transaction de l'archive par son ID
    pub async fn get_failed_transaction(&self, transaction_id: &str) -> Option<FailedTransaction> {
        let archive = self.failed_archive.lock().await;
        
        for tx in archive.iter() {
            if tx.transaction.id == transaction_id {
                return Some(tx.clone());
            }
        }
        
        // Si non trouvée dans l'archive, chercher dans les files d'attente
        let payment_queue = self.payment_queue.lock().await;
        for tx in payment_queue.iter() {
            if tx.transaction.id == transaction_id {
                return Some(tx.clone());
            }
        }
        
        let pop_queue = self.pop_queue.lock().await;
        for tx in pop_queue.iter() {
            if tx.transaction.id == transaction_id {
                return Some(tx.clone());
            }
        }
        
        let token_queue = self.token_queue.lock().await;
        for tx in token_queue.iter() {
            if tx.transaction.id == transaction_id {
                return Some(tx.clone());
            }
        }
        
        None
    }
    
    /// Récupère toutes les transactions échouées
    pub async fn get_all_failed_transactions(&self) -> Vec<FailedTransaction> {
        let mut result = Vec::new();
        
        // Récupérer depuis l'archive
        {
            let archive = self.failed_archive.lock().await;
            result.extend(archive.iter().cloned());
        }
        
        // Récupérer depuis les files d'attente
        {
            let payment_queue = self.payment_queue.lock().await;
            result.extend(payment_queue.iter().cloned());
        }
        
        {
            let pop_queue = self.pop_queue.lock().await;
            result.extend(pop_queue.iter().cloned());
        }
        
        {
            let token_queue = self.token_queue.lock().await;
            result.extend(token_queue.iter().cloned());
        }
        
        result
    }
    
    /// Résout manuellement une transaction échouée
    pub async fn manually_resolve_transaction(&self, transaction_id: &str, resolution_note: &str) -> Result<(), String> {
        // Chercher dans toutes les files d'attente
        let mut found = false;
        
        // Chercher dans la file de paiement
        {
            let mut queue = self.payment_queue.lock().await;
            let mut i = 0;
            
            while i < queue.len() {
                if queue[i].transaction.id == transaction_id {
                    let mut tx = queue.remove(i).unwrap();
                    tx.error_details = format!("Résolu manuellement: {}", resolution_note);
                    
                    // Archiver la transaction
                    let mut archive = self.failed_archive.lock().await;
                    archive.push(tx.clone());
                    
                    // Envoyer une notification
                    let notification = FallbackNotification {
                        transaction_id: transaction_id.to_string(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::ManuallyResolved,
                        message: format!("Transaction résolue manuellement: {}", resolution_note),
                    };
                    
                    let _ = self.notification_tx.send(notification).await;
                    
                    found = true;
                    break;
                }
                i += 1;
            }
        }
        
        // Chercher dans la file PoP si non trouvée
        if !found {
            let mut queue = self.pop_queue.lock().await;
            let mut i = 0;
            
            while i < queue.len() {
                if queue[i].transaction.id == transaction_id {
                    let mut tx = queue.remove(i).unwrap();
                    tx.error_details = format!("Résolu manuellement: {}", resolution_note);
                    
                    // Archiver la transaction
                    let mut archive = self.failed_archive.lock().await;
                    archive.push(tx.clone());
                    
                    // Envoyer une notification
                    let notification = FallbackNotification {
                        transaction_id: transaction_id.to_string(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::ManuallyResolved,
                        message: format!("Transaction résolue manuellement: {}", resolution_note),
                    };
                    
                    let _ = self.notification_tx.send(notification).await;
                    
                    found = true;
                    break;
                }
                i += 1;
            }
        }
        
        // Chercher dans la file de tokens si non trouvée
        if !found {
            let mut queue = self.token_queue.lock().await;
            let mut i = 0;
            
            while i < queue.len() {
                if queue[i].transaction.id == transaction_id {
                    let mut tx = queue.remove(i).unwrap();
                    tx.error_details = format!("Résolu manuellement: {}", resolution_note);
                    
                    // Archiver la transaction
                    let mut archive = self.failed_archive.lock().await;
                    archive.push(tx.clone());
                    
                    // Envoyer une notification
                    let notification = FallbackNotification {
                        transaction_id: transaction_id.to_string(),
                        fallback_type: tx.fallback_type.clone(),
                        status: FallbackNotificationStatus::ManuallyResolved,
                        message: format!("Transaction résolue manuellement: {}", resolution_note),
                    };
                    
                    let _ = self.notification_tx.send(notification).await;
                    
                    found = true;
                    break;
                }
                i += 1;
            }
        }
        
        if found {
            Ok(())
        } else {
            Err(format!("Transaction {} non trouvée dans les files d'attente", transaction_id))
        }
    }
    
    /// Exporte les transactions échouées au format JSON
    pub async fn export_failed_transactions(&self) -> Result<String, String> {
        let transactions = self.get_all_failed_transactions().await;
        
        serde_json::to_string_pretty(&transactions)
            .map_err(|e| format!("Erreur de sérialisation: {}", e))
    }
    
    /// Importe des transactions échouées depuis un JSON
    pub async fn import_failed_transactions(&self, json_data: &str) -> Result<usize, String> {
        let transactions: Vec<FailedTransaction> = serde_json::from_str(json_data)
            .map_err(|e| format!("Erreur de désérialisation: {}", e))?;
            
        let mut count = 0;
        
        for tx in transactions {
            // Déterminer la file d'attente appropriée
            let queue = match tx.fallback_type {
                FallbackType::PaymentFailure => &self.payment_queue,
                FallbackType::PopFailure => &self.pop_queue,
                FallbackType::TokenActivationFailure => &self.token_queue,
                FallbackType::Timeout | FallbackType::Inconsistency => {
                    // Pour les timeouts et incohérences, on les place dans la file appropriée
                    // selon l'état de la transaction
                    if !tx.payment_completed {
                        &self.payment_queue
                    } else if !tx.pop_completed {
                        &self.pop_queue
                    } else {
                        &self.token_queue
                    }
                }
            };
            
            // Ajouter à la file d'attente
            let mut queue_lock = queue.lock().await;
            if queue_lock.len() < self.config.queue_capacity {
                queue_lock.push_back(tx);
                count += 1;
            }
        }
        
        Ok(count)
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
                    
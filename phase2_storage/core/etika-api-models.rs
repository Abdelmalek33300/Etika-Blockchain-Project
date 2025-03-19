// etika-platform-api/src/models.rs
//
// Définition des modèles de données utilisés dans l'API

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Énumération des types d'acteurs dans le système
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ActorType {
    Consumer,
    Merchant,
    Supplier,
    Sponsor,
    NGO,
    PublicEntity,
    Investor,
    Admin,
}

/// Énumération des niveaux de fidélité
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, PartialOrd)]
pub enum LoyaltyTier {
    Bronze,
    Silver,
    Gold,
    Platinum,
    Diamond,
}

/// Modèle de données d'un utilisateur
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub name: String,
    pub actor_type: ActorType,
    pub loyalty_tier: LoyaltyTier,
    pub is_active: bool,
    pub phone_number: Option<String>,
    pub registered_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

/// Modèle de jetons JWT pour l'authentification
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // ID de l'utilisateur
    pub exp: usize,   // Timestamp d'expiration
    pub iat: usize,   // Timestamp d'émission
    pub role: String, // Rôle/type de l'utilisateur
}

/// Requête d'authentification
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Réponse d'authentification
#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user_id: String,
}

/// Requête de rafraîchissement de token
#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

/// Modèle pour le solde de tokens
#[derive(Debug, Serialize)]
pub struct TokenBalance {
    pub latent_balance: i64,
    pub active_balance: i64,
    pub locked_balance: i64,
    pub total_balance: i64,
}

/// Requête d'activation de tokens
#[derive(Debug, Deserialize)]
pub struct TokenActivationRequest {
    pub amount: i64,
}

/// Requête de transfert de tokens
#[derive(Debug, Deserialize)]
pub struct TokenTransferRequest {
    pub recipient_id: String,
    pub amount: i64,
    pub message: Option<String>,
}

/// Réponse à une action sur les tokens
#[derive(Debug, Serialize)]
pub struct TokenActionResponse {
    pub transaction_id: String,
    pub status: String,
    pub new_balance: TokenBalance,
    pub timestamp: DateTime<Utc>,
}

/// Entrée de l'historique des tokens
#[derive(Debug, Serialize)]
pub struct TokenHistoryEntry {
    pub transaction_id: String,
    pub transaction_type: String,
    pub amount: i64,
    pub counterparty_id: Option<String>,
    pub counterparty_name: Option<String>,
    pub timestamp: DateTime<Utc>,
}

/// Réponse pour l'historique des tokens
#[derive(Debug, Serialize)]
pub struct TokenHistoryResponse {
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
    pub entries: Vec<TokenHistoryEntry>,
}

/// Statut d'une transaction PoP
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PopTransactionStatus {
    Pending,
    Validated,
}

/// Requête de création de transaction PoP
#[derive(Debug, Deserialize)]
pub struct PopTransactionRequest {
    pub consumer_id: String,
    pub merchant_id: String,
    pub supplier_ids: Option<Vec<String>>,
    pub standard_amount: i64,
    pub tokens_exchanged: i64,
    pub receipt_hash: String,
    pub receipt_data: Option<String>,
}

/// Participant à une transaction PoP
#[derive(Debug, Serialize)]
pub struct PopParticipant {
    pub id: String,
    pub name: String,
}

/// Validation d'une transaction PoP
#[derive(Debug, Serialize)]
pub struct PopValidation {
    pub validator_id: String,
    pub validator_name: String,
    pub validator_type: ActorType,
    pub validation_time: DateTime<Utc>,
}

/// Réponse pour une transaction PoP
#[derive(Debug, Serialize)]
pub struct PopTransactionResponse {
    pub transaction_id: String,
    pub consumer: PopParticipant,
    pub merchant: PopParticipant,
    pub suppliers: Vec<PopParticipant>,
    pub standard_amount: i64,
    pub tokens_exchanged: i64,
    pub savings_generated: i64,
    pub timestamp: DateTime<Utc>,
    pub status: String,
    pub validation_count: usize,
    pub required_validations: usize,
    pub validations: Vec<PopValidation>,
}

/// Réponse pour le profil utilisateur
#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub name: String,
    pub actor_type: ActorType,
    pub loyalty_tier: LoyaltyTier,
    pub is_active: bool,
    pub phone_number: Option<String>,
    pub registered_at: DateTime<Utc>,
    pub metadata: serde_json::Value,
}

/// Réponse pour la liste des utilisateurs
#[derive(Debug, Serialize)]
pub struct UserListResponse {
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
    pub users: Vec<UserResponse>,
}

/// Structure générique d'erreur
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

/// Réponse pour la liste des transactions PoP
#[derive(Debug, Serialize)]
pub struct PopTransactionListResponse {
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
    pub transactions: Vec<PopTransactionResponse>,
}

/// Requête d'inscription d'un utilisateur
#[derive(Debug, Deserialize)]
pub struct UserRegistrationRequest {
    pub email: String,
    pub password: String,
    pub name: String,
    pub actor_type: ActorType,
    pub phone_number: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// Requête de mise à jour du profil utilisateur
#[derive(Debug, Deserialize)]
pub struct UserUpdateRequest {
    pub name: Option<String>,
    pub phone_number: Option<String>,
    pub current_password: Option<String>,
    pub new_password: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// Requête admin de mise à jour d'un utilisateur
#[derive(Debug, Deserialize)]
pub struct AdminUserUpdateRequest {
    pub name: Option<String>,
    pub actor_type: Option<ActorType>,
    pub phone_number: Option<String>,
    pub email: Option<String>,
    pub is_active: Option<bool>,
    pub loyalty_tier: Option<LoyaltyTier>,
    pub metadata: Option<serde_json::Value>,
}
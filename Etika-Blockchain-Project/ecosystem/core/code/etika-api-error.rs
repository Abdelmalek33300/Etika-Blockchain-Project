// etika-platform-api/src/error.rs
//
// Gestionnaire d'erreurs centralisé pour l'API

use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiErrorResponse {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug)]
pub enum ApiError {
    // Erreurs d'authentification et d'autorisation
    Unauthorized(String),
    Forbidden(String),
    
    // Erreurs de validation
    BadRequest(String),
    ValidationError { field: String, message: String },
    
    // Erreurs de ressources
    NotFound(String),
    Conflict(String),
    
    // Erreurs système
    InternalServerError(String),
    ServiceUnavailable(String),
    
    // Erreurs liées au token
    InsufficientBalance(String),
    TokenActivationError(String),
    TokenTransferError(String),
    
    // Erreurs liées au PoP
    PopTransactionError(String),
    PopValidationError(String),
}

impl ApiError {
    pub fn error_code(&self) -> String {
        match self {
            Self::Unauthorized(_) => "UNAUTHORIZED".into(),
            Self::Forbidden(_) => "FORBIDDEN".into(),
            Self::BadRequest(_) => "BAD_REQUEST".into(),
            Self::ValidationError { .. } => "VALIDATION_ERROR".into(),
            Self::NotFound(_) => "NOT_FOUND".into(),
            Self::Conflict(_) => "CONFLICT".into(),
            Self::InternalServerError(_) => "INTERNAL_SERVER_ERROR".into(),
            Self::ServiceUnavailable(_) => "SERVICE_UNAVAILABLE".into(),
            Self::InsufficientBalance(_) => "INSUFFICIENT_BALANCE".into(),
            Self::TokenActivationError(_) => "TOKEN_ACTIVATION_ERROR".into(),
            Self::TokenTransferError(_) => "TOKEN_TRANSFER_ERROR".into(),
            Self::PopTransactionError(_) => "POP_TRANSACTION_ERROR".into(),
            Self::PopValidationError(_) => "POP_VALIDATION_ERROR".into(),
        }
    }
    
    pub fn error_details(&self) -> Option<serde_json::Value> {
        match self {
            Self::ValidationError { field, message } => {
                let mut details = std::collections::HashMap::new();
                details.insert("field".to_string(), field.clone());
                details.insert("constraint".to_string(), message.clone());
                Some(serde_json::to_value(details).unwrap_or_default())
            }
            _ => None,
        }
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unauthorized(msg) => write!(f, "Non autorisé: {}", msg),
            Self::Forbidden(msg) => write!(f, "Accès interdit: {}", msg),
            Self::BadRequest(msg) => write!(f, "Requête invalide: {}", msg),
            Self::ValidationError { field, message } => {
                write!(f, "Erreur de validation sur le champ '{}': {}", field, message)
            }
            Self::NotFound(msg) => write!(f, "Ressource introuvable: {}", msg),
            Self::Conflict(msg) => write!(f, "Conflit: {}", msg),
            Self::InternalServerError(msg) => write!(f, "Erreur interne: {}", msg),
            Self::ServiceUnavailable(msg) => write!(f, "Service indisponible: {}", msg),
            Self::InsufficientBalance(msg) => write!(f, "Solde insuffisant: {}", msg),
            Self::TokenActivationError(msg) => write!(f, "Erreur d'activation de tokens: {}", msg),
            Self::TokenTransferError(msg) => write!(f, "Erreur de transfert de tokens: {}", msg),
            Self::PopTransactionError(msg) => write!(f, "Erreur de transaction PoP: {}", msg),
            Self::PopValidationError(msg) => write!(f, "Erreur de validation PoP: {}", msg),
        }
    }
}

impl ResponseError for ApiError {
    fn status_code(&self) -> StatusCode {
        match *self {
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::Forbidden(_) => StatusCode::FORBIDDEN,
            Self::BadRequest(_) | Self::ValidationError { .. } => StatusCode::BAD_REQUEST,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            Self::InsufficientBalance(_) | Self::TokenActivationError(_) | Self::TokenTransferError(_) => StatusCode::BAD_REQUEST,
            Self::PopTransactionError(_) | Self::PopValidationError(_) => StatusCode::BAD_REQUEST,
        }
    }
    
    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        
        HttpResponse::build(status).json(ApiErrorResponse {
            code: self.error_code(),
            message: self.to_string(),
            details: self.error_details(),
        })
    }
}

// Implémentations From pour convertir d'autres types d'erreurs
impl From<std::io::Error> for ApiError {
    fn from(error: std::io::Error) -> Self {
        ApiError::InternalServerError(error.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for ApiError {
    fn from(error: jsonwebtoken::errors::Error) -> Self {
        ApiError::Unauthorized(error.to_string())
    }
}

impl From<argon2::password_hash::Error> for ApiError {
    fn from(error: argon2::password_hash::Error) -> Self {
        ApiError::InternalServerError(format!("Erreur de hachage: {}", error))
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(error: serde_json::Error) -> Self {
        ApiError::BadRequest(format!("Erreur JSON: {}", error))
    }
}

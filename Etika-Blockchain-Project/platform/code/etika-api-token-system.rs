// etika-platform-api/src/token_system.rs
//
// Système de gestion des tokens Étika

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use chrono::Utc;
use uuid::Uuid;

use crate::auth;
use crate::config::Config;
use crate::error::ApiError;
use crate::models::{
    TokenActionResponse, TokenActivationRequest, TokenBalance, 
    TokenHistoryEntry, TokenHistoryResponse, TokenTransferRequest
};

/// Obtenir le solde de tokens de l'utilisateur authentifié
pub async fn get_token_balance(
    req: HttpRequest,
    config: web::Data<Config>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    // Dans une implémentation réelle, interroger le module etika-token-system
    // Ici, retourner des données simulées
    
    let user_id = claims.sub;
    
    // Simuler une réponse
    let balance = TokenBalance {
        latent_balance: 1000,
        active_balance: 500,
        locked_balance: 0,
        total_balance: 1500,
    };
    
    Ok(HttpResponse::Ok().json(balance))
}

/// Activer des tokens latents
pub async fn activate_tokens(
    req: HttpRequest,
    config: web::Data<Config>,
    activation_data: web::Json<TokenActivationRequest>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    // Vérifier que le montant est positif
    if activation_data.amount <= 0 {
        return Err(ApiError::ValidationError {
            field: "amount".into(),
            message: "Le montant doit être supérieur à 0".into(),
        });
    }
    
    let user_id = claims.sub;
    
    // Dans une implémentation réelle, appeler le module etika-token-system
    // Vérifier les soldes, etc.
    
    // Simuler une réponse réussie
    let new_balance = TokenBalance {
        latent_balance: 900,  // -100 après activation
        active_balance: 600,  // +100 après activation
        locked_balance: 0,
        total_balance: 1500,
    };
    
    let response = TokenActionResponse {
        transaction_id: Uuid::new_v4().to_string(),
        status: "success".into(),
        new_balance,
        timestamp: Utc::now(),
    };
    
    Ok(HttpResponse::Ok().json(response))
}

/// Transférer des tokens actifs à un autre utilisateur
pub async fn transfer_tokens(
    req: HttpRequest,
    config: web::Data<Config>,
    transfer_data: web::Json<TokenTransferRequest>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    // Vérifier que le montant est positif
    if transfer_data.amount <= 0 {
        return Err(ApiError::ValidationError {
            field: "amount".into(),
            message: "Le montant doit être supérieur à 0".into(),
        });
    }
    
    let sender_id = claims.sub;
    let recipient_id = transfer_data.recipient_id.clone();
    
    // Vérifier que l'utilisateur ne s'envoie pas de tokens à lui-même
    if sender_id == recipient_id {
        return Err(ApiError::ValidationError {
            field: "recipient_id".into(),
            message: "Vous ne pouvez pas vous transférer des tokens à vous-même".into(),
        });
    }
    
    // Dans une implémentation réelle, vérifier l'existence du destinataire
    // Vérifier les soldes, appliquer brûlage, etc.
    
    // Simuler une réponse réussie
    let new_balance = TokenBalance {
        latent_balance: 900,
        active_balance: 550,  // -50 après transfert
        locked_balance: 0,
        total_balance: 1450,
    };
    
    let response = TokenActionResponse {
        transaction_id: Uuid::new_v4().to_string(),
        status: "success".into(),
        new_balance,
        timestamp: Utc::now(),
    };
    
    Ok(HttpResponse::Ok().json(response))
}

/// Obtenir l'historique des transactions de tokens
pub async fn get_token_history(
    req: HttpRequest,
    config: web::Data<Config>,
    query: web::Query<std::collections::HashMap<String, String>>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    let user_id = claims.sub;
    
    // Extraire les paramètres de pagination
    let limit = query.get("limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(10);
    
    let offset = query.get("offset")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(0);
    
    // Dans une implémentation réelle, interroger l'historique des tokens
    
    // Simuler une réponse d'historique
    let entries = vec![
        TokenHistoryEntry {
            transaction_id: Uuid::new_v4().to_string(),
            transaction_type: "distribution".into(),
            amount: 100,
            counterparty_id: None,
            counterparty_name: None,
            timestamp: Utc::now() - chrono::Duration::days(5),
        },
        TokenHistoryEntry {
            transaction_id: Uuid::new_v4().to_string(),
            transaction_type: "activation".into(),
            amount: 50,
            counterparty_id: None,
            counterparty_name: None,
            timestamp: Utc::now() - chrono::Duration::days(4),
        },
        TokenHistoryEntry {
            transaction_id: Uuid::new_v4().to_string(),
            transaction_type: "transfer".into(),
            amount: 20,
            counterparty_id: Some("3".into()),
            counterparty_name: Some("Shop ABC".into()),
            timestamp: Utc::now() - chrono::Duration::days(3),
        },
    ];
    
    let response = TokenHistoryResponse {
        total: entries.len(),
        limit,
        offset,
        entries,
    };
    
    Ok(HttpResponse::Ok().json(response))
}

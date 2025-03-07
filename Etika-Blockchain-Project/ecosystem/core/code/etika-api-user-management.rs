// etika-platform-api/src/user_management.rs
//
// Gestion des utilisateurs de l'écosystème Étika

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use chrono::Utc;
use uuid::Uuid;

use crate::auth;
use crate::config::Config;
use crate::error::ApiError;
use crate::models::{
    ActorType, LoyaltyTier, User, UserRegistrationRequest, 
    UserResponse, UserUpdateRequest
};

/// Inscrire un nouvel utilisateur
pub async fn register_user(
    config: web::Data<Config>,
    registration_data: web::Json<UserRegistrationRequest>
) -> Result<HttpResponse, ApiError> {
    // Vérifier que l'email n'est pas déjà utilisé
    // Dans une implémentation réelle, vérifier dans la base de données
    
    if registration_data.email == "admin@etika.io" || registration_data.email == "merchant@etika.io" {
        return Err(ApiError::Conflict("Cette adresse email est déjà utilisée".into()));
    }
    
    // Vérifier la complexité du mot de passe
    if registration_data.password.len() < 8 {
        return Err(ApiError::ValidationError {
            field: "password".into(),
            message: "Le mot de passe doit contenir au moins 8 caractères".into(),
        });
    }
    
    // Hasher le mot de passe
    let password_hash = auth::hash_password(&registration_data.password)?;
    
    // Créer l'utilisateur
    let user_id = Uuid::new_v4().to_string();
    
    // Dans une implémentation réelle, enregistrer l'utilisateur en base de données
    
    // Créer la réponse
    let user_response = UserResponse {
        id: user_id,
        email: registration_data.email.clone(),
        name: registration_data.name.clone(),
        actor_type: registration_data.actor_type.clone(),
        loyalty_tier: LoyaltyTier::Bronze, // Niveau initial
        is_active: true,
        phone_number: registration_data.phone_number.clone(),
        registered_at: Utc::now(),
        metadata: registration_data.metadata.clone().unwrap_or_else(|| serde_json::json!({})),
    };
    
    Ok(HttpResponse::Created().json(user_response))
}

/// Obtenir le profil de l'utilisateur authentifié
pub async fn get_user_profile(
    req: HttpRequest,
    config: web::Data<Config>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    let user_id = claims.sub;
    
    // Dans une implémentation réelle, récupérer l'utilisateur de la base de données
    
    // Simuler une réponse
    let user = if user_id == "1" {
        UserResponse {
            id: "1".into(),
            email: "admin@etika.io".into(),
            name: "Admin".into(),
            actor_type: ActorType::Admin,
            loyalty_tier: LoyaltyTier::Diamond,
            is_active: true,
            phone_number: Some("+33123456789".into()),
            registered_at: Utc::now() - chrono::Duration::days(100),
            metadata: serde_json::json!({}),
        }
    } else if user_id == "2" {
        UserResponse {
            id: "2".into(),
            email: "merchant@etika.io".into(),
            name: "Merchant".into(),
            actor_type: ActorType::Merchant,
            loyalty_tier: LoyaltyTier::Gold,
            is_active: true,
            phone_number: Some("+33987654321".into()),
            registered_at: Utc::now() - chrono::Duration::days(50),
            metadata: serde_json::json!({
                "company_id": "FR12345678",
                "sector": "Retail",
            }),
        }
    } else {
        return Err(ApiError::NotFound("Utilisateur introuvable".into()));
    };
    
    Ok(HttpResponse::Ok().json(user))
}

/// Mettre à jour le profil de l'utilisateur authentifié
pub async fn update_user_profile(
    req: HttpRequest,
    config: web::Data<Config>,
    update_data: web::Json<UserUpdateRequest>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    let user_id = claims.sub;
    
    // Dans une implémentation réelle, récupérer puis mettre à jour l'utilisateur en base de données
    
    // Si l'utilisateur veut changer son mot de passe, vérifier l'ancien mot de passe
    if update_data.new_password.is_some() {
        if update_data.current_password.is_none() {
            return Err(ApiError::ValidationError {
                field: "current_password".into(),
                message: "Le mot de passe actuel est requis pour changer le mot de passe".into(),
            });
        }
        
        // Vérifier l'ancien mot de passe (simulé)
        // Dans une implémentation réelle, récupérer le hash de la BDD
        let stored_hash = "$argon2id$v=19$m=16,t=2,p=1$c2FsdHlzYWx0$ELqEcnEAzxhPxHN8hM+suw"; // "password"
        
        auth::verify_password(&update_data.current_password.clone().unwrap(), stored_hash)?;
        
        // Vérifier la complexité du nouveau mot de passe
        if update_data.new_password.clone().unwrap().len() < 8 {
            return Err(ApiError::ValidationError {
                field: "new_password".into(),
                message: "Le nouveau mot de passe doit contenir au moins 8 caractères".into(),
            });
        }
        
        // Dans une implémentation réelle, hasher et stocker le nouveau mot de passe
    }
    
    // Simuler une réponse de profil mis à jour
    let updated_user = if user_id == "1" {
        UserResponse {
            id: "1".into(),
            email: "admin@etika.io".into(),
            name: update_data.name.clone().unwrap_or_else(|| "Admin".into()),
            actor_type: ActorType::Admin,
            loyalty_tier: LoyaltyTier::Diamond,
            is_active: true,
            phone_number: update_data.phone_number.clone().or(Some("+33123456789".into())),
            registered_at: Utc::now() - chrono::Duration::days(100),
            metadata: update_data.metadata.clone().unwrap_or_else(|| serde_json::json!({})),
        }
    } else if user_id == "2" {
        UserResponse {
            id: "2".into(),
            email: "merchant@etika.io".into(),
            name: update_data.name.clone().unwrap_or_else(|| "Merchant".into()),
            actor_type: ActorType::Merchant,
            loyalty_tier: LoyaltyTier::Gold,
            is_active: true,
            phone_number: update_data.phone_number.clone().or(Some("+33987654321".into())),
            registered_at: Utc::now() - chrono::Duration::days(50),
            metadata: update_data.metadata.clone().unwrap_or_else(|| serde_json::json!({
                "company_id": "FR12345678",
                "sector": "Retail",
            })),
        }
    } else {
        return Err(ApiError::NotFound("Utilisateur introuvable".into()));
    };
    
    Ok(HttpResponse::Ok().json(updated_user))
}

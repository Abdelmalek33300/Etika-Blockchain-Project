// etika-platform-api/src/auth.rs
//
// Module d'authentification et d'autorisation

use actix_web::{web, HttpResponse, Responder};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use uuid::Uuid;

use crate::config::Config;
use crate::error::ApiError;
use crate::models::{AuthResponse, Claims, LoginRequest, RefreshTokenRequest, User, ActorType};

/// Authentification d'un utilisateur
pub async fn login(
    config: web::Data<Config>, 
    login_data: web::Json<LoginRequest>
) -> Result<HttpResponse, ApiError> {
    // Dans une implémentation réelle, vérifier les identifiants dans la base de données
    // Exemple simplifiée pour démonstration
    
    // Vérifier si l'email existe (simulé)
    let user = get_user_by_email(&login_data.email).map_err(|_| {
        ApiError::Unauthorized("Les identifiants fournis sont invalides".into())
    })?;
    
    // Vérifier le mot de passe
    verify_password(&login_data.password, &user.password_hash).map_err(|_| {
        ApiError::Unauthorized("Les identifiants fournis sont invalides".into())
    })?;
    
    // Générer les tokens
    let (access_token, refresh_token) = generate_tokens(&user, &config)?;
    
    // Répondre avec les tokens
    Ok(HttpResponse::Ok().json(AuthResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".into(),
        expires_in: config.jwt_expiration,
        user_id: user.id,
    }))
}

/// Rafraîchir le token d'authentification
pub async fn refresh_token(
    config: web::Data<Config>,
    refresh_data: web::Json<RefreshTokenRequest>
) -> Result<HttpResponse, ApiError> {
    // Vérifier la validité du refresh token
    let token_data = decode::<Claims>(
        &refresh_data.refresh_token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )?;
    
    // Récupérer l'utilisateur
    let user = get_user_by_id(&token_data.claims.sub).map_err(|_| {
        ApiError::Unauthorized("Utilisateur introuvable".into())
    })?;
    
    // Générer de nouveaux tokens
    let (access_token, refresh_token) = generate_tokens(&user, &config)?;
    
    // Répondre avec les nouveaux tokens
    Ok(HttpResponse::Ok().json(AuthResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".into(),
        expires_in: config.jwt_expiration,
        user_id: user.id,
    }))
}

/// Middleware de validation du token JWT
pub fn validate_token(
    req: &actix_web::HttpRequest,
    config: &Config,
) -> Result<Claims, ApiError> {
    // Extraire le token du header Authorization
    let auth_header = req.headers().get("Authorization")
        .ok_or_else(|| ApiError::Unauthorized("Token manquant".into()))?;
    
    let auth_str = auth_header.to_str()
        .map_err(|_| ApiError::Unauthorized("Token invalide".into()))?;
    
    // Vérifier qu'il s'agit d'un token Bearer
    if !auth_str.starts_with("Bearer ") {
        return Err(ApiError::Unauthorized("Format de token invalide".into()));
    }
    
    let token = auth_str[7..].to_string(); // Enlever "Bearer "
    
    // Décoder et valider le token
    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )?;
    
    Ok(token_data.claims)
}

/// Vérifier si l'utilisateur a un rôle spécifique
pub fn check_role(claims: &Claims, allowed_roles: &[&str]) -> Result<(), ApiError> {
    if allowed_roles.contains(&claims.role.as_str()) {
        Ok(())
    } else {
        Err(ApiError::Forbidden("Accès non autorisé pour ce rôle".into()))
    }
}

// Fonctions utilitaires

/// Générer des tokens JWT pour un utilisateur
fn generate_tokens(user: &User, config: &Config) -> Result<(String, String), ApiError> {
    let now = Utc::now();
    let access_exp = now + Duration::seconds(config.jwt_expiration);
    let refresh_exp = now + Duration::seconds(config.refresh_token_expiration);
    
    // Claims pour le token d'accès
    let access_claims = Claims {
        sub: user.id.clone(),
        exp: access_exp.timestamp() as usize,
        iat: now.timestamp() as usize,
        role: format!("{:?}", user.actor_type),
    };
    
    // Claims pour le refresh token
    let refresh_claims = Claims {
        sub: user.id.clone(),
        exp: refresh_exp.timestamp() as usize,
        iat: now.timestamp() as usize,
        role: format!("{:?}", user.actor_type),
    };
    
    // Encoder les tokens
    let access_token = encode(
        &Header::default(),
        &access_claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )?;
    
    let refresh_token = encode(
        &Header::default(),
        &refresh_claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )?;
    
    Ok((access_token, refresh_token))
}

/// Récupérer un utilisateur par email (simulé)
fn get_user_by_email(email: &str) -> Result<User, ApiError> {
    // Simuler une recherche en base de données
    // Dans une implémentation réelle, interroger la BDD
    
    if email == "admin@etika.io" {
        Ok(User {
            id: "1".to_string(),
            email: "admin@etika.io".to_string(),
            password_hash: "$argon2id$v=19$m=16,t=2,p=1$c2FsdHlzYWx0$ELqEcnEAzxhPxHN8hM+suw".to_string(), // "password"
            name: "Admin".to_string(),
            actor_type: ActorType::Admin,
            loyalty_tier: crate::models::LoyaltyTier::Diamond,
            is_active: true,
            phone_number: Some("+33123456789".to_string()),
            registered_at: Utc::now() - Duration::days(100),
            metadata: serde_json::json!({}),
        })
    } else if email == "merchant@etika.io" {
        Ok(User {
            id: "2".to_string(),
            email: "merchant@etika.io".to_string(),
            password_hash: "$argon2id$v=19$m=16,t=2,p=1$c2FsdHlzYWx0$ELqEcnEAzxhPxHN8hM+suw".to_string(), // "password"
            name: "Merchant".to_string(),
            actor_type: ActorType::Merchant,
            loyalty_tier: crate::models::LoyaltyTier::Gold,
            is_active: true,
            phone_number: Some("+33987654321".to_string()),
            registered_at: Utc::now() - Duration::days(50),
            metadata: serde_json::json!({
                "company_id": "FR12345678",
                "sector": "Retail",
            }),
        })
    } else {
        Err(ApiError::NotFound("Utilisateur introuvable".into()))
    }
}

/// Récupérer un utilisateur par ID (simulé)
fn get_user_by_id(id: &str) -> Result<User, ApiError> {
    // Simuler une recherche en base de données
    // Dans une implémentation réelle, interroger la BDD
    
    if id == "1" {
        Ok(User {
            id: "1".to_string(),
            email: "admin@etika.io".to_string(),
            password_hash: "$argon2id$v=19$m=16,t=2,p=1$c2FsdHlzYWx0$ELqEcnEAzxhPxHN8hM+suw".to_string(),
            name: "Admin".to_string(),
            actor_type: ActorType::Admin,
            loyalty_tier: crate::models::LoyaltyTier::Diamond,
            is_active: true,
            phone_number: Some("+33123456789".to_string()),
            registered_at: Utc::now() - Duration::days(100),
            metadata: serde_json::json!({}),
        })
    } else if id == "2" {
        Ok(User {
            id: "2".to_string(),
            email: "merchant@etika.io".to_string(),
            password_hash: "$argon2id$v=19$m=16,t=2,p=1$c2FsdHlzYWx0$ELqEcnEAzxhPxHN8hM+suw".to_string(),
            name: "Merchant".to_string(),
            actor_type: ActorType::Merchant,
            loyalty_tier: crate::models::LoyaltyTier::Gold,
            is_active: true,
            phone_number: Some("+33987654321".to_string()),
            registered_at: Utc::now() - Duration::days(50),
            metadata: serde_json::json!({
                "company_id": "FR12345678",
                "sector": "Retail",
            }),
        })
    } else {
        Err(ApiError::NotFound("Utilisateur introuvable".into()))
    }
}

/// Hasher un mot de passe avec Argon2
pub fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    
    Ok(argon2.hash_password(password.as_bytes(), &salt)?.to_string())
}

/// Vérifier un mot de passe
fn verify_password(password: &str, hash: &str) -> Result<(), ApiError> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|_| ApiError::InternalServerError("Erreur de hachage".into()))?;
    
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| ApiError::Unauthorized("Mot de passe incorrect".into()))
}

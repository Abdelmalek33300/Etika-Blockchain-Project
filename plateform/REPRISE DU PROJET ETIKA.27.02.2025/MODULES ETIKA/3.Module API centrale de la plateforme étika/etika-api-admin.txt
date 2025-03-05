// etika-platform-api/src/admin.rs
//
// Fonctionnalités d'administration de l'écosystème Étika

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;

use crate::auth;
use crate::config::Config;
use crate::error::ApiError;
use crate::models::{
    ActorType, AdminUserUpdateRequest, LoyaltyTier, 
    UserListResponse, UserResponse
};

/// Lister les utilisateurs (avec filtres et pagination)
pub async fn list_users(
    req: HttpRequest,
    config: web::Data<Config>,
    query: web::Query<HashMap<String, String>>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    // Vérifier que l'utilisateur est un administrateur
    auth::check_role(&claims, &["Admin"])?;
    
    // Extraire les paramètres de filtres et pagination
    let actor_type = query.get("actor_type")
        .and_then(|s| match s.as_str() {
            "Consumer" => Some(ActorType::Consumer),
            "Merchant" => Some(ActorType::Merchant),
            "Supplier" => Some(ActorType::Supplier),
            "Sponsor" => Some(ActorType::Sponsor),
            "NGO" => Some(ActorType::NGO),
            "PublicEntity" => Some(ActorType::PublicEntity),
            "Investor" => Some(ActorType::Investor),
            _ => None,
        });
    
    let limit = query.get("limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(10);
    
    let offset = query.get("offset")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(0);
    
    // Dans une implémentation réelle, interroger la base de données avec les filtres
    
    // Simuler une liste d'utilisateurs
    let users = vec![
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
        },
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
        },
        UserResponse {
            id: "3".into(),
            email: "consumer@etika.io".into(),
            name: "Jean Dupont".into(),
            actor_type: ActorType::Consumer,
            loyalty_tier: LoyaltyTier::Silver,
            is_active: true,
            phone_number: Some("+33612345678".into()),
            registered_at: Utc::now() - chrono::Duration::days(20),
            metadata: serde_json::json!({}),
        },
        UserResponse {
            id: "4".into(),
            email: "supplier@etika.io".into(),
            name: "Fournisseur ABC".into(),
            actor_type: ActorType::Supplier,
            loyalty_tier: LoyaltyTier::Bronze,
            is_active: true,
            phone_number: Some("+33678901234".into()),
            registered_at: Utc::now() - chrono::Duration::days(10),
            metadata: serde_json::json!({
                "company_id": "FR87654321",
                "sector": "Manufacturing",
            }),
        },
    ];
    
    // Filtrer par type d'acteur si spécifié
    let filtered_users = if let Some(filter_type) = actor_type {
        users.into_iter()
            .filter(|u| u.actor_type == filter_type)
            .collect()
    } else {
        users
    };
    
    // Appliquer la pagination
    let paginated_users = filtered_users.into_iter()
        .skip(offset)
        .take(limit)
        .collect::<Vec<_>>();
    
    let response = UserListResponse {
        total: paginated_users.len(), // Dans une implémentation réelle, ce serait le nombre total avant pagination
        limit,
        offset,
        users: paginated_users,
    };
    
    Ok(HttpResponse::Ok().json(response))
}

/// Obtenir les détails d'un utilisateur spécifique
pub async fn get_user_details(
    req: HttpRequest,
    path: web::Path<String>,
    config: web::Data<Config>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    // Vérifier que l'utilisateur est un administrateur
    auth::check_role(&claims, &["Admin"])?;
    
    let user_id = path.into_inner();
    
    // Dans une implémentation réelle, récupérer l'utilisateur de la base de données
    
    // Simuler une réponse
    let user = match user_id.as_str() {
        "1" => UserResponse {
            id: "1".into(),
            email: "admin@etika.io".into(),
            name: "Admin".into(),
            actor_type: ActorType::Admin,
            loyalty_tier: LoyaltyTier::Diamond,
            is_active: true,
            phone_number: Some("+33123456789".into()),
            registered_at: Utc::now() - chrono::Duration::days(100),
            metadata: serde_json::json!({}),
        },
        "2" => UserResponse {
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
        },
        "3" => UserResponse {
            id: "3".into(),
            email: "consumer@etika.io".into(),
            name: "Jean Dupont".into(),
            actor_type: ActorType::Consumer,
            loyalty_tier: LoyaltyTier::Silver,
            is_active: true,
            phone_number: Some("+33612345678".into()),
            registered_at: Utc::now() - chrono::Duration::days(20),
            metadata: serde_json::json!({}),
        },
        "4" => UserResponse {
            id: "4".into(),
            email: "supplier@etika.io".into(),
            name: "Fournisseur ABC".into(),
            actor_type: ActorType::Supplier,
            loyalty_tier: LoyaltyTier::Bronze,
            is_active: true,
            phone_number: Some("+33678901234".into()),
            registered_at: Utc::now() - chrono::Duration::days(10),
            metadata: serde_json::json!({
                "company_id": "FR87654321",
                "sector": "Manufacturing",
            }),
        },
        _ => return Err(ApiError::NotFound("Utilisateur introuvable".into())),
    };
    
    Ok(HttpResponse::Ok().json(user))
}

/// Mettre à jour un utilisateur (par un administrateur)
pub async fn update_user(
    req: HttpRequest,
    path: web::Path<String>,
    config: web::Data<Config>,
    update_data: web::Json<AdminUserUpdateRequest>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    // Vérifier que l'utilisateur est un administrateur
    auth::check_role(&claims, &["Admin"])?;
    
    let user_id = path.into_inner();
    
    // Dans une implémentation réelle, vérifier que l'utilisateur existe
    if !["1", "2", "3", "4"].contains(&user_id.as_str()) {
        return Err(ApiError::NotFound("Utilisateur introuvable".into()));
    }
    
    // Dans une implémentation réelle, mettre à jour l'utilisateur en base de données
    
    // Simuler une réponse avec les données mises à jour
    let updated_user = match user_id.as_str() {
        "1" => UserResponse {
            id: "1".into(),
            email: update_data.email.clone().unwrap_or_else(|| "admin@etika.io".into()),
            name: update_data.name.clone().unwrap_or_else(|| "Admin".into()),
            actor_type: update_data.actor_type.clone().unwrap_or(ActorType::Admin),
            loyalty_tier: update_data.loyalty_tier.clone().unwrap_or(LoyaltyTier::Diamond),
            is_active: update_data.is_active.unwrap_or(true),
            phone_number: update_data.phone_number.clone().or(Some("+33123456789".into())),
            registered_at: Utc::now() - chrono::Duration::days(100),
            metadata: update_data.metadata.clone().unwrap_or_else(|| serde_json::json!({})),
        },
        "2" => UserResponse {
            id: "2".into(),
            email: update_data.email.clone().unwrap_or_else(|| "merchant@etika.io".into()),
            name: update_data.name.clone().unwrap_or_else(|| "Merchant".into()),
            actor_type: update_data.actor_type.clone().unwrap_or(ActorType::Merchant),
            loyalty_tier: update_data.loyalty_tier.clone().unwrap_or(LoyaltyTier::Gold),
            is_active: update_data.is_active.unwrap_or(true),
            phone_number: update_data.phone_number.clone().or(Some("+33987654321".into())),
            registered_at: Utc::now() - chrono::Duration::days(50),
            metadata: update_data.metadata.clone().unwrap_or_else(|| serde_json::json!({
                "company_id": "FR12345678",
                "sector": "Retail",
            })),
        },
        "3" => UserResponse {
            id: "3".into(),
            email: update_data.email.clone().unwrap_or_else(|| "consumer@etika.io".into()),
            name: update_data.name.clone().unwrap_or_else(|| "Jean Dupont".into()),
            actor_type: update_data.actor_type.clone().unwrap_or(ActorType::Consumer),
            loyalty_tier: update_data.loyalty_tier.clone().unwrap_or(LoyaltyTier::Silver),
            is_active: update_data.is_active.unwrap_or(true),
            phone_number: update_data.phone_number.clone().or(Some("+33612345678".into())),
            registered_at: Utc::now() - chrono::Duration::days(20),
            metadata: update_data.metadata.clone().unwrap_or_else(|| serde_json::json!({})),
        },
        "4" => UserResponse {
            id: "4".into(),
            email: update_data.email.clone().unwrap_or_else(|| "supplier@etika.io".into()),
            name: update_data.name.clone().unwrap_or_else(|| "Fournisseur ABC".into()),
            actor_type: update_data.actor_type.clone().unwrap_or(ActorType::Supplier),
            loyalty_tier: update_data.loyalty_tier.clone().unwrap_or(LoyaltyTier::Bronze),
            is_active: update_data.is_active.unwrap_or(true),
            phone_number: update_data.phone_number.clone().or(Some("+33678901234".into())),
            registered_at: Utc::now() - chrono::Duration::days(10),
            metadata: update_data.metadata.clone().unwrap_or_else(|| serde_json::json!({
                "company_id": "FR87654321",
                "sector": "Manufacturing",
            })),
        },
        _ => return Err(ApiError::NotFound("Utilisateur introuvable".into())),
    };
    
    Ok(HttpResponse::Ok().json(updated_user))
}

// Structure du projet backend Rust avec Actix-web

// Fichier principal - main.rs
use actix_web::{middleware, web, App, HttpServer};
use dotenv::dotenv;
use std::env;

mod api;
mod config;
mod db;
mod middleware;
mod models;
mod services;
mod utils;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Chargement des variables d'environnement
    dotenv().ok();
    
    // Configuration du logger
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    // Connexion à la base de données
    let pool = db::establish_connection().await
        .expect("Failed to create database connection pool");
    
    // Configuration du serveur
    let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let server_port = env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>().expect("SERVER_PORT must be a number");
        
    log::info!("Starting server at http://{}:{}", server_host, server_port);
    
    // Démarrage du serveur HTTP
    HttpServer::new(move || {
        App::new()
            // Configuration de l'état de l'application
            .app_data(web::Data::new(pool.clone()))
            
            // Middlewares
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .wrap(middleware::DefaultHeaders::new().add(("X-Version", "0.1.0")))
            .wrap(middleware::NormalizePath::new(
                middleware::TrailingSlash::Trim))
            .wrap(middleware::custom_middleware::AuthenticationMiddleware)
            
            // Configuration CORS
            .wrap(
                actix_cors::Cors::default()
                    .allowed_origin("https://suppliers.etika.com")
                    .allowed_methods(vec!["GET", "POST", "PUT", "DELETE"])
                    .allowed_headers(vec![
                        http::header::AUTHORIZATION,
                        http::header::ACCEPT,
                        http::header::CONTENT_TYPE,
                    ])
                    .max_age(3600),
            )
            
            // Configuration des routes API
            .configure(api::configure_routes)
            
            // Gestionnaire d'erreurs global
            .default_service(web::route().to(api::not_found))
    })
    .bind((server_host, server_port))?
    .run()
    .await
}

// Configuration des routes API - api/mod.rs
pub mod auth;
pub mod suppliers;
pub mod tokens;
pub mod financials;
pub mod transactions;
pub mod analytics;
pub mod integration;

use actix_web::{web, HttpResponse};

// Configuration de toutes les routes
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .configure(auth::routes::configure)
            .configure(suppliers::routes::configure)
            .configure(tokens::routes::configure)
            .configure(financials::routes::configure)
            .configure(transactions::routes::configure)
            .configure(analytics::routes::configure)
            .configure(integration::routes::configure)
    );
}

// Handler pour les routes non trouvées
pub async fn not_found() -> HttpResponse {
    HttpResponse::NotFound()
        .json(serde_json::json!({
            "error": "Not Found",
            "message": "The requested resource does not exist"
        }))
}

// Module d'authentification - api/auth/routes.rs
use actix_web::{web, HttpResponse, Scope};
use crate::api::auth::handlers;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/login", web::post().to(handlers::login))
            .route("/refresh-token", web::post().to(handlers::refresh_token))
            .route("/logout", web::post().to(handlers::logout))
            .route("/register", web::post().to(handlers::register))
            .route("/forgot-password", web::post().to(handlers::forgot_password))
            .route("/reset-password", web::post().to(handlers::reset_password))
            .route("/verify-email/{token}", web::get().to(handlers::verify_email))
            .route("/me", web::get().to(handlers::me))
    );
}

// Gestionnaire d'authentification - api/auth/handlers.rs
use actix_web::{web, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use crate::db::DbPool;
use crate::models::supplier::{Supplier, SupplierUser};
use crate::services::auth::AuthService;

#[derive(Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    access_token: String,
    refresh_token: String,
    user: SupplierUserResponse,
}

#[derive(Serialize)]
pub struct SupplierUserResponse {
    id: i32,
    email: String,
    first_name: String,
    last_name: String,
    role: String,
    supplier_id: i32,
}

pub async fn login(
    pool: web::Data<DbPool>,
    req: web::Json<LoginRequest>,
) -> HttpResponse {
    let auth_service = AuthService::new(pool.get_ref());
    
    match auth_service.login(&req.email, &req.password).await {
        Ok((user, access_token, refresh_token)) => {
            HttpResponse::Ok()
                .json(LoginResponse {
                    access_token,
                    refresh_token,
                    user: SupplierUserResponse {
                        id: user.id,
                        email: user.email,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        role: user.role.to_string(),
                        supplier_id: user.supplier_id,
                    },
                })
        },
        Err(e) => {
            log::error!("Login error: {:?}", e);
            HttpResponse::Unauthorized()
                .json(serde_json::json!({
                    "error": "Authentication failed",
                    "message": e.to_string()
                }))
        }
    }
}

pub async fn me(req: HttpRequest, pool: web::Data<DbPool>) -> HttpResponse {
    let auth_service = AuthService::new(pool.get_ref());
    
    match auth_service.get_current_user(&req).await {
        Ok(user) => {
            HttpResponse::Ok()
                .json(SupplierUserResponse {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role: user.role.to_string(),
                    supplier_id: user.supplier_id,
                })
        },
        Err(e) => {
            log::error!("Get current user error: {:?}", e);
            HttpResponse::Unauthorized()
                .json(serde_json::json!({
                    "error": "Authentication failed",
                    "message": e.to_string()
                }))
        }
    }
}

// Module de gestion des tokens - api/tokens/routes.rs
use actix_web::{web, HttpResponse, Scope};
use crate::api::tokens::handlers;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/tokens")
            .route("", web::get().to(handlers::get_balance))
            .route("/transactions", web::get().to(handlers::get_transactions))
            .route("/send", web::post().to(handlers::send_tokens))
            .route("/convert", web::post().to(handlers::convert_tokens))
            .route("/history", web::get().to(handlers::get_history))
            .route("/statistics", web::get().to(handlers::get_statistics))
    );
}

// Gestionnaire de tokens - api/tokens/handlers.rs
use actix_web::{web, HttpResponse, HttpRequest};
use serde::{Deserialize, Serialize};
use crate::db::DbPool;
use crate::models::token::{TokenBalance, TokenTransaction};
use crate::services::token::TokenService;
use crate::services::auth::AuthService;

#[derive(Serialize)]
pub struct TokenBalanceResponse {
    balance: i64,
    value_eur: f64,
    value_updated_at: String,
    conversion_rate: f64,
}

pub async fn get_balance(req: HttpRequest, pool: web::Data<DbPool>) -> HttpResponse {
    let auth_service = AuthService::new(pool.get_ref());
    let token_service = TokenService::new(pool.get_ref());
    
    match auth_service.get_current_user(&req).await {
        Ok(user) => {
            match token_service.get_balance(user.supplier_id).await {
                Ok(balance) => {
                    HttpResponse::Ok()
                        .json(TokenBalanceResponse {
                            balance: balance.amount,
                            value_eur: balance.value_eur,
                            value_updated_at: balance.updated_at.to_string(),
                            conversion_rate: balance.conversion_rate,
                        })
                },
                Err(e) => {
                    log::error!("Get token balance error: {:?}", e);
                    HttpResponse::InternalServerError()
                        .json(serde_json::json!({
                            "error": "Failed to get token balance",
                            "message": e.to_string()
                        }))
                }
            }
        },
        Err(e) => {
            log::error!("Authentication error: {:?}", e);
            HttpResponse::Unauthorized()
                .json(serde_json::json!({
                    "error": "Authentication failed",
                    "message": e.to_string()
                }))
        }
    }
}

#[derive(Deserialize)]
pub struct SendTokensRequest {
    recipient_id: i32,
    amount: i64,
    description: Option<String>,
}

#[derive(Serialize)]
pub struct TransactionResponse {
    id: String,
    status: String,
    transaction_hash: Option<String>,
}

pub async fn send_tokens(
    req: HttpRequest,
    pool: web::Data<DbPool>,
    payload: web::Json<SendTokensRequest>,
) -> HttpResponse {
    let auth_service = AuthService::new(pool.get_ref());
    let token_service = TokenService::new(pool.get_ref());
    
    match auth_service.get_current_user(&req).await {
        Ok(user) => {
            match token_service.send_tokens(
                user.supplier_id,
                payload.recipient_id,
                payload.amount,
                payload.description.clone(),
            ).await {
                Ok(transaction) => {
                    HttpResponse::Ok()
                        .json(TransactionResponse {
                            id: transaction.id,
                            status: transaction.status,
                            transaction_hash: transaction.blockchain_hash,
                        })
                },
                Err(e) => {
                    log::error!("Send tokens error: {:?}", e);
                    HttpResponse::BadRequest()
                        .json(serde_json::json!({
                            "error": "Failed to send tokens",
                            "message": e.to_string()
                        }))
                }
            }
        },
        Err(e) => {
            log::error!("Authentication error: {:?}", e);
            HttpResponse::Unauthorized()
                .json(serde_json::json!({
                    "error": "Authentication failed",
                    "message": e.to_string()
                }))
        }
    }
}

// Module de modèles - models/supplier.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Supplier {
    pub id: i32,
    pub uuid: Uuid,
    pub name: String,
    pub legal_name: String,
    pub business_id: String,
    pub tax_id: String,
    pub status: SupplierStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub email: String,
    pub phone: String,
    pub address: Address,
    pub bank_info: Option<BankInfo>,
    pub settings: SupplierSettings,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum SupplierStatus {
    Pending,
    Active,
    Suspended,
    Blocked,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Address {
    pub street: String,
    pub city: String,
    pub state: String,
    pub postal_code: String,
    pub country: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BankInfo {
    pub bank_name: String,
    pub account_number: String,
    pub iban: String,
    pub swift: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SupplierSettings {
    pub default_currency: String,
    pub auto_convert_tokens: bool,
    pub conversion_threshold: Option<i64>,
    pub notification_preferences: NotificationPreferences,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NotificationPreferences {
    pub email_notifications: bool,
    pub transaction_alerts: bool,
    pub marketing_communications: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SupplierUser {
    pub id: i32,
    pub supplier_id: i32,
    pub uuid: Uuid,
    pub email: String,
    pub password_hash: String,
    pub first_name: String,
    pub last_name: String,
    pub role: UserRole,
    pub status: UserStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum UserRole {
    Admin,
    Manager,
    Finance,
    ReadOnly,
}

impl ToString for UserRole {
    fn to_string(&self) -> String {
        match self {
            UserRole::Admin => "admin".to_string(),
            UserRole::Manager => "manager".to_string(),
            UserRole::Finance => "finance".to_string(),
            UserRole::ReadOnly => "readonly".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum UserStatus {
    Pending,
    Active,
    Locked,
    Inactive,
}

// Module de modèles - models/token.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenBalance {
    pub supplier_id: i32,
    pub amount: i64,
    pub value_eur: f64,
    pub conversion_rate: f64,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenTransaction {
    pub id: String,
    pub supplier_id: i32,
    pub type_: TransactionType,
    pub amount: i64,
    pub recipient_id: Option<i32>,
    pub sender_id: Option<i32>,
    pub description: Option<String>,
    pub status: String,
    pub blockchain_hash: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub enum TransactionType {
    Send,
    Receive,
    Convert,
    Refund,
}

// Service de tokens - services/token.rs
use crate::db::DbPool;
use crate::models::token::{TokenBalance, TokenTransaction, TransactionType};
use crate::utils::errors::ServiceError;
use uuid::Uuid;
use chrono::Utc;

pub struct TokenService {
    pool: DbPool,
}

impl TokenService {
    pub fn new(pool: &DbPool) -> Self {
        Self {
            pool: pool.clone(),
        }
    }
    
    pub async fn get_balance(&self, supplier_id: i32) -> Result<TokenBalance, ServiceError> {
        // Dans une implémentation réelle, cette méthode interrogerait la base de données
        // et potentiellement la blockchain pour obtenir le solde des tokens
        
        // Simulation d'un résultat pour l'exemple
        Ok(TokenBalance {
            supplier_id,
            amount: 12500,
            value_eur: 11875.0,
            conversion_rate: 0.95,
            updated_at: Utc::now(),
        })
    }
    
    pub async fn send_tokens(
        &self,
        sender_id: i32,
        recipient_id: i32,
        amount: i64,
        description: Option<String>,
    ) -> Result<TokenTransaction, ServiceError> {
        // Dans une implémentation réelle, cette méthode:
        // 1. Vérifierait le solde du fournisseur
        // 2. Créerait une transaction en base de données
        // 3. Soumettrait la transaction à la blockchain
        // 4. Mettrait à jour les soldes de tokens
        
        // Simulation d'un résultat pour l'exemple
        Ok(TokenTransaction {
            id: Uuid::new_v4().to_string(),
            supplier_id: sender_id,
            type_: TransactionType::Send,
            amount,
            recipient_id: Some(recipient_id),
            sender_id: Some(sender_id),
            description,
            status: "pending".to_string(),
            blockchain_hash: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }
    
    pub async fn convert_tokens(
        &self,
        supplier_id: i32,
        amount: i64,
        target_currency: String,
    ) -> Result<TokenTransaction, ServiceError> {
        // Simulation d'un résultat pour l'exemple
        Ok(TokenTransaction {
            id: Uuid::new_v4().to_string(),
            supplier_id,
            type_: TransactionType::Convert,
            amount,
            recipient_id: None,
            sender_id: Some(supplier_id),
            description: Some(format!("Conversion to {}", target_currency)),
            status: "pending".to_string(),
            blockchain_hash: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        })
    }
    
    // Autres méthodes pour la gestion des tokens...
}

// Module de connexion à la base de données - db.rs
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::env;

pub type DbPool = PgPool;

pub async fn establish_connection() -> Result<DbPool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");
        
    PgPoolOptions::new()
        .max_connections(10)
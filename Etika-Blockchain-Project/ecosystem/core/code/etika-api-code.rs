// etika-platform-api/src/main.rs
//
// API REST centralisée pour l'écosystème Étika
// Cette API sert d'interface entre les applications et les modules du système

use actix_web::{web, App, HttpServer, Responder, HttpResponse, middleware};
use actix_cors::Cors;
use dotenv::dotenv;
use serde::{Deserialize, Serialize};
use std::env;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use chrono::{Duration, Utc};
use uuid::Uuid;

// Import des modules
mod auth;
mod token_system;
mod pop_consensus;
mod user_management;
mod admin;
mod models;
mod error;
mod config;

use crate::config::Config;
use crate::error::ApiError;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Charger les variables d'environnement depuis .env
    dotenv().ok();
    
    // Initialiser le logger
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    // Charger la configuration
    let config = Config::from_env().expect("Impossible de charger la configuration");
    let server_address = format!("{}:{}", config.server_host, config.server_port);
    
    log::info!("Démarrage du serveur sur {}", server_address);
    
    // Démarrer le serveur HTTP
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
            
        App::new()
            .wrap(middleware::Logger::default())
            .wrap(cors)
            .app_data(web::Data::new(config.clone()))
            .service(
                web::scope("/api/v1")
                    // Routes d'authentification
                    .service(
                        web::scope("/auth")
                            .route("/login", web::post().to(auth::login))
                            .route("/refresh", web::post().to(auth::refresh_token))
                    )
                    // Routes du système de tokens
                    .service(
                        web::scope("/tokens")
                            .route("/balance", web::get().to(token_system::get_token_balance))
                            .route("/activate", web::post().to(token_system::activate_tokens))
                            .route("/transfer", web::post().to(token_system::transfer_tokens))
                            .route("/history", web::get().to(token_system::get_token_history))
                    )
                    // Routes du consensus PoP
                    .service(
                        web::scope("/pop")
                            .route("/transaction", web::post().to(pop_consensus::create_pop_transaction))
                            .route("/transaction/{id}", web::get().to(pop_consensus::get_pop_transaction))
                            .route("/transaction/{id}/validate", web::post().to(pop_consensus::validate_pop_transaction))
                            .route("/transactions", web::get().to(pop_consensus::list_pop_transactions))
                    )
                    // Routes de gestion des utilisateurs
                    .service(
                        web::scope("/users")
                            .route("/register", web::post().to(user_management::register_user))
                            .route("/profile", web::get().to(user_management::get_user_profile))
                            .route("/profile", web::put().to(user_management::update_user_profile))
                    )
                    // Routes d'administration
                    .service(
                        web::scope("/admin")
                            .route("/users", web::get().to(admin::list_users))
                            .route("/users/{id}", web::get().to(admin::get_user_details))
                            .route("/users/{id}", web::put().to(admin::update_user))
                    )
            )
            .default_service(web::route().to(|| HttpResponse::NotFound()))
    })
    .bind(server_address)?
    .run()
    .await
}

// Le reste du code sera organisé dans des modules séparés

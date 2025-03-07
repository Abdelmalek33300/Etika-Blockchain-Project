// etika-platform-api/src/config.rs
//
// Configuration de l'application

use serde::Deserialize;
use std::env;
use dotenv::dotenv;

#[derive(Clone, Debug, Deserialize)]
pub struct Config {
    pub server_host: String,
    pub server_port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiration: i64,  // en secondes
    pub refresh_token_expiration: i64,  // en secondes
    pub blockchain_rpc_url: String,
    pub token_system_url: String,
    pub pop_consensus_url: String,
}

impl Config {
    /// Charge la configuration à partir des variables d'environnement
    pub fn from_env() -> Result<Self, env::VarError> {
        dotenv().ok();
        
        let server_host = env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let server_port = env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>().expect("SERVER_PORT doit être un nombre");
        let database_url = env::var("DATABASE_URL")?;
        let jwt_secret = env::var("JWT_SECRET")?;
        let jwt_expiration = env::var("JWT_EXPIRATION").unwrap_or_else(|_| "3600".to_string())
            .parse::<i64>().expect("JWT_EXPIRATION doit être un nombre");
        let refresh_token_expiration = env::var("REFRESH_TOKEN_EXPIRATION").unwrap_or_else(|_| "604800".to_string())
            .parse::<i64>().expect("REFRESH_TOKEN_EXPIRATION doit être un nombre");
        let blockchain_rpc_url = env::var("BLOCKCHAIN_RPC_URL")?;
        let token_system_url = env::var("TOKEN_SYSTEM_URL")?;
        let pop_consensus_url = env::var("POP_CONSENSUS_URL")?;
        
        Ok(Config {
            server_host,
            server_port,
            database_url,
            jwt_secret,
            jwt_expiration,
            refresh_token_expiration,
            blockchain_rpc_url,
            token_system_url,
            pop_consensus_url,
        })
    }
}

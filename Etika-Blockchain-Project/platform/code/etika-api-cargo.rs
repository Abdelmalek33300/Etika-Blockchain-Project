[package]
name = "etika-platform-api"
version = "0.1.0"
edition = "2021"
authors = ["Équipe Étika"]
description = "API centrale pour l'écosystème Étika"

[dependencies]
# Serveur web
actix-web = "4.3.1"
actix-cors = "0.6.4"
actix-rt = "2.8.0"

# Sérialisation / désérialisation
serde = { version = "1.0.159", features = ["derive"] }
serde_json = "1.0.95"

# Utilitaires
chrono = { version = "0.4.24", features = ["serde"] }
uuid = { version = "1.3.0", features = ["serde", "v4"] }
log = "0.4.17"
env_logger = "0.10.0"
dotenv = "0.15.0"
thiserror = "1.0.40"

# Gestion d'authentification
jsonwebtoken = "8.3.0"
argon2 = "0.5.0"
rand = "0.8.5"

# Base de données (simulée pour l'instant)
# sqlx = { version = "0.6.3", features = ["runtime-tokio-native-tls", "postgres", "chrono", "uuid", "json"] }

# Pour les appels HTTP vers les autres modules
reqwest = { version = "0.11.16", features = ["json"] }

[dev-dependencies]
# Tests
actix-test = "0.1.1"
mockito = "1.0.2"

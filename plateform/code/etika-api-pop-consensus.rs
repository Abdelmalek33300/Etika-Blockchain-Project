// etika-platform-api/src/pop_consensus.rs
//
// Gestion du mécanisme de consensus PoP (Proof of Purchase)

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use chrono::{Duration, Utc};
use uuid::Uuid;
use std::collections::HashMap;

use crate::auth;
use crate::config::Config;
use crate::error::ApiError;
use crate::models::{
    ActorType, PopParticipant, PopTransactionRequest, 
    PopTransactionResponse, PopTransactionListResponse,
    PopTransactionStatus, PopValidation
};

/// Créer une nouvelle transaction PoP
pub async fn create_pop_transaction(
    req: HttpRequest,
    config: web::Data<Config>,
    transaction_data: web::Json<PopTransactionRequest>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    // Vérifier que le créateur est soit le consommateur, soit le commerçant
    let creator_id = claims.sub;
    if creator_id != transaction_data.consumer_id && creator_id != transaction_data.merchant_id {
        return Err(ApiError::Forbidden(
            "Seuls le consommateur ou le commerçant peuvent créer une transaction PoP".into()
        ));
    }
    
    // Dans une implémentation réelle, vérifier les types d'acteurs, les montants, etc.
    // Puis appeler le module etika-pop-consensus pour créer la transaction
    
    // Simuler une réponse réussie
    let transaction_id = Uuid::new_v4().to_string();
    
    // Calculer l'épargne générée (simulé comme 5% du montant standard)
    let savings_generated = transaction_data.standard_amount * 5 / 100;
    
    let response = PopTransactionResponse {
        transaction_id: transaction_id.clone(),
        consumer: PopParticipant {
            id: transaction_data.consumer_id.clone(),
            name: "Jean Dupont".into(), // Simulé, à récupérer de la base de données
        },
        merchant: PopParticipant {
            id: transaction_data.merchant_id.clone(),
            name: "Magasin XYZ".into(), // Simulé
        },
        suppliers: transaction_data.supplier_ids.clone()
            .unwrap_or_else(Vec::new)
            .iter()
            .map(|id| PopParticipant {
                id: id.clone(),
                name: format!("Fournisseur {}", id.chars().take(4).collect::<String>()), // Simulé
            })
            .collect(),
        standard_amount: transaction_data.standard_amount,
        tokens_exchanged: transaction_data.tokens_exchanged,
        savings_generated,
        timestamp: Utc::now(),
        status: "pending".into(),
        validation_count: 1, // Le créateur valide automatiquement
        required_validations: 2 + transaction_data.supplier_ids.clone().unwrap_or_else(Vec::new).len(), // Consommateur + Commerçant + Fournisseurs
        validations: vec![
            // Le créateur a déjà validé
            PopValidation {
                validator_id: creator_id.clone(),
                validator_name: if creator_id == transaction_data.consumer_id {
                    "Jean Dupont".into()
                } else {
                    "Magasin XYZ".into()
                },
                validator_type: if creator_id == transaction_data.consumer_id {
                    ActorType::Consumer
                } else {
                    ActorType::Merchant
                },
                validation_time: Utc::now(),
            }
        ],
    };
    
    Ok(HttpResponse::Created().json(response))
}

/// Valider une transaction PoP existante
pub async fn validate_pop_transaction(
    req: HttpRequest,
    path: web::Path<String>,
    config: web::Data<Config>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    let validator_id = claims.sub;
    let transaction_id = path.into_inner();
    
    // Dans une implémentation réelle, vérifier que la transaction existe
    // et que le validateur est autorisé (consommateur, commerçant ou fournisseur)
    
    // Simuler une réponse réussie
    let response = PopTransactionResponse {
        transaction_id: transaction_id.clone(),
        consumer: PopParticipant {
            id: "1".into(),
            name: "Jean Dupont".into(),
        },
        merchant: PopParticipant {
            id: "2".into(),
            name: "Magasin XYZ".into(),
        },
        suppliers: vec![
            PopParticipant {
                id: "3".into(),
                name: "Fournisseur ABC".into(),
            }
        ],
        standard_amount: 1000,
        tokens_exchanged: 100,
        savings_generated: 50,
        timestamp: Utc::now() - Duration::minutes(5),
        status: "pending".into(),
        validation_count: 2, // +1 après cette validation
        required_validations: 3,
        validations: vec![
            // Validations précédentes
            PopValidation {
                validator_id: "2".into(), // Le commerçant avait validé
                validator_name: "Magasin XYZ".into(),
                validator_type: ActorType::Merchant,
                validation_time: Utc::now() - Duration::minutes(5),
            },
            // Nouvelle validation
            PopValidation {
                validator_id: validator_id.clone(),
                validator_name: "Jean Dupont".into(), // Simulé
                validator_type: ActorType::Consumer, // Simulé
                validation_time: Utc::now(),
            }
        ],
    };
    
    Ok(HttpResponse::Ok().json(response))
}

/// Obtenir les détails d'une transaction PoP
pub async fn get_pop_transaction(
    req: HttpRequest,
    path: web::Path<String>,
    config: web::Data<Config>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    let transaction_id = path.into_inner();
    
    // Dans une implémentation réelle, récupérer la transaction de la base de données
    
    // Simuler une réponse réussie
    let response = PopTransactionResponse {
        transaction_id: transaction_id.clone(),
        consumer: PopParticipant {
            id: "1".into(),
            name: "Jean Dupont".into(),
        },
        merchant: PopParticipant {
            id: "2".into(),
            name: "Magasin XYZ".into(),
        },
        suppliers: vec![
            PopParticipant {
                id: "3".into(),
                name: "Fournisseur ABC".into(),
            }
        ],
        standard_amount: 1000,
        tokens_exchanged: 100,
        savings_generated: 50,
        timestamp: Utc::now() - Duration::minutes(10),
        status: "validated".into(), // Supposons qu'elle est complètement validée
        validation_count: 3,
        required_validations: 3,
        validations: vec![
            PopValidation {
                validator_id: "1".into(),
                validator_name: "Jean Dupont".into(),
                validator_type: ActorType::Consumer,
                validation_time: Utc::now() - Duration::minutes(5),
            },
            PopValidation {
                validator_id: "2".into(),
                validator_name: "Magasin XYZ".into(),
                validator_type: ActorType::Merchant,
                validation_time: Utc::now() - Duration::minutes(10),
            },
            PopValidation {
                validator_id: "3".into(),
                validator_name: "Fournisseur ABC".into(),
                validator_type: ActorType::Supplier,
                validation_time: Utc::now() - Duration::minutes(3),
            }
        ],
    };
    
    Ok(HttpResponse::Ok().json(response))
}

/// Lister les transactions PoP (avec filtres et pagination)
pub async fn list_pop_transactions(
    req: HttpRequest,
    config: web::Data<Config>,
    query: web::Query<HashMap<String, String>>
) -> Result<HttpResponse, ApiError> {
    // Valider le token
    let claims = auth::validate_token(&req, &config)?;
    
    // Extraire les paramètres de filtre et pagination
    let status = query.get("status").cloned();
    let limit = query.get("limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(10);
    let offset = query.get("offset")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(0);
    
    // Dans une implémentation réelle, filtrer les transactions selon les paramètres
    
    // Simuler une liste de transactions
    let transactions = vec![
        PopTransactionResponse {
            transaction_id: Uuid::new_v4().to_string(),
            consumer: PopParticipant {
                id: "1".into(),
                name: "Jean Dupont".into(),
            },
            merchant: PopParticipant {
                id: "2".into(),
                name: "Magasin XYZ".into(),
            },
            suppliers: vec![
                PopParticipant {
                    id: "3".into(),
                    name: "Fournisseur ABC".into(),
                }
            ],
            standard_amount: 1000,
            tokens_exchanged: 100,
            savings_generated: 50,
            timestamp: Utc::now() - Duration::days(1),
            status: "validated".into(),
            validation_count: 3,
            required_validations: 3,
            validations: vec![], // On ne renvoie pas les validations détaillées dans la liste
        },
        PopTransactionResponse {
            transaction_id: Uuid::new_v4().to_string(),
            consumer: PopParticipant {
                id: "1".into(),
                name: "Jean Dupont".into(),
            },
            merchant: PopParticipant {
                id: "2".into(),
                name: "Magasin XYZ".into(),
            },
            suppliers: vec![],
            standard_amount: 500,
            tokens_exchanged: 50,
            savings_generated: 25,
            timestamp: Utc::now() - Duration::hours(5),
            status: "pending".into(),
            validation_count: 1,
            required_validations: 2,
            validations: vec![],
        },
    ];
    
    // Filtrer par statut si nécessaire
    let filtered_transactions = if let Some(status_filter) = status {
        transactions.into_iter()
            .filter(|t| t.status == status_filter)
            .collect()
    } else {
        transactions
    };
    
    let response = PopTransactionListResponse {
        total: filtered_transactions.len(),
        limit,
        offset,
        transactions: filtered_transactions,
    };
    
    Ok(HttpResponse::Ok().json(response))
}
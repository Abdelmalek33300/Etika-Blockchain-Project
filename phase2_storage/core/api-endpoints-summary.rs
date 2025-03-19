# Résumé des Endpoints de l'API Étika

## 1. Authentification

| Endpoint                | Méthode | Description                                       | Authentification |
|-------------------------|---------|---------------------------------------------------|-----------------|
| `/auth/login`           | POST    | Authentification et obtention d'un JWT            | Non             |
| `/auth/refresh`         | POST    | Rafraîchissement du token JWT                     | Oui (Token)     |

## 2. Système de Tokens

| Endpoint                | Méthode | Description                                       | Authentification |
|-------------------------|---------|---------------------------------------------------|-----------------|
| `/tokens/balance`       | GET     | Obtenir le solde de tokens                        | Oui             |
| `/tokens/activate`      | POST    | Activer des tokens latents                        | Oui             |
| `/tokens/transfer`      | POST    | Transférer des tokens à un autre utilisateur      | Oui             |
| `/tokens/history`       | GET     | Historique des transactions de tokens             | Oui             |

## 3. Consensus PoP (Proof of Purchase)

| Endpoint                                  | Méthode | Description                            | Authentification |
|-------------------------------------------|---------|----------------------------------------|-----------------|
| `/pop/transaction`                        | POST    | Créer une transaction PoP             | Oui             |
| `/pop/transaction/{transactionId}`        | GET     | Obtenir les détails d'une transaction | Oui             |
| `/pop/transaction/{transactionId}/validate` | POST  | Valider une transaction PoP           | Oui             |
| `/pop/transactions`                       | GET     | Lister les transactions PoP           | Oui             |

## 4. Gestion des Utilisateurs

| Endpoint                | Méthode | Description                                        | Authentification |
|-------------------------|---------|---------------------------------------------------|-----------------|
| `/users/register`       | POST    | Inscrire un nouvel utilisateur                    | Non             |
| `/users/profile`        | GET     | Obtenir son profil utilisateur                    | Oui             |
| `/users/profile`        | PUT     | Mettre à jour son profil utilisateur              | Oui             |

## 5. Administration

| Endpoint                | Méthode | Description                                       | Authentification |
|-------------------------|---------|---------------------------------------------------|-----------------|
| `/admin/users`          | GET     | Lister les utilisateurs (avec filtres)            | Oui (Admin)     |
| `/admin/users/{userId}` | GET     | Obtenir les détails d'un utilisateur              | Oui (Admin)     |
| `/admin/users/{userId}` | PUT     | Mettre à jour un utilisateur                      | Oui (Admin)     |

## Formats de Données Principaux

### 1. Token Balance
```json
{
  "latent_balance": 1000,
  "active_balance": 500,
  "locked_balance": 0,
  "total_balance": 1500
}
```

### 2. Transaction PoP
```json
{
  "transaction_id": "0123456789abcdef0123456789abcdef",
  "consumer": {
    "id": "1",
    "name": "Jean Dupont"
  },
  "merchant": {
    "id": "2",
    "name": "Magasin XYZ"
  },
  "suppliers": [
    {
      "id": "3",
      "name": "Fournisseur ABC"
    }
  ],
  "standard_amount": 1000,
  "tokens_exchanged": 100,
  "savings_generated": 50,
  "timestamp": "2025-02-28T14:30:00Z",
  "status": "pending",
  "validation_count": 1,
  "required_validations": 3,
  "validations": [
    {
      "validator_id": "2",
      "validator_name": "Magasin XYZ",
      "validator_type": "Merchant",
      "validation_time": "2025-02-28T14:30:00Z"
    }
  ]
}
```

### 3. User Profile
```json
{
  "id": "1",
  "email": "user@etika.io",
  "name": "Jean Dupont",
  "actor_type": "Consumer",
  "loyalty_tier": "Silver",
  "is_active": true,
  "phone_number": "+33612345678",
  "registered_at": "2025-01-15T10:30:00Z",
  "metadata": {
    "preferences": {
      "newsletter": true
    }
  }
}
```

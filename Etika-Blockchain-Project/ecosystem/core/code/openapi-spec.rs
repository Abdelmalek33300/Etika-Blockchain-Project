openapi: 3.0.3
info:
  title: API Étika
  description: API centrale pour l'écosystème Étika permettant l'interaction entre les différents modules.
  version: 1.0.0
  contact:
    name: Équipe Étika
servers:
  - url: http://api.etika.io/v1
    description: Serveur principal
paths:
  # Endpoints d'authentification
  /auth/login:
    post:
      tags:
        - Auth
      summary: Authentification d'un utilisateur
      description: Permet à un utilisateur de s'authentifier et d'obtenir un token JWT
      operationId: login
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
        required: true
      responses:
        '200':
          description: Authentification réussie
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          description: Identifiants invalides
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  /auth/refresh:
    post:
      tags:
        - Auth
      summary: Rafraîchir le token
      description: Permet d'obtenir un nouveau token JWT à partir d'un refresh token
      operationId: refreshToken
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Token rafraîchi avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          description: Token invalide ou expiré
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  # Endpoints du système de tokens
  /tokens/balance:
    get:
      tags:
        - Token System
      summary: Obtenir le solde de tokens
      description: Renvoie le solde de tokens latents et actifs d'un utilisateur
      operationId: getTokenBalance
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Solde obtenu avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenBalance'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  /tokens/activate:
    post:
      tags:
        - Token System
      summary: Activer des tokens
      description: Permet de convertir des tokens latents en tokens actifs
      operationId: activateTokens
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TokenActivationRequest'
        required: true
      responses:
        '200':
          description: Tokens activés avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenActionResponse'
        '400':
          description: Solde insuffisant ou montant invalide
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  /tokens/transfer:
    post:
      tags:
        - Token System
      summary: Transférer des tokens
      description: Permet de transférer des tokens actifs à un autre utilisateur
      operationId: transferTokens
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TokenTransferRequest'
        required: true
      responses:
        '200':
          description: Tokens transférés avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenActionResponse'
        '400':
          description: Solde insuffisant ou montant invalide
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
                
  /tokens/history:
    get:
      tags:
        - Token System
      summary: Historique des transactions de tokens
      description: Renvoie l'historique des transactions de tokens d'un utilisateur
      operationId: getTokenHistory
      security:
        - bearerAuth: []
      parameters:
        - name: limit
          in: query
          description: Nombre maximum d'entrées à retourner
          required: false
          schema:
            type: integer
            default: 10
        - name: offset
          in: query
          description: Position de départ pour la pagination
          required: false
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Historique obtenu avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenHistoryResponse'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  # Endpoints du consensus PoP
  /pop/transaction:
    post:
      tags:
        - PoP Consensus
      summary: Créer une transaction PoP
      description: Crée une nouvelle transaction avec preuve d'achat
      operationId: createPopTransaction
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PopTransactionRequest'
        required: true
      responses:
        '201':
          description: Transaction créée avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PopTransactionResponse'
        '400':
          description: Données invalides
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  /pop/transaction/{transactionId}/validate:
    post:
      tags:
        - PoP Consensus
      summary: Valider une transaction PoP
      description: Ajoute une validation à une transaction PoP existante
      operationId: validatePopTransaction
      security:
        - bearerAuth: []
      parameters:
        - name: transactionId
          in: path
          description: Identifiant de la transaction
          required: true
          schema:
            type: string
            format: hex
            example: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      responses:
        '200':
          description: Transaction validée avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PopTransactionResponse'
        '400':
          description: Transaction déjà validée ou autre erreur
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Transaction non trouvée
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  /pop/transaction/{transactionId}:
    get:
      tags:
        - PoP Consensus
      summary: Obtenir les détails d'une transaction PoP
      description: Renvoie les détails d'une transaction PoP spécifique
      operationId: getPopTransaction
      security:
        - bearerAuth: []
      parameters:
        - name: transactionId
          in: path
          description: Identifiant de la transaction
          required: true
          schema:
            type: string
            format: hex
            example: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      responses:
        '200':
          description: Détails de la transaction obtenus avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PopTransactionResponse'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Transaction non trouvée
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  /pop/transactions:
    get:
      tags:
        - PoP Consensus
      summary: Lister les transactions PoP
      description: Renvoie la liste des transactions PoP avec pagination
      operationId: listPopTransactions
      security:
        - bearerAuth: []
      parameters:
        - name: status
          in: query
          description: Filtrer par statut (pending, validated)
          required: false
          schema:
            type: string
            enum: [pending, validated]
        - name: limit
          in: query
          description: Nombre maximum d'entrées à retourner
          required: false
          schema:
            type: integer
            default: 10
        - name: offset
          in: query
          description: Position de départ pour la pagination
          required: false
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Liste des transactions obtenue avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PopTransactionListResponse'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  # Endpoints de gestion des utilisateurs
  /users/register:
    post:
      tags:
        - User Management
      summary: Inscrire un nouvel utilisateur
      description: Permet d'inscrire un nouvel utilisateur dans le système
      operationId: registerUser
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserRegistrationRequest'
        required: true
      responses:
        '201':
          description: Utilisateur créé avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          description: Données d'inscription invalides
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  /users/profile:
    get:
      tags:
        - User Management
      summary: Obtenir le profil utilisateur
      description: Renvoie le profil de l'utilisateur authentifié
      operationId: getUserProfile
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Profil obtenu avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    put:
      tags:
        - User Management
      summary: Mettre à jour le profil utilisateur
      description: Met à jour les informations du profil de l'utilisateur authentifié
      operationId: updateUserProfile
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserUpdateRequest'
        required: true
      responses:
        '200':
          description: Profil mis à jour avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          description: Données de mise à jour invalides
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  # Endpoints d'administration
  /admin/users:
    get:
      tags:
        - Administration
      summary: Lister les utilisateurs
      description: Renvoie la liste des utilisateurs avec pagination (réservé aux administrateurs)
      operationId: listUsers
      security:
        - bearerAuth: []
      parameters:
        - name: actor_type
          in: query
          description: Filtrer par type d'acteur
          required: false
          schema:
            type: string
            enum: [Consumer, Merchant, Supplier, Sponsor, NGO, PublicEntity, Investor]
        - name: limit
          in: query
          description: Nombre maximum d'entrées à retourner
          required: false
          schema:
            type: integer
            default: 10
        - name: offset
          in: query
          description: Position de départ pour la pagination
          required: false
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Liste des utilisateurs obtenue avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '403':
          description: Accès interdit
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
  
  /admin/users/{userId}:
    get:
      tags:
        - Administration
      summary: Obtenir les détails d'un utilisateur
      description: Renvoie les détails d'un utilisateur spécifique (réservé aux administrateurs)
      operationId: getUserDetails
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          description: Identifiant de l'utilisateur
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Détails de l'utilisateur obtenus avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '403':
          description: Accès interdit
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Utilisateur non trouvé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    put:
      tags:
        - Administration
      summary: Mettre à jour un utilisateur
      description: Met à jour les informations d'un utilisateur spécifique (réservé aux administrateurs)
      operationId: updateUser
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          description: Identifiant de l'utilisateur
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AdminUserUpdateRequest'
        required: true
      responses:
        '200':
          description: Utilisateur mis à jour avec succès
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          description: Données de mise à jour invalides
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Non autorisé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '403':
          description: Accès interdit
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '404':
          description: Utilisateur non trouvé
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  
  schemas:
    # Schémas d'authentification
    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
          description: Adresse email de l'utilisateur
          example: user@etika.io
        password:
          type: string
          format: password
          description: Mot de passe de l'utilisateur
          example: "********"
    
    AuthResponse:
      type: object
      properties:
        access_token:
          type: string
          description: Token JWT d'accès
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        refresh_token:
          type: string
          description: Token de rafraîchissement
          example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        token_type:
          type: string
          description: Type de token
          example: "Bearer"
        expires_in:
          type: integer
          description: Durée de validité du token en secondes
          example: 3600
        user_id:
          type: string
          description: Identifiant de l'utilisateur
          example: "5f7c3b4e1c9d8b4c1c9d8b4c"
    
    # Schémas du système de tokens
    TokenBalance:
      type: object
      properties:
        latent_balance:
          type: integer
          format: int64
          description: Solde de tokens latents
          example: 1000
        active_balance:
          type: integer
          format: int64
          description: Solde de tokens actifs
          example: 500
        locked_balance:
          type: integer
          format: int64
          description: Solde de tokens verrouillés
          example: 0
        total_balance:
          type: integer
          format: int64
          description: Solde total (latent + actif + verrouillé)
          example: 1500
    
    TokenActivationRequest:
      type: object
      required:
        - amount
      properties:
        amount:
          type: integer
          format: int64
          description: Montant de tokens à activer
          example: 100
    
    TokenTransferRequest:
      type: object
      required:
        - recipient_id
        - amount
      properties:
        recipient_id:
          type: string
          description: Identifiant du destinataire
          example: "5f7c3b4e1c9d8b4c1c9d8b4c"
        amount:
          type: integer
          format: int64
          description: Montant de tokens à transférer
          example: 50
        message:
          type: string
          description: Message optionnel pour le destinataire
          example: "Paiement pour service X"
    
    TokenActionResponse:
      type: object
      properties:
        transaction_id:
          type: string
          description: Identifiant de la transaction
          example: "0123456789abcdef0123456789abcdef"
        status:
          type: string
          description: Statut de l'action
          example: "success"
        new_balance:
          type: object
          properties:
            latent_balance:
              type: integer
              format: int64
              example: 900
            active_balance:
              type: integer
              format: int64
              example: 600
            locked_balance:
              type: integer
              format: int64
              example: 0
        timestamp:
          type: string
          format: date-time
          description: Horodatage de l'action
          example: "2025-02-28T14:30:00Z"
    
    TokenHistoryEntry:
      type: object
      properties:
        transaction_id:
          type: string
          description: Identifiant de la transaction
          example: "0123456789abcdef0123456789abcdef"
        transaction_type:
          type: string
          enum: [distribution, activation, transfer, burn, lock, unlock]
          description: Type de transaction
          example: "transfer"
        amount:
          type: integer
          format: int64
          description: Montant de la transaction
          example: 50
        counterparty_id:
          type: string
          description: Identifiant de la contrepartie (si applicable)
          example: "5f7c3b4e1c9d8b4c1c9d8b4c"
        counterparty_name:
          type: string
          description: Nom de la contrepartie (si applicable)
          example: "Merchant ABC"
        timestamp:
          type: string
          format: date-time
          description: Horodatage de la transaction
          example: "2025-02-28T14:30:00Z"
    
    TokenHistoryResponse:
      type: object
      properties:
        total:
          type: integer
          description: Nombre total d'entrées
          example: 42
        limit:
          type: integer
          description: Limite de pagination
          example: 10
        offset:
          type: integer
          description: Décalage de pagination
          example: 0
        entries:
          type: array
          items:
            $ref: '#/components/schemas/TokenHistoryEntry'
    
    # Schémas du consensus PoP
    PopTransactionRequest:
      type: object
      required:
        - consumer_id
        - merchant_id
        - standard_amount
        - tokens_exchanged
        - receipt_hash
      properties:
        consumer_id:
          type: string
          description: Identifiant du consommateur
          example: "5f7c3b4e1c9d8b4c1c9d8b4c"
        merchant_id:
          type: string
          description: Identifiant du commerçant
          example: "6a8d4c5f2e1a7b3e2d1c3b4a"
        supplier_ids:
          type: array
          items:
            type: string
          description: Liste des identifiants des fournisseurs
          example: ["7b9c8d7e6f5a4b3c2d1e2f3a"]
        standard_amount:
          type: integer
          format: int64
          description: Montant standard de la transaction
          example: 1000
        tokens_exchanged:
          type: integer
          format: int64
          description: Montant de tokens échangés
          example: 100
        receipt_hash:
          type: string
          format: hex
          description: Hash du ticket de caisse
          example: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        receipt_data:
          type: string
          format: byte
          description: Données du ticket de caisse encodées en base64 (optionnel)
    
    PopTransactionResponse:
      type: object
      properties:
        transaction_id:
          type: string
          format: hex
          description: Identifiant de la transaction
          example: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        consumer:
          type: object
          properties:
            id:
              type: string
              example: "5f7c3b4e1c9d8b4c1c9d8b4c"
            name:
              type: string
              example: "Jean Dupont"
        merchant:
          type: object
          properties:
            id:
              type: string
              example: "6a8d4c5f2e1a7b3e2d1c3b4a"
            name:
              type: string
              example: "Magasin XYZ"
        suppliers:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
                example: "7b9c8d7e6f5a4b3c2d1e2f3a"
              name:
                type: string
                example: "Fournisseur ABC"
        standard_amount:
          type: integer
          format: int64
          description: Montant standard de la transaction
          example: 1000
        tokens_exchanged:
          type: integer
          format: int64
          description: Montant de tokens échangés
          example: 100
        savings_generated:
          type: integer
          format: int64
          description: Montant d'épargne généré
          example: 50
        timestamp:
          type: string
          format: date-time
          description: Horodatage de la transaction
          example: "2025-02-28T14:30:00Z"
        status:
          type: string
          enum: [pending, validated]
          description: Statut de la transaction
          example: "pending"
        validation_count:
          type: integer
          description: Nombre de validations reçues
          example: 1
        required_validations:
          type: integer
          description: Nombre de validations requises
          example: 3
        validations:
          type: array
          items:
            type: object
            properties:
              validator_id:
                type: string
                example: "5f7c3b4e1c9d8b4c1c9d8b4c"
              validator_name:
                type: string
                example: "Jean Dupont"
              validator_type:
                type: string
                enum: [Consumer, Merchant, Supplier]
                example: "Consumer"
              validation_time:
                type: string
                format: date-time
                example: "2025-02-28T14:30:00Z"
    
    PopTransactionListResponse:
      type: object
      properties:
        total:
          type: integer
          description: Nombre total de transactions
          example: 42
        limit:
          type: integer
          description: Limite de pagination
          example: 10
        offset:
          type: integer
          description: Décalage de pagination
          example: 0
        transactions:
          type: array
          items:
            $ref: '#/components/schemas/PopTransactionResponse'
    
    # Schémas de gestion des utilisateurs
    UserRegistrationRequest:
      type: object
      required:
        - email
        - password
        - name
        - actor_type
      properties:
        email:
          type: string
          format: email
          description: Adresse email
          example: "user@etika.io"
        password:
          type: string
          format: password
          description: Mot de passe
          example: "********"
        name:
          type: string
          description: Nom de l'utilisateur ou de l'organisation
          example: "Jean Dupont"
        actor_type:
          type: string
          enum: [Consumer, Merchant, Supplier, Sponsor, NGO, PublicEntity, Investor]
          description: Type d'acteur
          example: "Consumer"
        phone_number:
          type: string
          description: Numéro de téléphone
          example: "+33612345678"
        metadata:
          type: object
          description: Métadonnées additionnelles spécifiques au type d'acteur
          example: 
            company_id: "FR12345678"
            sector: "Retail"
    
    UserUpdateRequest:
      type: object
      properties:
        name:
          type: string
          description: Nom de l'utilisateur ou de l'organisation
          example: "Jean Dupont"
        phone_number:
          type: string
          description: Numéro de téléphone
          example: "+33612345678"
        current_password:
          type: string
          format: password
          description: Mot de passe actuel (requis pour changer le mot de passe)
          example: "********"
        new_password:
          type: string
          format: password
          description: Nouveau mot de passe
          example: "********"
        metadata:
          type: object
          description: Métadonnées additionnelles spécifiques au type d'acteur
          example: 
            company_id: "FR12345678"
            sector: "Retail"
    
    AdminUserUpdateRequest:
      type: object
      properties:
        name:
          type: string
          description: Nom de l'utilisateur ou de l'organisation
          example: "Jean Dupont"
        actor_type:
          type: string
          enum: [Consumer, Merchant, Supplier, Sponsor, NGO, PublicEntity, Investor]
          description: Type d'acteur
          example: "Consumer"
        phone_number:
          type: string
          description: Numéro de téléphone
          example: "+33612345678"
        email:
          type: string
          format: email
          description: Adresse email
          example: "user@etika.io"
        is_active:
          type: boolean
          description: Statut d'activation du compte
          example: true
        loyalty_tier:
          type: string
          enum: [Bronze, Silver, Gold, Platinum, Diamond]
          description: Niveau de fidélité
          example: "Silver"
        metadata:
          type: object
          description: Métadonnées additionnelles spécifiques au type d'acteur
          example: 
            company_id: "FR12345678"
            sector: "Retail"
    
    UserResponse:
      type: object
      properties:
        id:
          type: string
          description: Identifiant de l'utilisateur
          example: "5f7c3b4e1c9d8b4c1c9d8b4c"
        email:
          type: string
          format: email
          description: Adresse email
          example: "user@etika.io"
        name:
          type: string
          description: Nom de l'utilisateur ou de l'organisation
          example: "Jean Dupont"
        actor_type:
          type: string
          enum: [Consumer, Merchant, Supplier, Sponsor, NGO, PublicEntity, Investor]
          description: Type d'acteur
          example: "Consumer"
        loyalty_tier:
          type: string
          enum: [Bronze, Silver, Gold, Platinum, Diamond]
          description: Niveau de fidélité
          example: "Silver"
        is_active:
          type: boolean
          description: Statut d'activation du compte
          example: true
        phone_number:
          type: string
          description: Numéro de téléphone
          example: "+33612345678"
        registered_at:
          type: string
          format: date-time
          description: Date d'inscription
          example: "2025-01-15T10:30:00Z"
        metadata:
          type: object
          description: Métadonnées additionnelles spécifiques au type d'acteur
          example: 
            company_id: "FR12345678"
            sector: "Retail"
    
    UserListResponse:
      type: object
      properties:
        total:
          type: integer
          description: Nombre total d'utilisateurs
          example: 120
        limit:
          type: integer
          description: Limite de pagination
          example: 10
        offset:
          type: integer
          description: Décalage de pagination
          example: 0
        users:
          type: array
          items:
            $ref: '#/components/schemas/UserResponse'
    
    # Schéma d'erreur générique
    Error:
      type: object
      properties:
        code:
          type: string
          description: Code d'erreur
          example: "INVALID_CREDENTIALS"
        message:
          type: string
          description: Message d'erreur
          example: "Les identifiants fournis sont invalides"
        details:
          type: object
          description: Détails supplémentaires sur l'erreur
          example:
            field: "email"
            constraint: "format"
  
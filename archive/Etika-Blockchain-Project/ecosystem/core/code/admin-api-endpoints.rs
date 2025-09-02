# Endpoints API pour le Dashboard d'Administration Étika

#----------------------
# Authentification et Autorisation
#----------------------
/api/auth:
  /login:
    post:
      description: Authentification administrateur avec JWT
      body: { username, password }
      response: { token, refreshToken, user }
  /refresh:
    post:
      description: Rafraîchissement du token d'authentification
      body: { refreshToken }
      response: { token }
  /2fa:
    /setup:
      post:
        description: Configuration de l'authentification à deux facteurs
        body: { userId }
        response: { secretKey, qrCode }
    /verify:
      post:
        description: Vérification du code 2FA
        body: { userId, code }
        response: { valid }

#----------------------
# Monitoring du Système
#----------------------
/api/monitoring:
  /dashboard:
    get:
      description: Données globales pour le dashboard principal
      response: { systemStatus, activeUsers, transactionCount, etc. }
  /blockchain:
    get:
      description: État et statistiques de la blockchain
      response: { blockHeight, nodeCount, consensusHealth, etc. }
  /tokens:
    get:
      description: Statistiques des tokens (distribution, activation, etc.)
      params: { period, filter }
      response: { totalSupply, activeTokens, burnedTokens, etc. }
  /transactions:
    get:
      description: Statistiques des transactions
      params: { period, type, status }
      response: { count, volume, averageTime, etc. }
  /system:
    get:
      description: Statistiques des serveurs et ressources système
      response: { cpuUsage, memoryUsage, diskUsage, apiLatency, etc. }
  /logs:
    get:
      description: Logs du système
      params: { level, service, fromDate, toDate, limit, offset }
      response: { logs: [{timestamp, level, service, message}] }

#----------------------
# Gestion des Utilisateurs
#----------------------
/api/users:
  get:
    description: Liste des utilisateurs (filtrée par rôle/type)
    params: { role, status, search, limit, offset }
    response: { users, total, limit, offset }
  post:
    description: Création d'un nouvel utilisateur
    body: { username, email, role, ... }
    response: { userId, status }
  /{userId}:
    get:
      description: Détails d'un utilisateur
      response: { user }
    put:
      description: Mise à jour d'un utilisateur
      body: { username, email, role, ... }
      response: { status }
    delete:
      description: Désactivation d'un utilisateur
      response: { status }
  /roles:
    get:
      description: Liste des rôles disponibles
      response: { roles }
    post:
      description: Création d'un nouveau rôle
      body: { name, permissions, ... }
      response: { roleId, status }
    /{roleId}:
      get:
        description: Détails d'un rôle
        response: { role }
      put:
        description: Mise à jour d'un rôle
        body: { name, permissions, ... }
        response: { status }
      delete:
        description: Suppression d'un rôle
        response: { status }
  /audit:
    get:
      description: Journal d'audit des actions administratives
      params: { userId, action, fromDate, toDate, limit, offset }
      response: { entries, total, limit, offset }

#----------------------
# Gestion des Organisations
#----------------------
/api/organizations:
  get:
    description: Liste des organisations
    params: { type, status, search, limit, offset }
    response: { organizations, total, limit, offset }
  post:
    description: Création d'une nouvelle organisation
    body: { name, type, contactInfo, ... }
    response: { organizationId, status }
  /{organizationId}:
    get:
      description: Détails d'une organisation
      response: { organization }
    put:
      description: Mise à jour d'une organisation
      body: { name, type, contactInfo, ... }
      response: { status }
    delete:
      description: Désactivation d'une organisation
      response: { status }
  /{organizationId}/verification:
    put:
      description: Validation KYC/KYB d'une organisation
      body: { verificationStatus, notes, ... }
      response: { status }

#----------------------
# Paramètres du Système
#----------------------
/api/settings:
  /token:
    get:
      description: Paramètres des tokens
      response: { distributionRate, initialValue, burnPercentage, ... }
    put:
      description: Mise à jour des paramètres des tokens
      body: { distributionRate, initialValue, burnPercentage, ... }
      response: { status }
  /financial:
    get:
      description: Paramètres financiers
      response: { rates, fees, distributionPeriods, ... }
    put:
      description: Mise à jour des paramètres financiers
      body: { rates, fees, distributionPeriods, ... }
      response: { status }
  /factoring:
    get:
      description: Paramètres d'affacturage
      response: { rules, rates, limits, ... }
    put:
      description: Mise à jour des paramètres d'affacturage
      body: { rules, rates, limits, ... }
      response: { status }
  /consensus:
    get:
      description: Paramètres du consensus PoP
      response: { validatorMinimum, validationRules, ... }
    put:
      description: Mise à jour des paramètres du consensus
      body: { validatorMinimum, validationRules, ... }
      response: { status }
  /auction:
    get:
      description: Paramètres du système d'enchères
      response: { minimumBid, duration, sponsorshipTerms, ... }
    put:
      description: Mise à jour des paramètres d'enchères
      body: { minimumBid, duration, sponsorshipTerms, ... }
      response: { status }

#----------------------
# Alertes et Notifications
#----------------------
/api/alerts:
  get:
    description: Liste des alertes
    params: { severity, status, fromDate, toDate, limit, offset }
    response: { alerts, total, limit, offset }
  post:
    description: Création d'une nouvelle alerte
    body: { message, severity, source, ... }
    response: { alertId, status }
  /{alertId}:
    get:
      description: Détails d'une alerte
      response: { alert }
    put:
      description: Mise à jour d'une alerte (résolution, commentaires)
      body: { status, resolution, ... }
      response: { status }
  /settings:
    get:
      description: Configuration des alertes
      response: { thresholds, recipients, methods, ... }
    put:
      description: Mise à jour de la configuration des alertes
      body: { thresholds, recipients, methods, ... }
      response: { status }
  /reports:
    get:
      description: Liste des rapports programmés
      response: { reports }
    post:
      description: Création d'un nouveau rapport programmé
      body: { name, schedule, recipients, format, ... }
      response: { reportId, status }
    /{reportId}:
      get:
        description: Détails d'un rapport programmé
        response: { report }
      put:
        description: Mise à jour d'un rapport programmé
        body: { name, schedule, recipients, format, ... }
        response: { status }
      delete:
        description: Suppression d'un rapport programmé
        response: { status }

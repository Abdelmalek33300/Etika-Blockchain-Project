version: '3.8'

services:
  # API Gateway - Point d'entrée pour toutes les requêtes
  api-gateway:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./config/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - api-centrale
      - auth-service
    networks:
      - etika-network
    deploy:
      replicas: 2
      restart_policy:
        condition: any
    
  # API Centrale - Coordination de tous les services
  api-centrale:
    build: 
      context: ./api-centrale
      dockerfile: Dockerfile
    environment:
      - DB_HOST=postgres-db
      - DB_PORT=5432
      - DB_NAME=etikadb
      - DB_USER=etika_user
      - DB_PASSWORD=etika_password
      - AUTH_SERVICE_URL=http://auth-service:8080
      - REDIS_HOST=redis-cache
      - BLOCKCHAIN_NODE_URL=http://blockchain-node:9000
    ports:
      - "8000:8000"
    depends_on:
      - postgres-db
      - redis-cache
    networks:
      - etika-network
    volumes:
      - api-centrale-data:/app/data
    
  # Service d'Authentification
  auth-service:
    build: 
      context: ./auth-service
      dockerfile: Dockerfile
    environment:
      - DB_HOST=postgres-db
      - SECRET_KEY=your_very_secure_secret_key
      - TOKEN_EXPIRY=86400
    ports:
      - "8080:8080"
    depends_on:
      - postgres-db
    networks:
      - etika-network
    
  # Blockchain Core
  blockchain-node:
    build: 
      context: ./blockchain-core
      dockerfile: Dockerfile
    environment:
      - NODE_ID=1
      - NETWORK=testnet
      - API_PORT=9000
      - P2P_PORT=9001
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - blockchain-data:/blockchain/data
    networks:
      - etika-network
    
  # Module Gestion des Tokens
  token-service:
    build: 
      context: ./token-service
      dockerfile: Dockerfile
    environment:
      - BLOCKCHAIN_API_URL=http://blockchain-node:9000
      - API_PORT=8081
    ports:
      - "8081:8081"
    depends_on:
      - blockchain-node
      - postgres-db
    networks:
      - etika-network
    
  # Module Système d'Enchères
  auction-service:
    build: 
      context: ./auction-service
      dockerfile: Dockerfile
    environment:
      - DB_HOST=postgres-db
      - TOKEN_SERVICE_URL=http://token-service:8081
      - API_PORT=8082
    ports:
      - "8082:8082"
    depends_on:
      - postgres-db
      - token-service
    networks:
      - etika-network
    
  # Module Place de Marché
  marketplace-service:
    build: 
      context: ./marketplace-service
      dockerfile: Dockerfile
    environment:
      - DB_HOST=postgres-db
      - TOKEN_SERVICE_URL=http://token-service:8081
      - AUCTION_SERVICE_URL=http://auction-service:8082
      - PAYMENT_SERVICE_URL=http://payment-service:8084
      - API_PORT=8083
    ports:
      - "8083:8083"
    depends_on:
      - postgres-db
      - token-service
      - auction-service
    networks:
      - etika-network
    volumes:
      - marketplace-data:/app/data
    
  # Module Intégration Paiement
  payment-service:
    build: 
      context: ./payment-service
      dockerfile: Dockerfile
    environment:
      - DB_HOST=postgres-db
      - API_PORT=8084
      - PAYMENT_GATEWAY_URL=https://payment-gateway.example.com
    ports:
      - "8084:8084"
    depends_on:
      - postgres-db
    networks:
      - etika-network
    
  # Service de Notification
  notification-service:
    build: 
      context: ./notification-service
      dockerfile: Dockerfile
    environment:
      - REDIS_HOST=redis-cache
      - API_PORT=8085
      - EMAIL_SMTP_HOST=smtp.example.com
      - EMAIL_SMTP_PORT=587
      - EMAIL_USER=notification@etika.com
      - EMAIL_PASSWORD=secure_password
    ports:
      - "8085:8085"
    depends_on:
      - redis-cache
    networks:
      - etika-network
    
  # Base de données principale
  postgres-db:
    image: postgres:14
    environment:
      - POSTGRES_DB=etikadb
      - POSTGRES_USER=etika_user
      - POSTGRES_PASSWORD=etika_password
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    networks:
      - etika-network
    
  # Cache distribué
  redis-cache:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - etika-network
    
  # Monitoring
  prometheus:
    image: prom/prometheus
    volumes:
      - ./config/prometheus:/etc/prometheus
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - etika-network
    
  grafana:
    image: grafana/grafana
    depends_on:
      - prometheus
    ports:
      - "3000:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./config/grafana/provisioning:/etc/grafana/provisioning
    networks:
      - etika-network

# Définition des volumes persistants
volumes:
  postgres-data:
  redis-data:
  blockchain-data:
  api-centrale-data:
  marketplace-data:
  prometheus-data:
  grafana-data:

# Définition du réseau
networks:
  etika-network:
    driver: bridge
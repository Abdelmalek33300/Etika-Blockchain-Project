// server.js
// Serveur principal pour la plateforme web Étika

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
const MongoStore = require('connect-mongo');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Import des routes
const authRoutes = require('./routes/auth');
const auctionRoutes = require('./routes/auctions');
const certificateRoutes = require('./routes/certificates');
const userRoutes = require('./routes/users');
const ngoRoutes = require('./routes/ngos');
const adminRoutes = require('./routes/admin');

// Import des services
const { initializeServices } = require('./services');

// Configuration
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'etika-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/etika',
    ttl: 14 * 24 * 60 * 60 // 14 jours
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 14 * 24 * 60 * 60 * 1000
  }
}));

// Authentification
app.use(passport.initialize());
app.use(passport.session());
require('./config/passport')(passport);

// Stockage statique
app.use(express.static(path.join(__dirname, 'public')));

// Initialisation des services
const services = initializeServices(io);

// Middleware pour injecter les services
app.use((req, res, next) => {
  req.services = services;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/admin', adminRoutes);

// Route pour servir l'application React en production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Une erreur est survenue',
      status: err.status || 500
    }
  });
});

// Configuration de Socket.IO
io.on('connection', (socket) => {
  console.log('Client connecté:', socket.id);
  
  // Gestion des événements en temps réel
  socket.on('join-auction', (auctionId) => {
    socket.join(`auction-${auctionId}`);
    console.log(`Client ${socket.id} a rejoint l'enchère ${auctionId}`);
  });
  
  socket.on('leave-auction', (auctionId) => {
    socket.leave(`auction-${auctionId}`);
    console.log(`Client ${socket.id} a quitté l'enchère ${auctionId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
  });
});

// Connexion à la base de données et démarrage du serveur
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/etika')
  .then(() => {
    console.log('Connexion à MongoDB établie');
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      console.log(`Serveur en écoute sur le port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Erreur de connexion à MongoDB:', err);
    process.exit(1);
  });

// Exportation pour les tests
module.exports = app;

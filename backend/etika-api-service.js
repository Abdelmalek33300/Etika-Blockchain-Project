import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import https from 'https';
import jwt from 'jsonwebtoken';

import etikaService from './etika-router.js';
import authRouter from './phase2_storage/auth-router.js';

const config = {
  port: 4433,
  jwtSecret: 'etika-auth-secret', // ✅ Clé forcée ici
  adminAddress: process.env.ADMIN_ADDRESS || '0xAdminAddress'
};

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🧪 Route de test navigateur
app.get('/', (req, res) => res.send('Etika API is running on HTTPS!'));

// 🔐 Middleware JWT : vérifie que l'utilisateur est authentifié
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, config.jwtSecret, (err, user) => {
      if (err) {
        console.error('❌ Erreur de vérification JWT :', err.message);
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// 🔐 Middleware Admin : vérifie que l'utilisateur est un admin
const requireAdmin = (req, res, next) => {
  // 👇 Debug rôle utilisateur
  console.log('🔐 DEBUG rôle utilisateur :', req.user);

  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Accès interdit : admin uniquement' });
  }
};

// 🔓 Routes publiques : login
app.use('/api/auth', authRouter);

// 🔐 Protection des routes sensibles (POST et DELETE sur /auctions)
app.use('/api', (req, res, next) => {
  // 🐞 Log de debug pour voir les requêtes qui arrivent
  console.log('🔍 Requête reçue :', req.method, req.path);

  const isProtected =
    (req.method === 'POST' && req.path === '/auctions') ||
    (req.method === 'DELETE' && req.path.startsWith('/auctions'));

  if (isProtected) {
    return authenticateJWT(req, res, () => requireAdmin(req, res, next));
  }

  next();
});

// 📦 Intégration des routes API principales
app.use('/api', etikaService);

// 🌐 Lancement du serveur HTTPS
const httpsOptions = {
  key: fs.readFileSync('./cert/key.pem'),
  cert: fs.readFileSync('./cert/cert.pem')
};

https.createServer(httpsOptions, app).listen(config.port, () => {
  console.log(`✅ Étika API HTTPS Server running at https://localhost:${config.port}`);
});

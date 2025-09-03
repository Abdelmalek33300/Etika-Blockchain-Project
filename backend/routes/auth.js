import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bcrypt from 'bcryptjs';
import { signToken } from '../services/jwt.js';

const router = express.Router();

// Variables d'admin (nettoyées)
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@etika.local').trim();
const ADMIN_PASSWORD_HASH = (process.env.ADMIN_PASSWORD_HASH ||
  '$2a$10$Xn7oZQF0J8wZ8Yw0KJmNde4K7M3k3.1r3H4o0a9Owu2r8hY3u7dAW').trim(); // fallback

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  if (email.trim() !== ADMIN_EMAIL) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ sub: email.trim(), role: 'admin' }, '4h');
  res.json({ token });
});

export default router;

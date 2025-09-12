import "dotenv/config";
import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../services/db.js";
import { signToken } from "../services/jwt.js";

const router = express.Router();

// POST /api/auth/login  (auth via table users)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

    const { rows } = await pool.query(
      "SELECT id, email, password_hash, role FROM users WHERE email=$1",
      [email.trim()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken({ sub: user.id, role: user.role, email: user.email }, "4h");
    res.json({ token });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    res.status(500).json({ error: "Auth error" });
  }
});

export default router;

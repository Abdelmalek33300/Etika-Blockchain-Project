import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";

const router = express.Router();

/**
 * GET /api/public/dashboard
 * Sert le JSON pré-agrégé depuis .cache/dashboard.json
 */
router.get("/api/public/dashboard", async (req, res) => {
  try {
    const fp = path.join(process.cwd(), ".cache", "dashboard.json");
    const data = await readFile(fp, "utf8");
    res.type("application/json").send(data);
  } catch (err) {
    res.status(503).json({ error: "dashboard_unavailable", detail: err.message });
  }
});

export default router;

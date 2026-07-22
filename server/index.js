// Huddle backend entry point. For now it does two things:
//   1. Exposes GET /api/health, which pings Postgres — the first deploy uses
//      this to confirm the DATABASE_URL wiring end-to-end.
//   2. Serves the built Vite SPA (dist/) with a client-side-routing fallback.
// Auth, board APIs, and the Socket.IO realtime layer land in later phases.

import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { pool } from "./db.js";
import { authMiddleware, authRouter, authConfigured } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");

const app = express();
// Railway terminates TLS at a proxy; trust it so secure cookies are set and
// req.protocol reflects https (needed for the OAuth callback URL).
app.set("trust proxy", 1);
app.use(express.json());
app.use(authMiddleware());

app.use("/api/auth", authRouter);

app.get("/api/health", async (_req, res) => {
  try {
    const { rows } = await pool.query("select 1 as ok");
    res.json({ status: "ok", db: rows[0].ok === 1 });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

// Static assets, then an index.html fallback for any non-API GET so the SPA's
// client-side routes resolve on refresh/deep-link.
app.use(express.static(DIST_DIR));
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log(`Huddle server listening on :${port} (auth: ${authConfigured ? "enabled" : "DISABLED"})`)
);

/**
 * AI Novel Reader - Server Entry Point
 *
 * This file is the main entry point for the Express server.
 * Routes are organized in separate modules under server/routes/
 */

import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkpointWAL, createBackup, cleanupDeletedRecords } from "./database.js";
import { cleanupRateLimits } from "./middleware/index.js";
import { novelsRouter, ragRouter, syncRouter, proxyRouter } from "./routes/index.js";

import { mountAdminRoutes } from "./admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ── CORS: restrict to localhost origins ──
const ALLOWED_ORIGINS = [
  "http://localhost:5173", "http://127.0.0.1:5173",
  "http://localhost:3001", "http://127.0.0.1:3001",
  "http://localhost:4173", "http://127.0.0.1:4173",
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin (same-origin, curl, mobile apps) and localhost
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Allow any LAN IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/.test(origin)) return cb(null, true);
    cb(new Error("CORS not allowed"));
  },
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "anthropic-version"],
  exposedHeaders: ["Content-Type"],
  credentials: true,
  maxAge: 86400,
}));
app.use(express.json({ limit: "50mb" }));

// Prune stale rate limit entries every 5 minutes
setInterval(cleanupRateLimits, 300_000);

// ── Mount Admin Routes ──────────────────────────────────────
mountAdminRoutes(app);

// ── Mount API Routes ────────────────────────────────────────
app.use("/api/novels", novelsRouter);
app.use("/api/rag", ragRouter);
app.use("/api/sync", syncRouter);
app.use("/api/proxy", proxyRouter);

// ── Admin page ──────────────────────────────────────────────

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// ── Production static serving ───────────────────────────────

const isFullMode = process.argv.includes("--full");
if (isFullMode) {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  // SPA fallback: serve index.html for any non-API, non-admin route
  // Note: Express 5 requires named parameters, so we use a middleware instead of "*"
  app.use((req, res, next) => {
    // Skip API and admin routes
    if (req.path.startsWith("/api/") || req.path.startsWith("/admin")) {
      return next();
    }
    // Skip non-GET requests
    if (req.method !== "GET") {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── Global error handler ────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error("[server] unhandled error:", err);
  res.status(500).json({ error: "服务器内部错误" });
});

// ── Start server ────────────────────────────────────────────

const PORT = process.env.PORT || (isFullMode ? 5173 : 3001);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[sync] http://0.0.0.0:${PORT} (${isFullMode ? "full" : "api-only"})`);
});

// ── Maintenance tasks ───────────────────────────────────────

// 启动时立即执行一次备份
try { createBackup(); } catch { /* ignore */ }

// WAL checkpoint every 30 minutes
setInterval(() => {
  try { checkpointWAL(); } catch { /* ignore */ }
}, 30 * 60 * 1000);

// Backup every 24 hours
setInterval(() => {
  try { createBackup(); } catch { /* ignore */ }
}, 24 * 60 * 60 * 1000);

// Cleanup deleted records every 24 hours
setInterval(() => {
  try { cleanupDeletedRecords(); } catch { /* ignore */ }
}, 24 * 60 * 60 * 1000);

// Graceful shutdown
process.on("SIGINT", () => {
  try { checkpointWAL(); } catch { /* ignore */ }
  process.exit(0);
});

process.on("SIGTERM", () => {
  try { checkpointWAL(); } catch { /* ignore */ }
  process.exit(0);
});

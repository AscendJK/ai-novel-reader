import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createUser, readUser, userExists } from "./user-store.js";
import { register, disconnect, heartbeat, mergeAndSave } from "./sync-handler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ── Sync API ──────────────────────────────────────────────

// POST /api/sync/register
app.post("/api/sync/register", (req, res) => {
  const { username, mode } = req.body;
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username required" });
  }

  const exists = userExists(username);

  // "join" mode: reject if user doesn't exist
  if (mode === "join" && !exists) {
    return res.status(404).json({ error: "用户名不存在，请先创建" });
  }

  const data = exists ? readUser(username) : createUser(username);
  const clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const activeCount = register(username, clientId);

  res.json({ clientId, activeCount, data: exists ? data : null, isNew: !exists });
});

// POST /api/sync/heartbeat
app.post("/api/sync/heartbeat", (req, res) => {
  const { username, clientId } = req.body;
  if (!username || !clientId) return res.status(400).json({ error: "username and clientId required" });
  const activeCount = heartbeat(username, clientId);
  res.json({ activeCount });
});

// POST /api/sync/push
app.post("/api/sync/push", (req, res) => {
  const { username, clientId, changes } = req.body;
  if (!username || !clientId) return res.status(400).json({ error: "username and clientId required" });
  if (!changes) return res.json({ merged: false, data: readUser(username) });

  heartbeat(username, clientId);
  const merged = mergeAndSave(username, changes);
  res.json({ merged: !!merged, data: merged });
});

// POST /api/sync/disconnect
app.post("/api/sync/disconnect", (req, res) => {
  const { username, clientId } = req.body;
  if (username && clientId) disconnect(username, clientId);
  res.json({ ok: true });
});

// GET /api/sync/status
app.get("/api/sync/status", (_req, res) => {
  res.json({ ok: true });
});

// ── Production static serving ─────────────────────────────

const isFullServer = process.argv.includes("--full");
const distPath = path.join(__dirname, "..", "dist");

if (isFullServer && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── Start ────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || (isFullServer ? "5173" : "3001"), 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[sync] http://0.0.0.0:${PORT} (${isFullServer ? "full" : "api-only"})`);
});

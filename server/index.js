import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as db from "./database.js";
import { register, disconnect, heartbeat, isActive, mergeAndSave } from "./sync-handler.js";

import { mountAdminRoutes } from "./admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors({
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "anthropic-version"],
  exposedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "50mb" }));
mountAdminRoutes(app);

// ── Auth helper ──────────────────────────────────────────────

function authNovel(req, res) {
  const username = req.query.username || req.body?.username;
  if (!username || !db.userExists(username)) {
    res.status(401).json({ error: "需要登录" }); return false;
  }
  return true;
}

// ── Novel Library API ────────────────────────────────────────

// GET /api/novels?username=xxx — list all novels with user join status
app.get("/api/novels", (req, res) => {
  try {
    const username = req.query.username;
    if (username) {
      res.json(db.listNovelsWithUserStatus(username));
    } else {
      res.json(db.listNovels());
    }
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// GET /api/novels/:id — novel meta + chapter list (titles only, no content)
app.get("/api/novels/:id", (req, res) => {
  try {
    const novel = db.getNovel(req.params.id);
    if (!novel) return res.status(404).json({ error: "小说未找到" });
    const chapters = db.getChapterList(req.params.id);
    res.json({ novel, chapters });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// GET /api/novels/:id/chapters — all chapters with content (for auto-join)
app.get("/api/novels/:id/chapters", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const chapters = db.getAllChapters(req.params.id);
    res.json(chapters);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// GET /api/novels/:id/chapters/:index — single chapter content
app.get("/api/novels/:id/chapters/:index", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const ch = db.getChapter(req.params.id, parseInt(req.params.index, 10));
    if (!ch) return res.status(404).json({ error: "章节未找到" });
    res.json(ch);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /api/novels — upload/import a novel (parsed JSON from frontend)
app.post("/api/novels", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const { novel, chapters } = req.body;
    if (!novel || !chapters) return res.status(400).json({ error: "novel and chapters required" });

    db.insertNovel({
      id: novel.id,
      title: novel.title,
      author: novel.author || null,
      fileName: novel.fileName || "",
      fileFormat: novel.fileFormat || "txt",
      totalChars: novel.totalChars || 0,
      chapterCount: novel.chapterCount || chapters.length,
      createdAt: novel.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
    db.insertChapters(chapters);
    res.json({ ok: true, novelId: novel.id });
  } catch (e) {
    console.error("upload novel failed:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/novels/:id/join — user adds novel to their bookshelf
app.post("/api/novels/:id/join", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });
    const novel = db.getNovel(req.params.id);
    if (!novel) return res.status(404).json({ error: "小说未找到" });
    db.joinNovel(username, req.params.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /api/novels/:id/leave — user removes novel from bookshelf (keeps novel on server)
app.post("/api/novels/:id/leave", (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });
    db.leaveNovel(username, req.params.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// DELETE /api/novels/:id — removed; use /api/admin/novels/:id with token auth instead

// ── Sync API ────────────────────────────────────────────────

// POST /api/sync/register
app.post("/api/sync/register", (req, res) => {
  const { username, mode } = req.body;
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username required" });
  }

  const exists = db.userExists(username);

  if (mode === "create" && exists) {
    return res.status(409).json({ error: "用户名已存在，请返回并点击'加入已有'" });
  }
  if (mode === "join" && !exists) {
    return res.status(404).json({ error: "用户名不存在，请先创建" });
  }

  if (!exists) db.createUser(username);

  const clientId = crypto.randomBytes(12).toString("hex");
  const activeCount = register(username, clientId);
  const data = db.gatherSyncData(username);

  res.json({ clientId, activeCount, data, isNew: !exists });
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
  try {
    const { username, clientId, changes } = req.body;
    if (!username || !clientId) return res.status(400).json({ error: "username and clientId required" });
    if (!isActive(username, clientId)) return res.status(403).json({ error: "kicked" });
    if (!changes) return res.json({ merged: false, data: db.gatherSyncData(username) });

    const merged = mergeAndSave(username, changes);
    res.json({ merged: !!merged, data: merged });
  } catch (e) {
    console.error("[sync] push error:", e);
    res.status(500).json({ error: e.message });
  }
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

// ── Admin page ──────────────────────────────────────────────

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// ── Production static serving ───────────────────────────────

const isFullServer = process.argv.includes("--full");
const distPath = path.join(__dirname, "..", "dist");

if (isFullServer && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/") || req.path === "/admin") return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── Start ──────────────────────────────────────────────────

// Graceful shutdown — checkpoint WAL
process.on("SIGINT", () => { db.db.pragma("wal_checkpoint(RESTART)"); process.exit(0); });
process.on("SIGTERM", () => { db.db.pragma("wal_checkpoint(RESTART)"); process.exit(0); });

const PORT = parseInt(process.env.PORT || (isFullServer ? "5173" : "3001"), 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[sync] http://0.0.0.0:${PORT} (${isFullServer ? "full" : "api-only"})`);
});

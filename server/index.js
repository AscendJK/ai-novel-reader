import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as db from "./database.js";
import { register, disconnect, heartbeat, isActive, mergeAndSave, createSession, validateSession, removeSession } from "./sync-handler.js";

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
}));
app.use(express.json({ limit: "50mb" }));

// ── Rate limiting for expensive endpoints ──
const rateLimits = new Map(); // ip → { count, resetAt }
const RATE_WINDOW = 60_000; // 1 minute

function rateLimit(maxPerMinute) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimits.get(ip);
    if (!entry || now > entry.resetAt) {
      rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
      return next();
    }
    entry.count++;
    if (entry.count > maxPerMinute) {
      return res.status(429).json({ error: "请求过于频繁，请稍后再试" });
    }
    next();
  };
}

// Prune stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(ip);
  }
}, 300_000);

mountAdminRoutes(app);

// ── Session auth middleware ───────────────────────────────────

function getSessionUsername(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return validateSession(auth.slice(7));
  }
  // Fallback: body or query (for backward compat during migration)
  const t = req.query.token || req.body?.token;
  if (t) return validateSession(t);
  return null;
}

function authNovel(req, res) {
  const username = getSessionUsername(req);
  if (!username) {
    res.status(401).json({ error: "需要登录" }); return false;
  }
  req._username = username;
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
  } catch (e) { console.error(e); res.status(500).json({ error: "查询失败" }); }
});

// GET /api/novels/:id — novel meta + chapter list (titles only, no content)
app.get("/api/novels/:id", (req, res) => {
  try {
    const novel = db.getNovel(req.params.id);
    if (!novel) return res.status(404).json({ error: "小说未找到" });
    const chapters = db.getChapterList(req.params.id);
    res.json({ novel, chapters });
  } catch (e) { console.error(e); res.status(500).json({ error: "查询失败" }); }
});

// GET /api/novels/:id/chapters — all chapters with content (for auto-join)
app.get("/api/novels/:id/chapters", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const chapters = db.getAllChapters(req.params.id);
    res.json(chapters);
  } catch (e) { console.error(e); res.status(500).json({ error: "获取章节失败" }); }
});

// GET /api/novels/:id/chapters/:index — single chapter content
app.get("/api/novels/:id/chapters/:index", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const ch = db.getChapter(req.params.id, parseInt(req.params.index, 10));
    if (!ch) return res.status(404).json({ error: "章节未找到" });
    res.json(ch);
  } catch (e) { console.error(e); res.status(500).json({ error: "获取章节失败" }); }
});

// POST /api/novels — upload/import a novel (parsed JSON from frontend)
app.post("/api/novels", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const { novel, chapters } = req.body;
    if (!novel || !chapters) return res.status(400).json({ error: "novel and chapters required" });

    // Always generate server-side ID to prevent client ID spoofing
    const novelId = novel.id || crypto.randomUUID();

    db.insertNovel({
      id: novelId,
      title: novel.title,
      author: novel.author || null,
      fileName: novel.fileName || "",
      fileFormat: novel.fileFormat || "txt",
      totalChars: novel.totalChars || 0,
      chapterCount: novel.chapterCount || chapters.length,
      createdAt: novel.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
    // Map chapters to use server-generated novel ID
    const mappedChapters = chapters.map((ch, i) => ({
      ...ch,
      novelId: novelId,
      id: ch.id || `${novelId}-ch${i}`,
    }));
    db.insertChapters(mappedChapters);
    res.json({ ok: true, novelId });
  } catch (e) {
    console.error("upload novel failed:", e);
    res.status(500).json({ error: "上传失败" });
  }
});

// POST /api/novels/:id/join — user adds novel to their bookshelf
app.post("/api/novels/:id/join", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const novel = db.getNovel(req.params.id);
    if (!novel) return res.status(404).json({ error: "小说未找到" });
    db.joinNovel(req._username, req.params.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "加入书架失败" }); }
});

// POST /api/novels/:id/leave — user removes novel from bookshelf (keeps novel on server)
app.post("/api/novels/:id/leave", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    db.leaveNovel(req._username, req.params.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: "操作失败" }); }
});

// DELETE /api/novels/:id — removed; use /api/admin/novels/:id with token auth instead

// ── RAG: Cached pipeline for test/encode endpoints ────────

let _cachedPipe = null;
async function getEncodePipeline() {
  if (_cachedPipe) return _cachedPipe;
  const { pipeline, env } = await import("@xenova/transformers");
  env.allowRemoteModels = false;
  env.localModelPath = "./public/models/builtin/";
  _cachedPipe = await pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", { local_files_only: true });
  return _cachedPipe;
}

// ── RAG: Quick test endpoint ──────────────────────────────

app.get("/api/rag/test", rateLimit(5), async (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const t0 = Date.now();
    const pipe = await getEncodePipeline();
    const result = await pipe(["测试文本"], { pooling: "mean", normalize: true });
    const arr = await result.tolist();
    res.json({ ok: true, dim: arr[0]?.length, time: Date.now() - t0 });
  } catch (e) {
    res.status(500).json({ error: "测试失败" });
  }
});

// ── RAG Index API ──────────────────────────────────────────

import { buildIndex as buildRagIndex, getProgress, getIndexData, getStatuses } from "./rag-builder.js";

// POST /api/rag/encode — encode query text (single small batch, max 20 texts)
app.post("/api/rag/encode", rateLimit(30), async (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const { texts } = req.body;
    if (!texts?.length) return res.status(400).json({ error: "texts required" });
    if (texts.length > 20) return res.status(400).json({ error: "单次最多编码 20 条文本" });
    if (texts.some((t) => typeof t !== "string" || t.length > 10000)) {
      return res.status(400).json({ error: "文本过长或格式错误" });
    }
    const pipe = await getEncodePipeline();
    const result = await pipe(texts, { pooling: "mean", normalize: true });
    const vectors = await result.tolist();
    res.json({ vectors });
  } catch (e) { res.status(500).json({ error: "编码失败" }); }
});

// GET /api/rag/statuses?ids=a,b,c&engine=bge-small-zh
app.get("/api/rag/statuses", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const ids = (req.query.ids || "").split(",").filter(Boolean);
    const engine = req.query.engine || "bge-small-zh";
    res.json(getStatuses(ids, engine));
  } catch (e) { res.status(500).json({ error: "查询失败" }); }
});

// GET /api/rag/:novelId/status?engine=bge-small-zh
app.get("/api/rag/:novelId/status", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const engine = req.query.engine || "bge-small-zh";
    const progress = getProgress(req.params.novelId, engine);
    res.json(progress);
  } catch (e) { res.status(500).json({ error: "查询失败" }); }
});

// POST /api/rag/:novelId/build — trigger async build
app.post("/api/rag/:novelId/build", rateLimit(5), (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const engine = req.body?.engine || "bge-small-zh";
    const result = buildRagIndex(req.params.novelId, engine);
    res.json(result);
  } catch (e) { res.status(500).json({ error: "构建失败" }); }
});

// GET /api/rag/:novelId/index?engine=bge-small-zh — download built index
app.get("/api/rag/:novelId/index", (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const engine = req.query.engine || "bge-small-zh";
    const data = getIndexData(req.params.novelId, engine);
    if (!data) return res.status(404).json({ error: "索引未构建" });
    res.json({
      chunks: JSON.parse(data.chunks_json),
      vectorsBase64: data.vectors_blob.toString("base64"),
      dim: data.dim,
      chunkCount: data.chunk_count,
    });
  } catch (e) { res.status(500).json({ error: "获取索引失败" }); }
});

// ── Sync API ────────────────────────────────────────────────

// POST /api/sync/register
app.post("/api/sync/register", (req, res) => {
  const { username, mode } = req.body;
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username required" });
  }

  // Validate username: 2-30 chars, no control characters
  const trimmed = username.trim();
  if (trimmed.length < 2 || trimmed.length > 30) {
    return res.status(400).json({ error: "用户名需 2-30 个字符" });
  }
  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    return res.status(400).json({ error: "用户名包含非法字符" });
  }

  const exists = db.userExists(trimmed);

  if (mode === "create" && exists) {
    return res.status(409).json({ error: "用户名已存在，请返回并点击'加入已有'" });
  }
  if (mode === "join" && !exists) {
    return res.status(404).json({ error: "用户名不存在，请先创建" });
  }

  if (!exists) db.createUser(trimmed);

  const clientId = crypto.randomBytes(12).toString("hex");
  const token = createSession(trimmed);
  register(trimmed, clientId, token);
  const data = db.gatherSyncData(trimmed);

  res.json({ clientId, token, activeCount: 1, data, isNew: !exists });
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
    res.status(500).json({ error: "同步失败" });
  }
});

// POST /api/sync/disconnect
app.post("/api/sync/disconnect", (req, res) => {
  const { username, clientId, token } = req.body;
  if (username && clientId) disconnect(username, clientId);
  if (token) removeSession(token);
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

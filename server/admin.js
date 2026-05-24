import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as db from "./database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, "data", ".admin_token");

function getOrCreateToken() {
  if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, "utf-8").trim();
  const token = crypto.randomBytes(12).toString("hex");
  fs.writeFileSync(TOKEN_FILE, token, "utf-8");
  return token;
}

const ADMIN_TOKEN = getOrCreateToken();
console.log("[admin] Token:", ADMIN_TOKEN);

function auth(req, res) {
  const t = req.query.token || req.body?.token;
  if (t !== ADMIN_TOKEN) { res.status(403).json({ error: "无效 token" }); return false; }
  return true;
}

export function mountAdminRoutes(app) {
  // ── Stats ──

  app.get("/api/admin/stats", (req, res) => {
    if (!auth(req, res)) return;
    const dbPath = path.join(__dirname, "data", "novels.db");
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const userCount = db.db.prepare("SELECT COUNT(*) as c FROM users").get().c;
    const novelCount = db.db.prepare("SELECT COUNT(*) as c FROM novels").get().c;
    const summaryCount = db.db.prepare("SELECT COUNT(*) as c FROM summaries").get().c;
    res.json({ userCount, novelCount, summaryCount, dbSize, dbSizeMB: (dbSize / 1048576).toFixed(1) });
  });

  // ── Users ──

  app.get("/api/admin/users", (req, res) => {
    if (!auth(req, res)) return;
    const rows = db.db.prepare(`
      SELECT u.username, u.created_at,
        (SELECT COUNT(*) FROM user_novels un WHERE un.username = u.username) as novel_count,
        (SELECT COUNT(*) FROM summaries s WHERE s.username = u.username) as summary_count,
        (SELECT COUNT(*) FROM notes n WHERE n.username = u.username) as note_count
      FROM users u ORDER BY u.created_at DESC
    `).all();
    res.json(rows);
  });

  app.delete("/api/admin/users/:name", (req, res) => {
    if (!auth(req, res)) return;
    const { name } = req.params;
    db.db.prepare("DELETE FROM summaries WHERE username = ?").run(name);
    db.db.prepare("DELETE FROM notes WHERE username = ?").run(name);
    db.db.prepare("DELETE FROM reading_progress WHERE username = ?").run(name);
    db.db.prepare("DELETE FROM user_settings WHERE username = ?").run(name);
    db.db.prepare("DELETE FROM user_novels WHERE username = ?").run(name);
    db.db.prepare("DELETE FROM users WHERE username = ?").run(name);
    res.json({ ok: true });
  });

  // ── Novels ──

  app.get("/api/admin/novels", (req, res) => {
    if (!auth(req, res)) return;
    const rows = db.db.prepare(`
      SELECT n.*,
        (SELECT COUNT(*) FROM user_novels un WHERE un.novel_id = n.id) as join_count
      FROM novels n ORDER BY n.updated_at DESC
    `).all();
    res.json(rows.map(n => ({
      id: n.id, title: n.title, author: n.author,
      fileName: n.file_name, fileFormat: n.file_format,
      totalChars: n.total_chars, chapterCount: n.chapter_count,
      createdAt: n.created_at, updatedAt: n.updated_at,
      joinCount: n.join_count,
    })));
  });

  app.delete("/api/admin/novels/:id", (req, res) => {
    if (!auth(req, res)) return;
    db.deleteNovel(req.params.id);
    res.json({ ok: true });
  });

  // ── Token ──

  app.get("/api/admin/token", (_req, res) => {
    res.json({ token: ADMIN_TOKEN });
  });
}

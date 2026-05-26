import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "data", "novels.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("defensive = ON");
export { db };

// ── Schema ──────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS novels (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    file_name TEXT,
    file_format TEXT DEFAULT 'txt',
    total_chars INTEGER DEFAULT 0,
    chapter_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    index_num INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    start_offset INTEGER DEFAULT 0,
    end_offset INTEGER DEFAULT 0,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_chapters_novel ON chapters(novel_id, index_num);

  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    created_at INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_novels (
    username TEXT NOT NULL,
    novel_id TEXT NOT NULL,
    added_at INTEGER DEFAULT 0,
    PRIMARY KEY (username, novel_id),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reading_progress (
    username TEXT NOT NULL,
    novel_id TEXT NOT NULL,
    chapter_id TEXT,
    chapter_index INTEGER DEFAULT 0,
    last_opened INTEGER DEFAULT 0,
    PRIMARY KEY (username, novel_id)
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    chapter_id TEXT,
    chapter_title TEXT,
    username TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tokens_used INTEGER DEFAULT 0,
    created_at INTEGER,
    type TEXT DEFAULT 'chapter'
  );
  CREATE INDEX IF NOT EXISTS idx_summaries_novel_user ON summaries(novel_id, username, type);

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    chapter_id TEXT,
    chapter_title TEXT,
    username TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    source TEXT DEFAULT 'user',
    source_label TEXT,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_notes_novel_user ON notes(novel_id, username, chapter_id);

  CREATE TABLE IF NOT EXISTS user_settings (
    username TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (username, key)
  );

  CREATE TABLE IF NOT EXISTS rag_indices (
    novel_id TEXT NOT NULL,
    engine TEXT NOT NULL DEFAULT 'bge-small-zh',
    status TEXT NOT NULL DEFAULT 'none',
    chunks_json TEXT NOT NULL DEFAULT '[]',
    vectors_blob BLOB,
    dim INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    build_time INTEGER DEFAULT 0,
    error_msg TEXT,
    PRIMARY KEY (novel_id, engine),
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  );
`);

// ── Prepared statements ─────────────────────────────────────

// ── Novels (shared library) ──

export function insertNovel(novel) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO novels (id, title, author, file_name, file_format, total_chars, chapter_count, created_at, updated_at)
    VALUES (@id, @title, @author, @fileName, @fileFormat, @totalChars, @chapterCount, @createdAt, @updatedAt)
  `);
  return stmt.run(novel);
}

export function insertChapters(chapters) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO chapters (id, novel_id, index_num, title, content, start_offset, end_offset)
    VALUES (@id, @novelId, @index, @title, @content, @startOffset, @endOffset)
  `);
  const tx = db.transaction((chaps) => {
    for (const c of chaps) stmt.run(c);
  });
  tx(chapters);
}

export function listNovels() {
  return db.prepare(`
    SELECT id, title, author, file_name AS \"fileName\", file_format AS \"fileFormat\",
           total_chars AS \"totalChars\", chapter_count AS \"chapterCount\",
           created_at AS \"createdAt\", updated_at AS \"updatedAt\"
    FROM novels ORDER BY updated_at DESC
  `).all();
}

export function getNovel(novelId) {
  return db.prepare(`
    SELECT id, title, author, file_name AS \"fileName\", file_format AS \"fileFormat\",
           total_chars AS \"totalChars\", chapter_count AS \"chapterCount\",
           created_at AS \"createdAt\", updated_at AS \"updatedAt\"
    FROM novels WHERE id = ?
  `).get(novelId);
}

export function getChapterList(novelId) {
  return db.prepare(`
    SELECT id, novel_id AS \"novelId\", index_num AS \"index\", title,
           start_offset AS \"startOffset\", end_offset AS \"endOffset\"
    FROM chapters WHERE novel_id = ? ORDER BY index_num
  `).all(novelId);
}

export function getAllChapters(novelId) {
  return db.prepare(`
    SELECT id, novel_id AS \"novelId\", index_num AS \"index\", title, content,
           start_offset AS \"startOffset\", end_offset AS \"endOffset\"
    FROM chapters WHERE novel_id = ? ORDER BY index_num
  `).all(novelId);
}

export function getChapter(novelId, indexNum) {
  return db.prepare(`
    SELECT id, novel_id AS \"novelId\", index_num AS \"index\", title, content,
           start_offset AS \"startOffset\", end_offset AS \"endOffset\"
    FROM chapters WHERE novel_id = ? AND index_num = ?
  `).get(novelId, indexNum);
}

export function deleteNovel(novelId) {
  db.transaction(() => {
    db.prepare("DELETE FROM user_novels WHERE novel_id = ?").run(novelId);
    db.prepare("DELETE FROM summaries WHERE novel_id = ?").run(novelId);
    db.prepare("DELETE FROM notes WHERE novel_id = ?").run(novelId);
    db.prepare("DELETE FROM reading_progress WHERE novel_id = ?").run(novelId);
    db.prepare("DELETE FROM chapters WHERE novel_id = ?").run(novelId);
    db.prepare("DELETE FROM novels WHERE id = ?").run(novelId);
  })();
}

// ── User-novel association ──

export function joinNovel(username, novelId) {
  db.prepare("INSERT OR IGNORE INTO user_novels (username, novel_id, added_at) VALUES (?, ?, ?)").run(username, novelId, Date.now());
}

export function leaveNovel(username, novelId) {
  db.transaction(() => {
    db.prepare("DELETE FROM user_novels WHERE username = ? AND novel_id = ?").run(username, novelId);
    db.prepare("DELETE FROM summaries WHERE username = ? AND novel_id = ?").run(username, novelId);
    db.prepare("DELETE FROM notes WHERE username = ? AND novel_id = ?").run(username, novelId);
    db.prepare("DELETE FROM reading_progress WHERE username = ? AND novel_id = ?").run(username, novelId);
  })();
}

export function getUserNovelIds(username) {
  return db.prepare("SELECT novel_id FROM user_novels WHERE username = ?").all(username).map(r => r.novel_id);
}

export function listNovelsWithUserStatus(username) {
  const novels = db.prepare(`
    SELECT n.*, un.username IS NOT NULL as joined
    FROM novels n
    LEFT JOIN user_novels un ON n.id = un.novel_id AND un.username = ?
    ORDER BY n.updated_at DESC
  `).all(username);

  return novels.map(n => ({
    id: n.id, title: n.title, author: n.author,
    fileName: n.file_name, fileFormat: n.file_format,
    totalChars: n.total_chars, chapterCount: n.chapter_count,
    createdAt: n.created_at, updatedAt: n.updated_at,
    joined: !!n.joined,
  }));
}

// ── Users ──

export function userExists(username) {
  return !!db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
}

export function createUser(username) {
  db.prepare("INSERT OR IGNORE INTO users (username, created_at) VALUES (?, ?)").run(username, Date.now());
}

// ── Reading progress ──

export function getProgress(username) {
  const rows = db.prepare(`
    SELECT novel_id AS \"novelId\", chapter_id AS \"chapterId\", chapter_index AS \"chapterIndex\", last_opened AS \"lastOpened\"
    FROM reading_progress WHERE username = ?
  `).all(username);
  const readingPositions = {};
  const lastOpened = {};
  for (const r of rows) {
    readingPositions[r.novelId] = { chapterId: r.chapterId, chapterIndex: r.chapterIndex };
    lastOpened[r.novelId] = r.lastOpened;
  }
  return { readingPositions, lastOpened };
}

export function saveProgress(username, novelId, chapterId, chapterIndex) {
  db.prepare(`
    INSERT OR REPLACE INTO reading_progress (username, novel_id, chapter_id, chapter_index, last_opened)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, novelId, chapterId, chapterIndex, Date.now());
}

// ── Summaries ──

export function getSummaries(username, novelId) {
  return db.prepare("SELECT * FROM summaries WHERE username = ? AND novel_id = ? ORDER BY created_at").all(username, novelId);
}

export function upsertSummary(s) {
  db.prepare(`
    INSERT OR REPLACE INTO summaries (id, novel_id, chapter_id, chapter_title, username, content, tokens_used, created_at, type)
    VALUES (@id, @novelId, @chapterId, @chapterTitle, @username, @content, @tokensUsed, @createdAt, @type)
  `).run(s);
}

// ── Notes ──

export function getNotes(username, novelId) {
  return db.prepare("SELECT * FROM notes WHERE username = ? AND novel_id = ? ORDER BY created_at DESC").all(username, novelId);
}

export function upsertNote(n) {
  db.prepare(`
    INSERT OR REPLACE INTO notes (id, novel_id, chapter_id, chapter_title, username, content, source, source_label, created_at)
    VALUES (@id, @novelId, @chapterId, @chapterTitle, @username, @content, @source, @sourceLabel, @createdAt)
  `).run(n);
}

export function deleteNote(noteId, username) {
  if (username) {
    db.prepare("DELETE FROM notes WHERE id = ? AND username = ?").run(noteId, username);
  } else {
    db.prepare("DELETE FROM notes WHERE id = ?").run(noteId);
  }
}

export function deleteNotesByChapter(username, novelId, chapterId) {
  db.prepare("DELETE FROM notes WHERE username = ? AND novel_id = ? AND chapter_id = ?").run(username, novelId, chapterId);
}

// ── Settings ──

export function getSetting(username, key) {
  try {
    const r = db.prepare("SELECT value FROM user_settings WHERE username = ? AND key = ?").get(username, key);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}

export function setSetting(username, key, value) {
  try {
    const v = JSON.stringify(value);
    db.prepare("INSERT OR REPLACE INTO user_settings (username, key, value) VALUES (?, ?, ?)").run(username, key, v);
  } catch (e) {
    // Ignore JSON.stringify errors for corrupt data, but log DB errors
    if (e.code && !e.code.startsWith("SQLITE_")) {
      console.error("[db] setSetting error:", e);
    }
  }
}

// ── Sync: gather all user data for push (return camelCase for client) ──

export function gatherSyncData(username) {
  const summaries = db.prepare(`
    SELECT id, novel_id AS "novelId", chapter_id AS "chapterId", chapter_title AS "chapterTitle",
           username, content, tokens_used AS "tokensUsed", created_at AS "createdAt", type
    FROM summaries WHERE username = ?
  `).all(username);

  const notes = db.prepare(`
    SELECT id, novel_id AS "novelId", chapter_id AS "chapterId", chapter_title AS "chapterTitle",
           username, content, source, source_label AS "sourceLabel", created_at AS "createdAt"
    FROM notes WHERE username = ?
  `).all(username);

  const progress = getProgress(username);

  // Never return API key settings to clients
  const SENSITIVE_KEYS = new Set(["api-providers", "api-active-provider"]);
  const settingRows = db.prepare("SELECT key, value FROM user_settings WHERE username = ?").all(username);
  const settings = {};
  for (const s of settingRows) {
    if (SENSITIVE_KEYS.has(s.key)) continue;
    try { settings[s.key] = JSON.parse(s.value); } catch { settings[s.key] = s.value; }
  }

  // Novel IDs the user has joined (novel deleted from server → ID disappears via CASCADE)
  const joinedNovelIds = db.prepare("SELECT novel_id FROM user_novels WHERE username = ?").all(username).map(r => r.novel_id);

  return { summaries, notes, settings, progress, joinedNovelIds };
}

// ── Sync: apply merged data from server ──

export function applySyncData(username, summaries, notes, settings, progress) {
  db.transaction(() => {
    if (summaries?.length) {
      for (const s of summaries) { s.username = username; upsertSummary(s); }
    }
    if (notes?.length) {
      for (const n of notes) { n.username = username; upsertNote(n); }
    }
    if (settings) {
      for (const [key, value] of Object.entries(settings)) {
        setSetting(username, key, value);
      }
    }
    if (progress?.readingPositions) {
      for (const [novelId, pos] of Object.entries(progress.readingPositions)) {
        saveProgress(username, novelId, pos.chapterId, pos.chapterIndex);
      }
    }
  })();
}

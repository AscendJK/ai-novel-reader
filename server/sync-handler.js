import * as db from "./database.js";
import crypto from "node:crypto";

// Active connections: one clientId per username
const connections = new Map(); // username → clientId
const connectionLastSeen = new Map(); // username → timestamp

// Session tokens: token → { username, createdAt }
const sessions = new Map();

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const CONNECTION_MAX_IDLE = 5 * 60 * 1000; // 5 minutes without heartbeat

// Periodic cleanup of stale sessions and connections
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (now - s.createdAt > SESSION_MAX_AGE) sessions.delete(token);
  }
  for (const [username, lastSeen] of connectionLastSeen) {
    if (now - lastSeen > CONNECTION_MAX_IDLE) {
      connections.delete(username);
      connectionLastSeen.delete(username);
    }
  }
}, 60_000);

export function createSession(username) {
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { username, createdAt: Date.now() });
  return token;
}

export function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  return session ? session.username : null;
}

export function removeSession(token) {
  sessions.delete(token);
}

export function register(username, clientId, token) {
  // Remove any existing session for this username (single-session enforcement)
  let replaced = false;
  for (const [t, s] of sessions) {
    if (s.username === username && t !== token) {
      sessions.delete(t);
      replaced = true;
    }
  }
  // Also replace existing connection
  if (connections.has(username) && connections.get(username) !== clientId) {
    replaced = true;
  }
  connections.set(username, clientId);
  connectionLastSeen.set(username, Date.now());
  if (replaced) console.log(`[sync] session replaced for user: ${username}`);
  return 1;
}

export function disconnect(username, clientId) {
  const c = connections.get(username);
  if (c === clientId) connections.delete(username);
}

export function heartbeat(username, clientId) {
  const c = connections.get(username);
  if (!c) return 0;
  connectionLastSeen.set(username, Date.now());
  return c === clientId ? 1 : 0;
}

export function isActive(username, clientId) {
  const c = connections.get(username);
  if (!c) return false; // don't auto-register
  return c === clientId;
}

// Settings that contain sensitive data (API keys) — never sync these
const SENSITIVE_SETTINGS = new Set(["api-providers", "api-active-provider"]);

// Merge changes into SQLite (last write wins by updatedAt/createdAt)
export function mergeAndSave(username, changes) {
  db.db.transaction(() => {
    if (changes.summaries?.length) {
      for (const s of changes.summaries) {
        if (!s.id || !s.novelId) continue;
        db.upsertSummary({ ...s, username });
      }
    }
    if (changes.notes?.length) {
      for (const n of changes.notes) {
        if (!n.id || !n.novelId) continue;
        db.upsertNote({ ...n, username });
      }
    }
    if (changes.settings && Object.keys(changes.settings).length > 0) {
      for (const [key, value] of Object.entries(changes.settings)) {
        if (value !== undefined && value !== null && !SENSITIVE_SETTINGS.has(key)) {
          db.setSetting(username, key, value);
        }
      }
    }
    if (changes.progress?.readingPositions && Object.keys(changes.progress.readingPositions).length > 0) {
      for (const [novelId, pos] of Object.entries(changes.progress.readingPositions)) {
        if (pos && pos.chapterId) {
          db.saveProgress(username, novelId, pos.chapterId, pos.chapterIndex ?? 0);
        }
      }
    }
  })();

  return db.gatherSyncData(username);
}

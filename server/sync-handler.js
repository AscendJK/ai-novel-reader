import * as db from "./database.js";

// Active connections: one clientId per username
const connections = new Map(); // username → clientId

export function register(username, clientId) {
  connections.set(username, clientId);
  return 1;
}

export function disconnect(username, clientId) {
  const c = connections.get(username);
  if (c === clientId) connections.delete(username);
}

export function heartbeat(username, clientId) {
  const c = connections.get(username);
  if (!c) { connections.set(username, clientId); return 1; }
  return c === clientId ? 1 : 0;
}

export function isActive(username, clientId) {
  const c = connections.get(username);
  if (!c) { connections.set(username, clientId); return true; }
  return c === clientId;
}

// Merge changes into SQLite (last write wins by updatedAt/createdAt)
export function mergeAndSave(username, changes) {
  console.log("[merge] summaries:", changes.summaries?.length, "notes:", changes.notes?.length,
    "settings keys:", Object.keys(changes.settings || {}).length,
    "progress novels:", Object.keys(changes.progress?.readingPositions || {}).length);
  if (changes.summaries?.length) {
    console.log("[merge] first summary keys:", Object.keys(changes.summaries[0]));
    for (const s of changes.summaries) {
      if (!s.id || !s.novelId) continue; // skip malformed records
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
      if (value !== undefined && value !== null) {
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

  return db.gatherSyncData(username);
}

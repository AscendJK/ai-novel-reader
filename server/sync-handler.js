import { readUser, writeUser } from "./user-store.js";

// Active connections: username → Set<clientId>
const connections = new Map();

export function register(username, clientId) {
  if (!connections.has(username)) connections.set(username, new Set());
  connections.get(username).add(clientId);
  return connections.get(username).size;
}

export function disconnect(username, clientId) {
  const s = connections.get(username);
  if (s) {
    s.delete(clientId);
    if (s.size === 0) connections.delete(username);
  }
}

export function heartbeat(username, clientId) {
  // just refresh presence; return active count
  register(username, clientId);
  return connections.get(username)?.size || 0;
}

export function getActiveCount(username) {
  return connections.get(username)?.size || 0;
}

// Merge client changes into server data, "last write wins" by updatedAt
export function mergeAndSave(username, changes) {
  const data = readUser(username);
  if (!data) return null;

  for (const table of ["novels", "chapters", "summaries", "notes"]) {
    if (!changes[table]) continue;
    for (const incoming of changes[table]) {
      if (!incoming.id) continue;
      const existing = data[table].find((r) => r.id === incoming.id);
      if (!existing) {
        data[table].push(incoming);
      } else if ((incoming.updatedAt || incoming.createdAt || 0) >= (existing.updatedAt || existing.createdAt || 0)) {
        Object.assign(existing, incoming);
      }
    }
  }

  // Settings: shallow merge by key
  if (changes.settings) {
    data.settings = { ...data.settings, ...changes.settings };
  }

  // Progress: merge by novelId
  if (changes.progress) {
    const p = changes.progress;
    if (p.readingPositions) {
      data.progress.readingPositions = { ...data.progress.readingPositions, ...p.readingPositions };
    }
    if (p.lastOpened) {
      data.progress.lastOpened = { ...data.progress.lastOpened, ...p.lastOpened };
    }
  }

  data.lastSyncAt = Date.now();
  writeUser(username, data);
  return data;
}

// Clean up stale connections (no heartbeat for 60s)
export function cleanupStale() {
  // Placeholder: connections auto-cleaned by disconnect calls
  // In production, add a timer to remove entries that haven't heartbeat'd
}

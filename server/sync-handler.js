import * as db from "./database.js";
import crypto from "node:crypto";

// Active connections: one clientId per username (primary device)
const connections = new Map(); // username → clientId
const connectionLastSeen = new Map(); // username → timestamp
// Known devices: all clientIds that have registered for a username
const knownDevices = new Map(); // username → Set<clientId>
const knownDevicesLastSeen = new Map(); // username → timestamp (last time any device was active)

// Session tokens: token → { username, createdAt }
const sessions = new Map();

const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const CONNECTION_MAX_IDLE = 5 * 60 * 1000; // 5 minutes without heartbeat
const KNOWN_DEVICES_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Periodic cleanup of stale sessions, connections, and known devices
setInterval(() => {
  const now = Date.now();
  // 清理过期的 session
  for (const [token, s] of sessions) {
    if (now - s.createdAt > SESSION_MAX_AGE) sessions.delete(token);
  }
  // 清理空闲的连接
  for (const [username, lastSeen] of connectionLastSeen) {
    if (now - lastSeen > CONNECTION_MAX_IDLE) {
      connections.delete(username);
      connectionLastSeen.delete(username);
    }
  }
  // 清理长时间不活跃的已知设备
  for (const [username, lastSeen] of knownDevicesLastSeen) {
    if (now - lastSeen > KNOWN_DEVICES_MAX_AGE) {
      knownDevices.delete(username);
      knownDevicesLastSeen.delete(username);
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
  // Track known devices
  if (!knownDevices.has(username)) knownDevices.set(username, new Set());
  const devices = knownDevices.get(username);
  const isKnownDevice = devices.has(clientId);

  if (isKnownDevice) {
    // Known device reconnecting — refresh token, don't kick active device
    devices.add(clientId);
    connections.set(username, clientId);
    connectionLastSeen.set(username, Date.now());
    console.log(`[sync] device reconnected: ${username} (${clientId.slice(0, 8)})`);
  } else {
    // New device — kick existing session (single-session enforcement)
    devices.add(clientId);
    for (const [t, s] of sessions) {
      if (s.username === username && t !== token) {
        sessions.delete(t);
      }
    }
    connections.set(username, clientId);
    connectionLastSeen.set(username, Date.now());
    console.log(`[sync] new device, session replaced: ${username} (${clientId.slice(0, 8)})`);
  }

  let activeCount = 0;
  for (const [, s] of sessions) {
    if (s.username === username) activeCount++;
  }
  return activeCount || 1;
}

export function disconnect(username, clientId) {
  const c = connections.get(username);
  if (c === clientId) connections.delete(username);
}

export function heartbeat(username, clientId, token) {
  const devices = knownDevices.get(username);
  if (!devices || !devices.has(clientId)) return 0;

  // Check if the session is still valid (not kicked by another device)
  if (token && !sessions.has(token)) {
    // Session was deleted (kicked by another device)
    console.log(`[sync] heartbeat rejected: session expired for ${username} (${clientId.slice(0, 8)})`);
    return -1; // Indicate kicked
  }

  const now = Date.now();
  connectionLastSeen.set(username, now);
  knownDevicesLastSeen.set(username, now); // 更新已知设备的最后活跃时间
  return 1;
}

/** Get online status for all users based on heartbeat timestamps */
export function getUsersOnlineStatus() {
  const now = Date.now();
  const result = {};
  for (const [username, lastSeen] of connectionLastSeen) {
    result[username] = {
      online: (now - lastSeen) < CONNECTION_MAX_IDLE,
      lastSeen,
    };
  }
  return result;
}

export function isActive(username, clientId) {
  const devices = knownDevices.get(username);
  if (!devices) return false;
  return devices.has(clientId);
}

/**
 * 检查用户是否有活跃的在线设备
 * @param {string} username
 * @returns {{ online: boolean, deviceCount: number, lastSeen: number | null }}
 */
export function checkUserOnline(username) {
  const lastSeen = connectionLastSeen.get(username);
  const devices = knownDevices.get(username);
  const deviceCount = devices ? devices.size : 0;

  // 检查是否有活跃连接（5分钟内有心跳）
  const online = lastSeen ? (Date.now() - lastSeen) < CONNECTION_MAX_IDLE : false;

  return {
    online,
    deviceCount,
    lastSeen: lastSeen || null,
  };
}

// Settings that contain sensitive data (API keys) — never sync these (prefix match for user-specific keys like "api-providers:user1")
const SENSITIVE_PREFIXES = ["api-providers", "api-active-provider"];
function isSensitiveKey(key) {
  return SENSITIVE_PREFIXES.some((p) => key === p || key.startsWith(p + ":"));
}

// Merge changes into SQLite (last write wins by updatedAt)
export function mergeAndSave(username, changes, lastSyncTime = 0) {
  db.db.transaction(() => {
    if (changes.summaries?.length) {
      for (const s of changes.summaries) {
        if (!s.id || !s.novelId) continue;
        if (!db.getNovel(s.novelId)) continue; // skip orphaned records
        db.upsertSummary({ ...s, username });
      }
    }
    if (changes.notes?.length) {
      for (const n of changes.notes) {
        if (!n.id || !n.novelId) continue;
        if (!db.getNovel(n.novelId)) continue; // skip orphaned records
        db.upsertNote({ ...n, username });
      }
    }
    if (changes.settings && Object.keys(changes.settings).length > 0) {
      for (const [key, value] of Object.entries(changes.settings)) {
        if (value !== undefined && value !== null && !isSensitiveKey(key)) {
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

  // Capture AFTER transaction — upserts use Date.now() so updated_at <= lastSyncAt
  const lastSyncAt = Date.now();
  const data = db.gatherSyncData(username, lastSyncTime);
  data.lastSyncAt = lastSyncAt;
  return data;
}

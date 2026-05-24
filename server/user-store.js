import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function userFile(username) {
  return path.join(DATA_DIR, `${sanitize(username)}.json`);
}

function sanitize(username) {
  return username.replace(/[^a-zA-Z0-9一-鿿_-]/g, "_").slice(0, 64);
}

export function readUser(username) {
  const fp = userFile(username);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return null;
  }
}

export function writeUser(username, data) {
  const fp = userFile(username);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

export function userExists(username) {
  return fs.existsSync(userFile(username));
}

export function createUser(username) {
  const data = {
    username,
    createdAt: Date.now(),
    lastSyncAt: 0,
    novels: [],
    chapters: [],
    summaries: [],
    notes: [],
    settings: {},
    progress: { readingPositions: {}, lastOpened: {} },
  };
  writeUser(username, data);
  return data;
}

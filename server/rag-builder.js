import * as db from "./database.js";

const BATCH_SIZE = 16;
const CHUNK_SIZE = 500;
const OVERLAP = 100;

// Track build status in memory for progress reporting
const buildProgress = new Map(); // key: "novelId-engine" → { current, total, status }

// ── Public API ──

/** Start or resume building a RAG index for a novel */
export async function buildIndex(novelId, engine = "bge-small-zh") {
  const key = `${novelId}-${engine}`;

  // Check DB status
  const existing = db.db.prepare("SELECT status, chunk_count, error_msg FROM rag_indices WHERE novel_id = ? AND engine = ?").get(novelId, engine);
  console.log(`[rag] buildIndex called: ${key}, existing:`, existing?.status);
  if (existing && existing.status === "ready") return { status: "ready", chunkCount: existing.chunk_count };

  // Don't allow duplicate builds
  if (buildProgress.has(key)) return buildProgress.get(key);

  const progress = { status: "building", current: 0, total: 0 };
  buildProgress.set(key, progress);

  // Start async build
  console.log(`[rag] starting async build for ${key}`);
  _doBuild(novelId, engine, key).catch(e => {
    console.error(`[rag] build failed for ${key}:`, e.message || e);
    try {
      db.db.prepare("UPDATE rag_indices SET status = 'error', error_msg = ? WHERE novel_id = ? AND engine = ?").run(String(e.message || e), novelId, engine);
    } catch (dbErr) { console.error("[rag] DB update error:", dbErr); }
    buildProgress.set(key, { ...buildProgress.get(key), status: "error", error: String(e.message || e) });
  });

  return { status: "building" };
}

/** Get build progress */
export function getProgress(novelId, engine = "bge-small-zh") {
  const key = `${novelId}-${engine}`;
  const mem = buildProgress.get(key);
  if (mem) return mem;
  const dbRow = db.db.prepare("SELECT status, chunk_count, build_time, error_msg FROM rag_indices WHERE novel_id = ? AND engine = ?").get(novelId, engine);
  if (dbRow) return { status: dbRow.status, chunkCount: dbRow.chunk_count, buildTime: dbRow.build_time, error: dbRow.error_msg };
  return { status: "none" };
}

export function getIndexData(novelId, engine = "bge-small-zh") {
  return db.db.prepare(
    "SELECT chunks_json, vectors_blob, dim, chunk_count FROM rag_indices WHERE novel_id = ? AND engine = ? AND status = 'ready'"
  ).get(novelId, engine) || null;
}

// ── Internal build logic ──

async function _doBuild(novelId, engine, key) {
  console.log(`[rag] _doBuild start: ${key}`);
  const chapters = db.db.prepare("SELECT title, content FROM chapters WHERE novel_id = ? ORDER BY index_num").all(novelId);
  console.log(`[rag] chapters found: ${chapters.length}`);
  if (!chapters.length) throw new Error("No chapters found");
  const chunks = [];
  for (const ch of chapters) {
    let start = 0;
    while (start < ch.content.length) {
      const end = Math.min(start + CHUNK_SIZE, ch.content.length);
      const text = ch.content.slice(start, end).trim();
      if (text.replace(/\s/g, "").length >= 10) {
        chunks.push(`[${ch.title}] ${text}`);
      }
      start += CHUNK_SIZE - OVERLAP;
    }
  }

  // Init/update DB record
  db.db.prepare("INSERT OR REPLACE INTO rag_indices (novel_id, engine, status, chunks_json, chunk_count) VALUES (?, ?, 'building', ?, ?)").run(novelId, engine, JSON.stringify(chunks), chunks.length);

  buildProgress.set(key, { status: "building", current: 0, total: chunks.length });

  // Load Transformers.js in Node.js
  const { pipeline, env } = await import("@xenova/transformers");
  env.allowRemoteModels = false;
  env.localModelPath = "./public/models/builtin/";

  const pipe = await pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", { local_files_only: true });

  const vectors = [];
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
  const t0 = Date.now();

  for (let b = 0; b < totalBatches; b++) {
    const batch = chunks.slice(b * BATCH_SIZE, Math.min((b + 1) * BATCH_SIZE, chunks.length));
    const result = await pipe(batch, { pooling: "mean", normalize: true });
    const arr = await result.tolist();
    for (const row of arr) vectors.push(new Float32Array(row));
    buildProgress.set(key, { status: "building", current: Math.min((b + 1) * BATCH_SIZE, chunks.length), total: chunks.length });
  }

  // Serialize vectors as binary blob
  const dim = vectors[0]?.length || 0;
  const totalFloats = vectors.length * dim;
  const buf = new Float32Array(totalFloats);
  for (let i = 0; i < vectors.length; i++) {
    buf.set(vectors[i], i * dim);
  }

  db.db.prepare("UPDATE rag_indices SET status = 'ready', vectors_blob = ?, dim = ?, chunk_count = ?, build_time = ? WHERE novel_id = ? AND engine = ?").run(Buffer.from(buf.buffer), dim, chunks.length, Date.now() - t0, novelId, engine);

  buildProgress.set(key, { status: "ready", current: chunks.length, total: chunks.length });
}

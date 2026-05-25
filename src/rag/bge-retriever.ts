import type { Chunk } from "./retriever";
import { ragLog } from "@/components/common/DebugPanel";
import { db } from "@/db/database";

export interface BGEProgress { phase: "loading" | "encoding" | "done"; current?: number; total?: number; }
export interface BGERetrieverData { vectors: number[][]; chunks: Chunk[]; dim: number; }

const BATCH_SIZE = 16;       // encode batch size
const YIELD_EVERY = 4;       // yield main thread every N batches
const TIMEOUT_MS = 45000;    // per-batch timeout

let worker: Worker | null = null;
let workerBusy = false;
const pendingResolve = new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let reqId = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./bge-worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

function initWorker(): Promise<void> {
  const w = getWorker();
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    pendingResolve.set(id, {
      resolve: () => resolve(),
      reject: (e: Error) => reject(e),
      timer: setTimeout(() => reject(new Error("worker init timeout")), TIMEOUT_MS),
    });
    w.onmessage = (e) => {
      if (e.data.type === "ready") {
        const p = pendingResolve.get(e.data.id);
        if (p) { clearTimeout(p.timer); p.resolve(); pendingResolve.delete(e.data.id); }
      } else if (e.data.type === "error") {
        const p = pendingResolve.get(e.data.id);
        if (p) { clearTimeout(p.timer); p.reject(new Error(e.data.error)); pendingResolve.delete(e.data.id); }
      } else if (e.data.type === "result") {
        const p = pendingResolve.get(e.data.id);
        if (p) { clearTimeout(p.timer); p.resolve(e.data.vectors); pendingResolve.delete(e.data.id); }
      }
    };
  });
}

function encodeBatch(texts: string[]): Promise<number[][]> {
  const w = getWorker();
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    pendingResolve.set(id, {
      resolve: (v: number[][]) => resolve(v),
      reject: (e: Error) => reject(e),
      timer: setTimeout(() => reject(new Error("encode timeout")), TIMEOUT_MS),
    });
    w.postMessage({ type: "encode", id, data: texts });
  });
}

export class BGERetriever {
  private vectors: Float32Array[] = [];
  private chunks: Chunk[] = [];
  private dim = 0;

  get chunkCount() { return this.chunks.length; }
  get vectorDim() { return this.dim; }

  toData(): BGERetrieverData {
    return { vectors: this.vectors.map((v) => Array.from(v)), chunks: this.chunks, dim: this.dim };
  }

  static fromData(data: BGERetrieverData): BGERetriever {
    const r = new BGERetriever();
    r.vectors = data.vectors.map((v) => new Float32Array(v));
    r.chunks = data.chunks;
    r.dim = data.dim;
    return r;
  }

  async init(
    novelId: string,
    allChunks: Chunk[],
    onProgress?: (p: BGEProgress) => void
  ): Promise<void> {
    // Filter empty/short chunks
    const chunks = allChunks.filter((c) => c.content.replace(/\s/g, "").length >= 10);
    ragLog(`过滤后片段: ${chunks.length}/${allChunks.length}`);
    this.chunks = chunks;

    onProgress?.({ phase: "loading" });

    // Check checkpoint
    let startBatch = 0;
    let vectors: Float32Array[] = [];
    try {
      const cp = await db.ragCache.get(novelId + "-checkpoint");
      if (cp && cp.dim > 0) {
        startBatch = cp.vectors.length;
        vectors = cp.vectors.map((v: number[]) => new Float32Array(v));
        ragLog(`断点续传: 从第 ${startBatch} 批继续 (已有 ${vectors.length} 向量)`);
      }
    } catch { /* no checkpoint */ }

    // Init worker
    await initWorker();
    ragLog("BGE pipeline ready (Web Worker)");

    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
    if (startBatch >= totalBatches) {
      this.vectors = vectors;
      this.dim = vectors[0]?.length || 0;
      onProgress?.({ phase: "done" });
      return;
    }

    for (let b = startBatch; b < totalBatches; b++) {
      const batch = chunks.slice(b * BATCH_SIZE, Math.min((b + 1) * BATCH_SIZE, chunks.length));
      onProgress?.({ phase: "encoding", current: b * BATCH_SIZE, total: chunks.length });

      try {
        const result = await encodeBatch(batch.map((c) => c.content));
        for (const row of result) vectors.push(new Float32Array(row));
        this.dim = vectors[0]?.length || 0;
      } catch (e) {
        ragLog(`批次 ${b} 失败: ${e}, 重试中...`);
        try {
          const result = await encodeBatch(batch.map((c) => c.content));
          for (const row of result) vectors.push(new Float32Array(row));
        } catch (e2) {
          ragLog(`批次 ${b} 重试失败, 跳过: ${e2}`);
          // Fill with zero vectors as placeholder
          for (const _ of batch) vectors.push(new Float32Array(this.dim || 512));
        }
      }

      // Checkpoint every 4 batches
      if ((b + 1) % YIELD_EVERY === 0 || b === totalBatches - 1) {
        try {
          await db.ragCache.put({
            novelId: novelId + "-checkpoint",
            engine: "bge-small-zh",
            vectors: vectors.map((v) => Array.from(v)),
            chunks: chunks,
            dim: this.dim || 512,
            createdAt: Date.now(),
          });
        } catch { /* ignore */ }
        // Yield to UI thread
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    this.vectors = vectors;
    // Clean checkpoint after full completion
    try { await db.ragCache.delete(novelId + "-checkpoint"); } catch { /* ok */ }
    onProgress?.({ phase: "done" });
  }

  async search(query: string, topK: number = 15): Promise<{ chunk: Chunk; score: number }[]> {
    if (this.vectors.length === 0) return [];
    const qVecs = await encodeBatch([query]);
    const qVec = new Float32Array(qVecs[0]);
    const scores = this.vectors.map((v, i) => {
      let dot = 0;
      for (let j = 0; j < qVec.length; j++) dot += qVec[j] * v[j];
      return { index: i, score: dot };
    });
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK).map((s) => ({ chunk: this.chunks[s.index], score: s.score }));
  }

  dispose() { this.vectors = []; this.chunks = []; this.dim = 0; }
}

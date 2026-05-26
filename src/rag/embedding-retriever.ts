import type { Chunk } from "./retriever";
import { ragLog } from "@/components/common/DebugPanel";
import { db } from "@/db/database";
import { useRAGStore } from "@/stores/rag-store";
import { useBuildStore } from "@/stores/build-store";
import { authHeaders } from "@/lib/auth-headers";

export type BGEProgress = EmbeddingProgress;
export type BGERetrieverData = EmbeddingRetrieverData;

export interface EmbeddingProgress { phase: "loading" | "encoding" | "done"; current?: number; total?: number; }
export interface EmbeddingRetrieverData { vectors: number[][]; chunks: Chunk[]; dim: number; }

const LRU_CACHE = new Map<string, { vectors: Float32Array[]; chunks: Chunk[]; dim: number; size: number }>();
let cacheTotalSize = 0;

const evictListeners: Set<(key: string) => void> = new Set();
export function onLRUEvict(fn: (key: string) => void) { evictListeners.add(fn); return () => evictListeners.delete(fn); }

function getMaxCacheMB() {
  try { return useRAGStore.getState().cacheSizeMB || 100; } catch { return 100; }
}

function evictLRU() {
  const max = getMaxCacheMB() * 1024 * 1024;
  while (cacheTotalSize > max) {
    const firstKey = LRU_CACHE.keys().next().value;
    if (!firstKey) break;
    const entry = LRU_CACHE.get(firstKey)!;
    cacheTotalSize -= entry.size;
    LRU_CACHE.delete(firstKey);
    ragLog(`LRU 淘汰: ${firstKey}, 释放 ${(entry.size / 1024 / 1024).toFixed(1)}MB`);
    for (const fn of evictListeners) fn(firstKey);
  }
}

export class EmbeddingRetriever {
  private vectors: Float32Array[] = [];
  private chunks: Chunk[] = [];
  private dim = 0;
  private engine: string;

  constructor(engine: string = "bge-small-zh") {
    this.engine = engine;
  }

  get chunkCount() { return this.chunks.length; }
  get vectorDim() { return this.dim; }

  toData(): EmbeddingRetrieverData {
    return { vectors: this.vectors.map((v) => Array.from(v)), chunks: this.chunks, dim: this.dim };
  }

  static fromData(data: EmbeddingRetrieverData, engine: string = "bge-small-zh"): EmbeddingRetriever {
    const r = new EmbeddingRetriever(engine);
    r.vectors = data.vectors.map((v) => new Float32Array(v));
    r.chunks = data.chunks;
    r.dim = data.dim;
    return r;
  }

  async init(
    novelId: string,
    _allChunks: Chunk[],
    onProgress?: (p: EmbeddingProgress) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const memCacheKey = `${novelId}-${this.engine}`;

    // Check LRU memory cache first
    const memCached = LRU_CACHE.get(memCacheKey);
    if (memCached) {
      LRU_CACHE.delete(memCacheKey);
      LRU_CACHE.set(memCacheKey, memCached);
      this.vectors = memCached.vectors;
      this.chunks = memCached.chunks;
      this.dim = memCached.dim;
      onProgress?.({ phase: "done" });
      return;
    }

    onProgress?.({ phase: "loading" });

    // Check IndexedDB cache
    try {
      const cached = await db.ragCache.get(memCacheKey);
      if (cached && cached.vectors?.length > 0) {
        const data = EmbeddingRetriever.fromData({ vectors: cached.vectors, chunks: cached.chunks, dim: cached.dim }, this.engine);
        this.vectors = data.vectors;
        this.chunks = data.chunks;
        this.dim = data.dim;
        useRAGStore.getState().addCachedKey(memCacheKey);
        const size = this.vectors.length * this.dim * 4;
        LRU_CACHE.set(memCacheKey, { vectors: this.vectors, chunks: this.chunks, dim: this.dim, size });
        cacheTotalSize += size;
        evictLRU();
        onProgress?.({ phase: "done" });
        return;
      }
    } catch { /* no cached index */ }

    // Check status first to avoid 404
    ragLog("检查服务器索引状态...");
    const statusCheck = await fetch(`/api/rag/${novelId}/status?engine=${encodeURIComponent(this.engine)}`, { headers: authHeaders() });
    const statusData = await statusCheck.json();

    if (statusData.status === "none") {
      ragLog("索引未构建, 触发服务器构建...");
      useBuildStore.getState().start();
      await fetch(`/api/rag/${novelId}/build`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ engine: this.engine }),
      });

      let waited = 0;
      while (waited < 600_000) {
        if (signal?.aborted) throw new Error("操作已取消");
        await new Promise((r) => setTimeout(r, 3000));
        waited += 3000;
        if (signal?.aborted) throw new Error("操作已取消");
        const statusResp = await fetch(`/api/rag/${novelId}/status?engine=${encodeURIComponent(this.engine)}`, { headers: authHeaders() });
        const status = await statusResp.json();
        ragLog(`服务器构建中: ${status.status} ${status.current ?? ""}/${status.total ?? ""}`);

        if (status.status === "ready") { useBuildStore.getState().finish(); break; }
        if (status.status === "error") { useBuildStore.getState().fail(status.error || "构建失败"); throw new Error(status.error || "服务器构建失败"); }

        useBuildStore.getState().setProgress({
          message: `服务器处理中 (${status.current ?? 0}/${status.total ?? "?"})`,
          current: status.current || 0,
          total: status.total || _allChunks.length,
          novelId, engine: this.engine,
        });
        onProgress?.({ phase: "encoding", current: status.current || 0, total: status.total || _allChunks.length });
      }

      const retryResp = await fetch(`/api/rag/${novelId}/index?engine=${encodeURIComponent(this.engine)}`, { headers: authHeaders() });
      if (!retryResp.ok) throw new Error("索引加载失败");
      const data = await retryResp.json();
      await this._loadFromServer(novelId, data, memCacheKey, onProgress);
      return;
    }

    if (statusData.status === "ready") {
      const resp = await fetch(`/api/rag/${novelId}/index?engine=${encodeURIComponent(this.engine)}`, { headers: authHeaders() });
      if (!resp.ok) throw new Error("索引加载失败");
      const data = await resp.json();
      await this._loadFromServer(novelId, data, memCacheKey, onProgress);
      return;
    }

    // Still building — poll
    if (!useBuildStore.getState().open) useBuildStore.getState().start();
    let waited = 0;
    while (waited < 600_000) {
      if (signal?.aborted) throw new Error("操作已取消");
      await new Promise((r) => setTimeout(r, 3000));
      waited += 3000;
      if (signal?.aborted) throw new Error("操作已取消");
      const sr = await fetch(`/api/rag/${novelId}/status?engine=${encodeURIComponent(this.engine)}`, { headers: authHeaders() });
      const st = await sr.json();
      if (st.status === "ready") {
        useBuildStore.getState().finish();
        const resp = await fetch(`/api/rag/${novelId}/index?engine=${encodeURIComponent(this.engine)}`, { headers: authHeaders() });
        if (!resp.ok) throw new Error("索引加载失败");
        const data = await resp.json();
        await this._loadFromServer(novelId, data, memCacheKey, onProgress);
        return;
      }
      if (st.status === "error") {
        useBuildStore.getState().fail(st.error || "构建失败");
        throw new Error(st.error || "服务器构建失败");
      }
      const msg = st.status === "loading" ? "正在加载嵌入模型..."
        : `正在编码 (${st.current ?? 0}/${st.total ?? "?"})`;
      useBuildStore.getState().setProgress({
        message: msg,
        current: st.current || 0, total: st.total || _allChunks.length,
        novelId, engine: this.engine,
      });
      onProgress?.({ phase: "encoding", current: st.current || 0, total: st.total || _allChunks.length });
    }
  }

  private async _loadFromServer(
    novelId: string,
    data: { chunks: Chunk[]; vectorsBase64: string; dim: number },
    memCacheKey: string,
    onProgress?: (p: EmbeddingProgress) => void
  ) {
    this.chunks = data.chunks.map((c: any) => typeof c === "string" ? { id: "", content: c } : c);
    this.dim = data.dim;

    const binary = Uint8Array.from(atob(data.vectorsBase64), (c) => c.charCodeAt(0));
    const flatVectors = new Float32Array(binary.buffer);
    const count = flatVectors.length / data.dim;
    const vectors: Float32Array[] = [];
    for (let i = 0; i < count; i++) {
      vectors.push(flatVectors.slice(i * data.dim, (i + 1) * data.dim));
    }
    this.vectors = vectors;

    const size = vectors.length * data.dim * 4;
    ragLog(`索引加载完成: ${vectors.length}片段 · ${data.dim}维 · ${(size / 1024 / 1024).toFixed(1)}MB`);
    useRAGStore.getState().addCachedKey(memCacheKey);

    LRU_CACHE.set(memCacheKey, { vectors, chunks: data.chunks, dim: data.dim, size });
    cacheTotalSize += size;
    evictLRU();

    try {
      await db.ragCache.put({
        novelId: memCacheKey,
        engine: this.engine,
        vectors: vectors.map((v) => Array.from(v)),
        chunks: this.chunks,
        dim: data.dim,
        createdAt: Date.now(),
      });
    } catch { /* storage full, memory cache is enough */ }

    onProgress?.({ phase: "done" });
  }

  async search(query: string, topK: number = 15): Promise<{ chunk: Chunk; score: number }[]> {
    if (this.vectors.length === 0) return [];
    const resp = await fetch("/api/rag/encode", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [query], engine: this.engine }),
    });
    if (!resp.ok) return [];
    const { vectors: [qArr] } = await resp.json();
    const qVec = new Float32Array(qArr);

    const scores = this.vectors.map((v, i) => {
      let dot = 0;
      for (let j = 0; j < qVec.length; j++) dot += qVec[j] * v[j];
      return { index: i, score: dot };
    });
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK).map((s) => ({ chunk: this.chunks[s.index], score: s.score }));
  }

  dispose() {
    this.vectors = [];
    this.chunks = [];
    this.dim = 0;
  }
}

export { EmbeddingRetriever as BGERetriever };

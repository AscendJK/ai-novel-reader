import type { Chunk } from "./retriever";

export interface BGEProgress {
  phase: "loading" | "encoding" | "done";
  current?: number;
  total?: number;
}

import { setupLocalModelLoader } from "./model-loader";
import { ragLog } from "@/components/common/DebugPanel";

let pipelinePromise: Promise<any> | null = null;
let pipelineInstance: any = null;

async function getPipeline(onProgress?: (p: BGEProgress) => void): Promise<any> {
  if (pipelineInstance) return pipelineInstance;
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      onProgress?.({ phase: "loading" });
      await setupLocalModelLoader();
      const { pipeline, env } = await import("@xenova/transformers");
      console.log("[bge] env:", { localModelPath: env.localModelPath, allowRemoteModels: env.allowRemoteModels });

      // Intercept to see what URLs Transformers.js requests
      const origFetch = (window as any).fetch;
      const fetches: string[] = [];
      (window as any).fetch = async (url: string, ...args: any[]) => {
        const u = String(url);
        fetches.push(u.slice(0, 120));
        const resp = await origFetch(url, ...args);
        if (!resp.ok) {
          ragLog(`FETCH FAIL ${resp.status}: ${u.slice(0, 100)}`);
        }
        return resp;
      };

      try {
        pipelineInstance = await pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", {
          local_files_only: true,
        });
      } catch (e) {
        ragLog(`pipeline失败, 共 ${fetches.length} 次fetch: ${fetches.join(", ")}`);
        throw e;
      } finally {
        (window as any).fetch = origFetch;
      }
      return pipelineInstance;
    })();
  }
  return pipelinePromise;
}

export interface BGERetrieverData {
  vectors: number[][];
  chunks: Chunk[];
  dim: number;
}

export class BGERetriever {
  private vectors: Float32Array[] = [];
  private chunks: Chunk[] = [];
  private dim = 0;

  get chunkCount() { return this.chunks.length; }
  get vectorDim() { return this.dim; }

  /** Serialize for IndexedDB storage */
  toData(): BGERetrieverData {
    return {
      vectors: this.vectors.map((v) => Array.from(v)),
      chunks: this.chunks,
      dim: this.dim,
    };
  }

  /** Restore from IndexedDB cache */
  static fromData(data: BGERetrieverData): BGERetriever {
    const r = new BGERetriever();
    r.vectors = data.vectors.map((v) => new Float32Array(v));
    r.chunks = data.chunks;
    r.dim = data.dim;
    return r;
  }

  async init(
    chunks: Chunk[],
    onProgress?: (p: BGEProgress) => void
  ): Promise<void> {
    this.chunks = chunks;
    const pipe = await getPipeline(onProgress);
    const batchSize = 24;
    const vectors: Float32Array[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map((c) => c.content);
      onProgress?.({ phase: "encoding", current: i, total: chunks.length });
      const result = await pipe(batch, { pooling: "mean", normalize: true });
      const arr = await result.tolist();
      for (const row of arr) {
        vectors.push(new Float32Array(row));
      }
      this.dim = vectors[0]?.length || 0;
    }
    this.vectors = vectors;
    onProgress?.({ phase: "done" });
  }

  async search(query: string, topK: number = 15): Promise<{ chunk: Chunk; score: number }[]> {
    if (this.vectors.length === 0) return [];
    const pipe = await getPipeline();
    const result = await pipe([query], { pooling: "mean", normalize: true });
    const arr = await result.tolist();
    const qVec = new Float32Array(arr[0]);

    // Cosine similarity (vectors are already normalized, so dot product = cosine)
    const scores = this.vectors.map((v, i) => {
      let dot = 0;
      for (let j = 0; j < qVec.length; j++) dot += qVec[j] * v[j];
      return { index: i, score: dot };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK).map((s) => ({
      chunk: this.chunks[s.index],
      score: s.score,
    }));
  }

  dispose() {
    this.vectors = [];
    this.chunks = [];
    this.dim = 0;
  }
}

import type { Chunk } from "./retriever";
import { setupLocalModelLoader } from "./model-loader";
import { ragLog } from "@/components/common/DebugPanel";

export interface BGEProgress { phase: "loading" | "encoding" | "done"; current?: number; total?: number; }
export interface BGERetrieverData { vectors: number[][]; chunks: Chunk[]; dim: number; }

let pipelinePromise: Promise<any> | null = null;
let pipelineInstance: any = null;

async function getPipeline(onProgress?: (p: BGEProgress) => void): Promise<any> {
  if (pipelineInstance) return pipelineInstance;
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      onProgress?.({ phase: "loading" });
      await setupLocalModelLoader();
      const { pipeline } = await import("@xenova/transformers");
      pipelineInstance = await pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", {
        local_files_only: true,
      });
      ragLog("BGE pipeline ready");
      return pipelineInstance;
    })();
  }
  return pipelinePromise;
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

  async init(chunks: Chunk[], onProgress?: (p: BGEProgress) => void): Promise<void> {
    this.chunks = chunks;
    const pipe = await getPipeline(onProgress);
    const batchSize = 24;
    const vectors: Float32Array[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map((c) => c.content);
      onProgress?.({ phase: "encoding", current: i, total: chunks.length });
      const result = await pipe(batch, { pooling: "mean", normalize: true });
      const arr = await result.tolist();
      for (const row of arr) vectors.push(new Float32Array(row));
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

// BGE embedding Web Worker — runs model inference off the main thread
import { pipeline } from "@xenova/transformers";

let pipe: any = null;
let loading = false;

self.onmessage = async (e: MessageEvent) => {
  const { type, id, data } = e.data;

  if (type === "init") {
    if (pipe) { self.postMessage({ type: "ready", id }); return; }
    if (loading) return; // already loading
    loading = true;
    try {
      pipe = await pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", {
        local_files_only: true,
      });
      loading = false;
      self.postMessage({ type: "ready", id });
    } catch (err) {
      loading = false;
      self.postMessage({ type: "error", id, error: String(err) });
    }
    return;
  }

  if (type === "encode") {
    if (!pipe) { self.postMessage({ type: "error", id, error: "pipeline not ready" }); return; }
    try {
      const texts: string[] = data;
      const result = await pipe(texts, { pooling: "mean", normalize: true });
      const arr: number[][] = await result.tolist();
      self.postMessage({ type: "result", id, vectors: arr });
    } catch (err) {
      self.postMessage({ type: "error", id, error: String(err) });
    }
  }
};

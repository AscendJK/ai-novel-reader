// BGE embedding Web Worker
import { env, pipeline } from "@xenova/transformers";

let pipe: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, id, data } = e.data;

  if (type === "init") {
    if (pipe) { self.postMessage({ type: "ready", id }); return; }
    try {
      // Configure env INSIDE the worker
      env.localModelPath = "/models/builtin/";
      env.allowRemoteModels = false;
      env.useBrowserCache = false;
      pipe = await pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", { local_files_only: true });
      self.postMessage({ type: "ready", id });
    } catch (err) {
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

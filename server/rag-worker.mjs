// BGE encoding Worker Thread
import { parentPort, workerData } from "node:worker_threads";
import { pipeline, env } from "@xenova/transformers";

const { chunks, batchSize } = workerData;

env.allowRemoteModels = false;
env.localModelPath = "./public/models/builtin/";

async function run() {
  const pipe = await pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", { local_files_only: true });
  const totalBatches = Math.ceil(chunks.length / batchSize);
  const vectors = [];
  let dim = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batch = chunks.slice(b * batchSize, Math.min((b + 1) * batchSize, chunks.length));
    const result = await pipe(batch, { pooling: "mean", normalize: true });
    const arr = await result.tolist();
    for (const row of arr) vectors.push(row);
    dim = vectors[0]?.length || dim;
    parentPort.postMessage({
      type: "progress",
      current: Math.min((b + 1) * batchSize, chunks.length),
      total: chunks.length,
    });
    await new Promise((resolve) => setImmediate(resolve));
  }

  parentPort.postMessage({ type: "done", vectors, dim });
}

run().catch((e) => parentPort.postMessage({ type: "error", error: e.message || String(e) }));

/**
 * Client-side query encoder using Transformers.js.
 * Loads ONNX model from local public/models/ for offline embedding.
 */

import { ragLog } from "@/components/common/DebugPanel";
import { resolveModelKey } from "./engines";

// Resolve engine ID to the model key Transformers.js expects
function toModelPath(engine: string): string {
  const key = resolveModelKey(engine);
  // Transformers.js uses Xenova/ prefix; builtin models are at /models/builtin/Xenova/...
  if (key.startsWith("Xenova/")) return key;
  // For short IDs like "bge-small-zh", resolve to the full Xenova path
  if (key === "bge-small-zh") return "Xenova/bge-small-zh-v1.5";
  if (key === "gte-small") return "Xenova/gte-small";
  return key;
}

const encoderCache = new Map<string, any>();

async function getEncoder(engine: string): Promise<any> {
  const cached = encoderCache.get(engine);
  if (cached) return cached;

  const modelPath = toModelPath(engine);
  ragLog(`[client-encoder] 加载模型: ${modelPath}...`);
  const { pipeline } = await import("@xenova/transformers");
  const extractor = await pipeline("feature-extraction", modelPath);
  encoderCache.set(engine, extractor);
  ragLog(`[client-encoder] 模型就绪: ${modelPath}`);
  return extractor;
}

export async function encodeQuery(text: string, engine: string): Promise<Float32Array | null> {
  try {
    const extractor = await getEncoder(engine);
    const output = await extractor(text, { pooling: "mean", normalize: true });
    return new Float32Array(output.data);
  } catch (e) {
    ragLog(`[client-encoder] 编码失败: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

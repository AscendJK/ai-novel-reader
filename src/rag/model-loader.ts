/**
 * Local model loader.
 *
 * Model files live in public/models/ (NOT in Git — user places them manually).
 * The app checks for their existence and loads them from the local server.
 *
 * Expected directory structure:
 *   public/models/
 *     Xenova/
 *       bge-small-zh-v1.5/
 *         config.json
 *         tokenizer.json
 *         onnx/
 *           model_quantized.onnx  (or model.onnx)
 *       multilingual-e5-small/
 *         config.json
 *         tokenizer.json
 *         onnx/
 *           model_quantized.onnx  (or model.onnx)
 */

const MODEL_BASE = "/models/Xenova/";

const REQUIRED_FILES: Record<string, string[]> = {
  "Xenova/bge-small-zh-v1.5": [
    "bge-small-zh-v1.5/config.json",
    "bge-small-zh-v1.5/tokenizer.json",
    "bge-small-zh-v1.5/onnx/model_quantized.onnx",
  ],
  "Xenova/multilingual-e5-small": [
    "multilingual-e5-small/config.json",
    "multilingual-e5-small/tokenizer.json",
    "multilingual-e5-small/onnx/model_quantized.onnx",
  ],
};

export async function isModelCached(modelKey: string): Promise<boolean> {
  const files = REQUIRED_FILES[modelKey];
  if (!files) return false;

  for (const file of files) {
    try {
      const resp = await fetch(MODEL_BASE + file, { method: "HEAD" });
      if (!resp.ok) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Configure Transformers.js to load models from the local public/models/ directory
 * instead of trying to fetch from Hugging Face.
 */
export function setupLocalModelLoader(): void {
  import("@xenova/transformers").then(({ env }) => {
    // Point to our local model directory
    env.localModelPath = MODEL_BASE;
    // Prevent any network requests — models must be local
    env.allowRemoteModels = false;
  }).catch(() => {
    // Transformers.js not installed or failed to load — TF-IDF still works
  });
}

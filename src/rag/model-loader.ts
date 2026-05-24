/**
 * Local model loader — two directories:
 *   builtin/  — included in Git, ships with the project (bge-small-zh)
 *   custom/   — user-added models, NOT in Git
 *
 * Model detection: lists the onnx/ directory to find ANY .onnx file.
 * Transformers.js expects the file to be named "model_quantized.onnx".
 * If a different ONNX file is found, the model is still considered "available"
 * but a warning is shown telling the user to rename it.
 */

const BUILTIN = "/models/builtin/";
const CUSTOM = "/models/custom/";
// Transformers.js only loads "model_quantized.onnx" or "model.onnx".
// We detect ALL common variants so we can tell the user about rename.
const ONNX_EXPECTED = "model_quantized.onnx";
const ONNX_ALL = [
  "model_quantized.onnx", "model.onnx",
  "model_int8.onnx", "model_uint8.onnx",
  "model_fp16.onnx", "model_q4.onnx",
  "model_q4f16.onnx", "model_bnb4.onnx",
];

export interface ModelEntry {
  modelKey: string;
  name: string;
  source: "builtin" | "custom";
  size: string;
  onnxFiles: string[];
  renameWarning?: string;
}

// ── model status check ─────────────────────────────────────────────

export interface ModelStatus {
  /** Whether the model is usable (has config + tokenizer + at least one .onnx) */
  available: boolean;
  /** ONNX files found (only populated if config + tokenizer exist) */
  onnxFiles: string[];
  /** Warning if file exists but Transformers.js won't load it */
  renameWarning?: string;
}

/**
 * Check a model directory and report its status.
 * Probes all known ONNX variants via HEAD request.
 */
async function getModelStatus(base: string, modelKey: string): Promise<ModelStatus> {
  const missing: ModelStatus = { available: false, onnxFiles: [] };

  const noCache = { cache: "no-cache" as RequestCache };

  // 1. Check config.json and tokenizer.json exist
  for (const file of ["config.json", "tokenizer.json"]) {
    try {
      const resp = await fetch(base + modelKey + "/" + file, {
        method: "HEAD",
        ...noCache,
      });
      if (!resp.ok) return missing;
      const ct = resp.headers.get("Content-Type") || "";
      // Reject SPA fallback (text/html)
      if (ct.includes("text/html")) return missing;
    } catch {
      return missing;
    }
  }

  // 2. Probe ONLY the expected ONNX variant first.
  //    If found, skip probing the rest to avoid console noise.
  //    Real binary files have Content-Type: application/octet-stream (or similar).
  //    Vite's SPA fallback returns text/html — we filter those out.
  const found: string[] = [];
  const variants = [ONNX_EXPECTED, ...ONNX_ALL.filter((v) => v !== ONNX_EXPECTED)];
  for (const variant of variants) {
    try {
      const resp = await fetch(base + modelKey + "/onnx/" + variant, {
        method: "HEAD",
        ...noCache,
      });
      if (!resp.ok) continue;
      const ct = resp.headers.get("Content-Type") || "";
      if (ct.includes("text/html")) continue;
      const cl = resp.headers.get("Content-Length");
      if (cl && parseInt(cl, 10) < 100000) continue;
      found.push(variant);
      break; // first valid ONNX file is enough — no need to probe the rest
    } catch { /* try next */ }
  }

  if (found.length === 0) return missing;

  // 3. Check if expected name exists
  const hasExpected = found.includes(ONNX_EXPECTED);
  const renameWarning = hasExpected
    ? undefined
    : `Transformers.js 只加载 "${ONNX_EXPECTED}"，当前文件为 "${found[0]}"。请重命名。`;

  return { available: true, onnxFiles: found, renameWarning };
}

// ── public API ──────────────────────────────────────────────────────

export async function isModelCached(modelKey: string): Promise<boolean> {
  const builtin = await getModelStatus(BUILTIN, modelKey);
  if (builtin.available) return true;
  const custom = await getModelStatus(CUSTOM, modelKey);
  return custom.available;
}

export async function getBuiltinModelWarning(modelKey: string): Promise<string | null> {
  const status = await getModelStatus(BUILTIN, modelKey);
  return status.renameWarning || null;
}

/** Scan custom/ directory for user-added models */
export async function scanCustomModels(): Promise<ModelEntry[]> {
  const results: ModelEntry[] = [];

  // Vite plugin serves /models/custom/ as JSON array of sub-directory names
  try {
    const resp = await fetch(CUSTOM, { cache: "no-cache" } as RequestInit);
    if (!resp.ok) return results;
    const ct = resp.headers.get("Content-Type") || "";
    // Only parse JSON responses (not SPA fallback HTML)
    if (!ct.includes("json")) return results;
    const topDirs: string[] = await resp.json();
    if (!Array.isArray(topDirs)) return results;

    for (const dir of topDirs) {
      const subResp = await fetch(CUSTOM + dir + "/", { cache: "no-cache" } as RequestInit);
      if (!subResp.ok) continue;
      const subCt = subResp.headers.get("Content-Type") || "";
      if (!subCt.includes("json")) continue;
      const subDirs: string[] = await subResp.json();
      if (!Array.isArray(subDirs)) continue;

      for (const sub of subDirs) {
        const modelKey = `${dir}/${sub}`;
        const status = await getModelStatus(CUSTOM, modelKey);
        if (status.available) {
          // Get size of first ONNX file
          let size = "?";
          if (status.onnxFiles.length > 0) {
            const firstFile = status.onnxFiles[0];
            try {
              const h = await fetch(CUSTOM + modelKey + "/onnx/" + firstFile, { method: "HEAD", cache: "no-cache" } as RequestInit);
              const cl = h.headers.get("Content-Length");
              if (cl) {
                const mb = parseInt(cl) / (1024 * 1024);
                size = mb >= 1 ? `~${Math.round(mb)} MB` : `~${Math.round(mb * 1024)} KB`;
              }
            } catch { /* can't get size */ }
          }
          results.push({
            modelKey, name: sub, source: "custom", size,
            onnxFiles: status.onnxFiles,
            renameWarning: status.renameWarning,
          });
        }
      }
    }
  } catch {
    /* can't scan */
  }

  return results;
}

/** Check builtin BGE status for the settings UI */
export async function getBuiltinBGEStatus(): Promise<ModelStatus> {
  return getModelStatus(BUILTIN, "Xenova/bge-small-zh-v1.5");
}

// ── recommended models ─────────────────────────────────────────────

export interface RecommendedModel {
  name: string;
  modelKey: string;
  size: string;
  reason: string;
  url: string;
}

export const RECOMMENDED_MODELS: RecommendedModel[] = [
  {
    name: "BGE Small ZH v1.5（内置）",
    modelKey: "Xenova/bge-small-zh-v1.5",
    size: "~26 MB",
    reason: "中文专精，语义理解最佳，已内置在项目中无需额外下载",
    url: "https://huggingface.co/Xenova/bge-small-zh-v1.5",
  },
  {
    name: "Multilingual E5 Small",
    modelKey: "Xenova/multilingual-e5-small",
    size: "~120 MB",
    reason: "微软多语言模型，100+语言，适合中英文混合阅读场景",
    url: "https://huggingface.co/Xenova/multilingual-e5-small",
  },
  {
    name: "All-MiniLM-L6-v2",
    modelKey: "Xenova/all-MiniLM-L6-v2",
    size: "~23 MB",
    reason: "英文最佳轻量模型，体积小速度快，适合纯英文小说",
    url: "https://huggingface.co/Xenova/all-MiniLM-L6-v2",
  },
  {
    name: "Multilingual MiniLM L12 v2",
    modelKey: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    size: "~120 MB",
    reason: "50+语言深度语义理解，12层Transformer，多语言场景最强",
    url: "https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  },
  {
    name: "GTE Small",
    modelKey: "Xenova/gte-small",
    size: "~70 MB",
    reason: "阿里通义实验室出品，中英文均衡，检索评测表现优秀",
    url: "https://huggingface.co/Xenova/gte-small",
  },
];

// ── Transformers.js config ──────────────────────────────────────────

export function setupLocalModelLoader(): void {
  import("@xenova/transformers")
    .then(({ env }) => {
      env.localModelPath = BUILTIN;
      env.allowRemoteModels = false;
    })
    .catch((e) => { console.error("Failed to configure Transformers.js local model path:", e); });
}

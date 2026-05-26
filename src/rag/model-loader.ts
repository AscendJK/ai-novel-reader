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

// HF cache format: org/model → models--org--model
function hfCacheDir(modelKey: string): string {
  return "models--" + modelKey.replace("/", "--");
}

const ONNX_EXPECTED = "model_quantized.onnx";
const ONNX_ALL = [
  "model_quantized.onnx", "model.onnx",
  "model_int8.onnx", "model_uint8.onnx",
  "model_fp16.onnx", "model_q4.onnx",
  "model_q4f16.onnx", "model_bnb4.onnx",
];

/** Known embedding model architectures supported by Transformers.js */
const EMBEDDING_MODEL_TYPES = new Set([
  "bert", "distilbert", "albert", "roberta", "xlm-roberta",
  "nomic_bert", "mpnet", "mobilebert", "squeezebert",
  "electra", "deberta", "deberta-v2", "gpt2", "llama",
  "mistral", "qwen2", "phi", "gemma",
]);

export interface ModelEntry {
  modelKey: string;
  name: string;
  source: "builtin" | "custom";
  size: string;
  onnxFiles: string[];
  renameWarning?: string;
  modelType?: string;
  typeWarning?: string;
}

// ── model status check ─────────────────────────────────────────────

export interface ModelStatus {
  /** Whether the model is usable (has config + tokenizer + at least one .onnx) */
  available: boolean;
  /** ONNX files found (only populated if config + tokenizer exist) */
  onnxFiles: string[];
  /** Warning if file exists but Transformers.js won't load it */
  renameWarning?: string;
  /** model_type from config.json (e.g. "bert", "xlm-roberta") */
  modelType?: string;
  /** Warning if model_type is not a known embedding architecture */
  typeWarning?: string;
}

/**
 * Check a model directory and report its status.
 * Probes all known ONNX variants via HEAD request.
 */
async function getModelStatus(base: string, modelKey: string): Promise<ModelStatus> {
  const missing: ModelStatus = { available: false, onnxFiles: [] };
  // Try flat format first (org/model), then HF cache (models--org--model)
  const candidates = [modelKey, hfCacheDir(modelKey)];

  const noCache = { cache: "no-cache" as RequestCache };
  let dir = "";

  // 1. Check config.json, tokenizer.json, and tokenizer_config.json exist
  for (const cand of candidates) {
    let ok = true;
    for (const file of ["config.json", "tokenizer.json", "tokenizer_config.json"]) {
      try {
        const resp = await fetch(base + cand + "/" + file, { method: "HEAD", ...noCache });
        if (!resp.ok) { ok = false; break; }
        const ct = resp.headers.get("Content-Type") || "";
        if (ct.includes("text/html")) { ok = false; break; }
      } catch { ok = false; break; }
    }
    if (ok) { dir = cand; break; }
  }
  if (!dir) return missing;

  // 2. Probe ONLY the expected ONNX variant first.
  //    If found, skip probing the rest to avoid console noise.
  //    Real binary files have Content-Type: application/octet-stream (or similar).
  //    Vite's SPA fallback returns text/html — we filter those out.
  const found: string[] = [];
  const variants = [ONNX_EXPECTED, ...ONNX_ALL.filter((v) => v !== ONNX_EXPECTED)];
  for (const variant of variants) {
    try {
      const resp = await fetch(base + dir + "/onnx/" + variant, {
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

  // 4. Read config.json to get model_type
  let modelType: string | undefined;
  let typeWarning: string | undefined;
  try {
    const configResp = await fetch(base + dir + "/config.json", { ...noCache });
    if (configResp.ok) {
      const config = await configResp.json();
      modelType = config.model_type;
      if (modelType && !EMBEDDING_MODEL_TYPES.has(modelType)) {
        typeWarning = `model_type "${modelType}" 可能不是嵌入模型，加载时可能失败`;
      }
    }
  } catch { /* config read failed, not critical */ }

  return { available: true, onnxFiles: found, renameWarning, modelType, typeWarning };
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
  const scanned = new Set<string>();

  async function probe(modelKey: string) {
    if (scanned.has(modelKey)) return;
    scanned.add(modelKey);
    const status = await getModelStatus(CUSTOM, modelKey);
    if (status.available) {
      let size = "?";
      if (status.onnxFiles.length > 0) {
        // Try both flat and HF cache directory formats for size check
        for (const prefix of [modelKey, hfCacheDir(modelKey)]) {
          try {
            const h = await fetch(CUSTOM + prefix + "/onnx/" + status.onnxFiles[0], { method: "HEAD", cache: "no-cache" } as RequestInit);
            const cl = h.headers.get("Content-Length");
            if (cl) {
              const mb = parseInt(cl) / (1024 * 1024);
              size = mb >= 1 ? `~${Math.round(mb)} MB` : `~${Math.round(mb * 1024)} KB`;
              break;
            }
          } catch { /* try next format */ }
        }
      }
      const name = modelKey.split("/").pop() || modelKey;
      results.push({
        modelKey, name, source: "custom", size,
        onnxFiles: status.onnxFiles,
        renameWarning: status.renameWarning,
        modelType: status.modelType,
        typeWarning: status.typeWarning,
      });
    }
  }

  // Try directory listing (works in dev with Vite plugin, or prod with Express endpoint)
  try {
    const resp = await fetch(CUSTOM, { cache: "no-cache" } as RequestInit);
    const ct = resp.headers.get("Content-Type") || "";
    if (resp.ok && ct.includes("json")) {
      const topDirs: string[] = await resp.json();
      if (Array.isArray(topDirs)) {
        for (const dir of topDirs) {
          const subResp = await fetch(CUSTOM + dir + "/", { cache: "no-cache" } as RequestInit);
          const subCt = subResp.headers.get("Content-Type") || "";
          if (subResp.ok && subCt.includes("json")) {
            const subDirs: string[] = await subResp.json();
            if (Array.isArray(subDirs)) {
              for (const sub of subDirs) await probe(`${dir}/${sub}`);
            }
          }
        }
      }
    }
  } catch { /* directory listing unavailable */ }

  // Fallback: probe known model paths (recommended + previously saved)
  let savedKeys: string[] = [];
  try {
    const stored = localStorage.getItem("novel-reader-rag-custom-models");
    if (stored) savedKeys = JSON.parse(stored).map((m: any) => m.key);
  } catch { /* ignore */ }
  const knownKeys = [
    ...RECOMMENDED_MODELS.map(m => m.modelKey),
    ...savedKeys,
  ];
  for (const key of knownKeys) await probe(key);

  console.log("[scan] found:", results.length, results.map(r => r.modelKey));
  return results;
}

/** Check a builtin model's status for the settings UI */
export async function getBuiltinModelStatus(modelKey: string): Promise<ModelStatus> {
  return getModelStatus(BUILTIN, modelKey);
}

/** Check builtin BGE status (backward compat) */
export async function getBuiltinBGEStatus(): Promise<ModelStatus> {
  return getBuiltinModelStatus("Xenova/bge-small-zh-v1.5");
}

/** Check builtin GTE status */
export async function getBuiltinGTEStatus(): Promise<ModelStatus> {
  return getBuiltinModelStatus("Xenova/gte-small");
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
];

// ── Transformers.js config ──────────────────────────────────────────

let envReady: Promise<void> | null = null;

export function setupLocalModelLoader(): Promise<void> {
  if (!envReady) {
    envReady = import("@xenova/transformers")
      .then(({ env }) => {
        env.localModelPath = BUILTIN;  // Must be relative path — absolute URL triggers remote block
        env.allowRemoteModels = false;
        env.useBrowserCache = false;
        console.log("[transformers] localModelPath set to:", env.localModelPath);
      })
      .catch((e) => { console.error("Failed to configure Transformers.js:", e); });
  }
  return envReady;
}

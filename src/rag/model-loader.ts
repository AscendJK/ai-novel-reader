/**
 * Local model loader — two directories:
 *   builtin/  — included in Git, ships with the project (bge-small-zh, gte-small)
 *   custom/   — user-downloaded models, NOT in Git
 */

const BUILTIN = "/models/builtin/";
const CUSTOM = "/models/custom/";

const ONNX_EXPECTED = "model_quantized.onnx";

/** Known embedding model architectures supported by Transformers.js */
const EMBEDDING_MODEL_TYPES = new Set([
  "bert", "distilbert", "albert", "roberta", "xlm-roberta",
  "nomic_bert", "mpnet", "mobilebert", "squeezebert",
  "electra", "deberta", "deberta-v2",
]);

// ── File status for downloadable models ──────────────────────────

export interface FileStatus {
  config: boolean;
  tokenizer: boolean;
  tokenizerConfig: boolean;
  onnx: boolean;
  complete: boolean;
  modelType?: string;
  typeWarning?: string;
}

/** Check if the 4 required files exist for a model in custom/ */
export async function checkFileStatus(modelKey: string): Promise<FileStatus> {
  const base = CUSTOM + modelKey + "/";
  const nc = { cache: "no-cache" as RequestCache };
  const status: FileStatus = { config: false, tokenizer: false, tokenizerConfig: false, onnx: false, complete: false };

  async function probe(file: string): Promise<boolean> {
    try {
      const r = await fetch(base + file, { method: "HEAD", ...nc });
      if (!r.ok) return false;
      const ct = r.headers.get("Content-Type") || "";
      return !ct.includes("text/html");
    } catch { return false; }
  }

  [status.config, status.tokenizer, status.tokenizerConfig] = await Promise.all([
    probe("config.json"),
    probe("tokenizer.json"),
    probe("tokenizer_config.json"),
  ]);

  // Check ONNX file
  try {
    const r = await fetch(base + "onnx/" + ONNX_EXPECTED, { method: "HEAD", ...nc });
    if (r.ok) {
      const ct = r.headers.get("Content-Type") || "";
      const cl = r.headers.get("Content-Length");
      if (!ct.includes("text/html") && (!cl || parseInt(cl, 10) >= 100000)) {
        status.onnx = true;
      }
    }
  } catch { /* not found */ }

  status.complete = status.config && status.tokenizer && status.tokenizerConfig && status.onnx;

  // Read model_type from config if present
  if (status.config) {
    try {
      const resp = await fetch(base + "config.json", { ...nc });
      if (resp.ok) {
        const cfg = await resp.json();
        status.modelType = cfg.model_type;
        if (status.modelType && !EMBEDDING_MODEL_TYPES.has(status.modelType)) {
          status.typeWarning = `model_type "${status.modelType}" 可能不是嵌入模型`;
        }
      }
    } catch { /* not critical */ }
  }

  return status;
}

// ── Downloadable (recommended) models ────────────────────────────

export interface DownloadableModel {
  name: string;
  modelKey: string;
  size: string;
  description: string;
  url: string;
}

export const DOWNLOADABLE_MODELS: DownloadableModel[] = [
  {
    name: "Multilingual E5 Small",
    modelKey: "Xenova/multilingual-e5-small",
    size: "~120 MB",
    description: "微软多语言模型，100+语言，中英文兼顾",
    url: "https://huggingface.co/Xenova/multilingual-e5-small",
  },
  {
    name: "All-MiniLM-L6-v2",
    modelKey: "Xenova/all-MiniLM-L6-v2",
    size: "~23 MB",
    description: "英文最佳轻量模型，体积小速度快",
    url: "https://huggingface.co/Xenova/all-MiniLM-L6-v2",
  },
  {
    name: "Multilingual MiniLM L12 v2",
    modelKey: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
    size: "~120 MB",
    description: "50+语言深度语义理解，多语言场景最强",
    url: "https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  },
];

// ── Scan: check file status for all downloadable models ──────────

export interface ScannedModel extends DownloadableModel {
  fileStatus: FileStatus;
}

/** Check file status for all recommended downloadable models */
export async function scanCustomModels(): Promise<ScannedModel[]> {
  const results: ScannedModel[] = [];
  for (const m of DOWNLOADABLE_MODELS) {
    const fileStatus = await checkFileStatus(m.modelKey);
    results.push({ ...m, fileStatus });
  }
  return results;
}

// ── Builtin model status (for settings UI) ──────────────────────

export interface ModelStatus {
  available: boolean;
  onnxFiles: string[];
  renameWarning?: string;
  modelType?: string;
  typeWarning?: string;
}

export async function getBuiltinModelStatus(modelKey: string): Promise<ModelStatus> {
  const base = BUILTIN + modelKey + "/";
  const nc = { cache: "no-cache" as RequestCache };
  const missing: ModelStatus = { available: false, onnxFiles: [] };

  // Check required JSON files
  for (const file of ["config.json", "tokenizer.json", "tokenizer_config.json"]) {
    try {
      const r = await fetch(base + file, { method: "HEAD", ...nc });
      if (!r.ok) return missing;
      const ct = r.headers.get("Content-Type") || "";
      if (ct.includes("text/html")) return missing;
    } catch { return missing; }
  }

  // Check ONNX
  let onnxFound = false;
  try {
    const r = await fetch(base + "onnx/" + ONNX_EXPECTED, { method: "HEAD", ...nc });
    if (r.ok) {
      const ct = r.headers.get("Content-Type") || "";
      if (!ct.includes("text/html")) onnxFound = true;
    }
  } catch { /* not found */ }
  if (!onnxFound) return missing;

  // Read model_type
  let modelType: string | undefined;
  let typeWarning: string | undefined;
  try {
    const r = await fetch(base + "config.json", { ...nc });
    if (r.ok) {
      const cfg = await r.json();
      modelType = cfg.model_type;
      if (modelType && !EMBEDDING_MODEL_TYPES.has(modelType)) {
        typeWarning = `model_type "${modelType}" 可能不是嵌入模型`;
      }
    }
  } catch { /* not critical */ }

  return { available: true, onnxFiles: [ONNX_EXPECTED], modelType, typeWarning };
}

export async function getBuiltinBGEStatus(): Promise<ModelStatus> {
  return getBuiltinModelStatus("Xenova/bge-small-zh-v1.5");
}

export async function getBuiltinGTEStatus(): Promise<ModelStatus> {
  return getBuiltinModelStatus("Xenova/gte-small");
}

// ── Backward compat exports ─────────────────────────────────────

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

export interface RecommendedModel {
  name: string;
  modelKey: string;
  size: string;
  reason: string;
  url: string;
}

export const RECOMMENDED_MODELS: RecommendedModel[] = [
  ...DOWNLOADABLE_MODELS.map(m => ({
    name: m.name, modelKey: m.modelKey, size: m.size, reason: m.description, url: m.url,
  })),
];

// ── Transformers.js config ──────────────────────────────────────

let envReady: Promise<void> | null = null;

export function setupLocalModelLoader(): Promise<void> {
  if (!envReady) {
    envReady = import("@xenova/transformers")
      .then(({ env }) => {
        env.localModelPath = BUILTIN;
        env.allowRemoteModels = false;
        env.useBrowserCache = false;
        console.log("[transformers] localModelPath set to:", env.localModelPath);
      })
      .catch((e) => { console.error("Failed to configure Transformers.js:", e); });
  }
  return envReady;
}

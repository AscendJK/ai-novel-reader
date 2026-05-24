/**
 * Local model loader — two directories:
 *   builtin/  — included in Git, ships with the project (bge-small-zh)
 *   custom/   — user-added models, NOT in Git
 */

const BUILTIN = "/models/builtin/";
const CUSTOM = "/models/custom/";

const ONNX_EXPECTED = "model_quantized.onnx";
const ONNX_VARIANTS = [ONNX_EXPECTED, "model_int8.onnx", "model_uint8.onnx", "model.onnx"];

export interface ModelEntry {
  modelKey: string;
  name: string;
  source: "builtin" | "custom";
  warning?: string; // set if ONNX file needs renaming
}

/**
 * Check if a model is valid and report any filename issues.
 */
async function getModelStatus(
  base: string,
  modelKey: string
): Promise<"ok" | "missing" | { warning: string }> {
  // config.json and tokenizer.json required
  for (const file of ["config.json", "tokenizer.json"]) {
    try {
      const resp = await fetch(base + `${modelKey}/${file}`, { method: "HEAD" });
      if (!resp.ok) return "missing";
    } catch {
      return "missing";
    }
  }

  // Check ONNX variants
  for (const variant of ONNX_VARIANTS) {
    try {
      const resp = await fetch(base + `${modelKey}/onnx/${variant}`, {
        method: "HEAD",
      });
      if (resp.ok) {
        if (variant !== ONNX_EXPECTED) {
          return {
            warning: `ONNX 文件名 "${variant}" 不标准，建议改名为 "${ONNX_EXPECTED}" 以兼容 Transformers.js`,
          };
        }
        return "ok";
      }
    } catch {
      /* try next */
    }
  }

  return "missing";
}

async function checkFiles(base: string, modelKey: string): Promise<boolean> {
  const status = await getModelStatus(base, modelKey);
  return status === "ok" || (typeof status === "object" && "warning" in status);
}

export async function isModelCached(modelKey: string): Promise<boolean> {
  if (await checkFiles(BUILTIN, modelKey)) return true;
  if (await checkFiles(CUSTOM, modelKey)) return true;
  return false;
}

export async function getModelBase(modelKey: string): Promise<string | null> {
  if (await checkFiles(BUILTIN, modelKey)) return BUILTIN;
  if (await checkFiles(CUSTOM, modelKey)) return CUSTOM;
  return null;
}

export async function getBuiltinModelWarning(
  modelKey: string
): Promise<string | null> {
  const status = await getModelStatus(BUILTIN, modelKey);
  return typeof status === "object" ? status.warning : null;
}

/** Scan custom/ directory for user-added models */
export async function scanCustomModels(): Promise<ModelEntry[]> {
  const results: ModelEntry[] = [];

  try {
    const resp = await fetch(CUSTOM, { method: "GET" });
    if (!resp.ok) return results;
    const html = await resp.text();

    const dirRegex = /href="([^"]+)\/"/g;
    const dirs: string[] = [];
    let match;
    while ((match = dirRegex.exec(html)) !== null) {
      dirs.push(match[1].replace(/\/$/, ""));
    }

    for (const dir of dirs) {
      const subResp = await fetch(CUSTOM + dir, { method: "GET" }).catch(() => null);
      if (!subResp?.ok) continue;
      const subHtml = await subResp.text();

      const subDirs: string[] = [];
      let subMatch;
      while ((subMatch = dirRegex.exec(subHtml)) !== null) {
        subDirs.push(subMatch[1].replace(/\/$/, ""));
      }

      for (const sub of subDirs) {
        const modelKey = `${dir}/${sub}`;
        const status = await getModelStatus(CUSTOM, modelKey);
        if (status !== "missing") {
          results.push({
            modelKey,
            name: sub,
            source: "custom",
            warning: typeof status === "object" ? status.warning : undefined,
          });
        }
      }
    }
  } catch {
    /* can't scan */
  }

  return results;
}

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

/**
 * Configure Transformers.js to load from local directories.
 */
export function setupLocalModelLoader(): void {
  import("@xenova/transformers")
    .then(({ env }) => {
      env.localModelPath = BUILTIN;
      env.allowRemoteModels = false;
    })
    .catch(() => {});
}

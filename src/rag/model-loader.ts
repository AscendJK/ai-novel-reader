/**
 * Local model loader — two directories:
 *   builtin/  — included in Git, ships with the project (bge-small-zh)
 *   custom/   — user-added models, NOT in Git
 */

const BUILTIN = "/models/builtin/";
const CUSTOM = "/models/custom/";

interface ModelEntry {
  modelKey: string;   // e.g. "Xenova/bge-small-zh-v1.5"
  name: string;       // display name
  source: "builtin" | "custom";
}

async function checkFiles(base: string, modelKey: string): Promise<boolean> {
  // Try model_quantized.onnx first, fall back to model.onnx
  const paths = [
    `${modelKey}/config.json`,
    `${modelKey}/tokenizer.json`,
    `${modelKey}/onnx/model_quantized.onnx`,
  ];
  for (const p of paths) {
    try {
      const resp = await fetch(base + p, { method: "HEAD" });
      if (!resp.ok) {
        // Try model.onnx as fallback
        if (p.endsWith("model_quantized.onnx")) {
          const fallback = await fetch(base + `${modelKey}/onnx/model.onnx`, { method: "HEAD" });
          if (fallback.ok) continue;
        }
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

export async function isModelCached(modelKey: string): Promise<boolean> {
  // Check builtin first, then custom
  if (await checkFiles(BUILTIN, modelKey)) return true;
  if (await checkFiles(CUSTOM, modelKey)) return true;
  return false;
}

/** Where a model is located */
export async function getModelBase(modelKey: string): Promise<string | null> {
  if (await checkFiles(BUILTIN, modelKey)) return BUILTIN;
  if (await checkFiles(CUSTOM, modelKey)) return CUSTOM;
  return null;
}

/** Scan custom/ directory for user-added models */
export async function scanCustomModels(): Promise<ModelEntry[]> {
  const results: ModelEntry[] = [];

  try {
    // Fetch directory listing — relies on Vite serving directory index
    const resp = await fetch(CUSTOM, { method: "GET" });
    if (!resp.ok) return results;
    const html = await resp.text();

    // Parse directory links from Apache/Vite autoindex
    const dirRegex = /href="([^"]+)\/"/g;
    const dirs: string[] = [];
    let match;
    while ((match = dirRegex.exec(html)) !== null) {
      dirs.push(match[1].replace(/\/$/, ""));
    }

    // Check each directory for valid model files
    for (const dir of dirs) {
      // Vite serves models as: /models/custom/Xenova/<model>/
      // But we already fetched /models/custom/ so dirs might just be "Xenova"
      // or the actual model dirs depending on nesting
      const fullDir = `${CUSTOM}${dir}`;
      const subResp = await fetch(fullDir, { method: "GET" }).catch(() => null);
      if (!subResp?.ok) continue;
      const subHtml = await subResp.text();

      const subDirs: string[] = [];
      let subMatch;
      while ((subMatch = dirRegex.exec(subHtml)) !== null) {
        subDirs.push(subMatch[1].replace(/\/$/, ""));
      }

      for (const sub of subDirs) {
        const modelKey = `${dir}/${sub}`;
        if (await checkFiles(CUSTOM, modelKey)) {
          results.push({ modelKey, name: sub, source: "custom" });
        }
      }
    }
  } catch {
    // Can't scan — return empty
  }

  return results;
}

/** Recommended models user can download */
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
 * Configure Transformers.js to load from our local directories.
 */
export function setupLocalModelLoader(): void {
  import("@xenova/transformers").then(({ env }) => {
    // Always prefer builtin, fall back to custom
    env.localModelPath = BUILTIN;
    env.allowRemoteModels = false;
  }).catch(() => {});
}

export type EngineId = "tfidf" | "bge-small-zh" | "e5-small";

export interface EngineInfo {
  id: EngineId;
  name: string;
  description: string;
  size: string;
  modelKey: string;
  strengths: string[];
  weaknesses: string[];
}

export const ENGINES: Record<EngineId, EngineInfo> = {
  tfidf: {
    id: "tfidf",
    name: "TF-IDF（默认）",
    description: "纯本地字符级检索，零下载，即时可用",
    size: "0 MB",
    modelKey: "",
    strengths: [
      "无需额外文件，开箱即用",
      "关键词和短语匹配准确",
      "对中文词汇的字符级拆解有效",
    ],
    weaknesses: [
      "不理解语义，只做字面匹配",
      "无法识别同义词和近义词",
      "不能理解隐喻、成语和古文",
    ],
  },
  "bge-small-zh": {
    id: "bge-small-zh",
    name: "BGE Small 中文专精（推荐）",
    description: "北京智源出品，专为中文优化的嵌入模型，中文场景最佳",
    size: "约 26 MB",
    modelKey: "Xenova/bge-small-zh-v1.5",
    strengths: [
      "中文语义匹配最优，理解成语和古诗文",
      "对中文修辞手法和隐喻识别强",
      "512维向量，检索精度高于384维模型",
      "INT8量化仅26MB，体积小巧",
    ],
    weaknesses: [
      "需手动放置约 26MB 模型文件",
      "不支持英文文本查询",
      "加载时间4-6秒，略长于 TF-IDF",
    ],
  },
  "e5-small": {
    id: "e5-small",
    name: "E5 Small 多语言",
    description: "微软多语言模型，100+语言支持，中英文兼顾",
    size: "约 120 MB",
    modelKey: "Xenova/multilingual-e5-small",
    strengths: [
      "100+语言支持，中英文兼顾",
      "语义级匹配，能理解同义词",
      "学术评测分数高，通用性强",
    ],
    weaknesses: [
      "需手动放置约 120MB 模型文件，较大",
      "中文成语、古文理解不如 BGE",
      "体积是 BGE 的 5 倍",
    ],
  },
};

export function getEngineInfo(id: EngineId): EngineInfo {
  return ENGINES[id];
}

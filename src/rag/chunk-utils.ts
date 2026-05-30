/**
 * Chunk 相关的工具函数
 * 从 index.ts 中提取，打破循环依赖
 */

import type { Chunk } from "./retriever";

/**
 * 将服务端返回的 chunks 规范化为标准格式
 * 处理字符串和对象两种格式
 */
export function normalizeChunks(chunks: Array<string | { id?: string; content: string }>): Chunk[] {
  return chunks.map((c, i) => {
    if (typeof c === "string") {
      return { id: String(i), content: c };
    }
    return { id: c.id || String(i), content: c.content };
  });
}

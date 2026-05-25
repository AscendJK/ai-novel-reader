import { Retriever, type Chunk } from "./retriever";
import { BGERetriever, type BGEProgress } from "./bge-retriever";
import type { EngineId } from "./engines";
import { ragLog } from "@/components/common/DebugPanel";
import { db } from "@/db/database";

interface IndexEntry {
  novelId: string;
  engine: EngineId;
  retriever: Retriever;
  bge?: BGERetriever;
  chunks: Chunk[];
  buildTime?: number;
}

const indexCache = new Map<string, IndexEntry>();

export async function buildIndex(
  novelId: string,
  chapters: { title: string; content: string }[],
  engine: EngineId = "tfidf",
  onProgress?: (msg: string) => void
): Promise<Retriever | BGERetriever> {
  // Reuse if already built with same engine
  const existing = indexCache.get(novelId);
  if (existing && existing.engine === engine) return engine === "bge-small-zh" ? existing.bge! : existing.retriever;
  if (existing && existing.engine !== engine) {
    existing.bge?.dispose();
    indexCache.delete(novelId);
  }

  // Chunk the text
  onProgress?.("正在分割文本...");
  const chunks: Chunk[] = [];
  const chunkSize = 500;
  const overlap = 100;
  for (const ch of chapters) {
    let start = 0;
    const { content } = ch;
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      const text = content.slice(start, end).trim();
      if (text) {
        chunks.push({ id: `${novelId}-${chunks.length}`, content: `[${ch.title}] ${text}` });
      }
      start += chunkSize - overlap;
    }
  }

  const t0 = Date.now();
  ragLog(`开始构建索引: ${chunks.length}片段 · 引擎: ${engine}`);
  if (engine === "bge-small-zh") {
    // Check IndexedDB cache first
    try {
      const cached = await db.ragCache.get(novelId);
      if (cached && cached.engine === "bge-small-zh" && cached.dim > 0) {
        ragLog(`从缓存加载 BGE 索引: ${cached.vectors.length}片段 · ${cached.dim}维`);
        const bge = BGERetriever.fromData({ vectors: cached.vectors, chunks: cached.chunks, dim: cached.dim });
        const entry: IndexEntry = { novelId, engine, retriever: new Retriever(chunks), bge, chunks, buildTime: Date.now() - t0 };
        indexCache.set(novelId, entry);
        return bge;
      }
    } catch { /* cache miss */ }

    // Build from scratch
    onProgress?.("正在加载嵌入模型...");
    ragLog("加载 BGE Small ZH 模型...");
    const bge = new BGERetriever();
    await bge.init(novelId, chunks, (p: BGEProgress) => {
      if (p.phase === "encoding" && p.current != null && p.total != null) {
        onProgress?.(`正在编码文本 (${p.current}/${p.total})...`);
      } else if (p.phase === "done") {
        onProgress?.("编码完成");
      }
    });
    ragLog(`编码完成: ${chunks.length}片段 · ${(Date.now() - t0) / 1000}s`);

    // Save to IndexedDB cache
    try {
      await db.ragCache.put({
        novelId, engine: "bge-small-zh",
        vectors: bge.toData().vectors,
        chunks: bge.toData().chunks,
        dim: bge.toData().dim,
        createdAt: Date.now(),
      });
      ragLog("索引已缓存到 IndexedDB");
    } catch (e) { ragLog(`缓存索引失败: ${e}`); }

    const entry: IndexEntry = { novelId, engine, retriever: new Retriever(chunks), bge, chunks, buildTime: Date.now() - t0 };
    indexCache.set(novelId, entry);
    return bge;
  } else {
    const retriever = new Retriever(chunks);
    ragLog(`TF-IDF 索引就绪: ${chunks.length}片段 · ${(Date.now() - t0)}ms`);
    const entry: IndexEntry = { novelId, engine, retriever, chunks, buildTime: Date.now() - t0 };
    indexCache.set(novelId, entry);
    return retriever;
  }
}

export function getRetriever(novelId: string): Retriever | undefined {
  return indexCache.get(novelId)?.retriever;
}

export function getBGEMeta(novelId: string) {
  const e = indexCache.get(novelId);
  if (!e?.bge) return null;
  return { chunkCount: e.bge.chunkCount, dim: e.bge.vectorDim, buildTime: e.buildTime };
}

export function clearCache(novelId?: string) {
  if (novelId) {
    indexCache.get(novelId)?.bge?.dispose();
    indexCache.delete(novelId);
  } else {
    for (const entry of indexCache.values()) entry.bge?.dispose();
    indexCache.clear();
  }
}

export async function retrieveRelevant(
  novelId: string,
  query: string,
  topK: number = 15
): Promise<string> {
  const entry = indexCache.get(novelId);
  if (!entry) return "";

  if (entry.engine === "bge-small-zh" && entry.bge) {
    const results = await entry.bge.search(query, topK);
    return results.map((r) => `[相关度: ${r.score.toFixed(3)}] ${r.chunk.content}`).join("\n\n---\n\n");
  }

  // TF-IDF fallback
  const results = entry.retriever.search(query, topK);
  return results
    .map((r) => {
      const chunk = entry.chunks.find((c) => c.id === r.id);
      return chunk?.content || "";
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

// For debug panel: get full retrieval details
export async function retrieveRelevantWithDetails(
  novelId: string,
  query: string,
  topK: number = 15
): Promise<{ text: string; results: { content: string; score: number }[]; engine: string }> {
  const entry = indexCache.get(novelId);
  if (!entry) return { text: "", results: [], engine: entry?.engine || "none" };

  if (entry.engine === "bge-small-zh" && entry.bge) {
    const results = await entry.bge.search(query, topK);
    return {
      engine: "bge-small-zh",
      text: results.map((r) => `[相关度: ${r.score.toFixed(3)}] ${r.chunk.content}`).join("\n\n---\n\n"),
      results: results.map((r) => ({ content: r.chunk.content, score: r.score })),
    };
  }

  const results = entry.retriever.search(query, topK);
  const mapped = results
    .map((r) => {
      const chunk = entry.chunks.find((c) => c.id === r.id);
      return chunk ? { content: chunk.content, score: 1 } : null;
    })
    .filter(Boolean) as { content: string; score: number }[];
  return {
    engine: "tfidf",
    text: mapped.map((r) => `[TF-IDF] ${r.content}`).join("\n\n---\n\n"),
    results: mapped,
  };
}

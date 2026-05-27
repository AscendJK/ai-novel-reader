import { Retriever, type Chunk } from "./retriever";
import { EmbeddingRetriever, onLRUEvict, type EmbeddingProgress } from "./embedding-retriever";
import type { EngineId } from "./engines";
import { isEmbeddingEngine } from "./engines";
import { ragLog } from "@/components/common/DebugPanel";
import { db } from "@/db/database";
import { useRAGStore } from "@/stores/rag-store";

interface IndexEntry {
  novelId: string;
  engine: EngineId;
  retriever: Retriever;
  embedding?: EmbeddingRetriever;
  chunks: Chunk[];
  buildTime?: number;
}

const indexCache = new Map<string, IndexEntry>();
const buildingNow = new Set<string>();

// When LRU evicts an entry, dispose the corresponding indexCache entry
onLRUEvict((evictedKey) => {
  for (const [nid, entry] of indexCache) {
    const entryKey = `${nid}-${entry.engine}`;
    if (entryKey === evictedKey && entry.embedding) {
      entry.embedding.dispose();
      indexCache.delete(nid);
      useRAGStore.getState().removeCachedKey(evictedKey);
      ragLog(`indexCache 同步淘汰: ${evictedKey}`);
      break;
    }
  }
});

export type { EmbeddingRetriever, EmbeddingProgress };

export async function buildIndex(
  novelId: string,
  chapters: { title: string; content: string }[],
  engine: EngineId = "tfidf",
  onProgress?: (msg: string) => void
): Promise<Retriever | EmbeddingRetriever> {
  const existing = indexCache.get(novelId);
  if (existing && existing.engine === engine) {
    return isEmbeddingEngine(engine) ? existing.embedding! : existing.retriever;
  }

  const buildKey = `${novelId}-${engine}`;
  if (buildingNow.has(buildKey)) {
    ragLog(`索引正在构建中, 跳过重复请求`);
    throw new Error("Build already in progress");
  }
  buildingNow.add(buildKey);
  if (existing && existing.engine !== engine) {
    existing.embedding?.dispose();
    indexCache.delete(novelId);
  }

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

  if (isEmbeddingEngine(engine)) {
    // Check IndexedDB cache first
    const cacheKey = `${novelId}-${engine}`;
    try {
      const cached = await db.ragCache.get(cacheKey);
      if (cached && cached.dim > 0) {
        ragLog(`从缓存加载索引: ${cached.vectors.length}片段 · ${cached.dim}维`);
        const emb = EmbeddingRetriever.fromData({ vectors: cached.vectors, chunks: cached.chunks, dim: cached.dim }, engine);
        useRAGStore.getState().addCachedKey(cacheKey);
        const entry: IndexEntry = { novelId, engine, retriever: new Retriever(chunks), embedding: emb, chunks, buildTime: Date.now() - t0 };
        indexCache.set(novelId, entry);
        return emb;
      }
    } catch { /* cache miss */ }

    onProgress?.("正在加载嵌入模型...");
    ragLog(`加载嵌入模型: ${engine}...`);
    const emb = new EmbeddingRetriever(engine);
    await emb.init(novelId, chunks, (p: EmbeddingProgress) => {
      if (p.phase === "encoding" && p.current != null && p.total != null) {
        onProgress?.(`正在编码文本 (${p.current}/${p.total})...`);
      } else if (p.phase === "done") {
        onProgress?.("编码完成");
      }
    });
    ragLog(`编码完成: ${chunks.length}片段 · ${(Date.now() - t0) / 1000}s`);
    buildingNow.delete(buildKey);

    try {
      await db.ragCache.put({
        novelId: cacheKey, engine,
        vectors: emb.toData().vectors,
        chunks: emb.toData().chunks,
        dim: emb.toData().dim,
        createdAt: Date.now(),
      });
      ragLog("索引已缓存到 IndexedDB");
    } catch (e) { ragLog(`缓存索引失败: ${e}`); }

    const entry: IndexEntry = { novelId, engine, retriever: new Retriever(chunks), embedding: emb, chunks, buildTime: Date.now() - t0 };
    indexCache.set(novelId, entry);
    return emb;
  } else {
    const retriever = new Retriever(chunks);
    buildingNow.delete(buildKey);
    ragLog(`TF-IDF 索引就绪: ${chunks.length}片段 · ${(Date.now() - t0)}ms`);
    const entry: IndexEntry = { novelId, engine, retriever, chunks, buildTime: Date.now() - t0 };
    indexCache.set(novelId, entry);
    return retriever;
  }
}

export function getRetriever(novelId: string): Retriever | undefined {
  return indexCache.get(novelId)?.retriever;
}

export function getEmbeddingMeta(novelId: string) {
  const e = indexCache.get(novelId);
  if (!e?.embedding) return null;
  return { chunkCount: e.embedding.chunkCount, dim: e.embedding.vectorDim, buildTime: e.buildTime };
}

export { getEmbeddingMeta as getBGEMeta };

export function clearCache(novelId?: string) {
  if (novelId) {
    indexCache.get(novelId)?.embedding?.dispose();
    indexCache.delete(novelId);
  } else {
    for (const entry of indexCache.values()) entry.embedding?.dispose();
    indexCache.clear();
  }
}

export async function retrieveRelevant(
  novelId: string,
  query: string,
  topK?: number
): Promise<string> {
  const entry = indexCache.get(novelId);
  if (!entry) return "";

  const k = topK ?? useRAGStore.getState().getTopK(entry.chunks.length);

  if (isEmbeddingEngine(entry.engine) && entry.embedding) {
    const results = await entry.embedding.search(query, k);
    return results.map((r) => `[相关度: ${r.score.toFixed(3)}] ${r.chunk.content}`).join("\n\n---\n\n");
  }

  const results = entry.retriever.search(query, k);
  return results
    .map((r) => {
      const chunk = entry.chunks.find((c) => c.id === r.id);
      return chunk?.content || "";
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export async function retrieveRelevantWithDetails(
  novelId: string,
  query: string,
  topK?: number
): Promise<{ text: string; results: { content: string; score: number }[]; engine: string }> {
  const entry = indexCache.get(novelId);
  if (!entry) return { text: "", results: [], engine: "none" };

  const k = topK ?? useRAGStore.getState().getTopK(entry.chunks.length);

  if (isEmbeddingEngine(entry.engine) && entry.embedding) {
    const results = await entry.embedding.search(query, k);
    if (results.length > 0) {
      return {
        engine: entry.engine,
        text: results.map((r) => `[相关度: ${r.score.toFixed(3)}] ${r.chunk.content}`).join("\n\n---\n\n"),
        results: results.map((r) => ({ content: r.chunk.content, score: r.score })),
      };
    }
    // Embedding search returned empty (server offline for encoding) — fall back to TF-IDF
    ragLog("向量检索为空, 降级为 TF-IDF");
  }

  const results = entry.retriever.search(query, k);
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

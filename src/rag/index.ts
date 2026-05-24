import { Retriever, type Chunk } from "./retriever";
import type { EngineId } from "./engines";

interface IndexEntry {
  novelId: string;
  engine: EngineId;
  retriever: Retriever;
  chunks: Chunk[];
}

const indexCache = new Map<string, IndexEntry>();

export function buildIndex(
  novelId: string,
  chapters: { title: string; content: string }[],
  engine: EngineId = "tfidf"
): { retriever: Retriever; chunks: Chunk[] } {
  // Invalidate if engine changed
  const existing = indexCache.get(novelId);
  if (existing && existing.engine === engine) return existing;
  if (existing && existing.engine !== engine) {
    indexCache.delete(novelId);
  }

  const chunks: Chunk[] = [];
  for (const chapter of chapters) {
    const content = chapter.content;
    const chunkSize = 500;
    const overlap = 100;
    if (overlap >= chunkSize) break; // guard against infinite loop
    let start = 0;
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      const chunkText = content.slice(start, end).trim();
      if (chunkText) {
        chunks.push({
          id: `${novelId}-${chunks.length}`,
          content: `[${chapter.title}] ${chunkText}`,
        });
      }
      start += chunkSize - overlap;
    }
  }

  const retriever = new Retriever(chunks);
  const entry = { novelId, engine, retriever, chunks };
  indexCache.set(novelId, entry);
  return entry;
}

export function getRetriever(novelId: string): Retriever | undefined {
  return indexCache.get(novelId)?.retriever;
}

export function clearCache(novelId?: string) {
  if (novelId) {
    indexCache.delete(novelId);
  } else {
    indexCache.clear();
  }
}

export function retrieveRelevant(
  novelId: string,
  query: string,
  topK: number = 10
): string {
  const retriever = getRetriever(novelId);
  if (!retriever) return "";

  const results = retriever.search(query, topK);
  return results
    .map((r) => {
      const chunk = indexCache.get(novelId)?.chunks.find((c) => c.id === r.id);
      return chunk?.content || "";
    })
    .filter(Boolean)
    .join("\n\n---\n\n");
}

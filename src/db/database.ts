import Dexie, { type Table } from "dexie";

export interface NovelRecord {
  id: string;
  title: string;
  author?: string;
  fileName: string;
  fileFormat: "txt" | "epub";
  totalChars: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChapterRecord {
  id: string;
  novelId: string;
  index: number;
  title: string;
  content: string;
  startOffset: number;
  endOffset: number;
}

export interface SummaryRecord {
  id: string;
  chapterId: string;
  chapterTitle: string;
  novelId: string;
  content: string;
  tokensUsed: number;
  createdAt: number;
  updatedAt: number;
  type: string;
  usedFallback?: boolean;
  deleted?: number;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
}

export interface NoteRecord {
  id: string;
  novelId: string;
  chapterId: string;
  chapterTitle: string;
  content: string;
  source: "user" | "ai";
  sourceLabel: string;
  createdAt: number;
  updatedAt: number;
  deleted?: number;
}

export interface RAGCacheRecord {
  novelId: string;
  engine: string;
  vectors: number[][];  // serialized Float32Array as nested number arrays
  chunks: { id: string; content: string }[];
  dim: number;
  createdAt: number;
}

class NovelDB extends Dexie {
  novels!: Table<NovelRecord, string>;
  chapters!: Table<ChapterRecord, string>;
  summaries!: Table<SummaryRecord, string>;
  settings!: Table<SettingsRecord, string>;
  notes!: Table<NoteRecord, string>;
  ragCache!: Table<RAGCacheRecord, string>;

  constructor() {
    super("ai-novel-reader");
    this.version(3).stores({
      novels: "id, createdAt",
      chapters: "id, novelId, index",
      summaries: "id, novelId, chapterId, type",
      settings: "key",
      notes: "id, novelId, chapterId, source, createdAt",
      ragCache: "novelId",
    });
    this.version(4).stores({
      novels: "id, createdAt",
      chapters: "id, novelId, index",
      summaries: "id, novelId, chapterId, type, [novelId+chapterId+type]",
      settings: "key",
      notes: "id, novelId, chapterId, source, createdAt",
      ragCache: "novelId",
    });
    this.version(5).stores({
      novels: "id, createdAt",
      chapters: "id, novelId, index",
      summaries: "id, novelId, chapterId, type, updatedAt, [novelId+chapterId+type]",
      settings: "key",
      notes: "id, novelId, chapterId, source, createdAt, updatedAt",
      ragCache: "novelId",
    });
    this.version(6).stores({
      novels: "id, createdAt",
      chapters: "id, novelId, index",
      summaries: "id, novelId, chapterId, type, updatedAt, [novelId+chapterId+type]",
      settings: "key",
      notes: "id, novelId, chapterId, source, createdAt, updatedAt, deleted",
      ragCache: "novelId",
    });
    this.version(7).stores({
      novels: "id, createdAt",
      chapters: "id, novelId, index",
      summaries: "id, novelId, chapterId, type, updatedAt, deleted, [novelId+chapterId+type]",
      settings: "key",
      notes: "id, novelId, chapterId, source, createdAt, updatedAt, deleted",
      ragCache: "novelId",
    });
  }
}

export const db = new NovelDB();

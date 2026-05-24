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
}

export interface SummaryRecord {
  id: string;
  chapterId: string;
  chapterTitle: string;
  novelId: string;
  content: string;
  tokensUsed: number;
  createdAt: number;
  type: string;
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
}

class NovelDB extends Dexie {
  novels!: Table<NovelRecord, string>;
  chapters!: Table<ChapterRecord, string>;
  summaries!: Table<SummaryRecord, string>;
  settings!: Table<SettingsRecord, string>;
  notes!: Table<NoteRecord, string>;

  constructor() {
    super("ai-novel-reader");
    this.version(2).stores({
      novels: "id, createdAt",
      chapters: "id, novelId, index",
      summaries: "id, novelId, chapterId, type",
      settings: "key",
      notes: "id, novelId, chapterId, source, createdAt",
    });
  }
}

export const db = new NovelDB();

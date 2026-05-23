import { db } from "./database";
import type { Novel, NovelMeta } from "@/parsers/types";
import type { SummaryItem } from "@/stores/summary-store";

export async function saveNovel(novel: Novel): Promise<void> {
  try {
    await db.transaction("rw", db.novels, db.chapters, async () => {
      await db.novels.put({
        id: novel.id,
        title: novel.title,
        author: novel.author,
        fileName: novel.fileName,
        fileFormat: novel.fileFormat,
        totalChars: novel.totalChars,
        createdAt: novel.createdAt,
        updatedAt: novel.updatedAt,
      });

      const chapterRecords = novel.chapters.map((ch) => ({
        id: ch.id,
        novelId: ch.novelId,
        index: ch.index,
        title: ch.title,
        content: ch.content,
      }));

      await db.chapters.where("novelId").equals(novel.id).delete();
      await db.chapters.bulkPut(chapterRecords);
    });
  } catch (e) {
    console.error("saveNovel failed:", e);
  }
}

export async function loadNovel(novelId: string): Promise<Novel | null> {
  try {
    const record = await db.novels.get(novelId);
    if (!record) return null;

    const chapterRecords = await db.chapters.where("novelId").equals(novelId).sortBy("index");

    return {
      id: record.id, title: record.title, author: record.author,
      fileName: record.fileName, fileFormat: record.fileFormat,
      totalChars: record.totalChars, createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      chapters: chapterRecords.map((ch) => ({
        id: ch.id, novelId: ch.novelId, index: ch.index,
        title: ch.title, content: ch.content, startOffset: 0, endOffset: ch.content.length,
      })),
    };
  } catch (e) {
    console.error("loadNovel failed:", e);
    return null;
  }
}

export async function loadAllNovelMeta(): Promise<NovelMeta[]> {
  try {
    const records = await db.novels.orderBy("createdAt").reverse().toArray();
    const result: NovelMeta[] = [];
    for (const r of records) {
      const count = await db.chapters.where("novelId").equals(r.id).count();
      result.push({
        id: r.id, title: r.title, author: r.author,
        fileName: r.fileName, fileFormat: r.fileFormat,
        totalChars: r.totalChars, chapterCount: count,
        createdAt: r.createdAt, updatedAt: r.updatedAt,
      });
    }
    return result;
  } catch (e) {
    console.error("loadAllNovelMeta failed:", e);
    return [];
  }
}

export async function loadAllNovels(): Promise<Novel[]> {
  try {
    const records = await db.novels.orderBy("createdAt").reverse().toArray();
    const novels: Novel[] = [];
    for (const record of records) {
      const chapterRecords = await db.chapters.where("novelId").equals(record.id).sortBy("index");
      novels.push({
        id: record.id, title: record.title, author: record.author,
        fileName: record.fileName, fileFormat: record.fileFormat,
        totalChars: record.totalChars, createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        chapters: chapterRecords.map((ch) => ({
          id: ch.id, novelId: ch.novelId, index: ch.index,
          title: ch.title, content: ch.content, startOffset: 0, endOffset: ch.content.length,
        })),
      });
    }
    return novels;
  } catch (e) {
    console.error("loadAllNovels failed:", e);
    return [];
  }
}

export async function deleteNovel(novelId: string): Promise<void> {
  try {
    await db.transaction("rw", db.chapters, db.summaries, db.settings, db.novels, async () => {
      await db.chapters.where("novelId").equals(novelId).delete();
      await db.summaries.where("novelId").equals(novelId).delete();
      await db.settings.delete("character-graph-" + novelId).catch(() => {});
      await db.novels.delete(novelId);
    });

    try {
      const stored = localStorage.getItem("novel-reader-positions-v2");
      if (stored) {
        const positions = JSON.parse(stored);
        delete positions[novelId];
        localStorage.setItem("novel-reader-positions-v2", JSON.stringify(positions));
      }
    } catch { /* ignore */ }
  } catch (e) {
    console.error("deleteNovel failed:", e);
  }
}

export async function saveSummary(summary: SummaryItem & { novelId: string }): Promise<void> {
  try {
    await db.summaries.put({
      id: summary.id, novelId: summary.novelId,
      chapterId: summary.chapterId, chapterTitle: summary.chapterTitle,
      content: summary.content, tokensUsed: summary.tokensUsed,
      createdAt: summary.createdAt, type: summary.type,
    });
  } catch (e) {
    console.error("saveSummary failed:", e);
  }
}

export async function loadSummaries(novelId: string): Promise<(SummaryItem & { novelId: string })[]> {
  try {
    return db.summaries.where("novelId").equals(novelId).sortBy("createdAt");
  } catch (e) {
    console.error("loadSummaries failed:", e);
    return [];
  }
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  try {
    await db.settings.put({ key, value });
  } catch (e) {
    console.error("saveSetting failed:", e);
  }
}

export async function loadSetting<T>(key: string): Promise<T | null> {
  try {
    const record = await db.settings.get(key);
    return record ? (record.value as T) : null;
  } catch (e) {
    console.error("loadSetting failed:", e);
    return null;
  }
}

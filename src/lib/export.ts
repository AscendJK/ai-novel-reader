import { db } from "@/db/database";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export async function exportNovelAsJSON(novelId: string) {
  const novel = await db.novels.get(novelId);
  if (!novel) return;
  const chapters = await db.chapters.where("novelId").equals(novelId).sortBy("index");
  const summaries = await db.summaries.where("novelId").equals(novelId).toArray();
  const notes = await db.notes.where("novelId").equals(novelId).toArray();

  const data = { novel, chapters, summaries, notes, exportedAt: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  download(blob, `${novel.title}-${timestamp()}.json`);
}

export async function exportNovelAsTXT(novelId: string) {
  const novel = await db.novels.get(novelId);
  if (!novel) return;
  const chapters = await db.chapters.where("novelId").equals(novelId).sortBy("index");

  let text = `${novel.title}\n`;
  if (novel.author) text += `作者: ${novel.author}\n`;
  text += `\n${"=".repeat(40)}\n\n`;

  for (const ch of chapters) {
    text += `${ch.title}\n\n${ch.content}\n\n`;
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  download(blob, `${novel.title}-${timestamp()}.txt`);
}

export async function exportAllAsJSON() {
  const novels = await db.novels.toArray();
  const chapters = await db.chapters.toArray();
  const summaries = await db.summaries.toArray();
  const notes = await db.notes.toArray();
  // Exclude sensitive API settings
  const settings = (await db.settings.toArray()).filter(
    (s) => !s.key.startsWith("api-providers") && !s.key.startsWith("api-active-provider")
  );

  const data = { novels, chapters, summaries, notes, settings, exportedAt: Date.now(), version: 1 };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  download(blob, `小说阅读器备份-${timestamp()}.json`);
}

export async function importFromJSON(file: File): Promise<{ novels: number; chapters: number; summaries: number; notes: number }> {
  const text = await file.text();
  const data = JSON.parse(text);

  let novelCount = 0, chapterCount = 0, summaryCount = 0, noteCount = 0;

  await db.transaction("rw", db.novels, db.chapters, db.summaries, db.notes, db.settings, async () => {
    if (data.novels?.length) {
      for (const n of data.novels) { await db.novels.put(n); novelCount++; }
    }
    if (data.chapters?.length) {
      for (const ch of data.chapters) { await db.chapters.put(ch); chapterCount++; }
    }
    if (data.summaries?.length) {
      for (const s of data.summaries) { await db.summaries.put({ ...s, updatedAt: s.updatedAt || Date.now() }); summaryCount++; }
    }
    if (data.notes?.length) {
      for (const n of data.notes) { await db.notes.put({ ...n, updatedAt: n.updatedAt || Date.now() }); noteCount++; }
    }
    if (data.settings?.length) {
      for (const s of data.settings) { await db.settings.put(s); }
    }
  });

  return { novels: novelCount, chapters: chapterCount, summaries: summaryCount, notes: noteCount };
}

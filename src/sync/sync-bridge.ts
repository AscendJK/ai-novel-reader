import type { SyncData } from "./types";
import { db } from "@/db/database";

/** Gather all persisted data for sync push */
export async function gatherChanges(): Promise<Partial<SyncData>> {
  const novels = await db.novels.toArray();
  const chapters = await db.chapters.toArray();
  const summaries = await db.summaries.toArray();
  const notes = await db.notes.toArray();

  // Gather settings related to API and graph
  const settings: Record<string, unknown> = {};
  try {
    const apiProviders = await db.settings.get("api-providers");
    if (apiProviders) settings["api-providers"] = apiProviders.value;
    const apiActive = await db.settings.get("api-active-provider");
    if (apiActive) settings["api-active-provider"] = apiActive.value;
    const graphKeys = (await db.settings.toArray())
      .filter((s) => s.key.startsWith("character-graph-"));
    for (const g of graphKeys) settings[g.key] = g.value;
  } catch { /* ignore */ }

  // Gather reading progress
  let readingPositions = {};
  let lastOpened = {};
  try {
    readingPositions = JSON.parse(localStorage.getItem("novel-reader-positions-v2") || "{}");
    lastOpened = JSON.parse(localStorage.getItem("novel-reader-last-opened") || "{}");
  } catch { /* ignore */ }

  return {
    novels,
    chapters,
    summaries,
    notes,
    settings,
    progress: { readingPositions, lastOpened },
  };
}

/** Apply server data to local storage (after pull) */
export async function applyServerData(data: SyncData): Promise<void> {
  // Merge into IndexedDB — use put (upsert) with timestamp comparison
  if (data.novels?.length) {
    await db.transaction("rw", db.novels, async () => {
      for (const n of data.novels as Array<{ id: string; updatedAt?: number }>) {
        const existing = await db.novels.get(n.id);
        if (!existing || (n.updatedAt || 0) >= (existing.updatedAt || 0)) {
          await db.novels.put(n as any);
        }
      }
    });
  }

  if (data.chapters?.length) {
    await db.transaction("rw", db.chapters, async () => {
      for (const c of data.chapters as Array<{ id: string; updatedAt?: number }>) {
        const existing = await db.chapters.get(c.id);
        if (!existing || (c.updatedAt || 0) >= (existing.updatedAt || 0)) {
          await db.chapters.put(c as any);
        }
      }
    });
  }

  if (data.summaries?.length) {
    await db.transaction("rw", db.summaries, async () => {
      for (const s of data.summaries as Array<{ id: string; createdAt?: number }>) {
        const existing = await db.summaries.get(s.id);
        if (!existing || (s.createdAt || 0) >= (existing.createdAt || 0)) {
          await db.summaries.put(s as any);
        }
      }
    });
  }

  if (data.notes?.length) {
    await db.transaction("rw", db.notes, async () => {
      for (const n of data.notes as Array<{ id: string; createdAt?: number }>) {
        const existing = await db.notes.get(n.id);
        if (!existing || (n.createdAt || 0) >= (existing.createdAt || 0)) {
          await db.notes.put(n as any);
        }
      }
    });
  }

  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      if (value !== null && value !== undefined) {
        await db.settings.put({ key, value });
      }
    }
  }

  // Progress
  if (data.progress) {
    try {
      const existingPositions = JSON.parse(localStorage.getItem("novel-reader-positions-v2") || "{}");
      const mergedPositions = { ...existingPositions, ...data.progress.readingPositions };
      localStorage.setItem("novel-reader-positions-v2", JSON.stringify(mergedPositions));

      const existingOpened = JSON.parse(localStorage.getItem("novel-reader-last-opened") || "{}");
      const mergedOpened = { ...existingOpened, ...data.progress.lastOpened };
      localStorage.setItem("novel-reader-last-opened", JSON.stringify(mergedOpened));
    } catch { /* ignore */ }
  }
}

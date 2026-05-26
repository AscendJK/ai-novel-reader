import type { SyncData } from "./types";
import { db } from "@/db/database";

/** Gather user data for sync push (no novels/chapters — those are server-side) */
export async function gatherChanges(): Promise<Partial<SyncData>> {
  const summaries = await db.summaries.toArray();
  const notes = await db.notes.toArray();

  // Gather settings (graph, RAG) — never sync API keys
  const settings: Record<string, unknown> = {};
  try {
    const allSettings = await db.settings.toArray();
    for (const s of allSettings) {
      // Skip sensitive API key settings — these stay local only
      if (s.key.startsWith("api-providers:") || s.key.startsWith("api-active-provider:")) continue;
      if (s.key.startsWith("character-graph-")) {
        settings[s.key] = s.value;
      }
    }
  } catch { /* ignore */ }

  // Reading progress
  let readingPositions = {};
  let lastOpened = {};
  try {
    readingPositions = JSON.parse(localStorage.getItem("novel-reader-positions-v2") || "{}");
    lastOpened = JSON.parse(localStorage.getItem("novel-reader-last-opened") || "{}");
  } catch { /* ignore */ }

  return {
    summaries,
    notes,
    settings,
    progress: { readingPositions, lastOpened },
  };
}

/** Apply server data to local storage (after sync pull) */
export async function applyServerData(data: SyncData): Promise<void> {
  // Summaries
  if (data.summaries?.length) {
    await db.transaction("rw", db.summaries, async () => {
      for (const s of data.summaries as Array<{ id: string; createdAt?: number }>) {
        const existing = await db.summaries.get(s.id);
        if (!existing || (s.createdAt || 0) > (existing.createdAt || 0)) {
          await db.summaries.put(s as any);
        }
      }
    });
  }

  // Notes
  if (data.notes?.length) {
    await db.transaction("rw", db.notes, async () => {
      for (const n of data.notes as Array<{ id: string; createdAt?: number }>) {
        const existing = await db.notes.get(n.id);
        if (!existing || (n.createdAt || 0) > (existing.createdAt || 0)) {
          await db.notes.put(n as any);
        }
      }
    });
  }

  // Settings
  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      if (value !== null && value !== undefined) {
        await db.settings.put({ key, value });
      }
    }
    // Reload API store so new providers appear without refresh
    try {
      const { useAPIStore } = await import("@/stores/api-store");
      await useAPIStore.getState().loadFromDB();
    } catch { /* ok */ }
  }

  // Progress
  if (data.progress) {
    try {
      if (data.progress.readingPositions) {
        const existing = JSON.parse(localStorage.getItem("novel-reader-positions-v2") || "{}");
        localStorage.setItem("novel-reader-positions-v2",
          JSON.stringify({ ...existing, ...data.progress.readingPositions }));
      }
      if (data.progress.lastOpened) {
        const existing = JSON.parse(localStorage.getItem("novel-reader-last-opened") || "{}");
        localStorage.setItem("novel-reader-last-opened",
          JSON.stringify({ ...existing, ...data.progress.lastOpened }));
      }
    } catch { /* ignore */ }
  }
}

import type { SyncData } from "./types";
import { sharedDB, getUserDB } from "@/db/database";
import { useAPIStore } from "@/stores/api-store";
import { userKey } from "@/lib/user-utils";

// 每批同步的最大记录数
const BATCH_SIZE = 50;

/** Gather user data for sync push (no novels/chapters — those are server-side) */
export async function gatherChanges(lastSyncTime: number): Promise<Partial<SyncData>> {
  const udb = getUserDB();

  // Incremental: only send records modified since last sync
  const allSummaries = await udb.summaries.toArray();
  const filteredSummaries = lastSyncTime > 0
    ? allSummaries.filter((s) => (s.updatedAt || 0) > lastSyncTime)
    : allSummaries;

  const allNotes = await udb.notes.toArray();
  const filteredNotes = lastSyncTime > 0
    ? allNotes.filter((n) => (n.updatedAt || 0) > lastSyncTime)
    : allNotes;

  // 分批：只取前 BATCH_SIZE 条记录
  const summaries = filteredSummaries.slice(0, BATCH_SIZE);
  const notes = filteredNotes.slice(0, BATCH_SIZE);

  // 如果有更多数据，记录日志
  if (filteredSummaries.length > BATCH_SIZE) {
    console.log(`[sync] summaries batch: ${summaries.length}/${filteredSummaries.length}`);
  }
  if (filteredNotes.length > BATCH_SIZE) {
    console.log(`[sync] notes batch: ${notes.length}/${filteredNotes.length}`);
  }

  // Gather settings (graph, RAG) — never sync API keys
  const settings: Record<string, unknown> = {};
  try {
    const allSettings = await sharedDB.settings.toArray();
    for (const s of allSettings) {
      if (s.key.startsWith("api-providers:") || s.key.startsWith("api-active-provider:")) continue;
      if (s.key.startsWith("character-graph-")) {
        settings[s.key] = s.value;
      }
    }
  } catch { /* ignore */ }

  // Reading progress (per-user keys)
  let readingPositions = {};
  let lastOpened = {};
  try {
    readingPositions = JSON.parse(localStorage.getItem(userKey("novel-reader-positions")) || "{}");
    lastOpened = JSON.parse(localStorage.getItem(userKey("novel-reader-last-opened")) || "{}");
  } catch { /* ignore */ }

  return {
    summaries,
    notes,
    settings,
    progress: { readingPositions, lastOpened },
  };
}

/**
 * 检查是否还有更多数据需要同步
 */
export async function hasMoreChanges(lastSyncTime: number): Promise<boolean> {
  const udb = getUserDB();

  const allSummaries = await udb.summaries.toArray();
  const summaries = lastSyncTime > 0
    ? allSummaries.filter((s) => (s.updatedAt || 0) > lastSyncTime)
    : allSummaries;

  const allNotes = await udb.notes.toArray();
  const notes = lastSyncTime > 0
    ? allNotes.filter((n) => (n.updatedAt || 0) > lastSyncTime)
    : allNotes;

  return summaries.length > BATCH_SIZE || notes.length > BATCH_SIZE;
}

/** Apply server data to local storage (after sync pull) */
export async function applyServerData(data: SyncData): Promise<void> {
  const udb = getUserDB();

  // Summaries — conflict resolution by updatedAt
  if (data.summaries?.length) {
    await udb.transaction("rw", udb.summaries, async () => {
      for (const s of data.summaries) {
        const existing = await udb.summaries.get(s.id);
        if (!existing || (s.updatedAt || 0) >= (existing.updatedAt || 0)) {
          await udb.summaries.put(s);
        }
      }
    });
  }

  // Notes — conflict resolution by updatedAt
  if (data.notes?.length) {
    await udb.transaction("rw", udb.notes, async () => {
      for (const n of data.notes) {
        const existing = await udb.notes.get(n.id);
        if (!existing || (n.updatedAt || 0) >= (existing.updatedAt || 0)) {
          await udb.notes.put(n);
        }
      }
    });
  }

  // Settings (shared database)
  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      if (value !== null && value !== undefined) {
        await sharedDB.settings.put({ key, value });
      }
    }
    try {
      await useAPIStore.getState().loadFromDB();
    } catch { /* ok */ }
  }

  // Progress (per-user localStorage)
  if (data.progress) {
    try {
      if (data.progress.readingPositions) {
        const existing = JSON.parse(localStorage.getItem(userKey("novel-reader-positions")) || "{}");
        localStorage.setItem(userKey("novel-reader-positions"),
          JSON.stringify({ ...existing, ...data.progress.readingPositions }));
      }
      if (data.progress.lastOpened) {
        const existing = JSON.parse(localStorage.getItem(userKey("novel-reader-last-opened")) || "{}");
        localStorage.setItem(userKey("novel-reader-last-opened"),
          JSON.stringify({ ...existing, ...data.progress.lastOpened }));
      }
    } catch { /* ignore */ }
  }
}

import { create } from "zustand";
import type { Novel } from "@/parsers/types";

interface ReadPosition { chapterId: string; chapterIndex: number }

interface NovelState {
  currentNovel: Novel | null;
  novels: Novel[];
  selectedChapterId: string | null;
  readingPositions: Record<string, ReadPosition>;
  setCurrentNovel: (novel: Novel | null) => void;
  setSelectedChapter: (chapterId: string | null) => void;
  addNovel: (novel: Novel) => void;
  removeNovel: (novelId: string) => void;
  getReadingPosition: (novelId: string) => ReadPosition | null;
  saveReadingPosition: (novelId: string, chapterId: string, chapterIndex: number) => void;
}

function loadPositions(): Record<string, ReadPosition> {
  try {
    const stored = localStorage.getItem("novel-reader-positions-v2");
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function savePositions(positions: Record<string, ReadPosition>) {
  try { localStorage.setItem("novel-reader-positions-v2", JSON.stringify(positions)); } catch { /* ignore */ }
}

export const useNovelStore = create<NovelState>((set, get) => ({
  currentNovel: null,
  novels: [],
  selectedChapterId: null,
  readingPositions: loadPositions(),

  setCurrentNovel: (novel) => {
    if (novel) {
      const pos = get().readingPositions[novel.id];
      const chapter = pos
        ? novel.chapters.find((c) => c.id === pos.chapterId)
        : null;
      set({
        currentNovel: novel,
        selectedChapterId: chapter?.id ?? novel.chapters[0]?.id ?? null,
      });
    } else {
      set({ currentNovel: null, selectedChapterId: null });
    }
  },

  setSelectedChapter: (chapterId) => {
    const { currentNovel } = get();
    if (currentNovel && chapterId) {
      const idx = currentNovel.chapters.findIndex((c) => c.id === chapterId);
      const positions = {
        ...get().readingPositions,
        [currentNovel.id]: { chapterId, chapterIndex: idx >= 0 ? idx : 0 },
      };
      savePositions(positions);
      set({ selectedChapterId: chapterId, readingPositions: positions });
    } else {
      set({ selectedChapterId: chapterId });
    }
  },

  addNovel: (novel) => set((s) => {
    if (s.novels.some((n) => n.id === novel.id)) return s;
    return { novels: [...s.novels, novel] };
  }),

  removeNovel: (novelId) =>
    set((s) => {
      const positions = { ...s.readingPositions };
      delete positions[novelId];
      savePositions(positions);
      return {
        novels: s.novels.filter((n) => n.id !== novelId),
        currentNovel: s.currentNovel?.id === novelId ? null : s.currentNovel,
        readingPositions: positions,
      };
    }),

  getReadingPosition: (novelId) => get().readingPositions[novelId] || null,

  saveReadingPosition: (novelId, chapterId, chapterIndex) => {
    const positions = { ...get().readingPositions, [novelId]: { chapterId, chapterIndex } };
    savePositions(positions);
    set({ readingPositions: positions });
  },
}));

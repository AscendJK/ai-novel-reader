import { create } from "zustand";
import type { EngineId } from "@/rag/engines";

function loadPref(): EngineId {
  try {
    const stored = localStorage.getItem("novel-reader-rag-engine");
    if (stored && stored.length > 0) return stored;
  } catch { /* ignore */ }
  return "bge-small-zh";
}

function loadSavedModels(): { key: string; name: string; size: string }[] {
  try {
    const stored = localStorage.getItem("novel-reader-rag-custom-models");
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveModels(models: { key: string; name: string; size: string }[]) {
  try {
    localStorage.setItem("novel-reader-rag-custom-models", JSON.stringify(models));
  } catch { /* ignore */ }
}

function loadCacheSize(): number {
  try {
    const v = parseInt(localStorage.getItem("novel-reader-rag-cache-mb") || "", 10);
    return (v >= 100 && v <= 500) ? v : 100;
  } catch { return 100; }
}

interface RAGState {
  engine: EngineId;
  savedCustomModels: { key: string; name: string; size: string }[];
  cacheSizeMB: number;
  cachedKeys: Set<string>;
  setEngine: (e: EngineId, name?: string, size?: string) => void;
  setSavedCustomModels: (models: { key: string; name: string; size: string }[]) => void;
  removeSavedModel: (key: string) => void;
  setCacheSizeMB: (size: number) => void;
  addCachedKey: (key: string) => void;
  removeCachedKey: (key: string) => void;
  hasCachedKey: (key: string) => boolean;
}

export const useRAGStore = create<RAGState>((set, get) => ({
  engine: loadPref(),
  savedCustomModels: loadSavedModels(),
  cacheSizeMB: loadCacheSize(),
  cachedKeys: new Set<string>(),

  setEngine: (engine, name, size) => {
    try { localStorage.setItem("novel-reader-rag-engine", engine); } catch { /* ignore */ }
    // Save custom model to remembered list
    if (name && engine.includes("/")) {
      const models = get().savedCustomModels;
      if (!models.some((m) => m.key === engine)) {
        const updated = [...models, { key: engine, name, size: size || "?" }];
        saveModels(updated);
        set({ engine, savedCustomModels: updated });
        return;
      }
    }
    set({ engine });
  },

  setSavedCustomModels: (models) => {
    saveModels(models);
    set({ savedCustomModels: models });
  },

  removeSavedModel: (key) => {
    const updated = get().savedCustomModels.filter((m) => m.key !== key);
    saveModels(updated);
    set({ savedCustomModels: updated });
  },

  setCacheSizeMB: (size) => {
    const clamped = Math.max(100, Math.min(500, size));
    try { localStorage.setItem("novel-reader-rag-cache-mb", String(clamped)); } catch { /* ignore */ }
    set({ cacheSizeMB: clamped });
  },

  addCachedKey: (key) => {
    const next = new Set(get().cachedKeys);
    next.add(key);
    set({ cachedKeys: next });
  },

  removeCachedKey: (key) => {
    const next = new Set(get().cachedKeys);
    next.delete(key);
    set({ cachedKeys: next });
  },

  hasCachedKey: (key) => get().cachedKeys.has(key),
}));

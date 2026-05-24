import { create } from "zustand";
import type { EngineId } from "@/rag/engines";

function loadPref(): EngineId {
  try {
    const stored = localStorage.getItem("novel-reader-rag-engine");
    if (stored === "tfidf" || stored === "bge-small-zh") return stored;
  } catch { /* ignore */ }
  return "bge-small-zh";
}

function loadCustomKey(): string | null {
  try {
    return localStorage.getItem("novel-reader-rag-custom-key");
  } catch { return null; }
}

function loadCustomModels(): { key: string; name: string; size: string }[] {
  try {
    const stored = localStorage.getItem("novel-reader-rag-custom-models");
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveCustomModels(models: { key: string; name: string; size: string }[]) {
  try {
    localStorage.setItem("novel-reader-rag-custom-models", JSON.stringify(models));
  } catch { /* ignore */ }
}

interface RAGState {
  engine: EngineId;
  customModelKey: string | null;
  savedCustomModels: { key: string; name: string; size: string }[];
  setEngine: (e: EngineId) => void;
  setCustomModel: (key: string | null, name?: string, size?: string) => void;
  setSavedCustomModels: (models: { key: string; name: string; size: string }[]) => void;
  clearCustomModel: () => void;
}

export const useRAGStore = create<RAGState>((set, get) => ({
  engine: loadPref(),
  customModelKey: loadCustomKey(),
  savedCustomModels: loadCustomModels(),

  setEngine: (engine) => {
    try { localStorage.setItem("novel-reader-rag-engine", engine); } catch { /* ignore */ }
    try { localStorage.removeItem("novel-reader-rag-custom-key"); } catch { /* ignore */ }
    set({ engine, customModelKey: null });
  },

  setCustomModel: (key, name, size) => {
    try {
      if (key === null) localStorage.removeItem("novel-reader-rag-custom-key");
      else localStorage.setItem("novel-reader-rag-custom-key", key);
    } catch { /* ignore */ }
    const models = get().savedCustomModels;
    if (name && !models.some((m) => m.key === key)) {
      const updated = [...models, { key, name, size: size || "?" }];
      saveCustomModels(updated);
      set({ customModelKey: key, savedCustomModels: updated });
    } else {
      set({ customModelKey: key });
    }
  },

  setSavedCustomModels: (models) => {
    saveCustomModels(models);
    set({ savedCustomModels: models });
  },

  clearCustomModel: () => {
    try { localStorage.removeItem("novel-reader-rag-custom-key"); } catch { /* ignore */ }
    set({ customModelKey: null });
  },
}));

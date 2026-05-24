import { create } from "zustand";
import type { EngineId } from "@/rag/engines";

function loadPref(): EngineId {
  try {
    const stored = localStorage.getItem("novel-reader-rag-engine");
    if (stored === "tfidf" || stored === "e5-small" || stored === "bge-small-zh") {
      return stored;
    }
  } catch { /* ignore */ }
  return "tfidf";
}

interface RAGState {
  engine: EngineId;
  setEngine: (e: EngineId) => void;
}

export const useRAGStore = create<RAGState>((set) => ({
  engine: loadPref(),

  setEngine: (engine) => {
    localStorage.setItem("novel-reader-rag-engine", engine);
    set({ engine });
  },
}));

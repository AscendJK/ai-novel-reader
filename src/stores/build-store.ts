import { create } from "zustand";
import { useRAGStore } from "./rag-store";

interface BuildState {
  open: boolean;
  status: "building" | "done" | "error";
  message: string;
  current?: number;
  total?: number;
  error?: string;
  novelId?: string;
  engine?: string;
  setProgress: (p: Partial<BuildState>) => void;
  start: () => void;
  finish: () => void;
  fail: (err: string) => void;
  fallbackToTFIDF: () => void;
  retry: () => void;
}

export const useBuildStore = create<BuildState>((set, get) => ({
  open: false,
  status: "building",
  message: "",
  current: 0,
  total: 0,
  error: undefined,

  setProgress: (p) => set(p),

  start: () => set({ open: true, status: "building", message: "正在准备...", error: undefined }),
  dismiss: () => set({ open: false }),
  finish: () => {
    set({ status: "done", message: "索引构建成功" });
    setTimeout(() => set({ open: false }), 1500);
  },

  fail: (err) => set({ status: "error", message: "构建失败", error: err }),

  fallbackToTFIDF: () => {
    useRAGStore.getState().setEngine("tfidf");
    set({ open: false });
  },

  retry: () => {
    set({ open: false });
    // Trigger rebuild by changing engine back and forth
    const currentEngine = useRAGStore.getState().engine;
    useRAGStore.getState().setEngine("tfidf");
    setTimeout(() => useRAGStore.getState().setEngine(currentEngine), 100);
  },
}));

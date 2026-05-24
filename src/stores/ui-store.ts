import { create } from "zustand";

function getInitialTheme(): "light" | "dark" {
  try {
    const stored = localStorage.getItem("novel-reader-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch { /* ignore */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialFontSize(): number {
  try {
    const stored = localStorage.getItem("novel-reader-font-size");
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return 18;
}

function getInitialFontWeight(): number {
  try {
    const stored = localStorage.getItem("novel-reader-font-weight");
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return 400;
}

interface UIState {
  theme: "light" | "dark";
  fontSize: number;
  fontWeight: number;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setFontSize: (size: number) => void;
  setFontWeight: (weight: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  fontSize: getInitialFontSize(),
  fontWeight: getInitialFontWeight(),

  setTheme: (theme) => {
    try { localStorage.setItem("novel-reader-theme", theme); } catch { /* ignore */ }
    set({ theme });
  },

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light";
      try { localStorage.setItem("novel-reader-theme", next); } catch { /* ignore */ }
      return { theme: next };
    }),

  setFontSize: (size) => {
    try { localStorage.setItem("novel-reader-font-size", String(size)); } catch { /* ignore */ }
    set({ fontSize: size });
  },

  setFontWeight: (weight) => {
    try { localStorage.setItem("novel-reader-font-weight", String(weight)); } catch { /* ignore */ }
    set({ fontWeight: weight });
  },
}));

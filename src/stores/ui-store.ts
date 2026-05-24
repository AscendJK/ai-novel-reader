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
    if (stored) return parseInt(stored, 10);
  } catch { /* ignore */ }
  return 18;
}

function getInitialFontWeight(): number {
  try {
    const stored = localStorage.getItem("novel-reader-font-weight");
    if (stored) return parseInt(stored, 10);
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
    localStorage.setItem("novel-reader-theme", theme);
    set({ theme });
  },

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "light" ? "dark" : "light";
      localStorage.setItem("novel-reader-theme", next);
      return { theme: next };
    }),

  setFontSize: (size) => {
    localStorage.setItem("novel-reader-font-size", String(size));
    set({ fontSize: size });
  },

  setFontWeight: (weight) => {
    localStorage.setItem("novel-reader-font-weight", String(weight));
    set({ fontWeight: weight });
  },
}));

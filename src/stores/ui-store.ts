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
  return 16;
}

function getInitialFontWeight(): number {
  try {
    const stored = localStorage.getItem("novel-reader-font-weight");
    if (stored) return parseInt(stored, 10);
  } catch { /* ignore */ }
  return 400;
}

type ReadingTheme = "default" | "sepia" | "black";

function getInitialReadingTheme(): ReadingTheme {
  try {
    const stored = localStorage.getItem("novel-reader-reading-theme");
    if (stored === "sepia" || stored === "black") return stored;
  } catch { /* ignore */ }
  return "default";
}

interface UIState {
  theme: "light" | "dark";
  fontSize: number;
  fontWeight: number;
  readingTheme: ReadingTheme;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setFontSize: (size: number) => void;
  setFontWeight: (weight: number) => void;
  setReadingTheme: (t: ReadingTheme) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  fontSize: getInitialFontSize(),
  fontWeight: getInitialFontWeight(),
  readingTheme: getInitialReadingTheme(),

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

  setReadingTheme: (readingTheme) => {
    localStorage.setItem("novel-reader-reading-theme", readingTheme);
    set({ readingTheme });
  },
}));

export type { ReadingTheme };

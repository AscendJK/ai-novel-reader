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

function getInitialDebugMode(): boolean {
  try { return localStorage.getItem("novel-reader-debug") === "true"; } catch { return false; }
}

function getInitialLineHeight(): number {
  try {
    const stored = localStorage.getItem("novel-reader-line-height");
    if (stored) { const v = parseFloat(stored); if (!isNaN(v)) return v; }
  } catch { /* ignore */ }
  return 1.8;
}

function getInitialParagraphSpacing(): number {
  try {
    const stored = localStorage.getItem("novel-reader-para-spacing");
    if (stored) { const v = parseInt(stored, 10); if (!isNaN(v)) return v; }
  } catch { /* ignore */ }
  return 8;
}

function getInitialFontFamily(): string {
  try { return localStorage.getItem("novel-reader-font-family") || "system-ui"; } catch { return "system-ui"; }
}

function getInitialOfflineMode(): boolean {
  try { return localStorage.getItem("novel-reader-offline-mode") === "true"; } catch { return false; }
}

interface UIState {
  theme: "light" | "dark";
  fontSize: number;
  fontWeight: number;
  debugMode: boolean;
  lineHeight: number;
  paragraphSpacing: number;
  fontFamily: string;
  offlineMode: boolean;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setFontSize: (size: number) => void;
  setFontWeight: (weight: number) => void;
  setDebugMode: (v: boolean) => void;
  setLineHeight: (v: number) => void;
  setParagraphSpacing: (v: number) => void;
  setFontFamily: (v: string) => void;
  setOfflineMode: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  fontSize: getInitialFontSize(),
  fontWeight: getInitialFontWeight(),
  debugMode: getInitialDebugMode(),
  lineHeight: getInitialLineHeight(),
  paragraphSpacing: getInitialParagraphSpacing(),
  fontFamily: getInitialFontFamily(),
  offlineMode: getInitialOfflineMode(),

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

  setDebugMode: (v) => {
    try { localStorage.setItem("novel-reader-debug", String(v)); } catch { /* ignore */ }
    set({ debugMode: v });
  },

  setLineHeight: (v) => {
    const clamped = Math.max(1.2, Math.min(2.4, v));
    try { localStorage.setItem("novel-reader-line-height", String(clamped)); } catch { /* ignore */ }
    set({ lineHeight: clamped });
  },

  setParagraphSpacing: (v) => {
    const clamped = Math.max(0, Math.min(20, v));
    try { localStorage.setItem("novel-reader-para-spacing", String(clamped)); } catch { /* ignore */ }
    set({ paragraphSpacing: clamped });
  },

  setFontFamily: (v) => {
    try { localStorage.setItem("novel-reader-font-family", v); } catch { /* ignore */ }
    set({ fontFamily: v });
  },

  setOfflineMode: (v) => {
    try { localStorage.setItem("novel-reader-offline-mode", String(v)); } catch { /* ignore */ }
    set({ offlineMode: v });
  },
}));

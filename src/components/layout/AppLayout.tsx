import { useEffect, useState, useRef } from "react";
import { Header } from "./Header";
import { BookSelect } from "./BookSelect";
import { ReadingPanel } from "@/components/reader/ReadingPanel";
import { ApiSettings } from "@/components/settings/ApiSettings";
import { UsernameLogin } from "@/components/login/UsernameLogin";
import { setupLocalModelLoader } from "@/rag/model-loader";

// Configure Transformers.js to load models from local public/models/
setupLocalModelLoader();
import { useUIStore } from "@/stores/ui-store";
import { useNovelStore } from "@/stores/novel-store";
import { loadAllNovels, loadSummaries } from "@/db/repositories";
import { useSummaryStore } from "@/stores/summary-store";
import { useAPIStore } from "@/stores/api-store";
import { syncClient } from "@/sync/sync-client";
import { gatherChanges, applyServerData } from "@/sync/sync-bridge";
import type { SyncData } from "@/sync/types";

export function AppLayout() {
  const { theme } = useUIStore();
  const { currentNovel, setCurrentNovel, addNovel } = useNovelStore();
  const { setSummaries } = useSummaryStore();
  const [showSettings, setShowSettings] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const syncStarted = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    useAPIStore.getState().loadFromDB();
    loadAllNovels().then((novels) => {
      novels.forEach((n) => addNovel(n));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentNovel) {
      loadSummaries(currentNovel.id).then((dbSummaries) => {
        if (dbSummaries.length > 0) setSummaries(dbSummaries);
      });
    }
  }, [currentNovel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync integration ──
  useEffect(() => {
    if (syncClient.isLoggedIn && !syncStarted.current) {
      syncStarted.current = true;
      syncClient.start({
        gatherChanges,
        applyData: async (data: SyncData) => {
          await applyServerData(data);
          // Reload novels into store after sync pull
          const novels = await loadAllNovels();
          novels.forEach((n) => addNovel(n));
          // Reload summaries if currently viewing a novel
          const { currentNovel: cn } = useNovelStore.getState();
          if (cn) {
            const dbSummaries = await loadSummaries(cn.id);
            if (dbSummaries.length > 0) setSummaries(dbSummaries);
          }
        },
        isAiRunning: () => {
          // Check if any AI task is running (accessed via a simple flag)
          return (window as any).__aiRunning === true;
        },
      });
      setSyncReady(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Register visibility change → refresh data from server
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && syncClient.isLoggedIn) {
        syncClient.pushNow();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleLogin = async (username: string, isJoin: boolean) => {
    setLoginError(null);

    // Clear stale local data from any previous session
    try {
      const { db } = await import("@/db/database");
      await db.delete();
      await db.open(); // reopen so subsequent DB calls work
    } catch { /* ok if already empty */ }
    const syncUser = localStorage.getItem("sync-username");
    const syncCid = localStorage.getItem("sync-clientId");
    localStorage.clear();
    if (syncUser) localStorage.setItem("sync-username", syncUser);
    if (syncCid) localStorage.setItem("sync-clientId", syncCid);

    // Login
    const mode = isJoin ? "join" : "create";
    const result = await syncClient.login(username, mode);
    if (result.error) {
      setLoginError(result.error);
      return;
    }
    if (!result.success) {
      setLoginError("连接服务器失败，请确保服务已启动");
      return;
    }

    // Always push any local data first, then pull merged data from server
    try {
      await syncClient.syncOnce();
      // Reload novels from IndexedDB into store (syncOnce wrote them)
      const novels = await loadAllNovels();
      novels.forEach((n) => addNovel(n));
      // Reload summaries if needed
      const { currentNovel: cn } = useNovelStore.getState();
      if (cn) {
        const dbSummaries = await loadSummaries(cn.id);
        if (dbSummaries.length > 0) setSummaries(dbSummaries);
      }
    } catch { /* will catch up on next timer tick */ }

    // Start periodic sync
    if (!syncStarted.current) {
      syncStarted.current = true;
      syncClient.start({
        gatherChanges,
        applyData: async (data: SyncData) => {
          await applyServerData(data);
          const novels = await loadAllNovels();
          novels.forEach((n) => addNovel(n));
          const { currentNovel: cn2 } = useNovelStore.getState();
          if (cn2) {
            const s = await loadSummaries(cn2.id);
            if (s.length > 0) setSummaries(s);
          }
        },
        isAiRunning: () => (window as any).__aiRunning === true,
      });
    }
    setSyncReady(true);
  };

  const handleBackToLibrary = () => {
    setShowSettings(false);
    setCurrentNovel(null);
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Login modal — shown until user logs in */}
      {!syncClient.isLoggedIn && (
        <UsernameLogin onLogin={handleLogin} error={loginError} />
      )}

      <Header
        inBook={!!currentNovel}
        bookTitle={currentNovel?.title}
        onBack={handleBackToLibrary}
        onSettings={() => setShowSettings(true)}
      />
      <main className="flex-1 overflow-hidden relative">
        {/* Reading — always mounted so panel state survives */}
        <div style={{ display: !showSettings && currentNovel ? undefined : "none" }} className="h-full">
          <ReadingPanel />
        </div>
        {/* Settings overlay */}
        {showSettings && (
          <div className="h-full overflow-auto">
            <ApiSettings onBack={() => setShowSettings(false)} />
          </div>
        )}
        {/* Book select */}
        {!currentNovel && !showSettings && (
          <div className="h-full overflow-auto">
            <BookSelect />
          </div>
        )}
      </main>
    </div>
  );
}

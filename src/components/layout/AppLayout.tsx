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
  const [loginSyncing, setLoginSyncing] = useState(false);
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

  // ── Sync integration (auto-login from stored session) ──
  useEffect(() => {
    if (syncClient.isLoggedIn && !syncStarted.current) {
      syncStarted.current = true;
      syncClient.start({
        gatherChanges,
        applyData: async (data: SyncData) => {
          await applyServerData(data);
          const novels = await loadAllNovels();
          novels.forEach((n) => addNovel(n));
        },
        isAiRunning: () => (window as any).__aiRunning === true,
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

    // Clear stale local data from any previous user (truncate tables, not delete DB)
    try {
      const { db } = await import("@/db/database");
      await db.transaction("rw", db.novels, db.chapters, db.summaries, db.notes, db.settings, async () => {
        await db.novels.clear();
        await db.chapters.clear();
        await db.summaries.clear();
        await db.notes.clear();
        await db.settings.clear();
      });
    } catch (e) { console.error("clear tables failed:", e); }
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

    // Start periodic sync FIRST so gatherChanges/applyData are available for syncOnce
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

    // Block UI until initial sync completes
    setLoginSyncing(true);

    // Push any local data + pull merged data from server
    try {
      const ok = await syncClient.syncOnce();
      console.log("[sync] initial syncOnce:", ok ? "ok" : "failed");
      const novels = await loadAllNovels();
      novels.forEach((n) => addNovel(n));
    } catch (e) { console.error("[sync] syncOnce error:", e); }

    setSyncReady(true);
    setLoginSyncing(false);
  };

  const handleBackToLibrary = () => {
    setShowSettings(false);
    setCurrentNovel(null);
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Login / syncing overlay — blocks UI until first sync completes */}
      {!syncReady && (
        <UsernameLogin onLogin={handleLogin} error={loginError} syncing={loginSyncing || syncClient.isLoggedIn} />
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

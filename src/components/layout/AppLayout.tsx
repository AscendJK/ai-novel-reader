import { useEffect, useState, useRef, useCallback } from "react";
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
import { db } from "@/db/database";
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

  const handleKicked = useCallback(() => {
    alert("该账号已在另一设备登录，当前会话已下线。");
    // Clear local data and reload so login screen appears
    localStorage.removeItem("sync-username");
    localStorage.removeItem("sync-clientId");
    db.delete().then(() => window.location.reload());
  }, []);

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
          if (data.progress?.readingPositions) {
            useNovelStore.setState((s) => ({
              readingPositions: { ...s.readingPositions, ...data.progress!.readingPositions },
            }));
          }
          // Reload summaries if viewing a novel
          const { currentNovel: cn } = useNovelStore.getState();
          if (cn) {
            const s = await loadSummaries(cn.id);
            if (s.length > 0) setSummaries(s);
          }
          syncJoinedNovels();
        },
        isAiRunning: () => (window as any).__aiRunning === true,
        onKicked: handleKicked,
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
          if (data.progress?.readingPositions) {
            useNovelStore.setState((s) => ({
              readingPositions: { ...s.readingPositions, ...data.progress!.readingPositions },
            }));
          }
          const { currentNovel: cn2 } = useNovelStore.getState();
          if (cn2) {
            const s = await loadSummaries(cn2.id);
            if (s.length > 0) setSummaries(s);
          }
          syncJoinedNovels();
        },
        isAiRunning: () => (window as any).__aiRunning === true,
        onKicked: handleKicked,
      });
    }

    // Block UI until initial sync completes
    setLoginSyncing(true);

    // Push any local data + pull merged data from server
    try {
      const ok = await syncClient.syncOnce();
      console.log("[sync] initial syncOnce:", ok ? "ok" : "failed");
    } catch (e) { console.error("[sync] syncOnce error:", e); }

    // Download joined novels missing from local
    await syncJoinedNovels();

    setSyncReady(true);
    setLoginSyncing(false);
  };

  // Download joined novels that are missing from local IndexedDB
  const syncJoinedNovels = async () => {
    try {
      const username = localStorage.getItem("sync-username");
      if (!username) return;
      const resp = await fetch(`/api/novels?username=${encodeURIComponent(username)}`);
      if (!resp.ok) return;
      const list = await resp.json();
      for (const sn of list) {
        if (!sn.joined) continue;
        const existing = await db.novels.get(sn.id);
        if (existing) continue;
        const chResp = await fetch(`/api/novels/${sn.id}/chapters?username=${encodeURIComponent(username)}`);
        if (!chResp.ok) continue;
        const chapters = await chResp.json();
        await db.transaction("rw", db.novels, db.chapters, async () => {
          await db.novels.put({
            id: sn.id, title: sn.title, author: sn.author,
            fileName: sn.fileName, fileFormat: sn.fileFormat,
            totalChars: sn.totalChars, chapterCount: chapters.length,
            createdAt: sn.createdAt, updatedAt: sn.updatedAt || Date.now(),
          });
          for (const ch of chapters) {
            await db.chapters.put({
              id: ch.id, novelId: sn.id, index: ch.index,
              title: ch.title, content: ch.content,
              startOffset: ch.startOffset ?? 0, endOffset: ch.endOffset ?? ch.content?.length ?? 0,
            });
          }
        });
        addNovel({ ...sn, chapters, chapterCount: chapters.length });
      }
    } catch (e) { console.error("syncJoinedNovels:", e); }
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
        {/* Book select — key forces remount when sync completes */}
        {!currentNovel && !showSettings && (
          <div className="h-full overflow-auto" key={String(syncReady)}>
            <BookSelect />
          </div>
        )}
      </main>
    </div>
  );
}

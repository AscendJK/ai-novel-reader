import { useState } from "react";
import { ArrowLeft, Book, Settings, Moon, Sun, LogOut, User, StickyNote, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { db } from "@/db/database";
import { syncClient } from "@/sync/sync-client";

interface HeaderProps {
  inBook: boolean;
  bookTitle?: string;
  onBack: () => void;
  onSettings: () => void;
  onNotes: () => void;
}

export function Header({ inBook, bookTitle, onBack, onSettings, onNotes }: HeaderProps) {
  const { theme, toggleTheme, offlineMode } = useUIStore();
  const username = offlineMode ? localStorage.getItem("sync-username") : syncClient.user;
  const [showUser, setShowUser] = useState(false);

  const handleLogout = async () => {
    if (!window.confirm("确定退出登录？\n\n退出后将清除本地数据并返回登录界面。")) return;
    syncClient.logout();
    // Clear only app-specific keys, not all localStorage
    const keysToRemove = [
      "sync-username", "sync-clientId", "sync-token",
      "novel-reader-positions-v2", "novel-reader-last-opened",
      "novel-reader-theme", "novel-reader-debug",
      "novel-reader-offline-mode",
    ];
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    // Preserve ALL users' API settings (local-only, never synced)
    const savedApiSettings: Array<{ key: string; value: unknown }> = [];
    try {
      const allSettings = await db.settings.toArray();
      for (const s of allSettings) {
        if (s.key.startsWith("api-providers:") || s.key.startsWith("api-active-provider:")) {
          savedApiSettings.push(s);
        }
      }
    } catch { /* ignore */ }
    db.transaction("rw", db.novels, db.chapters, db.summaries, db.notes, db.settings, async () => {
      await db.novels.clear();
      await db.chapters.clear();
      await db.summaries.clear();
      await db.notes.clear();
      await db.settings.clear();
    }).then(async () => {
      // Restore all saved API settings
      for (const s of savedApiSettings) {
        await db.settings.put(s).catch(() => {});
      }
      window.location.reload();
    }).catch(() => window.location.reload());
  };

  return (
    <header className="border-b bg-card px-4 py-2.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {inBook ? (
          <>
            <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
              <ArrowLeft className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">书架</span>
            </Button>
            <span className="hidden md:block w-px h-5 bg-border mx-1" />
            <Book className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-sm font-semibold truncate max-w-[150px] md:max-w-[300px]">《{bookTitle}》</h1>
          </>
        ) : (
          <>
            <Book className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold hidden md:block">AI 小说精读助手</h1>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        {offlineMode && (
          <span className="text-xs text-amber-500 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded mr-1">
            <WifiOff className="h-3 w-3" />
            <span className="hidden md:inline">离线</span>
          </span>
        )}
        {/* Username + logout */}
        {username && (
          <div className="flex items-center gap-2 mr-1 relative">
            <button
              className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded hover:bg-accent transition-colors"
              onClick={() => setShowUser((v) => !v)}
              title={username}
            >
              <User className="h-3 w-3" />
              <span className="hidden md:inline">{username}</span>
            </button>
            {showUser && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUser(false)} />
                <div className="absolute top-full left-0 mt-1.5 z-50 bg-popover border rounded-md shadow-md px-3 py-1.5 text-xs whitespace-nowrap">
                  {username}
                </div>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleLogout} title="退出登录">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {!inBook && (
          <Button variant="ghost" size="icon" onClick={onNotes} title="全部笔记">
            <StickyNote className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onSettings} title="设置">
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === "light" ? "暗色模式" : "亮色模式"}
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

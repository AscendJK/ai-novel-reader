import { useEffect, useState } from "react";
import { Header } from "./Header";
import { BookSelect } from "./BookSelect";
import { ReadingPanel } from "@/components/reader/ReadingPanel";
import { ApiSettings } from "@/components/settings/ApiSettings";
import { useUIStore } from "@/stores/ui-store";
import { useNovelStore } from "@/stores/novel-store";
import { loadAllNovels, loadSummaries } from "@/db/repositories";
import { useSummaryStore } from "@/stores/summary-store";
import { useAPIStore } from "@/stores/api-store";

export function AppLayout() {
  const { theme } = useUIStore();
  const { currentNovel, setCurrentNovel, addNovel } = useNovelStore();
  const { setSummaries } = useSummaryStore();
  const [showSettings, setShowSettings] = useState(false);

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

  const handleBackToLibrary = () => {
    setShowSettings(false);
    setCurrentNovel(null);
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
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
          <div className="h-full">
            <ApiSettings onBack={() => setShowSettings(false)} />
          </div>
        )}
        {/* Book select */}
        {!currentNovel && !showSettings && (
          <div className="h-full">
            <BookSelect />
          </div>
        )}
      </main>
    </div>
  );
}

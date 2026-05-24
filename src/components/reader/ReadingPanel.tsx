import { useState } from "react";
import { ChapterNav } from "./ChapterNav";
import { ChapterContent } from "./ChapterContent";
import { SummaryPanel } from "@/components/summary/SummaryPanel";
import { PanelRightOpen, PanelRightClose, List, Sparkles, X } from "lucide-react";
import { useSummaryStore } from "@/stores/summary-store";
import { useNovelStore } from "@/stores/novel-store";

export function ReadingPanel() {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileAiOpen, setMobileAiOpen] = useState(false);
  const { currentNovel, selectedChapterId } = useNovelStore();
  const { getSummariesByNovel } = useSummaryStore();

  const hasCurrentSummary = currentNovel
    ? getSummariesByNovel(currentNovel.id).some(
        (s) => s.chapterId === selectedChapterId && s.type === "chapter"
      )
    : false;

  const showAi = summaryOpen || mobileAiOpen;

  return (
    <div className="flex h-full relative">
      {/* Desktop: permanent sidebar. Mobile: hidden */}
      <div className="hidden md:block shrink-0">
        <ChapterNav />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChapterContent
          summaryOpen={summaryOpen}
          onToggleSummary={() => setSummaryOpen(!summaryOpen)}
          hasSummary={hasCurrentSummary}
        />
      </div>

      {/* Mobile: bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-12 border-t bg-card flex items-center justify-around z-30 px-4">
        <button
          onClick={() => setMobileNavOpen(true)}
          className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground hover:text-primary"
        >
          <List className="h-4 w-4" />
          目录
        </button>
        <button
          onClick={() => setMobileAiOpen(true)}
          className="flex flex-col items-center gap-0.5 text-xs text-muted-foreground hover:text-primary relative"
        >
          <Sparkles className="h-4 w-4" />
          AI分析
          {hasCurrentSummary && (
            <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Desktop: right panel toggle + panel */}
      <div className="hidden md:flex">
        {!summaryOpen && (
          <button
            onClick={() => setSummaryOpen(true)}
            className="h-[85px] w-8 bg-card border border-r-0 rounded-l-md flex items-center justify-center hover:bg-accent transition-colors group shadow-sm shrink-0 relative"
            title="打开AI分析面板"
          >
            <PanelRightOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            {hasCurrentSummary && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
        )}
        <div style={{ display: summaryOpen ? undefined : "none" }} className="flex">
          <button
            onClick={() => setSummaryOpen(false)}
            className="h-[85px] w-8 bg-card border border-l-0 rounded-l-md flex items-center justify-center hover:bg-accent transition-colors group shadow-sm shrink-0"
            title="关闭AI分析面板"
          >
            <PanelRightClose className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
          <SummaryPanel />
        </div>
      </div>

      {/* Mobile: chapter nav drawer (left) */}
      {mobileNavOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileNavOpen(false)} />
          <div className="md:hidden fixed inset-y-0 left-0 w-64 bg-card z-50 shadow-xl animate-in slide-in-from-left">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="font-semibold text-sm">目录</span>
              <button onClick={() => setMobileNavOpen(false)} className="p-1 rounded hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100vh-48px)]">
              <ChapterNav />
            </div>
          </div>
        </>
      )}

      {/* Mobile: AI panel (bottom sheet) */}
      {mobileAiOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setMobileAiOpen(false)} />
          <div className="md:hidden fixed inset-x-0 bottom-0 bg-card z-50 rounded-t-xl shadow-xl animate-in slide-in-from-bottom max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-card">
              <span className="font-semibold text-sm">AI 分析</span>
              <button onClick={() => setMobileAiOpen(false)} className="p-1 rounded hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <SummaryPanel />
          </div>
        </>
      )}
    </div>
  );
}

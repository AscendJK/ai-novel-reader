import { useEffect, useCallback } from "react";
import { useNovelStore } from "@/stores/novel-store";
import { useSummaryStore } from "@/stores/summary-store";
import { useUIStore } from "@/stores/ui-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Sparkles, ChevronLeft, ChevronRight, Bold } from "lucide-react";

interface ChapterContentProps {
  summaryOpen: boolean;
  onToggleSummary: () => void;
  hasSummary: boolean;
}

const FONT_WEIGHTS = [
  { value: 300, label: "细" },
  { value: 400, label: "正常" },
  { value: 500, label: "中" },
  { value: 600, label: "粗" },
];

export function ChapterContent({ summaryOpen, onToggleSummary, hasSummary }: ChapterContentProps) {
  const { currentNovel, selectedChapterId, setSelectedChapter } = useNovelStore();
  const { getSummariesByNovel } = useSummaryStore();
  const { fontSize, setFontSize, fontWeight, setFontWeight } = useUIStore();

  const chapters = currentNovel?.chapters || [];
  const currentIndex = chapters.findIndex((c) => c.id === selectedChapterId);
  const chapter = currentIndex >= 0 ? chapters[currentIndex] : undefined;
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  const goToChapter = useCallback(
    (chapterId: string) => {
      setSelectedChapter(chapterId);
    },
    [setSelectedChapter]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft" && prevChapter) {
        goToChapter(prevChapter.id);
      } else if (e.key === "ArrowRight" && nextChapter) {
        goToChapter(nextChapter.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevChapter, nextChapter, goToChapter]);

  // Cycle font weight
  const cycleFontWeight = () => {
    const currentWeightIdx = FONT_WEIGHTS.findIndex((w) => w.value === fontWeight);
    const nextIdx = (currentWeightIdx + 1) % FONT_WEIGHTS.length;
    setFontWeight(FONT_WEIGHTS[nextIdx].value);
  };

  if (!chapter) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>请从左侧选择一个章节</p>
      </div>
    );
  }

  const summaries = currentNovel
    ? getSummariesByNovel(currentNovel.id).filter((s) => s.chapterId === chapter.id)
    : [];

  const currentWeightLabel = FONT_WEIGHTS.find((w) => w.value === fontWeight)?.label || "正常";

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Top bar */}
      <div className="p-3 md:p-4 border-b flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h2 className="text-base md:text-xl font-semibold truncate">{chapter.title}</h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">
            {chapter.content.length.toLocaleString()} 字
            <span className="mx-1 md:mx-2 text-border">|</span>
            {currentIndex + 1} / {chapters.length}
          </p>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {!summaryOpen && (
            <Button variant={hasSummary ? "secondary" : "ghost"} size="sm" onClick={onToggleSummary}
              className="text-xs h-7">
              <Sparkles className={`h-3.5 w-3.5 mr-0 md:mr-1.5 ${hasSummary ? "text-primary" : ""}`} />
              <span className="hidden md:inline">{hasSummary ? "已分析" : "AI 分析"}</span>
            </Button>
          )}

          {/* Font weight toggle — desktop only */}
          <Button variant="ghost" size="icon" className="h-7 w-7 hidden md:inline-flex"
            onClick={cycleFontWeight} title={`字体粗细: ${currentWeightLabel}`}>
            <Bold className="h-3.5 w-3.5" style={{ opacity: fontWeight / 600 }} />
          </Button>

          {/* Font size controls — desktop only */}
          <div className="hidden md:flex items-center gap-0.5 border-l pl-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={fontSize <= 12}
              onClick={() => setFontSize(Math.max(12, fontSize - 1))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-xs text-muted-foreground w-8 text-center tabular-nums select-none">
              {fontSize}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={fontSize >= 24}
              onClick={() => setFontSize(Math.min(24, fontSize + 1))}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-3xl mx-auto pb-20">
            {summaries.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {summaries.map((s) => (
                  <Badge key={s.id} variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    已总结 · {new Date(s.createdAt).toLocaleString("zh-CN")}
                  </Badge>
                ))}
              </div>
            )}

            <div
              className="prose prose-neutral dark:prose-invert max-w-none"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: 1.8,
                fontWeight,
              }}
            >
              {chapter.content.split("\n").map((paragraph, i) => {
                const trimmed = paragraph.trim();
                if (!trimmed) return <br key={i} />;
                return (
                  <p key={i} className="mb-2 text-justify">
                    {trimmed}
                  </p>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        {/* Bottom navigation bar */}
        <div className="border-t bg-card px-4 py-2.5 flex items-center justify-between shrink-0 md:pb-2.5 pb-16">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevChapter}
            onClick={() => prevChapter && goToChapter(prevChapter.id)}
            className="max-w-[45%]"
          >
            <ChevronLeft className="h-4 w-4 mr-1 shrink-0" />
            <span className="truncate text-xs">
              {prevChapter ? prevChapter.title : "已是第一章"}
            </span>
          </Button>

          <div className="text-xs text-muted-foreground text-center px-2 select-none">
            {currentIndex + 1} / {chapters.length}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={!nextChapter}
            onClick={() => nextChapter && goToChapter(nextChapter.id)}
            className="max-w-[45%]"
          >
            <span className="truncate text-xs">
              {nextChapter ? nextChapter.title : "已是最后一章"}
            </span>
            <ChevronRight className="h-4 w-4 ml-1 shrink-0" />
          </Button>
        </div>
      </div>
    </div>
  );
}

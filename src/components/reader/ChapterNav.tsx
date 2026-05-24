import { useState } from "react";
import { useNovelStore } from "@/stores/novel-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronRight, PanelLeftOpen, PanelLeftClose } from "lucide-react";

const TOGGLE_W = "w-8";
const TOGGLE_H = "h-[85px]"; // matches ChapterContent top bar height

export function ChapterNav() {
  const { currentNovel, selectedChapterId, setSelectedChapter } = useNovelStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!currentNovel) return null;

  if (collapsed) {
    return (
      <div className={`shrink-0 hidden md:flex ${TOGGLE_W}`}>
        <button
          onClick={() => setCollapsed(false)}
          className={`${TOGGLE_H} w-full bg-card border border-l-0 rounded-r-md flex items-center justify-center hover:bg-accent transition-colors group`}
          title="展开目录"
        >
          <PanelLeftOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div className="md:w-56 w-full shrink-0 flex">
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="p-4 border-b shrink-0 flex items-center min-h-[85px]">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{currentNovel.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">共 {currentNovel.chapters.length} 章</p>
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-150px)]">
          <div className="p-1.5">
            {currentNovel.chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChapter(ch.id)}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center gap-1.5",
                  selectedChapterId === ch.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 shrink-0 transition-transform",
                    selectedChapterId === ch.id && "text-primary"
                  )}
                />
                <span className="truncate">{ch.title}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
      {/* Toggle — desktop only, aligns with ChapterContent top bar */}
      <button
        onClick={() => setCollapsed(true)}
        className={`${TOGGLE_H} ${TOGGLE_W} hidden md:flex items-center justify-center bg-card border border-l-0 rounded-r-md hover:bg-accent transition-colors group shrink-0`}
        title="收起目录"
      >
        <PanelLeftClose className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>
    </div>
  );
}

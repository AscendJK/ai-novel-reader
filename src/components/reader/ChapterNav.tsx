import { useState } from "react";
import { useNovelStore } from "@/stores/novel-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronRight, PanelLeftOpen, PanelLeftClose } from "lucide-react";

export function ChapterNav() {
  const { currentNovel, selectedChapterId, setSelectedChapter } = useNovelStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!currentNovel) return null;

  if (collapsed) {
    return (
      <div className="shrink-0 hidden md:flex">
        <button
          onClick={() => setCollapsed(false)}
          className="h-20 w-7 bg-card border border-l-0 rounded-r-md flex items-center justify-center hover:bg-accent transition-colors group self-center"
          title="展开目录"
        >
          <PanelLeftOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div className="md:w-56 w-full md:border-r shrink-0 flex">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-2.5 border-b flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-medium text-xs truncate">{currentNovel.title}</p>
            <p className="text-xs text-muted-foreground">共 {currentNovel.chapters.length} 章</p>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="shrink-0 ml-1 h-6 w-6 md:flex items-center justify-center rounded hover:bg-accent transition-colors hidden"
            title="收起目录"
          >
            <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
        <ScrollArea className="flex-1">
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
    </div>
  );
}

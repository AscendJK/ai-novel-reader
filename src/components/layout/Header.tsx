import { ArrowLeft, Book, Settings, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";

interface HeaderProps {
  inBook: boolean;
  bookTitle?: string;
  onBack: () => void;
  onSettings: () => void;
}

export function Header({ inBook, bookTitle, onBack, onSettings }: HeaderProps) {
  const { theme, toggleTheme } = useUIStore();

  return (
    <header className="border-b bg-card px-4 py-2.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {inBook ? (
          <>
            <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              书架
            </Button>
            <span className="w-px h-5 bg-border mx-1" />
            <Book className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-sm font-semibold truncate max-w-[300px]">{bookTitle}</h1>
          </>
        ) : (
          <>
            <Book className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold">AI 小说精读助手</h1>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
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

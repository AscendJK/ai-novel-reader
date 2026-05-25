import { Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  open: boolean;
  engine: string;
  status: "building" | "queued" | "done" | "error";
  message: string;
  current?: number;
  total?: number;
  error?: string;
  novelId?: string;
  queuePosition?: number;
  onRetry: () => void;
  onFallbackToTFIDF: () => void;
  onDismiss: () => void;
}

export function BuildProgress({ open, engine, status, message, current, total, error, novelId, queuePosition, onRetry, onFallbackToTFIDF, onDismiss }: Props) {
  if (!open) return null;

  const isQueued = status === "queued";
  const pct = total ? Math.round(((current || 0) / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/30">
      <Card className="w-full max-w-md mx-4 relative">
        <button className="absolute top-2 right-2 text-muted-foreground hover:text-foreground" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </button>
        <CardHeader className="text-center">
          {status === "queued" && <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-2" />}
          {status === "building" && <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />}
          {status === "done" && <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />}
          {status === "error" && <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />}
          <CardTitle>
            {status === "queued" ? `排队中 (第 ${queuePosition || "?"} 位)`
              : status === "building" ? "正在构建检索索引"
              : status === "done" ? "索引构建完成" : "索引构建失败"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            引擎: <span className="font-mono">{engine}</span>
          </p>

          {!isQueued && status === "building" && (
            <div className="space-y-2">
              <Progress value={total ? pct : undefined} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {total ? `${current ?? 0} / ${total} · ${pct}%` : "准备中..."}
              </p>
            </div>
          )}
          {isQueued && (
            <p className="text-xs text-muted-foreground">前面还有 {queuePosition ? queuePosition - 1 : "?"} 个任务</p>
          )}

          <p className="text-sm">{message}</p>

          {status === "error" && error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {status === "error" && (
            <div className="flex gap-2 justify-center">
              <Button size="sm" onClick={onRetry}>重试</Button>
              <Button size="sm" variant="outline" onClick={onFallbackToTFIDF}>
                退回 TF-IDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

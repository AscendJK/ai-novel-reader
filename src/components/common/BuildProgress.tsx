import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  open: boolean;
  engine: string;
  status: "building" | "done" | "error";
  message: string;
  current?: number;
  total?: number;
  error?: string;
  novelId?: string;
  onRetry: () => void;
  onFallbackToTFIDF: () => void;
}

export function BuildProgress({ open, engine, status, message, current, total, error, novelId, onRetry, onFallbackToTFIDF }: Props) {
  if (!open) return null;

  const pct = total ? Math.round(((current || 0) / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          {status === "building" && <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />}
          {status === "done" && <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />}
          {status === "error" && <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />}
          <CardTitle>
            {status === "building" ? "正在构建检索索引" : status === "done" ? "索引构建完成" : "索引构建失败"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            引擎: <span className="font-mono">{engine}</span>
          </p>

          {status === "building" && total && (
            <div className="space-y-2">
              <Progress value={pct > 0 ? pct : undefined} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {current ?? 0} / {total} · {pct}%
              </p>
            </div>
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

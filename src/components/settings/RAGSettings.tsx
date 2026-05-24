import { useState, useEffect } from "react";
import { useRAGStore } from "@/stores/rag-store";
import { ENGINES, type EngineId } from "@/rag/engines";
import { isModelCached } from "@/rag/model-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Brain, Check, X, PackageOpen, FolderOpen } from "lucide-react";

export function RAGSettings() {
  const { engine, setEngine } = useRAGStore();
  const [installed, setInstalled] = useState<Partial<Record<EngineId, boolean>>>({});
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => { checkInstalled(); }, []);

  const checkInstalled = async () => {
    const status: Partial<Record<EngineId, boolean>> = {};
    for (const id of ["bge-small-zh", "e5-small"] as EngineId[]) {
      const info = ENGINES[id];
      if (info.modelKey) status[id] = await isModelCached(info.modelKey);
    }
    setInstalled(status);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4" />
          本地检索引擎
        </CardTitle>
        <CardDescription>
          选择 AI 分析时的文本检索后端。切换引擎后，重新打开小说即可生效。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(["tfidf", "bge-small-zh", "e5-small"] as EngineId[]).map((id) => {
          const info = ENGINES[id];
          const isInstalled = id === "tfidf" || installed[id];
          const isActive = engine === id;

          return (
            <div key={id}>
              <div
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                  isActive ? "border-primary bg-primary/5" : "hover:bg-accent"
                } ${!isInstalled ? "opacity-70" : ""}`}
                onClick={() => isInstalled && setEngine(id)}
                title={!isInstalled ? "模型文件未安装，请先放置到 public/models/ 目录" : ""}
              >
                {/* Header row */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium">{info.name}</span>
                    <Badge variant="outline" className="text-xs">{info.size}</Badge>
                    {isActive && <Badge className="text-xs bg-primary">当前</Badge>}
                    {isInstalled ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Badge variant="outline" className="text-xs text-destructive border-destructive/40">未安装</Badge>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-1.5">{info.description}</p>

                {/* Strengths & weaknesses */}
                <div className="grid grid-cols-1 gap-1">
                  {info.strengths.map((s, i) => (
                    <div key={`s-${i}`} className="flex items-start gap-1">
                      <Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-foreground/75">{s}</span>
                    </div>
                  ))}
                  {info.weaknesses.map((w, i) => (
                    <div key={`w-${i}`} className="flex items-start gap-1">
                      <X className="h-3 w-3 text-destructive/60 shrink-0 mt-0.5" />
                      <span className="text-xs text-muted-foreground">{w}</span>
                    </div>
                  ))}
                </div>

                {!isInstalled && (
                  <div className="mt-2 p-2 rounded bg-muted/50 text-xs text-muted-foreground flex items-start gap-1.5">
                    <PackageOpen className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>未安装 — 模型文件需放置在项目的 public/models/ 目录中</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <Separator />

        {/* Expandable model setup guide */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs w-full justify-between"
            onClick={() => setShowHelp(!showHelp)}
          >
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              {showHelp ? "收起安装说明" : "如何安装模型文件？"}
            </span>
          </Button>
          {showHelp && (
            <div className="mt-2 p-3 rounded bg-muted/50 text-xs space-y-3">
              <p className="font-medium">手动安装模型文件：</p>
              <ol className="list-decimal pl-4 space-y-2">
                <li>
                  从 Hugging Face 下载 Xenova 量化版模型文件
                  <ul className="list-disc pl-4 mt-0.5 text-muted-foreground">
                    <li><strong>BGE Small ZH</strong> (3 文件, ~26MB)：<br />
                      <code className="text-xs">huggingface.co/Xenova/bge-small-zh-v1.5</code></li>
                    <li><strong>E5 Small</strong> (3 文件, ~120MB)：<br />
                      <code className="text-xs">huggingface.co/Xenova/multilingual-e5-small</code></li>
                  </ul>
                </li>
                <li>
                  将下载的文件放入项目的 public/models/ 目录：<br />
                  <code className="text-xs block mt-0.5 bg-muted p-1 rounded">
                    public/models/Xenova/bge-small-zh-v1.5/<br />
                    &nbsp;&nbsp;config.json<br />
                    &nbsp;&nbsp;tokenizer.json<br />
                    &nbsp;&nbsp;onnx/model_quantized.onnx
                  </code>
                </li>
                <li>
                  刷新此页面，已安装的模型旁会显示绿色 ✓ 图标
                </li>
              </ol>
              <p className="text-muted-foreground">
                模型文件仅需安装一次，之后可完全离线使用。更新模型时替换对应文件即可。
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          推荐中文小说使用 BGE Small 中文专精。无网络环境或未安装模型时，默认使用 TF-IDF。
        </p>
      </CardContent>
    </Card>
  );
}

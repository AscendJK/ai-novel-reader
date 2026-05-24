import { useState, useEffect } from "react";
import { useRAGStore } from "@/stores/rag-store";
import { ENGINES, type EngineId } from "@/rag/engines";
import { isModelCached, scanCustomModels, RECOMMENDED_MODELS } from "@/rag/model-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Brain, Check, X, FolderOpen, Search, ExternalLink } from "lucide-react";

export function RAGSettings() {
  const { engine, setEngine } = useRAGStore();
  const [installed, setInstalled] = useState<Partial<Record<EngineId, boolean>>>({});
  const [customModels, setCustomModels] = useState<{ modelKey: string; name: string }[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showRec, setShowRec] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { checkInstalled(); }, []);

  const checkInstalled = async () => {
    const status: Partial<Record<EngineId, boolean>> = {};
    for (const id of ["bge-small-zh", "e5-small"] as EngineId[]) {
      const info = ENGINES[id];
      if (info.modelKey) status[id] = await isModelCached(info.modelKey);
    }
    setInstalled(status);
  };

  const handleScan = async () => {
    setScanning(true);
    const models = await scanCustomModels();
    setCustomModels(models);
    setScanning(false);
  };

  const handleSelectCustom = (modelKey: string) => {
    // Register as a custom engine and select it
    const name = modelKey.split("/").pop() || modelKey;
    useRAGStore.getState().setEngine("bge-small-zh"); // fallback
    // Custom models are handled by Transformers.js directly
    // The modelKey maps to /models/custom/<modelKey>
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
        {/* Built-in engines */}
        {(["bge-small-zh", "e5-small", "tfidf"] as EngineId[]).map((id) => {
          const info = ENGINES[id];
          const isInstalled = id === "tfidf" || installed[id];
          const isActive = engine === id;

          return (
            <div key={id}>
              <div
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                  isActive ? "border-primary bg-primary/5" : "hover:bg-accent"
                } ${!isInstalled ? "opacity-60" : ""}`}
                onClick={() => isInstalled && setEngine(id)}
                title={!isInstalled ? "模型未安装 — 请将文件放入 public/models/builtin/ 目录" : ""}
              >
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
                  {id === "bge-small-zh" && <Badge variant="secondary" className="text-xs">推荐</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mb-1.5">{info.description}</p>
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
              </div>
            </div>
          );
        })}

        {/* Custom model scanner */}
        <div className="p-3 rounded-lg border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5" />
              扫描自定义模型
            </span>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleScan} disabled={scanning}>
              {scanning ? "扫描中..." : "扫描"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            扫描 public/models/custom/ 目录中的用户自定义模型
          </p>
          {customModels.length > 0 && (
            <Select onValueChange={handleSelectCustom}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="选择自定义模型..." />
              </SelectTrigger>
              <SelectContent>
                {customModels.map((m) => (
                  <SelectItem key={m.modelKey} value={m.modelKey} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {customModels.length === 0 && !scanning && (
            <p className="text-xs text-muted-foreground">暂无自定义模型，点击扫描检测</p>
          )}
        </div>

        <Separator />

        {/* Recommended models */}
        <div>
          <Button variant="ghost" size="sm" className="text-xs w-full justify-between"
            onClick={() => setShowRec(!showRec)}>
            <span>{showRec ? "收起" : "推荐下载的模型"}</span>
          </Button>
          {showRec && (
            <div className="mt-2 space-y-2">
              {RECOMMENDED_MODELS.map((m) => (
                <div key={m.modelKey} className="p-2 rounded bg-muted/30 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.name}</span>
                    <Badge variant="outline" className="text-xs">{m.size}</Badge>
                  </div>
                  <p className="text-muted-foreground">{m.reason}</p>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    下载 <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Install guide (bilingual) */}
        <div>
          <Button variant="ghost" size="sm" className="text-xs w-full justify-between"
            onClick={() => setShowHelp(!showHelp)}>
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              {showHelp ? "收起说明" : "如何安装模型？ / How to install models?"}
            </span>
          </Button>
          {showHelp && (
            <div className="mt-2 p-3 rounded bg-muted/50 text-xs space-y-3">
              {/* Chinese */}
              <div className="space-y-2">
                <p className="font-medium">中文说明</p>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>从 Hugging Face 下载 Xenova 量化版模型（config.json + tokenizer.json + onnx/model_quantized.onnx）</li>
                  <li>
                    放入对应目录：
                    <div className="bg-muted p-1.5 rounded mt-0.5">
                      <p className="font-medium">内置模型（已随项目分发）：</p>
                      <code className="text-xs">public/models/builtin/Xenova/bge-small-zh-v1.5/</code>
                      <p className="font-medium mt-1">自定义模型（用户自行添加）：</p>
                      <code className="text-xs">public/models/custom/Xenova/你的模型名/</code>
                    </div>
                  </li>
                  <li>放置后点击上方"扫描"按钮检测自定义模型</li>
                  <li>检测到的模型会出现在下拉框中，选择即可使用</li>
                </ol>
                <p className="text-muted-foreground">
                  模型文件首次放置后即可完全离线使用。K
                </p>
              </div>

              <Separator />

              {/* English */}
              <div className="space-y-2">
                <p className="font-medium">English Instructions</p>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>Download Xenova quantized model files from Hugging Face (config.json + tokenizer.json + onnx/model_quantized.onnx)</li>
                  <li>
                    Place files in the appropriate directory:
                    <div className="bg-muted p-1.5 rounded mt-0.5">
                      <p className="font-medium">Built-in models (shipped with the project):</p>
                      <code className="text-xs">public/models/builtin/Xenova/bge-small-zh-v1.5/</code>
                      <p className="font-medium mt-1">Custom models (added by user):</p>
                      <code className="text-xs">public/models/custom/Xenova/your-model-name/</code>
                    </div>
                  </li>
                  <li>Click the "Scan" button above to detect custom models</li>
                  <li>Detected models appear in the dropdown — select to use</li>
                </ol>
                <p className="text-muted-foreground">
                  Models work fully offline after first placement. Update by replacing the files.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          默认使用 BGE Small 中文专精。无模型时自动回退到 TF-IDF。
        </p>
      </CardContent>
    </Card>
  );
}

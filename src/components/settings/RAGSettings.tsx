import { useState, useEffect, useRef } from "react";
import { useRAGStore } from "@/stores/rag-store";
import { useUIStore } from "@/stores/ui-store";
import { ENGINES, getEngineDisplayName } from "@/rag/engines";
import { scanCustomModels, getBuiltinBGEStatus, RECOMMENDED_MODELS } from "@/rag/model-loader";
import type { ModelEntry, ModelStatus } from "@/rag/model-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, Brain, Check, X, FolderOpen, Search, ExternalLink,
  AlertTriangle, Cpu, Zap, RefreshCw, PackageOpen, Star,
} from "lucide-react";

export function RAGSettings() {
  const { engine, setEngine, savedCustomModels, setSavedCustomModels } = useRAGStore();
  const [customModels, setCustomModels] = useState<ModelEntry[]>([]);
  const [isMobile] = useState(() => window.innerWidth < 768);

  // Restore previously scanned models from store on mount
  useEffect(() => {
    if (savedCustomModels.length > 0 && customModels.length === 0) {
      let cancelled = false;
      scanCustomModels().then((fresh) => {
        if (cancelled) return;
        if (fresh.length > 0) {
          setCustomModels(fresh);
          setSavedCustomModels(fresh.map((m) => ({ key: m.modelKey, name: m.name, size: m.size })));
        }
      });
      return () => { cancelled = true; };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showHelp, setShowHelp] = useState(false);
  const [showRec, setShowRec] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [bgeStatus, setBgeStatus] = useState<ModelStatus>({ available: false, onnxFiles: [] });
  const loadedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    getBuiltinBGEStatus().then((s) => { if (!cancelled) setBgeStatus(s); });
    return () => { cancelled = true; };
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setScanMessage(null);
    const models = await scanCustomModels();
    if (!mountedRef.current) return;
    setCustomModels(models);
    if (models.length > 0) {
      setSavedCustomModels(models.map((m) => ({ key: m.modelKey, name: m.name, size: m.size })));
    }
    const s = await getBuiltinBGEStatus();
    if (!mountedRef.current) return;
    setBgeStatus(s);
    setScanning(false);
    setScanMessage(models.length > 0 ? `发现 ${models.length} 个自定义模型` : "未发现自定义模型");
  };

  const bgeInstalled = bgeStatus.available;
  const bgeWarning = bgeStatus.renameWarning;

  const availableModels: {
    key: string;
    name: string;
    size: string;
    source: "builtin" | "custom";
    detail?: string;
    onnxFiles?: string[];
    renameWarning?: string;
  }[] = [
    {
      key: "tfidf",
      name: "TF-IDF",
      size: "0MB",
      source: "builtin",
      detail: "内置字符级检索，即时可用",
    },
    {
      key: "bge-small-zh",
      name: "BGE Small ZH",
      size: "26MB",
      source: "builtin",
      detail: ENGINES["bge-small-zh"]?.description || "",
      onnxFiles: bgeStatus.onnxFiles,
      renameWarning: bgeWarning || undefined,
    },
    ...customModels.map((m) => ({
      key: m.modelKey,
      name: m.name,
      size: m.size,
      source: "custom" as const,
      detail: ENGINES[m.modelKey]?.description || "用户自定义模型",
      onnxFiles: m.onnxFiles,
      renameWarning: m.renameWarning,
    })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4" />
          本地检索引擎
        </CardTitle>
        <CardDescription>
          选择文本检索后端。支持任意 Transformers.js 兼容的 ONNX 嵌入模型。切换后重新打开小说生效。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Available models — card grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" />
              可用引擎
            </h4>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleScan} disabled={scanning}>
                {scanning ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
                扫描
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            {availableModels.map((m) => {
              const isActive = engine === m.key;
              const isBuiltinInstalled = m.source === "builtin" && (m.key === "tfidf" || bgeInstalled);
              const info = ENGINES[m.key];
              return (
                <div key={m.key}>
                  <div
                    className={`p-2.5 rounded-lg border cursor-pointer transition-colors group ${
                      isActive
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50 hover:bg-accent/50"
                    }`}
                    onClick={() => setEngine(m.key, m.source === "custom" ? m.name : undefined, m.source === "custom" ? m.size : undefined)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium">{m.name}</span>
                        <Badge variant="outline" className="text-xs">{m.size}</Badge>
                        <Badge variant="secondary" className="text-xs">{m.source === "builtin" ? "内置" : "自定义"}</Badge>
                        {isActive && <Badge className="text-xs bg-primary">当前</Badge>}
                        {m.source === "builtin" && m.key === "bge-small-zh" && (
                          <Star className="h-3 w-3 text-amber-500" aria-label="推荐" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {m.renameWarning ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="文件存在，名称不匹配" />
                        ) : isBuiltinInstalled ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" aria-label="模型可用" />
                        ) : m.source === "custom" ? (
                            <Zap className="h-4 w-4 text-blue-500" aria-label="已检测到" />
                        ) : (
                            <PackageOpen className="h-4 w-4 text-muted-foreground/40" aria-label="未安装" />
                        )}
                      </div>
                    </div>

                    {/* Expandable detail on hover */}
                    {m.detail && (
                      <div className="mt-1.5 pt-1.5 border-t border-border/50 hidden group-hover:block">
                        <p className="text-xs text-muted-foreground">{m.detail}</p>

                        {m.renameWarning && (
                          <div className="mt-1 p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-xs space-y-1">
                            <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                              {m.renameWarning}
                            </p>
                            <p className="text-muted-foreground">
                              当前文件：
                              <code className="ml-1 px-1 rounded bg-muted">{m.onnxFiles?.[0]}</code>
                            </p>
                            <p className="text-muted-foreground">
                              需改名为：
                              <code className="ml-1 px-1 rounded bg-muted font-medium text-foreground">model_quantized.onnx</code>
                              <button
                                className="ml-1.5 text-primary hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText("model_quantized.onnx");
                                }}
                              >
                                复制
                              </button>
                            </p>
                          </div>
                        )}

                        {m.source === "builtin" && m.key === "bge-small-zh" && !bgeInstalled && (
                          <p className="text-xs text-destructive mt-0.5">
                            模型文件未找到。请将文件放入 public/models/builtin/Xenova/bge-small-zh-v1.5/
                          </p>
                        )}

                        {info && !m.renameWarning && (
                          <div className="mt-1.5 grid grid-cols-1 gap-0.5">
                            {info.strengths.map((s, i) => (
                              <div key={i} className="flex items-start gap-1">
                                <Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                                <span className="text-xs text-foreground/75">{s}</span>
                              </div>
                            ))}
                            {info.weaknesses.map((w, i) => (
                              <div key={i} className="flex items-start gap-1">
                                <X className="h-3 w-3 text-destructive/60 shrink-0 mt-0.5" />
                                <span className="text-xs text-muted-foreground">{w}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {scanMessage && (
              <p className={`text-xs py-1.5 text-center ${customModels.length === 0 ? "text-muted-foreground" : "text-green-600 dark:text-green-400"}`}>
                {scanMessage}
              </p>
            )}
            {!scanMessage && !scanning && (
              <p className="text-xs text-muted-foreground py-2 text-center">
                点击"扫描"检测 public/models/custom/ 中的自定义模型
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Recommended models */}
        <div>
          <Button
            variant="ghost" size="sm" className="text-xs w-full justify-between"
            onClick={() => setShowRec(!showRec)}
          >
            <span className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" />
              {showRec ? "收起推荐" : "推荐模型（点击下载）"}
            </span>
          </Button>
          {showRec && (
            <div className="mt-2 space-y-2">
              {RECOMMENDED_MODELS.map((m) => {
                const isBuiltIn = m.modelKey === "Xenova/bge-small-zh-v1.5";
                return (
                  <div key={m.modelKey} className="p-2.5 rounded border text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{m.name}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-xs">{m.size}</Badge>
                        {isBuiltIn && <Badge variant="secondary" className="text-xs">内置</Badge>}
                      </div>
                    </div>
                    <p className="text-muted-foreground">{m.reason}</p>
                    {!isBuiltIn && (
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        在 Hugging Face 下载 <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Install guide */}
        <div>
          <Button
            variant="ghost" size="sm" className="text-xs w-full justify-between"
            onClick={() => setShowHelp(!showHelp)}
          >
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              {showHelp ? "收起说明" : "如何安装自定义模型？"}
            </span>
          </Button>
          {showHelp && (
            <div className="mt-2 p-3 rounded bg-muted/50 text-xs space-y-3">
              <div className="space-y-2">
                <p className="font-medium">安装步骤</p>

                <p className="font-medium text-foreground/80">第一步：下载 4 个文件</p>
                <p>从 Xenova 转换版页面下载（见上方推荐列表的链接）：</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                  <li><code className="px-1 bg-muted rounded text-xs">config.json</code></li>
                  <li><code className="px-1 bg-muted rounded text-xs">tokenizer.json</code></li>
                  <li><code className="px-1 bg-muted rounded text-xs">tokenizer_config.json</code></li>
                  <li><code className="px-1 bg-muted rounded text-xs">onnx/model_quantized.onnx</code></li>
                </ol>
                <p className="text-muted-foreground">必须从 <strong>Xenova</strong> 页面下载（<code className="px-1 bg-muted rounded text-xs">huggingface.co/Xenova/模型名</code>），不是原版页面。</p>

                <p className="font-medium text-foreground/80 mt-2">第二步：放到正确位置</p>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{`public/models/custom/Xenova/你的模型名/
  ├── config.json
  ├── tokenizer.json
  ├── tokenizer_config.json
  └── onnx/
      └── model_quantized.onnx`}</pre>
                <p className="text-muted-foreground">4 个文件必须按此目录结构放置，ONNX 文件必须在 <code className="px-1 bg-muted rounded text-xs">onnx/</code> 子文件夹中。</p>

                <p className="font-medium text-foreground/80 mt-2">第三步：扫描使用</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                  <li>重启 dev server（<code className="px-1 bg-muted rounded text-xs">Ctrl+C</code> 后重新 <code className="px-1 bg-muted rounded text-xs">npm run dev</code>）</li>
                  <li>打开设置页 → 点击"扫描"按钮</li>
                  <li>发现模型后点击卡片即可选用</li>
                  <li>首次使用某引擎打开小说时，会自动构建索引</li>
                </ol>

                <p className="text-muted-foreground mt-2">
                  <strong>兼容模型：</strong>所有 Transformers.js 兼容的 ONNX 嵌入模型均可使用，包括 BGE、E5、MiniLM、GTE 等系列。
                </p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Engine behavior info */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground/80">切换引擎后的行为</p>
          <div className="space-y-1">
            <p>• 引擎选择会自动保存，关闭浏览器后依然生效</p>
            <p>• 切换引擎<strong>无需刷新页面</strong>，下次打开小说时自动使用新引擎</p>
            <p>• 切换引擎后已有分析结果<strong>不会清除</strong>，仅影响后续新生成的分析</p>
            <p>• 向量索引按需重建：首次使用新引擎打开小说时，会自动用新引擎重建索引</p>
            <p>• 无可用模型时自动回退到 TF-IDF</p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">索引缓存上限</p>
            <p className="text-xs text-muted-foreground">{useRAGStore.getState().cacheSizeMB}MB，超过自动淘汰旧索引</p>
          </div>
          <select
            className="text-xs border rounded px-2 py-1 bg-background"
            value={useRAGStore.getState().cacheSizeMB}
            onChange={(e) => useRAGStore.getState().setCacheSizeMB(parseInt(e.target.value))}
          >
            {[100, 200, 300, 400, 500].map((mb) => (
              <option key={mb} value={mb}>{mb} MB</option>
            ))}
          </select>
        </div>

        {!isMobile && (
          <>
            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">调试模式</p>
                <p className="text-xs text-muted-foreground">开启后在右下角显示 RAG 检索详情面板</p>
              </div>
              <Button
                variant={useUIStore.getState().debugMode ? "default" : "outline"}
                size="sm"
                onClick={() => useUIStore.getState().setDebugMode(!useUIStore.getState().debugMode)}
              >
                {useUIStore.getState().debugMode ? "已开启" : "已关闭"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

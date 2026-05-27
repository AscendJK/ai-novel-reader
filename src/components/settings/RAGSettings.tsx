import { useState, useEffect, useRef } from "react";
import { useRAGStore, type TopKTier } from "@/stores/rag-store";
import { useUIStore } from "@/stores/ui-store";
import { ENGINES, getEngineDisplayName } from "@/rag/engines";
import { scanCustomModels, getBuiltinBGEStatus, getBuiltinGTEStatus, DOWNLOADABLE_MODELS } from "@/rag/model-loader";
import type { ScannedModel, ModelStatus } from "@/rag/model-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, Brain, Check, X, Search, ExternalLink,
  AlertTriangle, Cpu, Zap, RefreshCw, PackageOpen, Star, FolderOpen, RotateCcw,
} from "lucide-react";

export function RAGSettings() {
  const { engine, setEngine, topKDefault, topKTiers, setTopKDefault, setTopKTiers, resetTopKConfig, getTopK } = useRAGStore();
  const [isMobile] = useState(() => window.innerWidth < 768);
  const [showHelp, setShowHelp] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [bgeStatus, setBgeStatus] = useState<ModelStatus>({ available: false, onnxFiles: [] });
  const [gteStatus, setGteStatus] = useState<ModelStatus>({ available: false, onnxFiles: [] });
  const [scannedModels, setScannedModels] = useState<ScannedModel[]>([]);
  const loadedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Load builtin status on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    getBuiltinBGEStatus().then((s) => { if (!cancelled) setBgeStatus(s); });
    getBuiltinGTEStatus().then((s) => { if (!cancelled) setGteStatus(s); });
    // Auto-scan on mount
    scanCustomModels().then((m) => { if (!cancelled) setScannedModels(m); });
    return () => { cancelled = true; };
  }, []);

  const handleScan = async () => {
    setScanning(true);
    const [bge, gte, models] = await Promise.all([
      getBuiltinBGEStatus(),
      getBuiltinGTEStatus(),
      scanCustomModels(),
    ]);
    if (!mountedRef.current) return;
    setBgeStatus(bge);
    setGteStatus(gte);
    setScannedModels(models);
    setScanning(false);
  };

  const bgeInstalled = bgeStatus.available;
  const gteInstalled = gteStatus.available;

  const builtinModels = [
    {
      key: "tfidf", name: "TF-IDF", size: "0MB",
      detail: "内置字符级检索，即时可用",
      installed: true, modelType: undefined as string | undefined, typeWarning: undefined as string | undefined,
    },
    {
      key: "bge-small-zh", name: "BGE Small ZH", size: "26MB",
      detail: ENGINES["bge-small-zh"]?.description || "",
      installed: bgeInstalled, modelType: bgeStatus.modelType, typeWarning: bgeStatus.typeWarning,
    },
    {
      key: "gte-small", name: "GTE Small", size: "34MB",
      detail: ENGINES["gte-small"]?.description || "",
      installed: gteInstalled, modelType: gteStatus.modelType, typeWarning: gteStatus.typeWarning,
    },
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
        {/* Built-in engines */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Cpu className="h-3.5 w-3.5" />
            内置引擎
          </h4>
          <div className="space-y-1.5">
            {builtinModels.map((m) => {
              const isActive = engine === m.key;
              return (
                <div
                  key={m.key}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isActive ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-accent/50"
                  }`}
                  onClick={() => setEngine(m.key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium">{m.name}</span>
                      <Badge variant="outline" className="text-xs">{m.size}</Badge>
                      {m.modelType && <Badge variant="outline" className="text-xs font-mono">{m.modelType}</Badge>}
                      {isActive && <Badge className="text-xs bg-primary">当前</Badge>}
                      {(m.key === "bge-small-zh" || m.key === "gte-small") && (
                        <Star className="h-3 w-3 text-amber-500" aria-label="推荐" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {m.typeWarning ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : m.installed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <PackageOpen className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{m.detail}</p>
                  {!m.installed && m.key !== "tfidf" && (
                    <p className="text-xs text-destructive mt-0.5">
                      模型文件未找到
                    </p>
                  )}
                  {m.typeWarning && (
                    <p className="text-xs text-amber-600 mt-0.5">{m.typeWarning}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Downloadable recommended models */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5" />
              扩展引擎（需下载）
            </h4>
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleScan} disabled={scanning}>
              {scanning ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Search className="h-3 w-3 mr-1" />}
              检测
            </Button>
          </div>

          <div className="space-y-2">
            {(scannedModels.length > 0 ? scannedModels : DOWNLOADABLE_MODELS.map(m => ({ ...m, fileStatus: { config: false, tokenizer: false, tokenizerConfig: false, onnx: false, complete: false } }))).map((m) => {
              const isActive = engine === m.modelKey;
              const fs = m.fileStatus;
              const files = [
                { name: "config.json", ok: fs.config },
                { name: "tokenizer.json", ok: fs.tokenizer },
                { name: "tokenizer_config.json", ok: fs.tokenizerConfig },
                { name: "onnx/model_quantized.onnx", ok: fs.onnx },
              ];

              return (
                <div
                  key={m.modelKey}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    fs.complete
                      ? "cursor-pointer " + (isActive ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-accent/50")
                      : "opacity-70"
                  }`}
                  onClick={() => fs.complete && setEngine(m.modelKey)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium">{m.name}</span>
                      <Badge variant="outline" className="text-xs">{m.size}</Badge>
                      {m.fileStatus?.modelType && <Badge variant="outline" className="text-xs font-mono">{m.fileStatus.modelType}</Badge>}
                      {isActive && <Badge className="text-xs bg-primary">当前</Badge>}
                      {fs.complete && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                    </div>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      下载 <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">{m.description}</p>

                  {/* File path */}
                  <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                    public/models/custom/{m.modelKey}/
                  </p>

                  {/* File status */}
                  <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {files.map(f => (
                      <div key={f.name} className="flex items-center gap-1 text-xs">
                        {f.ok ? (
                          <Check className="h-3 w-3 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-3 w-3 text-destructive/60 shrink-0" />
                        )}
                        <span className={f.ok ? "text-foreground/75" : "text-muted-foreground"}>
                          {f.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  {fs.typeWarning && (
                    <p className="text-xs text-amber-600 mt-1">{fs.typeWarning}</p>
                  )}

                  {!fs.complete && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      下载 4 个文件放入上方目录后，点击"检测"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
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
                <p>从 Xenova 转换版页面下载（点击上方模型卡片的"下载"链接）：</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                  <li><code className="px-1 bg-muted rounded text-xs">config.json</code></li>
                  <li><code className="px-1 bg-muted rounded text-xs">tokenizer.json</code></li>
                  <li><code className="px-1 bg-muted rounded text-xs">tokenizer_config.json</code></li>
                  <li><code className="px-1 bg-muted rounded text-xs">onnx/model_quantized.onnx</code></li>
                </ol>
                <p className="text-muted-foreground">必须从 <strong>Xenova</strong> 页面下载（<code className="px-1 bg-muted rounded text-xs">huggingface.co/Xenova/模型名</code>），不是原版页面。</p>

                <p className="font-medium text-foreground/80 mt-2">第二步：放到正确位置</p>
                <p className="text-muted-foreground">每个模型卡片下方显示了对应的文件路径，将 4 个文件按目录结构放入即可。</p>

                <p className="font-medium text-foreground/80 mt-2">第三步：检测使用</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                  <li>点击"检测"按钮验证文件</li>
                  <li>4 个文件全部显示 ✓ 后，点击卡片即可选用</li>
                  <li>首次使用某引擎打开小说时，会自动构建索引</li>
                </ol>
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
            id="rag-cache-size" name="rag-cache-size"
            className="text-xs border rounded px-2 py-1 bg-background"
            value={useRAGStore.getState().cacheSizeMB}
            onChange={(e) => useRAGStore.getState().setCacheSizeMB(parseInt(e.target.value))}
          >
            {[100, 200, 300, 400, 500].map((mb) => (
              <option key={mb} value={mb}>{mb} MB</option>
            ))}
          </select>
        </div>

        <Separator className="my-4" />

        {/* TopK configuration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">RAG 检索数量 (TopK)</p>
              <p className="text-xs text-muted-foreground">
                全书分析时检索的相关段落数量，根据书籍大小自动调整
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetTopKConfig}>
              <RotateCcw className="h-3 w-3 mr-1" /> 恢复默认
            </Button>
          </div>

          {/* Default topK */}
          <div className="flex items-center gap-3">
            <label htmlFor="topk-default" className="text-xs text-muted-foreground shrink-0">默认值</label>
            <Input
              id="topk-default" name="topk-default"
              type="number" min={1} max={200}
              className="h-7 w-20 text-xs"
              value={topKDefault}
              onChange={(e) => setTopKDefault(parseInt(e.target.value) || 30)}
            />
          </div>

          {/* Tier table */}
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-1.5 font-medium">Chunk 数量上限</th>
                  <th className="text-left px-3 py-1.5 font-medium">对应 TopK</th>
                  <th className="text-left px-3 py-1.5 font-medium">适用场景</th>
                </tr>
              </thead>
              <tbody>
                {topKTiers.map((tier, i) => {
                  const label = tier.maxChunks <= 200 ? "短篇"
                    : tier.maxChunks <= 1000 ? "中篇"
                    : tier.maxChunks <= 5000 ? "长篇"
                    : "超长篇";
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5">
                        <Input
                          id={`topk-tier-max-${i}`} name={`topk-tier-max-${i}`}
                          type="number" min={1}
                          className="h-6 w-20 text-xs"
                          value={tier.maxChunks === Infinity ? "" : tier.maxChunks}
                          placeholder="无上限"
                          onChange={(e) => {
                            const val = e.target.value === "" ? Infinity : parseInt(e.target.value) || 1;
                            const next = [...topKTiers];
                            next[i] = { ...tier, maxChunks: val };
                            setTopKTiers(next);
                          }}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          id={`topk-tier-val-${i}`} name={`topk-tier-val-${i}`}
                          type="number" min={1} max={200}
                          className="h-6 w-20 text-xs"
                          value={tier.topK}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(200, parseInt(e.target.value) || 1));
                            const next = [...topKTiers];
                            next[i] = { ...tier, topK: val };
                            setTopKTiers(next);
                          }}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Preview */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
            <span className="font-medium text-foreground/70">预览：</span>
            100 chunks → {getTopK(100)}，
            500 chunks → {getTopK(500)}，
            2000 chunks → {getTopK(2000)}，
            6000 chunks → {getTopK(6000)}
          </div>

          {/* Recommendations and warnings */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/70">推荐值</p>
            <p>短篇（10万字以下）：15-20 | 中篇（10-50万字）：25-40 | 长篇（50-200万字）：40-60 | 超长篇（200万字以上）：60-100</p>
            {topKTiers.some((t) => t.topK > 100) && (
              <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-medium">TopK 过大可能导致：</p>
                  <p>- 超出模型上下文限制，导致请求失败</p>
                  <p>- AI 回答质量下降（信息过多反而干扰判断）</p>
                  <p>- API 调用成本增加</p>
                  <p>建议从默认值开始，根据分析质量逐步调高。</p>
                </div>
              </div>
            )}
          </div>
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

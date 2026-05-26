import { useCallback, useRef, useState, useEffect } from "react";
import { Upload, BookOpen, FolderOpen, Clock, ChevronRight, FileText, Trash2, Search, Loader2 } from "lucide-react";
import { useFileParser } from "@/hooks/useFileParser";
import { useNovelStore, getLastOpenedTimes } from "@/stores/novel-store";
import { loadAllNovelMeta, deleteNovel, loadNovel } from "@/db/repositories";
import { db } from "@/db/database";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCharCount } from "@/lib/text-utils";
import { useBuildStore } from "@/stores/build-store";
import { useRAGStore } from "@/stores/rag-store";
import { getEngineDisplayName } from "@/rag/engines";
import { authHeaders } from "@/lib/auth-headers";
import type { NovelMeta } from "@/parsers/types";

export function BookSelect() {
  const { parseFile, isParsing, progress } = useFileParser();
  const { setCurrentNovel, readingPositions, addNovel } = useNovelStore();
  const [savedNovels, setSavedNovels] = useState<NovelMeta[]>([]);
  const [serverNovels, setServerNovels] = useState<NovelMeta[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const buildPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [batchParsing, setBatchParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup build polling on unmount
  useEffect(() => {
    return () => { if (buildPollRef.current) clearInterval(buildPollRef.current); };
  }, []);

  useEffect(() => {
    loadAllNovelMeta().then((novels) => {
      const lastOpened = getLastOpenedTimes();
      novels.sort((a, b) => (lastOpened[b.id] || 0) - (lastOpened[a.id] || 0));
      setSavedNovels(novels);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [serverScanned, setServerScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const engine = useRAGStore((s) => s.engine);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [buildStatuses, setBuildStatuses] = useState<Record<string, any>>({});

  // Poll build statuses for bookshelf novels + check IndexedDB cache
  useEffect(() => {
    if (engine === "tfidf") { setBuildStatuses({}); return; }
    const ids = savedNovels.map((n) => n.id);
    // Check which indices are cached in IndexedDB
    ids.forEach(async (nid) => {
      try {
        const c = await db.ragCache.get(nid + "-" + engine);
        if (c?.vectors?.length) {
          if (!(window as any).__ragCacheLoaded) (window as any).__ragCacheLoaded = new Set<string>();
          (window as any).__ragCacheLoaded.add(nid + "-" + engine);
        }
      } catch { /* ignore */ }
    });
    if (!ids.length) return;
    let active = true;
    const poll = async () => {
      try {
        // Skip if not authenticated
        if (!localStorage.getItem("sync-token")) return;
        const resp = await fetch(`/api/rag/statuses?ids=${ids.join(",")}&engine=${encodeURIComponent(engine)}`, { headers: authHeaders() });
        if (!active || !resp.ok) return;
        const statuses = await resp.json();
        setBuildStatuses(statuses);
        const cur = buildingId ? statuses[buildingId] : null;
        if (cur && (cur.status === "ready" || cur.status === "error")) {
          setBuildingId(null);
        }
      } catch { /* server unreachable */ }
    };
    poll();
    const timer = setInterval(poll, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [savedNovels, buildingId, authHeaders, engine]);

  const handleBuild = async (novelId: string) => {
    // Clear any existing poll before starting a new one
    if (buildPollRef.current) { clearInterval(buildPollRef.current); buildPollRef.current = null; }
    setBuildingId(novelId);
    useBuildStore.getState().start();
    const resp = await fetch(`/api/rag/${novelId}/build`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ engine }),
    });
    const result = await resp.json();
    if (result.status === "busy") {
      alert("服务器繁忙，当前排队已满。请稍后再试。");
      useBuildStore.getState().dismiss();
      setBuildingId(null);
      return;
    }
    useBuildStore.getState().setProgress({
      message: result.status === "queued" ? `排队中 (第 ${result.queuePosition} 位)...` : "服务器构建中...",
      novelId, engine,
      status: result.status === "queued" ? "queued" : "building",
      queuePosition: result.queuePosition,
    } as any);
    const bs = useBuildStore.getState();
    buildPollRef.current = setInterval(async () => {
      try {
        const sr = await fetch(`/api/rag/${novelId}/status?engine=${encodeURIComponent(engine)}`, { headers: authHeaders() });
        const st = await sr.json();
        if (st.status === "ready") {
          bs.finish(); if (buildPollRef.current) { clearInterval(buildPollRef.current); buildPollRef.current = null; }
          setBuildingId(null); setBuildStatuses((prev: any) => ({ ...prev, [novelId]: st }));
        } else if (st.status === "error") {
          bs.fail(st.error || "失败"); if (buildPollRef.current) { clearInterval(buildPollRef.current); buildPollRef.current = null; }
          setBuildingId(null);
        } else if (st.status === "queued") {
          bs.setProgress({ status: "queued", queuePosition: st.queuePosition || "?", message: `排队中 (第 ${st.queuePosition || "?"} 位)...`, novelId, engine } as any);
        } else {
          const msg = st.status === "loading" ? "正在加载模型..." : `正在编码 (${st.current ?? 0}/${st.total ?? "?"})`;
          bs.setProgress({ status: "building", message: msg, current: st.current || 0, total: st.total || 0, novelId, engine });
        }
      } catch { /* keep polling */ }
    }, 3000);
  };

  // Scan server novel library on demand
  const scanServer = async () => {
    setScanning(true);
    try {
      const username = localStorage.getItem("sync-username");
      const url = username ? `/api/novels?username=${encodeURIComponent(username)}` : "/api/novels";
      const r = await fetch(url, { headers: authHeaders() });
      const list = await r.json();
      setServerNovels(list.map((n: any) => ({
        id: n.id, title: n.title, author: n.author,
        fileName: n.fileName, fileFormat: n.fileFormat,
        totalChars: n.totalChars, chapterCount: n.chapterCount,
        createdAt: n.createdAt, updatedAt: n.updatedAt,
        joined: n.joined,
      } as any)));
      setServerScanned(true);
    } catch { /* server unreachable */ }
    finally { setScanning(false); }
  };

  // Join a server novel (download chapters + register on server)
  const handleJoinNovel = async (novel: any) => {
    setJoiningId(novel.id);
    const username = localStorage.getItem("sync-username");
    try {
      const chResp = await fetch(`/api/novels/${novel.id}/chapters`, { headers: authHeaders() });
      const chapters = await chResp.json();
      await db.transaction("rw", db.novels, db.chapters, async () => {
        await db.novels.put({
          id: novel.id, title: novel.title, author: novel.author,
          fileName: novel.fileName, fileFormat: novel.fileFormat,
          totalChars: novel.totalChars, chapterCount: chapters.length,
          createdAt: novel.createdAt, updatedAt: Date.now(),
        });
        for (const ch of chapters) {
          await db.chapters.put({
            id: ch.id, novelId: novel.id, index: ch.index,
            title: ch.title, content: ch.content,
            startOffset: ch.startOffset ?? 0, endOffset: ch.endOffset ?? (ch.content?.length ?? 0),
          });
        }
      });
      addNovel({ ...novel, chapters, chapterCount: chapters.length });
      fetch(`/api/novels/${novel.id}/join`, {
        method: "POST", headers: authHeaders(),
      }).catch(() => {});
      setSavedNovels((prev) => [{ ...novel, chapterCount: chapters.length }, ...prev]);
      setServerNovels((prev) => prev.map((n) => n.id === novel.id ? { ...n, joined: true } : n));
    } catch (e) { console.error("join failed:", e); }
    finally { setJoiningId(null); }
  };

  const processFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter(
        (f) => f.name.endsWith(".txt") || f.name.endsWith(".epub")
      );
      if (valid.length === 0) {
        setError("所选文件夹中未找到 .txt 或 .epub 文件");
        return;
      }
      setError(null);
      for (const file of valid) {
        const novel = await parseFile(file);
        if (novel) {
          const meta: NovelMeta = {
            id: novel.id, title: novel.title, author: novel.author,
            fileName: novel.fileName, fileFormat: novel.fileFormat,
            totalChars: novel.totalChars, chapterCount: novel.chapterCount,
            createdAt: novel.createdAt, updatedAt: novel.updatedAt,
          };
          setSavedNovels((prev) => {
            const filtered = prev.filter((n) => n.id !== meta.id);
            return [meta, ...filtered];
          });
        }
      }
    },
    [parseFile]
  );

  // Folder import: try showOpenFilePicker first (files visible + type filter), fallback to webkitdirectory
  const handleFolderPick = useCallback(async () => {
    setBatchParsing(true);
    setError(null);

    try {
      // Primary: showOpenFilePicker - shows individual files with proper type filtering
      if ("showOpenFilePicker" in window) {
        const fileHandles = await (window as any).showOpenFilePicker({
          types: [
            {
              description: "小说文件",
              accept: {
                "text/plain": [".txt"],
                "application/epub+zip": [".epub"],
              },
            },
          ],
          multiple: true,
        });

        const files: File[] = [];
        for (const handle of fileHandles) {
          try {
            files.push(await handle.getFile());
          } catch {
            // skip unreadable files
          }
        }
        await processFiles(files);
      } else {
        // Fallback: webkitdirectory on hidden input
        folderInputRef.current?.click();
      }
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") {
        // User cancelled - no error
      } else {
        setError("导入失败：" + (err instanceof Error ? err.message : "未知错误"));
      }
    } finally {
      setBatchParsing(false);
    }
  }, [processFiles]);

  // Fallback handler for webkitdirectory
  const handleFolderFallback = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) {
        setBatchParsing(false);
        return;
      }
      await processFiles(Array.from(files));
      // Reset so same folder can be picked again
      e.target.value = "";
      setBatchParsing(false);
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      setBatchParsing(true);
      processFiles(Array.from(files)).finally(() => setBatchParsing(false));
    },
    [processFiles]
  );

  const handleDelete = async (e: React.MouseEvent, novelId: string, title: string) => {
    e.stopPropagation();
    if (!window.confirm(`从书架移除《${title}》？\n\n将删除你关于此书的所有数据：\n- AI 总结和分析\n- 人物关系图谱\n- 笔记\n- 阅读进度\n\n小说本身仍保留在服务器书库中。`)) return;
    fetch(`/api/novels/${novelId}/leave`, {
      method: "POST", headers: authHeaders(),
    }).catch(() => {});
    await deleteNovel(novelId);
    setSavedNovels((prev) => prev.filter((n) => n.id !== novelId));
    setServerNovels((prev) => prev.map((n) => n.id === novelId ? { ...n, joined: false } : n));
  };

  const loading = isParsing || batchParsing;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Hero area */}
        <div className="text-center py-4 md:py-8">
          <BookOpen className="h-10 md:h-16 w-10 md:w-16 text-primary mx-auto mb-2 md:mb-4" />
          <h1 className="text-xl md:text-3xl font-bold mb-1 md:mb-2">AI 小说精读助手</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
            上传小说，借助 AI 进行深度阅读、章节总结和全书分析
          </p>
        </div>

        {/* Upload Zone */}
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">
                {dragOver ? "释放以上传" : "点击上传或拖拽小说文件到此处"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                支持 .txt、.epub 格式，可多选文件
              </p>
            </div>
            <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
              {/* Regular file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.epub"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  setBatchParsing(true);
                  processFiles(Array.from(files)).finally(() => setBatchParsing(false));
                }}
              />
              {/* Folder picker button: opens showOpenFilePicker or falls back to webkitdirectory */}
              <Button variant="outline" size="sm" onClick={handleFolderPick}>
                <FolderOpen className="h-4 w-4 mr-2" />
                从文件夹导入
              </Button>
              {/* Fallback: hidden webkitdirectory input (only used if showOpenFilePicker unsupported) */}
              <input
                ref={folderInputRef}
                type="file"
                /* @ts-expect-error webkitdirectory */
                webkitdirectory=""
                className="hidden"
                onChange={handleFolderFallback}
              />
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="py-4 space-y-2">
              <p className="text-sm font-medium">
                {batchParsing ? "正在批量导入..." : "正在解析文件..."}
              </p>
              <Progress value={isParsing ? progress : undefined} />
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Book Grid */}
        {savedNovels.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              我的书架 ({savedNovels.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {savedNovels.map((novel) => {
                const pos = readingPositions[novel.id];
                const readIndex = pos ? pos.chapterIndex : -1;
                const progressPct = novel.chapterCount > 0 && readIndex >= 0
                  ? (((readIndex + 1) / novel.chapterCount) * 100)
                  : 0;

                return (
                  <Card
                    key={novel.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group relative"
                    onClick={async () => {
                      const full = await loadNovel(novel.id);
                      if (full) setCurrentNovel(full);
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => handleDelete(e, novel.id, novel.title)}
                      title="删除此书"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>

                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-14 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold truncate group-hover:text-primary transition-colors pr-6">
                            {novel.title}
                          </h3>
                          {novel.author && (
                            <p className="text-xs text-muted-foreground">{novel.author}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {novel.fileName}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <Badge variant="secondary" className="text-xs">
                          {novel.fileFormat.toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {novel.chapterCount} 章
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {formatCharCount(novel.totalChars)}
                        </Badge>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {pos ? `已读至第 ${pos.chapterIndex + 1} 章` : "未开始阅读"}
                          </span>
                          <span>{typeof progressPct === "number" ? progressPct.toFixed(2) : progressPct}%</span>
                        </div>
                        <Progress value={progressPct} className="h-1.5" />
                      </div>

                      <div className="flex justify-end items-center mt-3">
                        <Button variant="ghost" size="sm" className="group-hover:text-primary">
                          开始阅读
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>

                      {/* Build status indicator — hidden for TF-IDF (no index needed) */}
                      {engine !== "tfidf" && (() => {
                        const st = buildStatuses[novel.id] || { status: "none" };
                        const chunkCount = st.chunkCount || st.chunk_count || 0;
                        const estSize = chunkCount ? `${((chunkCount * 512 * 4) / 1048576).toFixed(1)} MB` : "";
                        const memKey = novel.id + "-" + engine;
                        const loadedInMem = (window as any).__ragCacheLoaded?.has(memKey);
                        const el = engine.includes("bge") ? "BGE" : engine.includes("gte") ? "GTE" : engine.includes("e5") ? "E5" : engine.includes("MiniLM") ? "MiniLM" : getEngineDisplayName(engine).split(" ")[0];
                        if (st.status === "ready") {
                          return (
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                              <Badge variant="outline" className={`text-[10px] ${loadedInMem ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30"}`}>
                                {loadedInMem ? `${el} 已加载 ${estSize || ""}` : `${el} 就绪 ${estSize || ""}`}
                              </Badge>
                            </div>
                          );
                        }
                        if (st.status === "building" || st.status === "loading" || st.status === "encoding") return (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                            <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
                            <span className="text-[10px] text-yellow-500">{el} 构建中...</span>
                          </div>
                        );
                        if (st.status === "queued") {
                          const qpos = (st as any).queuePosition || "?";
                          return (
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                              <Loader2 className="h-3 w-3 text-blue-400" />
                              <span className="text-[10px] text-blue-400">排队第 {qpos} 位</span>
                            </div>
                          );
                        }
                        if (st.status === "error") return (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
                            <span className="text-[10px] text-red-400">{el} 失败</span>
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={(e) => { e.stopPropagation(); handleBuild(novel.id); }}>重试</Button>
                          </div>
                        );
                        return (
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                            <span className="text-[10px] text-muted-foreground">{el} 未构建</span>
                            <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={(e) => { e.stopPropagation(); handleBuild(novel.id); }} disabled={buildingId === novel.id}>
                              {buildingId === novel.id ? "触发中..." : "构建"}
                            </Button>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Server novel library */}
        <div className="space-y-4 mt-8">
          {!serverScanned && (
            <div className="text-center py-6">
              <Button variant="outline" onClick={scanServer} disabled={scanning}>
                <Search className="h-4 w-4 mr-2" />
                {scanning ? "扫描中..." : "扫描书库"}
              </Button>
            </div>
          )}
          {serverScanned && serverNovels.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">扫描完成，书库为空</p>
              <Button variant="outline" size="sm" onClick={scanServer} disabled={scanning}>重新扫描</Button>
            </div>
          )}
          {serverScanned && serverNovels.length > 0 && (
            <>
              <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                <FolderOpen className="h-5 w-5" />书库
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {serverNovels.map((novel: any) => (
                  <Card key={novel.id} className="transition-all hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold truncate">{novel.title}</h3>
                          {novel.author && <p className="text-xs text-muted-foreground">{novel.author}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <Badge variant="secondary" className="text-xs">{novel.fileFormat.toUpperCase()}</Badge>
                        <Badge variant="secondary" className="text-xs">{novel.chapterCount} 章</Badge>
                        <Badge variant="secondary" className="text-xs">{formatCharCount(novel.totalChars)}</Badge>
                      </div>
                      <div className="flex justify-end">
                        {novel.joined ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">已添加</Badge>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleJoinNovel(novel)} disabled={joiningId === novel.id}>
                            {joiningId === novel.id ? "加载中..." : "加入书架"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        {savedNovels.length === 0 && !loading && (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground">书架上还没有书，上传第一本小说吧</p>
          </div>
        )}
      </div>
    </div>
  );
}

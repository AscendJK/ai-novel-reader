import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNovelStore } from "@/stores/novel-store";
import { useRAGStore } from "@/stores/rag-store";
import { getEngineDisplayName } from "@/rag/engines";
import { useSummaryStore } from "@/stores/summary-store";
import { useSummarizer } from "@/hooks/useSummarizer";
import type { GraphData } from "@/hooks/useSummarizer";
import { db } from "@/db/database";
import { loadSetting, saveSetting, loadNotes, saveNote, deleteNote } from "@/db/repositories";
import type { NoteItem } from "@/db/repositories";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ChevronRight, ChevronDown,
  Sparkles, Users, Clock, RefreshCw, MessageSquare,
  BookOpen, Trash2, Maximize2, FileText, PlusCircle,
  Bookmark, StickyNote,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { CharacterGraph } from "./CharacterGraph";

export function SummaryPanel({ defaultTab = "chapter" }: { defaultTab?: string }) {
  // Book sub-items: "timeline" | "characters" | "global" | null
  const [bookSub, setBookSub] = useState<string | null>(null);
  const [dataOpen, setDataOpen] = useState(false);

  // QA state
  const [qaMessages, setQaMessages] = useState<{ id: string; role: "user" | "assistant"; content: string; tokensUsed?: number }[]>([]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeResults, setRangeResults] = useState<{ id: string; title: string; content: string; tokensUsed: number; createdAt: number }[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [noteTab, setNoteTab] = useState<"chapter" | "book">("chapter");
  const [savingNote, setSavingNote] = useState(false);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);

  // Graph data
  const [characterGraphData, setCharacterGraphData] = useState<GraphData | null>(null);

  const { currentNovel, selectedChapterId } = useNovelStore();
  // Ref for latest selectedChapterId to avoid stale closures in callbacks
  const selectedChapterRef = useRef(selectedChapterId);
  selectedChapterRef.current = selectedChapterId;
  const { getSummariesByNovel, isGenerating, generateProgress } = useSummaryStore();
  const {
    isRunning, currentTask, error,
    summarizeChapter, summarizeAllChapters, regenerateChapter,
    generateGlobalSummary, regenerateGlobal,
    generateCharacterAnalysis, generateTimeline,
    generateCharacterGraph, regenerateCharacterGraph,
    regenerateCharacters, regenerateTimeline,
    generateRangeSummary, askCustomQuestion,
    clearError, ragEngineUsed,
  } = useSummarizer();

  const loading = isRunning || isGenerating || qaLoading;

  const handleSaveNote = async () => {
    if (!noteContent.trim() || !currentNovel) return;
    setSavingNote(true);
    const chapterId = noteTab === "chapter" && selectedChapterId ? selectedChapterId : "__book__";
    const chapterTitle = noteTab === "chapter"
      ? currentNovel.chapters.find((c) => c.id === selectedChapterId)?.title || "当前章节"
      : "全书笔记";
    const note: NoteItem = {
      id: crypto.randomUUID(),
      novelId: currentNovel.id,
      chapterId,
      chapterTitle,
      content: noteContent.trim(),
      source: "user",
      sourceLabel: noteTab === "chapter" ? "用户笔记" : "全书笔记",
      createdAt: Date.now(),
    };
    await saveNote(note);
    setNotes((prev) => [note, ...prev]);
    setNoteContent("");
    setSavingNote(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleMoveToBook = async (note: NoteItem) => {
    if (!currentNovel) return;
    const updated: NoteItem = { ...note, chapterId: "__book__", chapterTitle: "全书笔记", sourceLabel: "从章节移入" };
    await deleteNote(note.id);
    await saveNote(updated);
    setNotes((prev) => prev.map((n) => n.id === note.id ? updated : n));
  };

  const handleBookmarkAI = async (title: string, content: string, chapterId: string, scope?: "chapter" | "book") => {
    if (!currentNovel) return;
    // If scope is explicitly provided, use it to decide chapterId
    const isBook = scope
      ? scope === "book"
      : (chapterId === "__global__" || chapterId === "__timeline__" || chapterId === "__characters__" || chapterId === "__book__");
    const finalChapterId = isBook ? "__book__" : (chapterId || "__book__");
    const chTitle = isBook ? "全书笔记" : currentNovel.chapters.find((c) => c.id === chapterId)?.title || title;
    const note: NoteItem = {
      id: crypto.randomUUID(),
      novelId: currentNovel.id,
      chapterId: finalChapterId,
      chapterTitle: chTitle,
      content,
      source: "ai",
      sourceLabel: title,
      createdAt: Date.now(),
    };
    await saveNote(note);
    setNotes((prev) => [note, ...prev]);
  };

  const filteredNotes = notes.filter((n) =>
    noteTab === "chapter"
      ? n.chapterId === selectedChapterId
      : n.chapterId === "__book__"
  );

  // Load graph + notes on novel switch, clear QA
  useEffect(() => {
    setQaMessages([]); setRangeResults([]); setCustomQuestion(""); setRangeFrom(""); setRangeTo("");
    setNoteContent("");
    let cancelled = false;
    if (currentNovel) {
      loadSetting<GraphData>(`character-graph-${currentNovel.id}`).then((gd) => {
        if (!cancelled) setCharacterGraphData(gd);
      });
      loadNotes(currentNovel.id).then((n) => {
        if (!cancelled) setNotes(n);
      });
    } else {
      setCharacterGraphData(null);
      setNotes([]);
    }
    return () => { cancelled = true; };
  }, [currentNovel?.id]);

  if (!currentNovel) return null;

  const summaries = getSummariesByNovel(currentNovel.id);
  const chapterSummary = summaries.find((s) => s.chapterId === selectedChapterId && s.type === "chapter");
  const globalSummaries = summaries.filter((s) => s.type === "global");
  const charSummaries = summaries.filter((s) => s.type === "characters");
  const tlSummaries = summaries.filter((s) => s.type === "timeline");

  const saveGraph = (gd: GraphData | null) => {
    setCharacterGraphData(gd);
    if (currentNovel && gd) saveSetting(`character-graph-${currentNovel.id}`, gd);
  };

  const handleAsk = async () => {
    if (!customQuestion.trim()) return;
    const q = customQuestion.trim(); setCustomQuestion("");
    const um = { id: crypto.randomUUID(), role: "user" as const, content: q };
    setQaMessages((p) => [...p, um]);
    setQaLoading(true); setQaError(null);
    try {
      const hist = useSummaryStore.getState().summaries.map((m: any) => ({ role: m.role, content: m.content }));
      const r = await askCustomQuestion(q, hist);
      if (r) setQaMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: r.answer, tokensUsed: r.tokensUsed }]);
    } catch (e) { setQaError(e instanceof Error ? e.message : "failed"); }
    finally { setQaLoading(false); }
  };

  const handleRange = async () => {
    const f = parseInt(rangeFrom), t = parseInt(rangeTo);
    if (isNaN(f) || isNaN(t) || f < 1 || t > currentNovel.chapters.length || f > t) {
      setQaError(`invalid range (1-${currentNovel.chapters.length})`); return;
    }
    setQaLoading(true); setQaError(null);
    try { const r = await generateRangeSummary(f, t); if (r) setRangeResults((p) => [r, ...p]); }
    catch (e) { setQaError(e instanceof Error ? e.message : "failed"); }
    finally { setQaLoading(false); }
  };

  return (
    <div className="md:w-72 w-full border-l md:border-l border-t md:border-t-0 bg-card h-full flex flex-col shrink-0">
      {/* Header */}
      <div className="p-2.5 border-b shrink-0">
        <h3 className="font-semibold text-xs flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />AI 分析
        </h3>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="mx-2.5 mt-2 p-1.5 rounded bg-primary/10 border border-primary/20 flex items-center gap-2 text-xs text-primary shrink-0">
          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
          <span>AI 正在执行：{currentTask || "分析任务"}...</span>
        </div>
      )}

      {/* Engine indicator — show actual engine used, or current setting */}
      {(() => {
        const engine = ragEngineUsed || useRAGStore.getState().engine;
        const isEmbedding = engine !== "tfidf";
        return (
          <div className="mx-2.5 mt-2 text-[10px] text-muted-foreground text-center shrink-0">
            检索引擎:{" "}
            <span className={isEmbedding ? "text-green-400" : "text-yellow-400"}>
              {getEngineDisplayName(engine)}
            </span>
          </div>
        );
      })()}

      {/* Error banner */}
      {(error || qaError) && (
        <div className="mx-2.5 mt-2 p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive shrink-0">
          <p className="whitespace-pre-wrap">{error || qaError}</p>
          <Button variant="ghost" size="sm" className="h-5 text-xs mt-0.5" onClick={() => { clearError(); setQaError(null); }}>关闭</Button>
        </div>
      )}

      {/* Fixed tabs — always visible */}
      <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 px-2.5 pt-2 border-b">
          <TabsList className="w-full">
            <TabsTrigger value="qa" className="text-xs h-7 flex-1">问答</TabsTrigger>
            <TabsTrigger value="chapter" className="text-xs h-7 flex-1">本章分析</TabsTrigger>
            <TabsTrigger value="book" className="text-xs h-7 flex-1">全书分析</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs h-7 flex-1">笔记</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {/* ====== 问答 Tab ====== */}
          <TabsContent value="qa" className="m-0">
            {/* QA input at top — always visible first */}
            <div className="px-2.5 pt-2 pb-2 space-y-1.5 border-b">
              <Card className="shadow-none"><CardContent className="p-2 space-y-1.5">
                <p className="text-xs font-medium">范围总结</p>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">第</span>
                  <Input id="range-from" name="range-from" className="h-6 text-xs w-10 text-center" placeholder="1" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input id="range-to" name="range-to" className="h-6 text-xs w-10 text-center" placeholder={String(currentNovel.chapters.length)} value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
                  <span className="text-xs text-muted-foreground">章</span>
                  <Button size="sm" className="h-6 text-xs" onClick={handleRange} disabled={loading}>生成</Button>
                </div>
              </CardContent></Card>
              <Textarea id="qa-input" name="qa-input" className="text-xs min-h-[40px]" placeholder="输入问题，支持追问..."
                value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }} />
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-xs flex-1" onClick={handleAsk} disabled={loading || !customQuestion.trim()}>
                  <MessageSquare className="h-3 w-3 mr-1" />发送
                </Button>
                {qaMessages.length > 0 && (
                  <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setQaMessages([])}>
                    <PlusCircle className="h-3 w-3 mr-1" />新会话
                  </Button>
                )}
              </div>
            </div>
            {/* Chat + range results below */}
            <div className="px-2.5 pt-2 pb-2 space-y-1.5">
              {qaMessages.length > 0 && (
                <div className="space-y-1.5">
                  {qaMessages.map((m) => (
                    <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                      <div className={`max-w-[90%] rounded-lg px-2 py-1 text-xs ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <ReactMarkdown components={chatMd as any}>{m.content}</ReactMarkdown>
                      </div>
                      {m.role === "assistant" && (
                        <div className="flex gap-1 mt-0.5">
                          <Button variant="ghost" size="sm" className="h-5 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => handleBookmarkAI("AI 回答", m.content, selectedChapterRef.current || "", "chapter")}>
                            <Bookmark className="h-2.5 w-2.5 mr-0.5" />收藏到本章
                          </Button>
                          <Button variant="ghost" size="sm" className="h-5 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => handleBookmarkAI("AI 回答", m.content, "__book__", "book")}>
                            <Bookmark className="h-2.5 w-2.5 mr-0.5" />收藏到全书
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {qaLoading && <Loader2 className="h-3 w-3 animate-spin mx-auto" />}
              {rangeResults.map((r) => (
                <MiniCard key={r.id} title={r.title} content={r.content} tokens={r.tokensUsed} date={r.createdAt} isTemp
                  onRemove={() => setRangeResults((p) => p.filter((x) => x.id !== r.id))} />
              ))}
            </div>
          </TabsContent>

          {/* ====== 本章分析 Tab ====== */}
          <TabsContent value="chapter" className="px-2.5 pt-2 pb-2 space-y-2 m-0">
            <div className="flex gap-1">
                <Button size="sm" className="flex-1 text-xs h-7" onClick={() => selectedChapterId && summarizeChapter(selectedChapterId)} disabled={loading || !selectedChapterId}>
                  {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}总结本章
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={summarizeAllChapters} disabled={loading}>
                  <FileText className="h-3 w-3 mr-1" />批量
                </Button>
              </div>
              {generateProgress && (
                <div className="space-y-0.5">
                  <Progress value={(generateProgress.current / generateProgress.total) * 100} className="h-1" />
                  <p className="text-xs text-muted-foreground">{generateProgress.current}/{generateProgress.total}</p>
                </div>
              )}
              {chapterSummary ? (
                <MiniCard title={chapterSummary.chapterTitle} content={chapterSummary.content}
                  tokens={chapterSummary.tokensUsed} date={chapterSummary.createdAt}
                  onRegenerate={() => selectedChapterId && regenerateChapter(selectedChapterId)} loading={loading}
                  onBookmark={() => handleBookmarkAI(chapterSummary.chapterTitle, chapterSummary.content, chapterSummary.chapterId)} />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">暂无总结，点击上方按钮生成</p>
              )}

          </TabsContent>

          {/* ====== 全书分析 Tab ====== */}
          <TabsContent value="book" className="px-2.5 pt-2 pb-2 space-y-1 m-0">
              <SubItem label="剧情时间线" icon={<Clock className="h-3 w-3" />}
                isOpen={bookSub === "timeline"} onClick={() => setBookSub(bookSub === "timeline" ? null : "timeline")}
                summaries={tlSummaries} onGenerate={generateTimeline} onRegenerate={regenerateTimeline}
                loading={loading} emptyLabel="生成剧情时间线" />
              <SubItem label="全书人物关系" icon={<Users className="h-3 w-3" />}
                isOpen={bookSub === "characters"} onClick={() => setBookSub(bookSub === "characters" ? null : "characters")}
                summaries={charSummaries} onGenerate={generateCharacterAnalysis} onRegenerate={regenerateCharacters}
                loading={loading} emptyLabel="生成人物关系分析"
                graphData={characterGraphData}
                onGenerateGraph={async () => { const gd = await generateCharacterGraph(); if (gd) saveGraph(gd); }}
                onRegenerateGraph={async () => { const gd = await regenerateCharacterGraph(); if (gd) saveGraph(gd); }} />
              <SubItem label="全书总览" icon={<BookOpen className="h-3 w-3" />}
                isOpen={bookSub === "global"} onClick={() => setBookSub(bookSub === "global" ? null : "global")}
                summaries={globalSummaries} onGenerate={generateGlobalSummary} onRegenerate={regenerateGlobal}
                loading={loading} emptyLabel="生成全书总览" />
          </TabsContent>

          {/* ====== 笔记 Tab ====== */}
          <TabsContent value="notes" className="pt-2 m-0">
            <div className="px-2.5 pb-1 flex gap-1 border-b">
              <Button variant={noteTab === "chapter" ? "secondary" : "ghost"} size="sm" className="text-xs h-6"
                onClick={() => setNoteTab("chapter")}>本章笔记</Button>
              <Button variant={noteTab === "book" ? "secondary" : "ghost"} size="sm" className="text-xs h-6"
                onClick={() => setNoteTab("book")}>全书笔记</Button>
            </div>
            <div className="px-2.5 pt-2 pb-2 space-y-2">
              <div className="space-y-1.5">
                <Textarea id="note-input" name="note-input" className="text-xs min-h-[50px]" placeholder="写笔记..."
                  value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
                <Button size="sm" className="h-6 text-xs w-full" onClick={handleSaveNote}
                  disabled={savingNote || !noteContent.trim()}>
                  <StickyNote className="h-3 w-3 mr-1" />保存笔记
                </Button>
              </div>
              {filteredNotes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  暂无{noteTab === "chapter" ? "本章" : "全书"}笔记
                </p>
              )}
              {filteredNotes.map((n) => {
                const isExpanded = noteTab === "chapter" ? expandedChapter === n.id : expandedBook === n.id;
                const setExpanded = noteTab === "chapter" ? setExpandedChapter : setExpandedBook;
                return (
                <Card key={n.id} className="shadow-none cursor-pointer overflow-hidden min-w-0"
                  onClick={() => setExpanded(isExpanded ? null : n.id)}>
                  <CardHeader className="p-2 pb-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0">
                        {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        <Badge variant={n.source === "ai" ? "secondary" : "outline"} className="text-xs shrink-0">
                          {n.source === "ai" ? "AI" : "笔记"}
                        </Badge>
                        <CardTitle className="text-xs truncate">{n.sourceLabel}</CardTitle>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {noteTab === "chapter" && (
                          <Button variant="ghost" size="sm" className="h-5 text-xs text-muted-foreground hover:text-primary"
                            onClick={() => handleMoveToBook(n)} title="移入全书笔记">
                            移入全书
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive shrink-0"
                          onClick={() => handleDeleteNote(n.id)}>
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString("zh-CN")}</p>
                  </CardHeader>
                  <CardContent className="p-2 pt-0">
                    <div className={`text-xs leading-relaxed text-foreground/80 ${isExpanded ? "whitespace-pre-wrap break-all" : "line-clamp-2 break-all"}`}>{n.content}</div>
                  </CardContent>
                </Card>
              )})}
            </div>
          </TabsContent>
        </ScrollArea>
        </Tabs>

      {/* Data Mgmt — pinned to bottom */}
      <div className="border-t shrink-0" />
      <div className="p-2.5 shrink-0">
        <button onClick={() => setDataOpen(!dataOpen)}
          className="flex items-center gap-1.5 w-full text-left text-xs font-medium text-muted-foreground hover:text-primary transition-colors">
          {dataOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Trash2 className="h-3 w-3" />数据管理
        </button>
        {dataOpen && (
          <div className="mt-1.5 max-h-32 overflow-auto">
            <DataMgr novelId={currentNovel.id} summaries={summaries} hasGraph={!!characterGraphData}
              onDeleteGraph={() => saveGraph(null)}
              onNotesChanged={() => { if (currentNovel) loadNotes(currentNovel.id).then(setNotes); }}
              noteCount={{
                chapter: notes.filter((n) => n.chapterId !== "__book__").length,
                book: notes.filter((n) => n.chapterId === "__book__").length
              }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function SubItem({ label, icon, isOpen, onClick, summaries, onGenerate, onRegenerate, loading, emptyLabel, graphData, onGenerateGraph, onRegenerateGraph }: {
  label: string; icon: ReactNode; isOpen: boolean; onClick: () => void;
  summaries: { id: string; chapterTitle: string; content: string; tokensUsed: number; createdAt: number }[];
  onGenerate: () => void; onRegenerate: () => void; loading: boolean; emptyLabel: string;
  graphData?: GraphData | null; onGenerateGraph?: () => void; onRegenerateGraph?: () => void;
}) {
  if (summaries.length === 0 && !graphData) {
    return (
      <div className="flex items-center gap-1.5">
        <button onClick={onGenerate} disabled={loading}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-0.5">
          {icon}{emptyLabel}
        </button>
        {onGenerateGraph && (
          <button onClick={onGenerateGraph} disabled={loading} className="text-xs text-muted-foreground hover:text-primary">| 图谱</button>
        )}
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-1">
        <button onClick={onClick} className="flex items-center gap-1 text-xs font-medium hover:text-primary transition-colors flex-1 text-left">
          {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          {icon}{label}
        </button>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRegenerate} disabled={loading}><RefreshCw className="h-2.5 w-2.5" /></Button>
        {onRegenerateGraph && graphData && (
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRegenerateGraph} disabled={loading}><Maximize2 className="h-2.5 w-2.5" /></Button>
        )}
      </div>
      {isOpen && (
        <div className="mt-1 space-y-1.5 pl-4">
          {graphData && onRegenerateGraph && <CharacterGraph graphData={graphData} onRegenerate={onRegenerateGraph} />}
          {summaries.length > 0 ? (
            summaries.map((s) => (
              <MiniCard key={s.id} title={s.chapterTitle} content={s.content} tokens={s.tokensUsed} date={s.createdAt}
                onRegenerate={onRegenerate} loading={loading} />
            ))
          ) : (
            <button onClick={onGenerate} disabled={loading}
              className="text-xs text-muted-foreground hover:text-primary transition-colors py-0.5 flex items-center gap-1">
              <FileText className="h-3 w-3" />生成文字分析
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MiniCard({ title, content, tokens, date, onRegenerate, loading, isTemp, onRemove, onBookmark }: {
  title: string; content: string; tokens: number; date: number;
  onRegenerate?: () => void; loading?: boolean; isTemp?: boolean; onRemove?: () => void;
  onBookmark?: () => void;
}) {
  return (
    <Card className={`shadow-none ${isTemp ? "border-dashed border-amber-300 dark:border-amber-700" : ""}`}>
      <CardHeader className="p-2 pb-0.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            {isTemp && <Badge variant="outline" className="text-xs font-normal text-amber-600 shrink-0">临时</Badge>}
            <CardTitle className="text-xs truncate">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Badge variant="outline" className="text-xs font-normal">~{tokens}</Badge>
            {onBookmark && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onBookmark} title="收藏到笔记"><Bookmark className="h-2.5 w-2.5" /></Button>}
            {onRegenerate && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRegenerate} disabled={loading}><RefreshCw className="h-2.5 w-2.5" /></Button>}
            {onRemove && <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRemove}>x</Button>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{new Date(date).toLocaleString("zh-CN")}</p>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <div className="text-xs leading-relaxed space-y-2">
          <ReactMarkdown components={summaryMd as any}>{content}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}

function DataMgr({ novelId, summaries, hasGraph, onDeleteGraph, noteCount, onNotesChanged }: {
  novelId: string; summaries: { id: string; type: string }[]; hasGraph: boolean;
  onDeleteGraph: () => void; noteCount: { chapter: number; book: number };
  onNotesChanged: () => void;
}) {
  const { setSummaries } = useSummaryStore();
  const del = async (type: string, label: string) => {
    if (!window.confirm(`确认删除所有 ${label}？此操作不可恢复。`)) return;
    const targets = summaries.filter((s) => s.type === type);
    for (const s of targets) await db.summaries.delete(s.id);
    setSummaries((prev) => prev.filter((s) => s.type !== type));
  };
  const delGraph = async () => {
    if (!window.confirm("确认删除人物关系图谱？")) return;
    await saveSetting("character-graph-" + novelId, null);
    onDeleteGraph();
  };
  const delNotesByFilter = async (isBook: boolean, label: string) => {
    if (!window.confirm(`确认删除所有 ${label}？此操作不可恢复。`)) return;
    const all = await db.notes.where("novelId").equals(novelId).toArray();
    const targets = all.filter((n) => isBook ? n.chapterId === "__book__" : n.chapterId !== "__book__");
    for (const n of targets) await db.notes.delete(n.id);
    onNotesChanged();
  };
  const count = (t: string) => summaries.filter((s) => s.type === t).length;
  return (
    <div className="mt-1 space-y-0.5 text-xs">
      {count("chapter") > 0 && <Row label={`章节总结 (${count("chapter")})`} onDelete={() => del("chapter", "章节总结")} />}
      {count("global") > 0 && <Row label="全书总览" onDelete={() => del("global", "全书总览")} />}
      {count("timeline") > 0 && <Row label="剧情时间线" onDelete={() => del("timeline", "剧情时间线")} />}
      {count("characters") > 0 && <Row label="人物关系分析" onDelete={() => del("characters", "人物关系分析")} />}
      {hasGraph && <Row label="人物关系图谱" onDelete={delGraph} />}
      {noteCount.chapter > 0 && <Row label={`章节笔记 (${noteCount.chapter})`} onDelete={() => delNotesByFilter(false, "章节笔记")} />}
      {noteCount.book > 0 && <Row label={`全书笔记 (${noteCount.book})`} onDelete={() => delNotesByFilter(true, "全书笔记")} />}
    </div>
  );
}

function Row({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between py-0.5 px-1.5 rounded hover:bg-muted/50">
      <span>{label}</span>
      <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={onDelete}><Trash2 className="h-2.5 w-2.5" /></Button>
    </div>
  );
}

const summaryMd = {
  h1: ({ children }: { children: ReactNode }) => <h2 className="text-sm font-bold border-b pb-0.5 mb-1.5 mt-3 first:mt-0">{children}</h2>,
  h2: ({ children }: { children: ReactNode }) => <h3 className="text-xs font-semibold mt-2 mb-1 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-primary shrink-0" />{children}</h3>,
  h3: ({ children }: { children: ReactNode }) => <h4 className="text-xs font-medium mt-1.5 mb-0.5">{children}</h4>,
  p: ({ children }: { children: ReactNode }) => <p className="text-foreground/80 leading-relaxed">{children}</p>,
  ul: ({ children }: { children: ReactNode }) => <ul className="list-disc pl-3 space-y-0.5 text-foreground/75">{children}</ul>,
  ol: ({ children }: { children: ReactNode }) => <ol className="list-decimal pl-3 space-y-0.5 text-foreground/75">{children}</ol>,
  li: ({ children }: { children: ReactNode }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }: { children: ReactNode }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: { children: ReactNode }) => <em className="italic text-primary">{children}</em>,
  hr: () => <hr className="my-2 border-border" />,
  blockquote: ({ children }: { children: ReactNode }) => <blockquote className="border-l-2 border-primary/30 pl-2 italic">{children}</blockquote>,
  code: ({ children }: { children: ReactNode }) => <code className="bg-muted px-1 py-0.5 rounded text-xs">{children}</code>,
  table: ({ children }: { children: ReactNode }) => <div className="overflow-x-auto my-1"><table className="w-full text-xs border-collapse">{children}</table></div>,
  thead: ({ children }: { children: ReactNode }) => <thead className="bg-muted/50">{children}</thead>,
  tr: ({ children }: { children: ReactNode }) => <tr className="border-b border-border last:border-0">{children}</tr>,
  th: ({ children }: { children: ReactNode }) => <th className="text-left px-1.5 py-0.5 font-semibold">{children}</th>,
  td: ({ children }: { children: ReactNode }) => <td className="px-1.5 py-0.5">{children}</td>,
};

const chatMd = {
  p: ({ children }: { children: ReactNode }) => <p className="mb-0.5 last:mb-0">{children}</p>,
  ul: ({ children }: { children: ReactNode }) => <ul className="list-disc pl-3">{children}</ul>,
  ol: ({ children }: { children: ReactNode }) => <ol className="list-decimal pl-3">{children}</ol>,
  strong: ({ children }: { children: ReactNode }) => <strong className="font-semibold">{children}</strong>,
  code: ({ children }: { children: ReactNode }) => <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">{children}</code>,
};

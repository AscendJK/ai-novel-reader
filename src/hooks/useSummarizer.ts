import { useState, useCallback, useRef, useEffect } from "react";
import { useNovelStore } from "@/stores/novel-store";
import { useAPIStore } from "@/stores/api-store";
import { useSummaryStore, type SummaryItem } from "@/stores/summary-store";
import { summarizerAgent, globalSummarizerAgent } from "@/agents/summarizer";
import { characterAnalysisAgent, timelineAgent } from "@/agents/analyzers";
import { characterGraphAgent } from "@/agents/graph-agent";
import { getProvider } from "@/api/registry";
import { saveSummary } from "@/db/repositories";
import { APIError } from "@/api/error-handler";
import { buildIndex, retrieveRelevant, retrieveRelevantWithDetails } from "@/rag/index";
import { useRAGStore } from "@/stores/rag-store";
import { syncClient } from "@/sync/sync-client";
import { addDebugEntry, ragLog } from "@/components/common/DebugPanel";
import { useBuildStore } from "@/stores/build-store";

export interface GraphData {
  nodes: { id: string; group: string; description: string }[];
  edges: { source: string; target: string; label: string }[];
}

interface TempResult {
  id: string;
  title: string;
  content: string;
  tokensUsed: number;
  createdAt: number;
}

export function useSummarizer() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTask, setCurrentTask] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { currentNovel } = useNovelStore();
  const { getActiveProvider } = useAPIStore();
  const { addSummary, setProgress } = useSummaryStore();
  const abortRef = useRef<AbortController | null>(null);

  const startTask = useCallback((name: string) => {
    setCurrentTask(name);
    setIsRunning(true);
    (window as any).__aiRunning = true;
    setError(null);
  }, []);

  const endTask = useCallback(() => {
    setIsRunning(false);
    (window as any).__aiRunning = false;
    setCurrentTask("");
  }, []);

  // Build is now triggered manually from bookshelf per-book card

  // Create a fresh AbortController, aborting any previous one
  const createSignal = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    return ctrl.signal;
  }, []);

  const abortAll = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Pre-retrieve relevant text using local RAG. Falls back to TF-IDF if BGE not ready.
  const [ragEngineUsed, setRagEngineUsed] = useState<string>("");
  const getRelevantText = useCallback(
    async (query: string): Promise<string> => {
      if (!currentNovel) return "";
      await new Promise((r) => setTimeout(r, 0));
      const prefEngine = useRAGStore.getState().engine;
      try {
        // Check if BGE index is ready on server; download if needed
        let engine = prefEngine;
        if (engine === "bge-small-zh") {
          try {
            const sr = await fetch(`/api/rag/${currentNovel.id}/status?engine=bge-small-zh`);
            const st = await sr.json();
            if (st.status === "ready") {
              // Index exists on server, trigger download via bge-retriever init
              ragLog("BGE 就绪, 加载索引...");
              try {
                await buildIndex(currentNovel.id, currentNovel.chapters, engine, (msg) => setCurrentTask(msg));
              } catch { engine = "tfidf"; ragLog("BGE 加载失败, 降级 TF-IDF"); }
            } else {
              ragLog("BGE 未就绪, 降级为 TF-IDF");
              engine = "tfidf";
            }
          } catch { engine = "tfidf"; }
        }

        setCurrentTask(`正在启动检索引擎 (${engine})...`);
        await buildIndex(currentNovel.id, currentNovel.chapters, engine, (msg) => setCurrentTask(msg));
        setCurrentTask("正在检索相关段落...");
        const t0 = performance.now();
        const result = await retrieveRelevantWithDetails(currentNovel.id, query, 15);
        setRagEngineUsed(result.engine);
        addDebugEntry({ query, duration: (performance.now() - t0) / 1000, results: result.results, engine: result.engine });
        return result.text;
      } catch {
        return "";
      }
    },
    [currentNovel]
  );

  const checkProvider = useCallback(() => {
    const provider = getActiveProvider();
    if (!provider) { setError("请先在设置中配置 API"); return null; }
    return provider;
  }, [getActiveProvider]);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof APIError) {
      if (err.code === "context_length") setError(`[上下文超限] ${err.message}`);
      else if (err.code === "auth") setError(`[认证失败] ${err.message}`);
      else if (err.code === "quota_exceeded") setError(`[额度用尽] ${err.message}`);
      else if (err.code === "rate_limit") setError(`[频率限制] ${err.message}`);
      else if (err.code === "network") setError(`[网络错误] ${err.message}`);
      else setError(`[${err.code}] ${err.message}`);
    } else {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  }, []);

  const saveChapterSummary = useCallback(
    async (chapterId: string, result: { success: boolean; data?: unknown; error?: string; tokensUsed?: number }) => {
      if (!currentNovel || !result.success || !result.data) return;
      const data = result.data as { summaries: { chapterTitle: string; content: string; tokens: number }[] };
      for (const s of data.summaries) {
        const summary: SummaryItem = {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36), novelId: currentNovel.id, chapterId,
          chapterTitle: s.chapterTitle, content: s.content,
          tokensUsed: s.tokens, createdAt: Date.now(), type: "chapter",
        };
        addSummary(summary);
        await saveSummary(summary);
      }
      syncClient.pushNow(); // immediate push so other devices get the update
    },
    [currentNovel, addSummary]
  );

  const saveGlobalSummary = useCallback(
    async (result: { success: boolean; data?: unknown; error?: string; tokensUsed?: number }, type: SummaryItem["type"], title: string, chapterId: string) => {
      if (!currentNovel || !result.success || !result.data) return;
      const data = result.data as { content: string; usedFallback?: boolean };
      const summary: SummaryItem = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36), novelId: currentNovel.id, chapterId,
        chapterTitle: title + (data.usedFallback ? "（精简版）" : ""),
        content: data.content, tokensUsed: result.tokensUsed || 0, createdAt: Date.now(), type,
      };
      addSummary(summary);
      await saveSummary(summary);
      syncClient.pushNow(); // immediate push
    },
    [currentNovel, addSummary]
  );

  // --- Chapter summary ---
  const summarizeChapter = useCallback(async (chapterId: string) => {
    if (!currentNovel || !checkProvider()) return;
    startTask("总结本章");
    try {
      const result = await summarizerAgent.run({ novelId: currentNovel.id, chapterIds: [chapterId], signal: createSignal() });
      if (result.success) await saveChapterSummary(chapterId, result);
      else setError(result.error || "总结生成失败");
    } catch (err) { handleError(err); }
    finally { endTask(); }
  }, [currentNovel, checkProvider, saveChapterSummary, handleError]);

  const regenerateChapter = useCallback(async (chapterId: string) => {
    if (!currentNovel || !checkProvider()) return;
    startTask("总结本章");
    try {
      const result = await summarizerAgent.run({ novelId: currentNovel.id, chapterIds: [chapterId], signal: createSignal() });
      if (result.success) await saveChapterSummary(chapterId, result);
      else setError(result.error || "重新生成失败");
    } catch (err) { handleError(err); }
    finally { endTask(); }
  }, [currentNovel, checkProvider, saveChapterSummary, handleError]);

  const summarizeAllChapters = useCallback(async () => {
    if (!currentNovel || !checkProvider()) return;
    startTask("批量总结所有章节");
    const chapters = currentNovel.chapters;
    const signal = createSignal();
    setProgress({ current: 0, total: chapters.length });
    try {
      for (let i = 0; i < chapters.length; i++) {
        if (signal.aborted) break;
        const result = await summarizerAgent.run({ novelId: currentNovel.id, chapterIds: [chapters[i].id], signal });
        if (signal.aborted) break;
        if (result.success) await saveChapterSummary(chapters[i].id, result);
        setProgress({ current: i + 1, total: chapters.length });
      }
    } catch (err) { handleError(err); }
    finally { endTask(); setProgress(null); }
  }, [currentNovel, checkProvider, saveChapterSummary, setProgress, handleError]);

  // --- Global summary ---
  const generateGlobalSummary = useCallback(async () => {
    if (!currentNovel || !checkProvider()) return;
    startTask("生成全书总览");
    try {
      const result = await globalSummarizerAgent.run({ novelId: currentNovel.id, signal: createSignal(), preRetrieved: await getRelevantText("小说主线剧情 主题分析 故事梗概 关键情节") });
      if (result.success) await saveGlobalSummary(result, "global", "全书总结", "__global__");
      else setError(result.error || "全局总结生成失败");
    } catch (err) { handleError(err); }
    finally { endTask(); }
  }, [currentNovel, checkProvider, saveGlobalSummary, handleError]);

  const regenerateGlobal = useCallback(async () => {
    if (!currentNovel || !checkProvider()) return;
    startTask("生成全书总览");
    try {
      const result = await globalSummarizerAgent.run({ novelId: currentNovel.id, signal: createSignal(), preRetrieved: await getRelevantText("小说主线剧情 主题分析 故事梗概 关键情节") });
      if (result.success) await saveGlobalSummary(result, "global", "全书总结", "__global__");
      else setError(result.error || "重新生成失败");
    } catch (err) { handleError(err); }
    finally { endTask(); }
  }, [currentNovel, checkProvider, saveGlobalSummary, handleError]);

  // --- Character analysis ---
  const generateCharacterAnalysis = useCallback(async (): Promise<GraphData | null> => {
    if (!currentNovel || !checkProvider()) return null;
    startTask("生成人物关系分析");
    try {
      const result = await characterAnalysisAgent.run({ novelId: currentNovel.id, signal: createSignal(), preRetrieved: await getRelevantText("人物角色 关系网络 性格特征 情感发展") });
      if (result.success) {
        await saveGlobalSummary(result, "characters", "人物关系分析", "__characters__");
        const data = result.data as { content: string; graphData?: GraphData };
        return data.graphData || null;
      } else {
        setError(result.error || "人物分析失败");
        return null;
      }
    } catch (err) { handleError(err); return null; }
    finally { endTask(); }
  }, [currentNovel, checkProvider, saveGlobalSummary, handleError]);

  const regenerateCharacters = useCallback(async (): Promise<GraphData | null> => {
    if (!currentNovel || !checkProvider()) return null;
    startTask("重新生成人物关系分析");
    try {
      const result = await characterAnalysisAgent.run({ novelId: currentNovel.id, signal: createSignal(), preRetrieved: await getRelevantText("人物角色 关系网络 性格特征 情感发展") });
      if (result.success) {
        await saveGlobalSummary(result, "characters", "人物关系分析", "__characters__");
        const data = result.data as { content: string; graphData?: GraphData };
        return data.graphData || null;
      } else {
        setError(result.error || "重新生成失败");
        return null;
      }
    } catch (err) { handleError(err); return null; }
    finally { endTask(); }
  }, [currentNovel, checkProvider, saveGlobalSummary, handleError]);

  // --- Character graph only (no text analysis) ---
  const generateCharacterGraph = useCallback(async (): Promise<GraphData | null> => {
    if (!currentNovel || !checkProvider()) return null;
    startTask("生成人物关系图谱");
    try {
      const result = await characterGraphAgent.run({ novelId: currentNovel.id, signal: createSignal() });
      if (result.success) {
        const data = result.data as { graphData?: GraphData };
        if (!data.graphData) setError("图谱生成成功但数据解析失败，请重试");
        return data.graphData || null;
      } else {
        setError(result.error || "图谱生成失败");
        return null;
      }
    } catch (err) { handleError(err); return null; }
    finally { endTask(); }
  }, [currentNovel, checkProvider, handleError]);

  const regenerateCharacterGraph = useCallback(async (): Promise<GraphData | null> => {
    if (!currentNovel || !checkProvider()) return null;
    startTask("重新生成人物关系图谱");
    try {
      const result = await characterGraphAgent.run({ novelId: currentNovel.id, signal: createSignal() });
      if (result.success) {
        const data = result.data as { graphData?: GraphData };
        if (!data.graphData) setError("图谱生成成功但数据解析失败，请重试");
        return data.graphData || null;
      } else {
        setError(result.error || "图谱生成失败");
        return null;
      }
    } catch (err) { handleError(err); return null; }
    finally { endTask(); }
  }, [currentNovel, checkProvider, handleError]);

  // --- Timeline ---
  const generateTimeline = useCallback(async () => {
    if (!currentNovel || !checkProvider()) return;
    startTask("生成剧情时间线");
    try {
      const result = await timelineAgent.run({ novelId: currentNovel.id, signal: createSignal(), preRetrieved: await getRelevantText("剧情事件 转折点 伏笔 时间线 高潮 结局 矛盾冲突") });
      if (result.success) await saveGlobalSummary(result, "timeline", "剧情时间线", "__timeline__");
      else setError(result.error || "时间线生成失败");
    } catch (err) { handleError(err); }
    finally { endTask(); }
  }, [currentNovel, checkProvider, saveGlobalSummary, handleError]);

  const regenerateTimeline = useCallback(async () => {
    if (!currentNovel || !checkProvider()) return;
    startTask("重新生成剧情时间线");
    try {
      const result = await timelineAgent.run({ novelId: currentNovel.id, signal: createSignal(), preRetrieved: await getRelevantText("剧情事件 转折点 伏笔 时间线 高潮 结局 矛盾冲突") });
      if (result.success) await saveGlobalSummary(result, "timeline", "剧情时间线", "__timeline__");
      else setError(result.error || "重新生成失败");
    } catch (err) { handleError(err); }
    finally { endTask(); }
  }, [currentNovel, checkProvider, saveGlobalSummary, handleError]);

  // --- Temporary: range summary (in-memory, not saved to DB) ---
  const generateRangeSummary = useCallback(
    async (fromChapter: number, toChapter: number): Promise<TempResult | null> => {
      if (!currentNovel || !checkProvider()) return null;
      const provider = getActiveProvider();
      if (!provider) return null;

      // Build temporary index for the range and retrieve relevant content
      const rangeChapters = currentNovel.chapters.slice(fromChapter - 1, toChapter);
      const rangeId = `${currentNovel.id}-range-${fromChapter}-${toChapter}`;
      const engine = useRAGStore.getState().engine;
      setCurrentTask(`正在检索第${fromChapter}-${toChapter}章...`);
      await buildIndex(rangeId, rangeChapters, engine, (msg) => setCurrentTask(msg));
      const combinedText = await retrieveRelevant(rangeId, "核心情节 关键事件 人物变化 承上启下", 20);

      const prompt = `你是一位专业的小说分析助手。请对以下小说章节范围（第${fromChapter}章到第${toChapter}章）进行总结分析。

要求：
1. **核心情节**（概括该段落的整体剧情走向）
2. **关键事件**（列出最重要的5-8个事件）
3. **人物变化**（主要角色在该段落中的发展变化）
4. **承上启下**（该段落在全书中的位置和作用）

请用简洁清晰的中文回答。

以下是通过语义检索找到的该范围内最相关的段落：

${combinedText}`;

      try {
        const providerInstance = getProvider(provider);
        const response = await providerInstance.chat({
          model: "", messages: [{ role: "user", content: prompt }],
          max_tokens: 2048, temperature: 0.5,
        });

        return {
          id: Math.random().toString(36).slice(2) + Date.now().toString(36),
          title: `第${fromChapter}-${toChapter}章 范围总结`,
          content: response.content,
          tokensUsed: response.tokensUsed.total,
          createdAt: Date.now(),
        };
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [currentNovel, checkProvider]
  );

  // --- Temporary: custom question with conversation history ---
  const askCustomQuestion = useCallback(
    async (
      question: string,
      history: { role: "user" | "assistant"; content: string }[]
    ): Promise<{ answer: string; tokensUsed: number } | null> => {
      if (!currentNovel || !checkProvider()) return null;
      const provider = getActiveProvider();
      if (!provider) return null;

      // Build system context (only sent once)
      const chapterList = currentNovel.chapters.map((c, i) => `${i + 1}. ${c.title}`).join("\n");

      // Use RAG to find relevant text for this question
      const relevantText = await getRelevantText(question);

      const systemPrompt = `你是一位专业的小说分析助手。请根据以下小说信息回答用户问题。请用中文回答。

**小说：**《${currentNovel.title}》
**章节目录：**
${chapterList}

**语义检索相关段落：**
${relevantText || "（无额外参考信息，请基于章节目录回答）"}

记住：你可以基于提供的文本信息和章节目录进行回答。如果信息不足以回答，请诚实说明并基于已有信息给出推断。`;

      // Build messages: system context + conversation history + new question
      const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
        { role: "system", content: systemPrompt },
      ];
      for (const msg of history) {
        messages.push(msg);
      }
      messages.push({ role: "user", content: question });

      try {
        const providerInstance = getProvider(provider);
        const response = await providerInstance.chat({
          model: "",
          messages,
          max_tokens: 2048,
          temperature: 0.5,
        });

        return { answer: response.content, tokensUsed: response.tokensUsed.total };
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [currentNovel, checkProvider]
  );

  return {
    isRunning, currentTask, error,
    summarizeChapter, summarizeAllChapters, regenerateChapter,
    generateGlobalSummary, regenerateGlobal,
    generateCharacterAnalysis, regenerateCharacters,
    generateCharacterGraph, regenerateCharacterGraph,
    generateTimeline, regenerateTimeline,
    generateRangeSummary, askCustomQuestion,
    clearError: () => setError(null),
    abortAll,
    ragEngineUsed,
  };
}

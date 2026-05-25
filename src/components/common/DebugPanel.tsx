import { useState, useEffect } from "react";
import { useNovelStore } from "@/stores/novel-store";
import { getBGEMeta } from "@/rag/index";

export interface DebugEntry {
  id: number;
  time: number;
  query: string;
  duration?: number;
  results: { content: string; score: number }[];
  engine: string;
}

let entryId = 0;
const listeners: Set<() => void> = new Set();
const entries: DebugEntry[] = [];

export function addDebugEntry(e: Omit<DebugEntry, "id" | "time">) {
  entries.unshift({ ...e, id: ++entryId, time: Date.now() });
  if (entries.length > 10) entries.pop();
  listeners.forEach((fn) => fn());
}

export function clearDebugEntries() {
  entries.length = 0;
  listeners.forEach((fn) => fn());
}

export function DebugPanel() {
  const { currentNovel } = useNovelStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const meta = currentNovel ? getBGEMeta(currentNovel.id) : null;

  const toggleEntry = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] max-w-lg w-80 text-xs font-mono"
      style={{ pointerEvents: "all" }}
    >
      {collapsed ? (
        <button
          className="bg-gray-900 text-green-400 px-2 py-1 rounded shadow-lg border border-gray-700"
          onClick={() => setCollapsed(false)}
        >
          &#128295; RAG
        </button>
      ) : (
        <div className="bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 text-green-300">
            <span className="font-semibold text-xs">&#128295; RAG 调试</span>
            <button className="text-gray-400 hover:text-white px-1" onClick={() => setCollapsed(true)}>_</button>
          </div>

          {/* Status */}
          <div className="px-3 py-2 border-b border-gray-700/50 space-y-0.5 text-gray-400">
            {currentNovel ? (
              <>
                <div>小说: {currentNovel.title}</div>
                {meta ? (
                  <>
                    <div>引擎: BGE Small ZH <span className="text-green-400">&#10003;</span></div>
                    <div>向量: {meta.chunkCount}片段 · {meta.dim}维 · {meta.buildTime ? `${(meta.buildTime / 1000).toFixed(1)}s` : "?"}</div>
                  </>
                ) : (
                  <div>引擎: TF-IDF <span className="text-yellow-400">(BGE 未构建)</span></div>
                )}
              </>
            ) : (
              <div className="text-gray-500">未打开小说</div>
            )}
          </div>

          {/* Retrieval history */}
          <div className="max-h-64 overflow-auto">
            {entries.length === 0 && (
              <div className="px-3 py-4 text-gray-600 text-center">暂无检索记录</div>
            )}
            {entries.map((e) => (
              <div key={e.id} className="border-b border-gray-700/30">
                <button
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-800/50 flex items-center justify-between"
                  onClick={() => toggleEntry(e.id)}
                >
                  <span className="truncate text-gray-300 w-48">{e.query}</span>
                  <span className="text-gray-500 shrink-0">
                    {e.duration != null ? `${e.duration.toFixed(2)}s` : ""} · {e.results.length}条 · {e.engine}
                  </span>
                </button>
                {expanded.has(e.id) && (
                  <div className="px-3 py-1 bg-gray-800/50 space-y-1 max-h-40 overflow-auto">
                    {e.results.slice(0, 10).map((r, i) => (
                      <div key={i} className="text-gray-400 leading-relaxed">
                        <span className="text-green-500/70 text-[10px]">
                          {r.score.toFixed(3)}
                        </span>{" "}
                        <span className="text-gray-300">{r.content.slice(0, 120)}{r.content.length > 120 ? "…" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

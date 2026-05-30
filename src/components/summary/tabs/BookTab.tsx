/**
 * 全书分析 Tab 组件
 * 从 SummaryPanel.tsx 中提取
 */

import { Clock, Users, BookOpen } from "lucide-react";
import { SubItem } from "../shared/SubItem";
import type { SummaryItem } from "@/stores/summary-store";
import type { GraphData } from "@/hooks/useSummarizer";

interface BookTabProps {
  /** 时间线总结 */
  timelineSummaries: SummaryItem[];
  /** 人物分析总结 */
  characterSummaries: SummaryItem[];
  /** 全书总览总结 */
  globalSummaries: SummaryItem[];
  /** 当前展开的子项 */
  bookSub: string | null;
  /** 设置展开的子项 */
  setBookSub: (sub: string | null) => void;
  /** 是否正在加载 */
  loading: boolean;
  /** 图谱数据 */
  characterGraphData: GraphData | null;
  /** 生成时间线 */
  onGenerateTimeline: () => void;
  /** 重新生成时间线 */
  onRegenerateTimeline: () => void;
  /** 生成人物分析 */
  onGenerateCharacters: () => void;
  /** 重新生成人物分析 */
  onRegenerateCharacters: () => void;
  /** 生成图谱 */
  onGenerateGraph: () => Promise<void>;
  /** 重新生成图谱 */
  onRegenerateGraph: () => Promise<void>;
  /** 生成全书总览 */
  onGenerateGlobal: () => void;
  /** 重新生成全书总览 */
  onRegenerateGlobal: () => void;
}

export function BookTab({
  timelineSummaries,
  characterSummaries,
  globalSummaries,
  bookSub,
  setBookSub,
  loading,
  characterGraphData,
  onGenerateTimeline,
  onRegenerateTimeline,
  onGenerateCharacters,
  onRegenerateCharacters,
  onGenerateGraph,
  onRegenerateGraph,
  onGenerateGlobal,
  onRegenerateGlobal,
}: BookTabProps) {
  return (
    <div className="px-2.5 pt-2 pb-2 space-y-1">
      {/* 剧情时间线 */}
      <SubItem
        label="剧情时间线"
        icon={<Clock className="h-3 w-3" />}
        isOpen={bookSub === "timeline"}
        onClick={() => setBookSub(bookSub === "timeline" ? null : "timeline")}
        summaries={timelineSummaries}
        onGenerate={onGenerateTimeline}
        onRegenerate={onRegenerateTimeline}
        loading={loading}
        emptyLabel="生成剧情时间线"
      />

      {/* 全书人物关系 */}
      <SubItem
        label="全书人物关系"
        icon={<Users className="h-3 w-3" />}
        isOpen={bookSub === "characters"}
        onClick={() => setBookSub(bookSub === "characters" ? null : "characters")}
        summaries={characterSummaries}
        onGenerate={onGenerateCharacters}
        onRegenerate={onRegenerateCharacters}
        loading={loading}
        emptyLabel="生成人物关系分析"
        graphData={characterGraphData}
        onGenerateGraph={onGenerateGraph}
        onRegenerateGraph={onRegenerateGraph}
      />

      {/* 全书总览 */}
      <SubItem
        label="全书总览"
        icon={<BookOpen className="h-3 w-3" />}
        isOpen={bookSub === "global"}
        onClick={() => setBookSub(bookSub === "global" ? null : "global")}
        summaries={globalSummaries}
        onGenerate={onGenerateGlobal}
        onRegenerate={onRegenerateGlobal}
        loading={loading}
        emptyLabel="生成全书总览"
      />
    </div>
  );
}

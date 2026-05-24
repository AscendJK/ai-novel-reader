import type { Agent, AgentContext, AgentResult } from "./types";
import { getProvider } from "@/api/registry";
import { useAPIStore } from "@/stores/api-store";
import { loadNovel } from "@/db/repositories";
import { APIError } from "@/api/error-handler";
import { estimateTokens, getTokenBudget } from "@/api/token-manager";

function getActiveProvider() {
  const config = useAPIStore.getState().getActiveProvider();
  if (!config) throw new Error("请先在设置中配置 API");
  return getProvider(config);
}

export const characterAnalysisAgent: Agent = {
  name: "character-analysis",
  description: "分析小说主要人物及其关系",

  async run(context: AgentContext): Promise<AgentResult> {
    const provider = getActiveProvider();
    const novel = await loadNovel(context.novelId);
    if (!novel) return { success: false, error: "小说数据未找到" };

    const providerConfig = useAPIStore.getState().getActiveProvider();
    const model = providerConfig?.model || "";
    const budget = getTokenBudget(model);

    const chapterList = novel.chapters
      .map((c, i) => `${i + 1}. ${c.title} (${c.content.length.toLocaleString()}字)`)
      .join("\n");

    const relevantContent = context.preRetrieved && context.preRetrieved.length > 100
      ? context.preRetrieved
      : (() => {
          const indices = [0, 1, 2];
          if (novel.chapters.length > 6) indices.push(Math.floor(novel.chapters.length / 2));
          if (novel.chapters.length > 3) indices.push(novel.chapters.length - 1);
          return [...new Set(indices)]
            .filter((i) => i < novel.chapters.length)
            .map((i) => `【${novel.chapters[i].title}】\n${novel.chapters[i].content.slice(0, 2000)}`)
            .join("\n\n---\n\n");
        })();

    const promptLabel = context.preRetrieved ? "语义检索相关段落" : "内容样本";

    const prompt = `你是一位专业的小说人物关系分析专家。请根据以下小说信息，分析主要人物及其关系网络。

**小说：**《${novel.title}》${novel.author ? ` · 作者：${novel.author}` : ""}
**总字数：** ${novel.totalChars.toLocaleString()} 字
**章节数：** ${novel.chapters.length} 章

**章节目录：**
${chapterList}

**${promptLabel}：**
${relevantContent}

请输出以下两部分内容，用 \`---GRAPH_JSON---\` 分隔：

**第一部分：文字分析**
1. **主要人物档案**（识别 5-10 个最重要的角色）：每个角色列出姓名、性格关键词、角色定位、人物简介、角色弧光
2. **人物关系网络**：列出每对重要人物之间的关系类型及演变
3. **人物重要性评估**：按剧情推动作用排序

**第二部分：关系图谱数据（JSON）**
在 \`---GRAPH_JSON---\` 之后，输出一个 JSON 对象，格式如下：
\`\`\`json
{
  "nodes": [
    { "id": "张三", "group": "主角", "description": "勇敢的青年剑客" },
    { "id": "李四", "group": "反派", "description": "野心勃勃的魔教教主" }
  ],
  "edges": [
    { "source": "张三", "target": "李四", "label": "敌对" },
    { "source": "张三", "target": "王五", "label": "师徒" }
  ]
}
\`\`\`
要求：
- nodes 数组包含所有识别出的人物，group 可选值：主角/配角/反派/导师/恋人/其他
- edges 数组包含所有重要关系，label 为关系类型（如：亲情/友情/爱情/敌对/师徒/利用/暗恋/仇敌）
- 确保所有 edges 中的 source 和 target 都在 nodes 中存在`;

    const estimatedInput = estimateTokens(prompt);
    const usePrompt =
      estimatedInput < budget.maxInputTokens * 0.7
        ? prompt
        : `请根据小说《${novel.title}》的章节目录分析人物关系。

章节目录：
${chapterList}

请输出文字分析，并用 ---GRAPH_JSON--- 分隔后输出 JSON 图谱数据（节点和边）。`;

    try {
      const response = await provider.chat({
        model: "",
        messages: [
          { role: "system", content: "你是一位资深的小说人物分析师。请确保 JSON 部分格式正确，所有边的节点引用与 nodes 中的 id 一致。" },
          { role: "user", content: usePrompt },
        ],
        max_tokens: 4096,
        temperature: 0.4,
        signal: context.signal,
      });

      // Parse response: split text analysis and graph JSON
      const fullContent = response.content;
      const graphMarker = "---GRAPH_JSON---";
      const markerIndex = fullContent.indexOf(graphMarker);

      let textAnalysis = fullContent;
      let graphData: { nodes: { id: string; group: string; description: string }[]; edges: { source: string; target: string; label: string }[] } | null = null;

      if (markerIndex !== -1) {
        textAnalysis = fullContent.slice(0, markerIndex).trim();
        const jsonPart = fullContent.slice(markerIndex + graphMarker.length).trim();
        // Extract JSON from code block if present
        const jsonMatch = jsonPart.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            graphData = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error("Character analysis graph JSON parse failed:", e);
          }
        }
      }

      return {
        success: true,
        data: { content: textAnalysis, graphData },
        tokensUsed: response.tokensUsed.total,
      };
    } catch (err) {
      if (err instanceof APIError) {
        return { success: false, error: `[${err.code}] ${err.message}` };
      }
      return { success: false, error: err instanceof Error ? err.message : "未知错误" };
    }
  },
};

export const timelineAgent: Agent = {
  name: "timeline",
  description: "提取小说剧情时间线",

  async run(context: AgentContext): Promise<AgentResult> {
    const provider = getActiveProvider();
    const novel = await loadNovel(context.novelId);
    if (!novel) return { success: false, error: "小说数据未找到" };

    const providerConfig = useAPIStore.getState().getActiveProvider();
    const model = providerConfig?.model || "";
    const budget = getTokenBudget(model);

    const chapterList = novel.chapters
      .map((c, i) => `${i + 1}. ${c.title} (${c.content.length.toLocaleString()}字)`)
      .join("\n");

    const relevantContent = context.preRetrieved && context.preRetrieved.length > 100
      ? context.preRetrieved
      : (() => {
          const indices = [0, 1];
          if (novel.chapters.length > 5) indices.push(Math.floor(novel.chapters.length / 3));
          if (novel.chapters.length > 6) indices.push(Math.floor(novel.chapters.length / 2));
          if (novel.chapters.length > 7) indices.push(Math.floor((novel.chapters.length * 2) / 3));
          if (novel.chapters.length > 3) indices.push(novel.chapters.length - 1);
          return [...new Set(indices)]
            .filter((i) => i < novel.chapters.length)
            .map((i) => `【${novel.chapters[i].title}】${novel.chapters[i].content.slice(0, 1500)}`)
            .join("\n\n---\n\n");
        })();

    const promptLabel = context.preRetrieved ? "语义检索相关段落" : "关键章节样本";

    const prompt = `你是一位专业的小说剧情分析师。请根据以下小说信息，提取关键剧情时间线。

**小说：**《${novel.title}》${novel.author ? ` · 作者：${novel.author}` : ""}
**总字数：** ${novel.totalChars.toLocaleString()} 字
**章节数：** ${novel.chapters.length} 章

**章节目录：**
${chapterList}

**${promptLabel}：**
${relevantContent}

**分析要求：**
1. **剧情主线时间线**（按时间顺序列出 15-25 个关键事件，每个事件标注章节编号、类型、因果关系）
2. **剧情结构分析**（开端/发展/转折/高潮/结局在哪些章节、叙事手法、主线与支线分布）
3. **伏笔与回收**（重要的伏笔及其回收章节）

请用清晰的时间线格式呈现。`;

    const estimatedInput = estimateTokens(prompt);
    const usePrompt =
      estimatedInput < budget.maxInputTokens * 0.7
        ? prompt
        : `请根据《${novel.title}》的章节目录推断剧情时间线。\n章节目录：\n${chapterList}\n请基于章节目录提取关键事件的时间线（标注"基于目录推断"）。`;

    try {
      const response = await provider.chat({
        model: "",
        messages: [
          { role: "system", content: "你是一位资深的小说剧情分析师，擅长提取和梳理剧情时间线。" },
          { role: "user", content: usePrompt },
        ],
        max_tokens: 4096,
        temperature: 0.4,
        signal: context.signal,
      });

      return {
        success: true,
        data: { content: response.content },
        tokensUsed: response.tokensUsed.total,
      };
    } catch (err) {
      if (err instanceof APIError) {
        return { success: false, error: `[${err.code}] ${err.message}` };
      }
      return { success: false, error: err instanceof Error ? err.message : "未知错误" };
    }
  },
};

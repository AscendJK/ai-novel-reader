import type { Agent, AgentContext, AgentResult } from "./types";
import { getProvider } from "@/api/registry";
import { useAPIStore } from "@/stores/api-store";
import { loadNovel } from "@/db/repositories";
import { APIError } from "@/api/error-handler";
import { estimateTokens, getTokenBudget } from "@/api/token-manager";

export const characterGraphAgent: Agent = {
  name: "character-graph",
  description: "只生成人物关系图谱JSON数据",

  async run(context: AgentContext): Promise<AgentResult> {
    const config = useAPIStore.getState().getActiveProvider();
    if (!config) throw new Error("请先在设置中配置 API");
    const provider = getProvider(config);

    const novel = await loadNovel(context.novelId);
    if (!novel) return { success: false, error: "小说数据未找到" };

    const model = config.model || "";
    const budget = getTokenBudget(model);

    const chapterList = novel.chapters.map((c, i) => `${i + 1}. ${c.title}`).join("\n");

    const indices = [0, 1, 2];
    if (novel.chapters.length > 6) indices.push(Math.floor(novel.chapters.length / 2));
    if (novel.chapters.length > 3) indices.push(novel.chapters.length - 1);

    const samples = [...new Set(indices)]
      .filter((i) => i < novel.chapters.length)
      .map((i) => `【${novel.chapters[i].title}】\n${novel.chapters[i].content.slice(0, 2000)}`)
      .join("\n\n---\n\n");

    const prompt = `你是一位专业的小说人物关系分析专家。请根据以下小说信息，生成人物关系图谱的JSON数据。

**小说：**《${novel.title}》
**章节目录：**
${chapterList}

**内容样本：**
${samples}

请**只输出**一个JSON对象（不要其他任何文字），格式如下：
{"nodes":[{"id":"张三","group":"主角","description":"勇敢的青年剑客"}],"edges":[{"source":"张三","target":"李四","label":"敌对"}]}

要求：
- 识别8-15个重要角色
- group可选值：主角/配角/反派/导师/恋人/其他
- label可选值：亲情/友情/爱情/敌对/师徒/利用/暗恋/仇敌/合作
- 确保所有source和target都在nodes中存在`;

    const estimatedInput = estimateTokens(prompt);
    const usePrompt = estimatedInput < budget.maxInputTokens * 0.7
      ? prompt
      : `请根据小说《${novel.title}》的章节目录生成人物关系图谱JSON。\n章节目录：\n${chapterList}\n请只输出JSON。`;

    try {
      const response = await provider.chat({
        model: "",
        messages: [
          { role: "system", content: "你是一个JSON数据生成器。只输出JSON，不要任何解释文字。" },
          { role: "user", content: usePrompt },
        ],
        max_tokens: 2048,
        temperature: 0.3,
        signal: context.signal,
      });

      // Parse JSON from response - strip markdown code fences first
      let raw = response.content.trim();
      // Remove ```json ... ``` or ``` ... ``` wrappers (handle trailing whitespace/newlines)
      raw = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```[\s\S]*$/i, "");

      let graphData: { nodes: { id: string; group: string; description: string }[]; edges: { source: string; target: string; label: string }[] } | null = null;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          graphData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          return { success: false, error: "图谱数据解析失败，请重试。AI 返回的 JSON 格式不正确。" };
        }
        // Validate structure (check for empty arrays too)
        if (!Array.isArray(graphData?.nodes) || graphData.nodes.length === 0) {
          return { success: false, error: "图谱数据不完整（nodes 为空或不是数组），请重试。" };
        }
        if (!Array.isArray(graphData?.edges) || graphData.edges.length === 0) {
          return { success: false, error: "图谱数据不完整（edges 为空或不是数组），请重试。" };
        }
        // Validate edge references
        const nodeIds = new Set(graphData.nodes.map((n: { id: string }) => n.id));
        for (const edge of graphData.edges) {
          if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
            return { success: false, error: `图谱数据有误：边引用了不存在的节点 "${edge.source}" 或 "${edge.target}"，请重试。` };
          }
        }
      } else {
        return { success: false, error: "未能从 AI 回复中提取到 JSON 图谱数据，请重试。" };
      }

      return { success: true, data: { graphData }, tokensUsed: response.tokensUsed.total };
    } catch (err) {
      if (err instanceof APIError) return { success: false, error: `[${err.code}] ${err.message}` };
      return { success: false, error: err instanceof Error ? err.message : "未知错误" };
    }
  },
};

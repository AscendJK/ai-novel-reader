/**
 * 人物关系图谱 Agent
 */

import type { AgentContext, AgentResult } from "./types";
import type { AgentEnvironment } from "./base-agent";
import { BaseAgent } from "./base-agent";
import { getRelevantContent } from "./utils";
import { useUIStore } from "@/stores/ui-store";
import { estimateTokens } from "@/api/token-manager";

interface GraphData {
  nodes: { id: string; group: string; description: string }[];
  edges: { source: string; target: string; label: string }[];
}

/**
 * 人物关系图谱 Agent
 */
class CharacterGraphAgent extends BaseAgent {
  name = "character-graph";
  description = "只生成人物关系图谱JSON数据";

  protected async execute(context: AgentContext, env: AgentEnvironment): Promise<AgentResult> {
    const { novel, provider, budget } = env;

    const chapterList = novel.chapters.map((c, i) => `${i + 1}. ${c.title}`).join("\n");

    const { content: relevantContent, label: promptLabel } = getRelevantContent(context, novel.chapters);
    const charLimit = useUIStore.getState().graphCharacterLimit;

    context.onStatus?.("正在组织提示词...");
    const prompt = `你是一位专业的小说人物关系分析专家。请根据以下小说信息，生成人物关系图谱的JSON数据。

**小说：**《${novel.title}》
**章节目录：**
${chapterList}

**${promptLabel}：**
${relevantContent}

请**只输出**一个JSON对象（不要其他任何文字），格式如下：
{"nodes":[{"id":"张三","group":"主角","description":"勇敢的青年剑客"}],"edges":[{"source":"张三","target":"李四","label":"敌对"}]}

要求：
- 识别10-${charLimit}个重要角色
- group可选值：主角/配角/反派/导师/恋人/其他
- label可选值：亲情/友情/爱情/敌对/师徒/利用/暗恋/仇敌/合作
- 确保所有source和target都在nodes中存在`;

    const estimatedInput = estimateTokens(prompt);
    const useFallback = estimatedInput >= budget.maxInputTokens * 0.7;
    const usePrompt = useFallback
      ? `请根据小说《${novel.title}》的章节目录生成人物关系图谱JSON。\n章节目录：\n${chapterList}\n请只输出JSON。`
      : prompt;

    try {
      context.onStatus?.("正在等待 AI 回答...");
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

      // Parse JSON from response
      context.onStatus?.("正在解析人物图谱...");
      const graphData = this.parseGraphData(response.content);

      if (!graphData) {
        return { success: false, error: "未能从 AI 回复中提取到 JSON 图谱数据，请重试。" };
      }

      // Validate structure
      const validationError = this.validateGraphData(graphData);
      if (validationError) {
        return { success: false, error: validationError };
      }

      return { success: true, data: { graphData }, tokensUsed: response.tokensUsed.total };
    } catch (err) {
      return { success: false, error: this.formatError(err) };
    }
  }

  /**
   * 解析图谱 JSON 数据
   */
  private parseGraphData(content: string): GraphData | null {
    let raw = content.trim();
    // Remove ```json ... ``` or ``` ... ``` wrappers
    raw = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```[\s\S]*$/i, "");

    // Try direct parse first
    try {
      return JSON.parse(raw);
    } catch {
      // Fallback: extract first balanced JSON object
      const start = raw.indexOf("{");
      if (start >= 0) {
        let depth = 0;
        for (let i = start; i < raw.length; i++) {
          if (raw[i] === "{") depth++;
          else if (raw[i] === "}") depth--;
          if (depth === 0) {
            try {
              return JSON.parse(raw.slice(start, i + 1));
            } catch { /* not valid JSON */ }
            break;
          }
        }
      }
    }
    return null;
  }

  /**
   * 验证图谱数据结构
   */
  private validateGraphData(graphData: GraphData): string | null {
    if (!Array.isArray(graphData?.nodes) || graphData.nodes.length === 0) {
      return "图谱数据不完整（nodes 为空或不是数组），请重试。";
    }
    if (!Array.isArray(graphData?.edges) || graphData.edges.length === 0) {
      return "图谱数据不完整（edges 为空或不是数组），请重试。";
    }

    // Filter out invalid edges (edges referencing non-existent nodes)
    const nodeIds = new Set(graphData.nodes.map((n) => n.id));
    const validEdges = graphData.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    if (validEdges.length === 0) {
      return "图谱数据有误：所有边都引用了不存在的节点，请重试。";
    }

    // Use filtered edges
    graphData.edges = validEdges;
    return null;
  }

  private formatError(err: unknown): string {
    if (err instanceof Error) return err.message;
    return "未知错误";
  }
}

// 导出 Agent 实例
export const characterGraphAgent = new CharacterGraphAgent();

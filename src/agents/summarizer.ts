import type { Agent, AgentContext, AgentResult } from "./types";
import { buildChapterSummaryPrompt } from "@/lib/prompt-templates";
import { getProvider } from "@/api/registry";
import { useAPIStore } from "@/stores/api-store";
import { estimateTokens, getTokenBudget } from "@/api/token-manager";
import { loadNovel } from "@/db/repositories";
import { APIError } from "@/api/error-handler";

function getActiveProvider() {
  const config = useAPIStore.getState().getActiveProvider();
  if (!config) throw new Error("请先在设置中配置 API");
  return getProvider(config);
}

export const summarizerAgent: Agent = {
  name: "summarizer",
  description: "生成章节摘要或全书总结",

  async run(context: AgentContext): Promise<AgentResult> {
    const provider = getActiveProvider();
    const novel = await loadNovel(context.novelId);
    if (!novel) return { success: false, error: "小说数据未找到" };

    const targetChapterIds = context.chapterIds || novel.chapters.map((c) => c.id);
    const chapters = novel.chapters.filter((c) => targetChapterIds.includes(c.id));

    if (chapters.length === 0) {
      return { success: false, error: "未找到指定章节" };
    }

    const results: { chapterTitle: string; content: string; tokens: number }[] = [];
    let totalTokens = 0;

    for (const chapter of chapters) {
      const prompt = buildChapterSummaryPrompt(chapter.title, chapter.content);

      try {
        const response = await provider.chat({
          model: "",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1024,
          temperature: 0.5,
          signal: context.signal,
        });

        results.push({
          chapterTitle: chapter.title,
          content: response.content,
          tokens: response.tokensUsed.total,
        });
        totalTokens += response.tokensUsed.total;
      } catch (err) {
        const message = err instanceof APIError
          ? `[${err.code}] ${err.message}`
          : err instanceof Error ? err.message : "未知错误";
        results.push({
          chapterTitle: chapter.title,
          content: `总结生成失败: ${message}`,
          tokens: 0,
        });
      }
    }

    return {
      success: true,
      data: { summaries: results, totalTokens },
      tokensUsed: totalTokens,
    };
  },
};

export const globalSummarizerAgent: Agent = {
  name: "global-summarizer",
  description: "生成全书总结（发送小说结构信息+内容样本，让大模型自行分析）",

  async run(context: AgentContext): Promise<AgentResult> {
    const provider = getActiveProvider();
    const novel = await loadNovel(context.novelId);
    if (!novel) return { success: false, error: "小说数据未找到" };

    const providerConfig = useAPIStore.getState().getActiveProvider();
    const model = providerConfig?.model || "";
    const budget = getTokenBudget(model);

    // Build a prompt with metadata + chapter structure + content samples
    const chapterList = novel.chapters
      .map((c, i) => `${i + 1}. ${c.title} (${c.content.length.toLocaleString()} 字)`)
      .join("\n");

    // Take samples: first 1500 chars of first 2 chapters + last chapter
    const sampleChapters: string[] = [];
    if (novel.chapters.length > 0) {
      sampleChapters.push(
        `【${novel.chapters[0].title}】开头:\n${novel.chapters[0].content.slice(0, 1500)}`
      );
    }
    if (novel.chapters.length > 1) {
      sampleChapters.push(
        `【${novel.chapters[1].title}】开头:\n${novel.chapters[1].content.slice(0, 1500)}`
      );
    }
    // Middle chapter
    if (novel.chapters.length > 4) {
      const mid = Math.floor(novel.chapters.length / 2);
      sampleChapters.push(
        `【${novel.chapters[mid].title}】开头:\n${novel.chapters[mid].content.slice(0, 1500)}`
      );
    }
    // Last chapter
    if (novel.chapters.length > 2) {
      const last = novel.chapters[novel.chapters.length - 1];
      sampleChapters.push(
        `【${last.title}】开头:\n${last.content.slice(0, 1500)}`
      );
    }

    const metadataPrompt = `你是一位专业的小说分析助手。你需要分析一部小说，以下是该小说的基本信息，请基于这些信息生成一份全面的分析报告。

**小说基本信息：**
- 书名：《${novel.title}》${novel.author ? `\n- 作者：${novel.author}` : ""}
- 文件：${novel.fileName}
- 总字数：${novel.totalChars.toLocaleString()} 字
- 章节数：${novel.chapters.length} 章

**完整章节目录：**
${chapterList}

**内容样本（开头几章+中间+结尾的片段）：**
${sampleChapters.join("\n\n---\n\n")}

**分析要求：**
请根据以上信息，生成一份详细的分析报告，包含：

1. **故事主线**：根据章节目录和内容样本，推断并梳理核心剧情走向。如果信息不足以完整还原，请标注"基于现有信息推断"。
2. **主要人物**：从内容样本中识别出现的重要角色，描述其特征和关系。
3. **主题分析**：识别小说的核心主题（爱情、复仇、成长、悬疑等），并引用章节内容佐证。
4. **结构特点**：分析小说的章节结构、叙事节奏。
5. **阅读建议**：基于章节分布，给读者提供阅读建议。

注意：由于只提供了内容样本，部分分析可能需要基于样本推断，请如实标注不确定的部分。`;

    const estimatedInput = estimateTokens(metadataPrompt);
    const fallbackPrompt = `你是一位专业的小说分析助手。请根据以下小说基本信息生成分析报告。

书名：《${novel.title}》
作者：${novel.author || "未知"}
总字数：${novel.totalChars.toLocaleString()} 字
章节数：${novel.chapters.length} 章

章节目录：
${chapterList}

请基于章节目录和你的文学知识，生成：
1. 故事主线推断
2. 可能的主题方向
3. 结构分析
4. 阅读建议

（注意：你没有完整文本，请基于章节目录和标题进行合理推断，并在回复中注明）`;

    // If the full prompt is too large, use the fallback
    const usePrompt =
      estimatedInput < budget.maxInputTokens * 0.7 ? metadataPrompt : fallbackPrompt;

    try {
      const response = await provider.chat({
        model: "",
        messages: [
          {
            role: "system",
            content: "你是一位经验丰富的小说分析专家，擅长从有限信息中提取洞察。当信息不足时，你会诚实地标注推断的不确定性。",
          },
          { role: "user", content: usePrompt },
        ],
        max_tokens: 4096,
        temperature: 0.5,
        signal: context.signal,
      });

      return {
        success: true,
        data: {
          content: response.content,
          usedFallback: usePrompt === fallbackPrompt,
        },
        tokensUsed: response.tokensUsed.total,
      };
    } catch (err) {
      if (err instanceof APIError) {
        return {
          success: false,
          error: `[${err.code}] ${err.message}${err.code === "context_length" ? " (提示：小说文本过长，已自动使用精简模式，但仍超出限制。请尝试使用支持更长上下文的模型。)" : ""}`,
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : "未知错误",
      };
    }
  },
};

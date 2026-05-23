export function buildChapterSummaryPrompt(chapterTitle: string, chapterContent: string): string {
  return `你是一位专业的小说分析助手。请对以下小说章节进行深度总结，要求：

1. **核心情节**（2-3句话概括本章发生的主要事件）
2. **关键人物**（列出本章出现的主要角色及其行为）
3. **重要伏笔**（如果有的话，指出本章埋下的伏笔或悬念）
4. **主题发展**（本章对小说主题的推进作用）

请用简洁清晰的中文回答，总字数控制在 300-500 字。

章节标题：${chapterTitle}

章节内容：
${chapterContent}`;
}

export function buildGlobalSummaryPrompt(chapterSummaries: string[]): string {
  const combined = chapterSummaries
    .map((s, i) => `第${i + 1}部分摘要：\n${s}`)
    .join("\n\n---\n\n");

  return `你是一位专业的小说分析助手。以下是小说各部分的章节摘要，请基于这些摘要生成一份全书总结，包括：

1. **故事主线**（按时间顺序梳理核心剧情，500-800字）
2. **人物关系网**（主要角色及其之间的关系，以结构化方式呈现）
3. **主题分析**（识别2-3个核心主题并简要阐述）
4. **关键转折点**（列出3-5个重要的剧情转折）

请用清晰的中文回答。

${combined}`;
}

export function buildCharacterAnalysisPrompt(fullText: string): string {
  return `你是一位专业的小说人物分析专家。请分析以下小说文本中的主要人物，要求：

1. 识别出5-10个最重要的角色
2. 对每个角色，提供：
   - 姓名/称呼
   - 性格特点（3-5个关键词）
   - 角色定位（主角/配角/反派等）
   - 与其他角色的关系
   - 角色弧光（如有明显变化）

请用结构化的方式呈现，方便后续可视化。

小说文本（节选）：
${fullText}`;
}

export function buildTimelinePrompt(chapterSummaries: string[]): string {
  const combined = chapterSummaries
    .map((s, i) => `[章节${i + 1}] ${s}`)
    .join("\n\n");

  return `你是一位专业的小说分析助手。请根据以下章节摘要，提取关键事件时间线。

要求：
1. 按时间顺序列出15-20个最重要的剧情事件
2. 每个事件标注发生的章节编号
3. 如果事件之间有因果关系，请标注出来
4. 标注出重要的伏笔和回收点

请用清晰的时间线格式呈现。

${combined}`;
}

export function buildRewritePrompt(originalText: string, styleInstruction: string): string {
  return `你是一位专业的小说改编助手。请根据以下要求改写文本。

改写要求：${styleInstruction}

注意：
- 保留原文的核心情节和人物关系
- 保持逻辑连贯性
- 语言流畅自然

原文：
${originalText}`;
}

export function buildContinuationPrompt(context: string, direction: string, length: number): string {
  return `你是一位专业的小说续写助手。请根据前文内容，续写后续情节。

前文内容：
${context}

续写方向：${direction || "自然延续当前情节"}
续写字数：约${length}字

要求：
- 保持与前文一致的文风和视角
- 人物性格和行为逻辑保持一致
- 情节发展要合理且吸引人
- 保持世界观设定一致`;
}

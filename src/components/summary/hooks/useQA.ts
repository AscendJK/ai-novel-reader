/**
 * useQA hook - 问答逻辑
 * 从 SummaryPanel.tsx 中提取
 */

import { useState, useCallback } from "react";
import { useSummarizer } from "@/hooks/useSummarizer";

interface QAMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokensUsed?: number;
}

interface RangeResult {
  id: string;
  title: string;
  content: string;
  tokensUsed: number;
  createdAt: number;
}

interface UseQAReturn {
  /** 问答消息列表 */
  qaMessages: QAMessage[];
  /** 设置问答消息列表 */
  setQaMessages: React.Dispatch<React.SetStateAction<QAMessage[]>>;
  /** 自定义问题 */
  customQuestion: string;
  /** 设置自定义问题 */
  setCustomQuestion: React.Dispatch<React.SetStateAction<string>>;
  /** 范围总结 - 起始章节 */
  rangeFrom: string;
  /** 设置范围总结 - 起始章节 */
  setRangeFrom: React.Dispatch<React.SetStateAction<string>>;
  /** 范围总结 - 结束章节 */
  rangeTo: string;
  /** 设置范围总结 - 结束章节 */
  setRangeTo: React.Dispatch<React.SetStateAction<string>>;
  /** 范围总结结果 */
  rangeResults: RangeResult[];
  /** 设置范围总结结果 */
  setRangeResults: React.Dispatch<React.SetStateAction<RangeResult[]>>;
  /** 是否正在加载 */
  qaLoading: boolean;
  /** 错误信息 */
  qaError: string | null;
  /** 设置错误信息 */
  setQaError: React.Dispatch<React.SetStateAction<string | null>>;
  /** 提交问题 */
  handleSubmitQuestion: () => Promise<void>;
  /** 生成范围总结 */
  handleRangeSummary: () => Promise<void>;
  /** 清除问答缓存 */
  handleClearQaCache: () => void;
  /** 添加消息 */
  addMessage: (role: "user" | "assistant", content: string, tokensUsed?: number) => void;
}

export function useQA(): UseQAReturn {
  const [qaMessages, setQaMessages] = useState<QAMessage[]>([]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [rangeResults, setRangeResults] = useState<RangeResult[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const {
    askCustomQuestion,
    generateRangeSummary,
    clearQaCache,
  } = useSummarizer();

  // 添加消息（新消息在前）
  const addMessage = useCallback((role: "user" | "assistant", content: string, tokensUsed?: number) => {
    const message: QAMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      tokensUsed,
    };
    setQaMessages((prev) => [message, ...prev]);
  }, []);

  // 提交问题
  const handleSubmitQuestion = useCallback(async () => {
    if (!customQuestion.trim() || qaLoading) return;

    const question = customQuestion.trim();
    setCustomQuestion("");
    setQaLoading(true);
    setQaError(null);

    // 添加用户消息
    addMessage("user", question);

    try {
      // 构建对话历史（包含当前问题）
      const currentHistory = qaMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      // 添加当前用户消息到历史
      const fullHistory = [
        ...currentHistory,
        { role: "user" as const, content: question }
      ];

      // 调用问答
      const result = await askCustomQuestion(question, fullHistory);

      if (result) {
        // 添加 AI 回复
        addMessage("assistant", result.answer, result.tokensUsed);
      } else {
        setQaError("问答失败，请重试");
      }
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "问答失败");
    } finally {
      setQaLoading(false);
    }
  }, [customQuestion, qaLoading, qaMessages, askCustomQuestion, addMessage]);

  // 生成范围总结
  const handleRangeSummary = useCallback(async () => {
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo, 10);

    if (isNaN(from) || isNaN(to) || from < 1 || to < from) {
      setQaError("请输入有效的章节范围");
      return;
    }

    if (to - from + 1 > 20) {
      setQaError("范围不能超过 20 章");
      return;
    }

    setQaLoading(true);
    setQaError(null);

    try {
      const result = await generateRangeSummary(from, to);
      if (result) {
        setRangeResults((prev) => [result, ...prev]);
        setRangeFrom("");
        setRangeTo("");
      }
    } catch (err) {
      setQaError(err instanceof Error ? err.message : "范围总结失败");
    } finally {
      setQaLoading(false);
    }
  }, [rangeFrom, rangeTo, generateRangeSummary]);

  // 清除问答缓存
  const handleClearQaCache = useCallback(() => {
    clearQaCache();
    setQaMessages([]);
    setRangeResults([]);
    setQaError(null);
  }, [clearQaCache]);

  return {
    qaMessages,
    setQaMessages,
    customQuestion,
    setCustomQuestion,
    rangeFrom,
    setRangeFrom,
    rangeTo,
    setRangeTo,
    rangeResults,
    setRangeResults,
    qaLoading,
    qaError,
    setQaError,
    handleSubmitQuestion,
    handleRangeSummary,
    handleClearQaCache,
    addMessage,
  };
}

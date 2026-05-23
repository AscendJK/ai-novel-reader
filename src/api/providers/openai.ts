import type { AIProvider, ChatCompletionRequest, ChatCompletionResponse, ProviderConfig } from "../types";
import { APIError, handleFetchError } from "../error-handler";

export function createOpenAIProvider(config: ProviderConfig): AIProvider {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";

  return {
    type: "openai",
    async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          signal: req.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model || req.model || "gpt-4o",
            messages: req.messages,
            max_tokens: req.max_tokens ?? config.maxTokens ?? 2048,
            temperature: req.temperature ?? 0.7,
          }),
        });
      } catch {
        throw new APIError(
          "网络请求失败：无法连接到 API 服务器。请检查网络连接或 API 地址是否正确。",
          "network"
        );
      }

      if (!response.ok) {
        await handleFetchError(response);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || "",
        tokensUsed: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0,
        },
      };
    },
  };
}

import type { AIProvider, ChatCompletionRequest, ChatCompletionResponse, ProviderConfig } from "../types";
import { APIError, handleFetchError } from "../error-handler";

export function createOpenAICompatProvider(config: ProviderConfig): AIProvider {
  const baseUrl = config.baseUrl.replace(/\/+$/, "") || "https://api.openai.com/v1";

  return {
    type: config.type,
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
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        throw new APIError(
          "网络请求失败：无法连接到 API 服务器。请检查 API 地址和网络连接。",
          "network"
        );
      }

      if (!response.ok) {
        await handleFetchError(response);
      }

      const data = await response.json();
      if (!data || typeof data !== "object") {
        throw new APIError("API 返回了无法识别的响应格式，请检查 API 地址和密钥。", "unknown");
      }
      return {
        content: typeof data.choices?.[0]?.message?.content === "string" ? data.choices[0].message.content : "",
        tokensUsed: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0,
        },
      };
    },
  };
}

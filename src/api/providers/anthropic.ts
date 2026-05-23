import type { AIProvider, ChatCompletionRequest, ChatCompletionResponse, ProviderConfig } from "../types";
import { APIError, handleFetchError } from "../error-handler";

export function createAnthropicProvider(config: ProviderConfig): AIProvider {
  const baseUrl = config.baseUrl || "https://api.anthropic.com/v1";

  return {
    type: "anthropic",
    async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
      let systemPrompt = "";
      const messages: { role: string; content: string }[] = [];

      for (const msg of req.messages) {
        if (msg.role === "system") {
          systemPrompt += (systemPrompt ? "\n" : "") + msg.content;
        } else {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      const body: Record<string, unknown> = {
        model: config.model || req.model || "claude-sonnet-4-6",
        max_tokens: req.max_tokens ?? config.maxTokens ?? 2048,
        messages,
      };

      if (systemPrompt) {
        body.system = systemPrompt;
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          signal: req.signal,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
        });
      } catch {
        throw new APIError(
          "网络请求失败：无法连接到 Anthropic API 服务器。",
          "network"
        );
      }

      if (!response.ok) {
        await handleFetchError(response);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || "";

      return {
        content,
        tokensUsed: {
          input: data.usage?.input_tokens || 0,
          output: data.usage?.output_tokens || 0,
          total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    },
  };
}

import type { AIProvider, ChatCompletionRequest, ChatCompletionResponse, ProviderConfig } from "../types";
import { APIError, handleFetchError } from "../error-handler";
import { authHeaders } from "@/lib/auth-headers";
import { useUIStore } from "@/stores/ui-store";

export function createOpenAICompatProvider(config: ProviderConfig): AIProvider {
  const baseUrl = config.baseUrl.replace(/\/+$/, "") || "https://api.openai.com/v1";

  async function doProxy(req: ChatCompletionRequest): Promise<Response> {
    const requestBody = {
      model: config.model || req.model || "gpt-4o",
      messages: req.messages,
      max_tokens: req.max_tokens ?? config.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.7,
    };
    return fetch("/api/proxy/chat", {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        url: `${baseUrl}/chat/completions`,
        headers: { Authorization: `Bearer ${config.apiKey}` },
        body: requestBody,
      }),
    });
  }

  async function doDirect(req: ChatCompletionRequest): Promise<Response> {
    return fetch(`${baseUrl}/chat/completions`, {
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
  }

  async function parseResponse(response: Response): Promise<ChatCompletionResponse> {
    if (!response.ok) await handleFetchError(response);
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
  }

  return {
    type: config.type,
    async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
      // If offline mode or no server token, direct only (no proxy available)
      const offline = useUIStore.getState().offlineMode;
      const hasToken = !!localStorage.getItem("sync-token");

      if (offline || !hasToken) {
        const response = await doDirect(req);
        return parseResponse(response);
      }

      try {
        // Try direct first
        const response = await doDirect(req);
        return await parseResponse(response);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        if (err instanceof APIError && err.code === "auth") throw err;
        // CORS or network error — try server proxy
        const response = await doProxy(req);
        return parseResponse(response);
      }
    },
  };
}

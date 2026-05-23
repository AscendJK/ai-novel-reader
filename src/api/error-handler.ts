export class APIError extends Error {
  constructor(
    message: string,
    public code: "auth" | "network" | "context_length" | "rate_limit" | "server" | "unknown",
    public statusCode?: number,
    public originalBody?: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

function classifyError(status: number, body: string): { code: APIError["code"]; message: string } {
  // Try parsing the error body
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(body); } catch { /* ignore */ }

  const apiMessage = typeof parsed?.error === "string" ? parsed.error
    : typeof parsed?.error?.message === "string" ? parsed.error.message
    : "";

  if (status === 401 || status === 403) {
    return {
      code: "auth",
      message: `API 认证失败 (${status})：请检查 API Key 是否正确`,
    };
  }

  if (status === 429) {
    return {
      code: "rate_limit",
      message: "API 请求频率过高，请稍后重试",
    };
  }

  if (status === 413 || status === 400) {
    const lower = apiMessage.toLowerCase();
    if (
      lower.includes("context") || lower.includes("token") || lower.includes("length") ||
      lower.includes("maximum") || lower.includes("limit") || lower.includes("too long") ||
      lower.includes("reduce") || lower.includes("truncat")
    ) {
      return {
        code: "context_length",
        message: `请求内容超过模型上下文长度限制 (${status})。已自动调整策略，请重试。`,
      };
    }
  }

  if (status >= 500) {
    return {
      code: "server",
      message: `API 服务器错误 (${status})：服务暂时不可用，请稍后重试`,
    };
  }

  return {
    code: "unknown",
    message: `API 错误 (${status}): ${apiMessage || body.slice(0, 300)}`,
  };
}

export async function handleFetchError(response: Response): Promise<never> {
  const body = await response.text();
  const { code, message } = classifyError(response.status, body);
  throw new APIError(message, code, response.status, body);
}

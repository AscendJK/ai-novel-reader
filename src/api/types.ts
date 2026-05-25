export type ProviderType = "openai" | "anthropic" | "deepseek" | `openai-compat-${number}`;
export const COMPAT_PREFIX = "openai-compat-";
export function isCompatProvider(type: string): type is `openai-compat-${number}` {
  return type.startsWith("openai-compat-");
}

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface ChatCompletionResponse {
  content: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
}

export interface AIProvider {
  type: ProviderType;
  chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}

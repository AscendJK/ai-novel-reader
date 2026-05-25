import type { AIProvider, ProviderConfig, ProviderType } from "./types";
import { isCompatProvider } from "./types";
import { createOpenAIProvider } from "./providers/openai";
import { createAnthropicProvider } from "./providers/anthropic";
import { createDeepSeekProvider } from "./providers/deepseek";
import { createOpenAICompatProvider } from "./providers/openai-compat";

function getFactory(type: ProviderType) {
  if (isCompatProvider(type)) return createOpenAICompatProvider;
  const map: Record<string, (config: ProviderConfig) => AIProvider> = {
    openai: createOpenAIProvider,
    anthropic: createAnthropicProvider,
    deepseek: createDeepSeekProvider,
  };
  return map[type];
}

const providerCache = new Map<string, AIProvider>();

export function getProvider(config: ProviderConfig): AIProvider {
  const cacheKey = `${config.type}:${config.apiKey}:${config.baseUrl}:${config.model}`;
  if (providerCache.has(cacheKey)) return providerCache.get(cacheKey)!;

  const factory = getFactory(config.type);
  if (!factory) throw new Error(`不支持的 API 提供商: ${config.type}`);

  const provider = factory(config);
  providerCache.set(cacheKey, provider);
  return provider;
}

export function clearProviderCache() {
  providerCache.clear();
}

export const PROVIDER_PRESETS: { type: ProviderType; name: string; baseUrl: string; defaultModel: string }[] = [
  { type: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
  { type: "anthropic", name: "Anthropic Claude", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-6" },
  { type: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
];

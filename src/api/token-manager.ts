// Rough token estimation: ~1 token per 2 Chinese chars, ~1 token per 4 English chars
export function estimateTokens(text: string): number {
  let chineseChars = 0;
  let otherChars = 0;

  for (const char of text) {
    if (/[一-鿿㐀-䶿\u{20000}-\u{2a6df}]/.test(char)) {
      chineseChars++;
    } else if (/\s/.test(char)) {
      otherChars += 0.25;
    } else {
      otherChars++;
    }
  }

  return Math.ceil(chineseChars / 1.5 + otherChars / 3.5);
}

export interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
}

const MODEL_LIMITS: Record<string, TokenBudget> = {
  "gpt-4o": { maxInputTokens: 128000, maxOutputTokens: 16384 },
  "gpt-4o-mini": { maxInputTokens: 128000, maxOutputTokens: 16384 },
  "gpt-4-turbo": { maxInputTokens: 128000, maxOutputTokens: 4096 },
  "claude-sonnet-4-6": { maxInputTokens: 200000, maxOutputTokens: 8192 },
  "claude-haiku-4-5": { maxInputTokens: 200000, maxOutputTokens: 8192 },
  "deepseek-chat": { maxInputTokens: 64000, maxOutputTokens: 8192 },
  "deepseek-reasoner": { maxInputTokens: 64000, maxOutputTokens: 8192 },
};

const DEFAULT_BUDGET: TokenBudget = { maxInputTokens: 64000, maxOutputTokens: 4096 };

export function getTokenBudget(model: string): TokenBudget {
  return MODEL_LIMITS[model] || DEFAULT_BUDGET;
}

export function canFitInContext(text: string, model: string, outputTokens: number): boolean {
  const budget = getTokenBudget(model);
  const estimated = estimateTokens(text);
  return estimated + outputTokens <= budget.maxInputTokens;
}

export function truncateToFit(text: string, model: string, reservedOutput: number): string {
  const budget = getTokenBudget(model);
  const maxInputEstimate = budget.maxInputTokens - reservedOutput;

  let currentTokens = estimateTokens(text);
  if (currentTokens <= maxInputEstimate) return text;

  // Binary search approximate truncation point
  let left = 0;
  let right = text.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const slice = text.slice(0, mid);
    if (estimateTokens(slice) <= maxInputEstimate) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  let result = text.slice(0, left);
  if (estimateTokens(result) > maxInputEstimate && left > 0) {
    result = text.slice(0, left - 1);
  }
  return result + "\n\n[文本因长度限制被截断...]";
}

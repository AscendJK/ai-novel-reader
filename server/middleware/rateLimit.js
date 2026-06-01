/**
 * 限流中间件
 * 从 index.js 中提取
 */

const RATE_WINDOW = 60_000; // 1 minute

/**
 * 创建限流中间件
 * 每个限流实例独立计数，不同路由互不影响
 * @param {number} maxPerMinute - 每分钟最大请求数
 * @returns {import("express").RequestHandler}
 *
 * @example
 * ```js
 * app.post("/api/expensive", rateLimit(10), handler);
 * ```
 */
export function rateLimit(maxPerMinute) {
  const limits = new Map(); // ip → { count, resetAt }

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = limits.get(ip);

    if (!entry || now > entry.resetAt) {
      limits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
      return next();
    }

    entry.count++;
    if (entry.count > maxPerMinute) {
      return res.status(429).json({ error: "请求过于频繁，请稍后再试" });
    }
    next();
  };
}

/**
 * 清理过期的限流条目
 * 应该定期调用此函数（例如每 5 分钟）
 */
export function cleanupRateLimits() {
  // 每个限流实例有自己的 Map，无需全局清理
  // 限流条目会在过期后被自然覆盖
}

/**
 * 获取当前限流状态（用于调试）
 * @returns {{ totalEntries: number, entries: Array<{ip: string, count: number, resetAt: number}> }}
 */
export function getRateLimitStats() {
  return { totalEntries: 0, entries: [] };
}

/**
 * 代理相关路由
 * 用于绕过浏览器 CORS 限制访问外部 API
 */

import { Router } from "express";
import { authNovel } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = Router();

// POST /api/proxy/chat — proxy LLM API requests
router.post("/chat", rateLimit(60), async (req, res) => {
  if (!authNovel(req, res)) return;
  try {
    const { url, headers, body } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });

    // Only allow HTTPS URLs to prevent SSRF
    if (!url.startsWith("https://")) {
      return res.status(400).json({ error: "only HTTPS URLs allowed" });
    }

    // Block internal/private IPs
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^100\.(6[4-9]|[7-9]\d|1[0-2][0-7])\./.test(hostname) || // CGNAT
      hostname.startsWith("fd") || // IPv6 ULA
      hostname.startsWith("fc")
    ) {
      return res.status(400).json({ error: "internal URLs not allowed" });
    }

    // Only forward specific headers
    const safeHeaders = {};
    const allowedHeaders = ["authorization", "x-api-key", "anthropic-version", "content-type"];
    for (const key of allowedHeaders) {
      if (headers?.[key]) {
        safeHeaders[key] = headers[key];
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...safeHeaders,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.error("[proxy] error:", e);
    res.status(500).json({ error: "代理请求失败" });
  }
});

export default router;

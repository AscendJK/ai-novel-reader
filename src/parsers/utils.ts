import type { Novel } from "./types";
import { v4 } from "./v4";

export { type Novel, type Chapter, type ParseResult, type ParserOptions } from "./types";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  return v4();
}

export function createNovel(parseResult: import("./types").ParseResult, fileName: string, fileFormat: "txt" | "epub"): Novel {
  const novelId = uuid();
  return {
    id: novelId,
    title: parseResult.title || fileName.replace(/\.[^.]+$/, ""),
    author: parseResult.author,
    fileName,
    fileFormat,
    totalChars: parseResult.totalChars,
    chapters: parseResult.chapters.map((ch, i) => ({
      id: uuid(),
      novelId,
      index: i,
      title: ch.title || `第${i + 1}章`,
      content: ch.content,
      startOffset: 0,
      endOffset: ch.content.length,
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export { uuid };

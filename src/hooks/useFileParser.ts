import { useState, useCallback, useRef } from "react";
import { parseTxt } from "@/parsers/txt";
import { parseEpub } from "@/parsers/epub";
import { createNovel } from "@/parsers/utils";
import { saveNovel } from "@/db/repositories";
import { useNovelStore } from "@/stores/novel-store";
import { useBuildStore } from "@/stores/build-store";
import type { Novel } from "@/parsers/types";

export function useFileParser() {
  const [isParsing, setIsParsing] = useState(false);
  const parseCountRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { addNovel } = useNovelStore();

  const parseFile = useCallback(async (file: File): Promise<Novel | null> => {
    setIsParsing(true);
    parseCountRef.current++;
    setProgress(0);
    setError(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let result;

      if (ext === "epub") {
        setProgress(30);
        result = await parseEpub(file);
      } else if (ext === "txt" || !ext) {
        setProgress(30);
        result = await parseTxt(file);
      } else {
        throw new Error(`不支持的文件格式: .${ext}。当前支持 .txt 和 .epub 格式。`);
      }

      setProgress(70);

      const novel = createNovel(
        result,
        file.name,
        (ext === "epub" ? "epub" : "txt") as "txt" | "epub"
      );

      setProgress(90);
      await saveNovel(novel);

      // Upload to server + auto-join + trigger RAG build (fire-and-forget)
      const user = localStorage.getItem("sync-username") || "";
      fetch(`/api/novels?username=${encodeURIComponent(user)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          novel: {
            id: novel.id, title: novel.title, author: novel.author,
            fileName: novel.fileName, fileFormat: novel.fileFormat,
            totalChars: novel.totalChars, chapterCount: novel.chapterCount,
            createdAt: novel.createdAt,
          },
          chapters: novel.chapters.map((c) => ({
            id: c.id, novelId: c.novelId, index: c.index,
            title: c.title, content: c.content,
            startOffset: c.startOffset, endOffset: c.endOffset,
          })),
        }),
      }).then(async (r) => {
        if (!r?.ok) return;
        const data = await r.json();
        const nid = data.novelId;
        if (!nid) return;

        // Auto-join
        if (user) fetch(`/api/novels/${nid}/join`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user }),
        }).catch(() => {});

      }).catch(() => {});

      setProgress(100);
      addNovel(novel);
      return novel;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "文件解析失败";
      setError(msg);
      return null;
    } finally {
      parseCountRef.current--;
      if (parseCountRef.current <= 0) setIsParsing(false);
    }
  }, [addNovel]);

  return { parseFile, isParsing, progress, error };
}

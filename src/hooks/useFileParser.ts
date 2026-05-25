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
  const { setCurrentNovel, addNovel } = useNovelStore();

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
      // Also upload to server
      fetch("/api/novels", {
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
      }).then((r) => r?.ok ? r.json() : null).then((data: any) => {
        // Auto-join for uploader
        const username = localStorage.getItem("sync-username");
        if (username && data?.novelId) {
          fetch(`/api/novels/${data.novelId}/join`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
          }).catch(() => {});
        }
      }).then((r) => r?.ok ? r.json() : null).then((data: any) => {
        // Auto-join for uploader
        const username = localStorage.getItem("sync-username");
        if (username && data?.novelId) {
          fetch(`/api/novels/${data.novelId}/join`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
          }).catch(() => {});
        }
        // Trigger server-side RAG build and show progress
        if (data?.novelId) {
          const engine = useBuildStore.getState().engine || "bge-small-zh";
          fetch(`/api/rag/${data.novelId}/build`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ engine }),
          }).then(() => {
            useBuildStore.getState().start();
            useBuildStore.getState().setProgress({ message: "服务器正在处理...", novelId: data!.novelId });
            // Poll until done
            const poll = setInterval(async () => {
              try {
                const sr = await fetch(`/api/rag/${data!.novelId}/status?engine=${engine}`);
                const st = await sr.json();
                if (st.status === "ready") {
                  useBuildStore.getState().finish();
                  clearInterval(poll);
                } else if (st.status === "error") {
                  useBuildStore.getState().fail(st.error || "构建失败");
                  clearInterval(poll);
                } else if (st.status === "building") {
                  useBuildStore.getState().setProgress({
                    message: `服务器处理中 (${st.current ?? 0}/${st.total ?? "?"})`,
                    current: st.current, total: st.total,
                    novelId: data!.novelId,
                  });
                }
              } catch { /* server error, keep polling */ }
            }, 3000);
          }).catch(() => {});
        }
      }).catch(() => { /* server may be offline */ });
      setProgress(100);

      addNovel(novel);
      setCurrentNovel(novel);

      return novel;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "文件解析失败";
      setError(msg);
      return null;
    } finally {
      parseCountRef.current--;
      if (parseCountRef.current <= 0) setIsParsing(false);
    }
  }, [setCurrentNovel, addNovel]);

  return { parseFile, isParsing, progress, error };
}

"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { searchMessages, type SearchResult } from "@/lib/messages/actions";

export function SearchPanel({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();

  function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const res = await searchMessages(value);
      setResults(res);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden border-b border-border bg-neutral-2"
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索消息内容（至少 2 个字）"
            autoFocus
            className="flex-1 rounded-md bg-neutral-1 px-3 py-1.5 text-copy-14 text-neutral-9 outline-none ring-1 ring-border focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={onClose}
            className="text-copy-14 text-neutral-6 hover:text-neutral-9"
          >
            关闭
          </button>
        </div>

        <div className="mt-2 max-h-60 overflow-y-auto">
          {pending && (
            <p className="py-2 text-copy-13 text-neutral-6">搜索中…</p>
          )}
          {!pending && query.trim().length >= 2 && results.length === 0 && (
            <p className="py-2 text-copy-13 text-neutral-6">无匹配结果</p>
          )}
          {!pending && results.length > 0 && (
            <div className="space-y-1">
              {results.map((r) => (
                <button
                  key={r.messageId}
                  onClick={() => onSelect(r.conversationId)}
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-neutral-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-label-12 font-medium text-neutral-8">
                      {r.conversationTitle}
                    </span>
                    <span className="text-caption-10 text-neutral-5">
                      {r.senderName} ·{" "}
                      {r.createdAt.toLocaleString("zh-CN", {
                        hour12: false,
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-copy-13 text-neutral-6">
                    {r.content}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

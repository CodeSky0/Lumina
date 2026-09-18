"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ClassMessage } from "@/lib/messages/actions";

export function ScreenMessageList({
  messages,
  currentUserId,
}: {
  messages: ClassMessage[];
  currentUserId: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sorted = [...messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return (
    <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
      <AnimatePresence initial={false}>
        {sorted.map((msg) => {
          const isSelf = msg.senderId === currentUserId;
          const recalled = !!msg.deletedAt;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[70%] ${isSelf ? "items-end" : "items-start"}`}>
                {!isSelf && (
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-copy-14 font-medium text-neutral-7">
                      {msg.senderName}
                    </span>
                    <span className="text-label-12 text-neutral-6">
                      {msg.senderRole === "teacher"
                        ? "教师"
                        : msg.senderRole === "parent"
                          ? "家长"
                          : "大屏"}
                    </span>
                    {msg.type === "urgent" && (
                      <span className="rounded bg-error px-1.5 py-0.5 text-label-12 text-white">
                        紧急
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={`rounded-xl px-4 py-3 ${
                    isSelf
                      ? "bg-accent text-white"
                      : msg.type === "urgent"
                        ? "bg-error/10 text-neutral-9 ring-1 ring-error"
                        : "bg-neutral-2 text-neutral-9 ring-1 ring-border"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-copy-16">
                    {recalled ? "（消息已撤回）" : msg.content}
                  </p>
                </div>
                <p
                  className={`mt-1 text-label-12 text-neutral-6 ${
                    isSelf ? "text-right" : "text-left"
                  }`}
                >
                  {msg.createdAt.toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {sorted.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <p className="text-copy-16 text-neutral-6">暂无消息</p>
        </div>
      )}
    </div>
  );
}

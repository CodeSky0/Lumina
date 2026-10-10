"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { MessageBubble } from "./message-bubble";
import type { ClassMessage } from "@/lib/messages/actions";

export function ChatWindow({
  messages,
  currentUserId,
  showStatus,
}: {
  messages: ClassMessage[];
  currentUserId: string;
  showStatus?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useEffect(() => {
    // 仅在用户已滚动到底部附近时才自动跟随新消息，避免打断历史阅读
    if (scrollRef.current && isAtBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [messages],
  );

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
    >
      <AnimatePresence initial={false}>
        {sorted.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            isSelf={msg.senderId === currentUserId}
            showStatus={showStatus}
          />
        ))}
      </AnimatePresence>
      {sorted.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <p className="text-copy-14 text-neutral-6">暂无消息，开始聊天吧</p>
        </div>
      )}
    </div>
  );
}

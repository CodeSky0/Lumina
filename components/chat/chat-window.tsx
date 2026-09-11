"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sorted = [...messages].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return (
    <div
      ref={scrollRef}
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

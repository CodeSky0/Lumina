"use client";

import { motion } from "motion/react";
import type { ClassMessage } from "@/lib/messages/actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "待送达",
  delivered: "已送达",
  displayed: "已展示",
};

export function MessageBubble({
  msg,
  isSelf,
  showStatus,
}: {
  msg: ClassMessage;
  isSelf: boolean;
  showStatus?: boolean;
}) {
  const time = msg.createdAt.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[70%] ${isSelf ? "items-end" : "items-start"}`}>
        {!isSelf && (
          <div className="mb-1 flex items-center gap-2">
            <span className="text-label-12 text-neutral-7">
              {msg.senderName}
            </span>
            <span className="text-label-12 text-neutral-6">
              {msg.senderRole === "teacher" ? "教师" : msg.senderRole === "parent" ? "家长" : "大屏"}
            </span>
            {msg.type === "urgent" && (
              <span className="rounded bg-error px-1.5 py-0.5 text-caption-10 text-white">
                紧急
              </span>
            )}
          </div>
        )}
        <div
          className={`rounded-xl px-3 py-2 ${
            isSelf
              ? "bg-accent text-white"
              : msg.type === "urgent"
                ? "bg-error/10 text-neutral-9 ring-1 ring-error"
                : "bg-neutral-2 text-neutral-9 ring-1 ring-border"
          }`}
        >
          {msg.type === "image" ? (
            <img
              src={msg.content}
              alt="图片消息"
              className="max-h-60 rounded-lg"
            />
          ) : (
            <p className="whitespace-pre-wrap text-copy-14">{msg.content}</p>
          )}
        </div>
        <div className={`mt-1 flex items-center gap-2 text-caption-10 text-neutral-6 ${isSelf ? "justify-end" : "justify-start"}`}>
          <span>{time}</span>
          {isSelf && showStatus && (
            <span>{STATUS_LABEL[msg.status]}</span>
          )}
          {isSelf && msg.type === "urgent" && (
            <span className="text-error">紧急</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import type { ClassMessage } from "@/lib/messages/actions";
import { recallMessage, editMessage } from "@/lib/messages/actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "待送达",
  delivered: "已送达",
  displayed: "已展示",
};

const RECALL_WINDOW_MS = 2 * 60 * 1000;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileCard({ content }: { content: string }) {
  let info: { url: string; name: string; size: number } | null = null;
  try {
    info = JSON.parse(content);
  } catch {
    return <p className="text-copy-14">文件解析失败</p>;
  }
  if (!info) return null;

  return (
    <a
      href={info.url}
      download={info.name}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2 transition-colors hover:bg-white/20"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6" />
          <path d="m9 15 3 3 3-3" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-copy-14 font-medium">{info.name}</p>
        <p className="text-caption-10 opacity-70">{formatFileSize(info.size)}</p>
      </div>
    </a>
  );
}

export function MessageBubble({
  msg,
  isSelf,
  showStatus,
}: {
  msg: ClassMessage;
  isSelf: boolean;
  showStatus?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [pending, startTransition] = useTransition();

  const time = msg.createdAt.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  const canRecall =
    isSelf &&
    !msg.deletedAt &&
    Date.now() - msg.createdAt.getTime() < RECALL_WINDOW_MS;

  const canEdit = isSelf && !msg.deletedAt && msg.type === "text";

  function handleRecall() {
    startTransition(async () => {
      await recallMessage(msg.id);
    });
  }

  function handleEdit() {
    if (!editText.trim()) return;
    startTransition(async () => {
      await editMessage(msg.id, editText);
      setEditing(false);
    });
  }

  if (msg.deletedAt) {
    return (
      <div className="flex justify-center py-1">
        <span className="text-caption-10 text-neutral-5">
          {isSelf ? "你" : msg.senderName} 撤回了一条消息
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`group flex ${isSelf ? "justify-end" : "justify-start"}`}
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
          ) : msg.type === "file" ? (
            <FileCard content={msg.content} />
          ) : editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full resize-none rounded-md bg-white/20 px-2 py-1 text-copy-14 outline-none ring-1 ring-white/30 focus:ring-2"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="text-caption-10 opacity-80 hover:opacity-100"
                >
                  取消
                </button>
                <button
                  onClick={handleEdit}
                  disabled={pending}
                  className="text-caption-10 font-medium opacity-80 hover:opacity-100 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-copy-14">{msg.content}</p>
          )}
        </div>
        <div className={`mt-1 flex items-center gap-2 text-caption-10 text-neutral-6 ${isSelf ? "justify-end" : "justify-start"}`}>
          <span>{time}</span>
          {msg.editedAt && (
            <span className="text-neutral-5">已编辑</span>
          )}
          {isSelf && showStatus && (
            <span>{STATUS_LABEL[msg.status]}</span>
          )}
          {isSelf && msg.type === "urgent" && (
            <span className="text-error">紧急</span>
          )}
        </div>
        {!editing && (canRecall || canEdit) && (
          <div className={`mt-0.5 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 ${isSelf ? "justify-end" : "justify-start"}`}>
            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="text-caption-10 text-neutral-5 hover:text-neutral-7"
              >
                编辑
              </button>
            )}
            {canRecall && (
              <button
                onClick={handleRecall}
                disabled={pending}
                className="text-caption-10 text-neutral-5 hover:text-error disabled:opacity-50"
              >
                撤回
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

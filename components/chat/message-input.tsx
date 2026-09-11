"use client";

import { useRef, useState, useTransition } from "react";
import { sendMessage } from "@/lib/messages/actions";

export function MessageInput({
  conversationId,
  allowUrgent,
}: {
  conversationId: string;
  allowUrgent?: boolean;
}) {
  const [text, setText] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim() && !fileRef.current?.files?.[0]) return;
    setFeedback(null);
    const fd = new FormData();
    fd.set("conversationId", conversationId);
    fd.set("text", text);
    if (urgent) fd.set("urgent", "true");
    if (fileRef.current?.files?.[0]) {
      fd.set("file", fileRef.current.files[0]);
    }
    startTransition(async () => {
      try {
        const res = await sendMessage(fd);
        if (res.ok) {
          setText("");
          setUrgent(false);
          if (fileRef.current) fileRef.current.value = "";
        } else {
          setFeedback(res.error);
        }
      } catch {
        setFeedback("发送失败，请重试");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {feedback && (
        <p className="text-copy-13 text-error">{feedback}</p>
      )}
      <div className="flex items-end gap-2">
        <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-2 text-neutral-7 ring-1 ring-border transition-colors hover:bg-neutral-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
        </label>
        {allowUrgent && (
          <button
            type="button"
            onClick={() => setUrgent((v) => !v)}
            className={`flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-copy-13 ring-1 transition-colors ${
              urgent
                ? "bg-error text-white ring-error"
                : "bg-neutral-2 text-neutral-7 ring-border hover:bg-neutral-3"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            紧急
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="输入消息…"
          className="flex-1 resize-none rounded-lg bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
            }
          }}
        />
        <button
          type="submit"
          disabled={pending || (!text.trim() && !fileRef.current?.files?.[0])}
          className="flex h-9 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "发送中" : "发送"}
        </button>
      </div>
    </form>
  );
}

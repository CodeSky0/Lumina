"use client";

import { useRef, useState, useTransition, useEffect, useMemo } from "react";
import { sendMessage, getGroupMembers, type GroupMember } from "@/lib/messages/actions";
import type { ConversationType } from "@/lib/db/schema";

export function MessageInput({
  conversationId,
  conversationType,
  allowUrgent,
}: {
  conversationId: string;
  conversationType?: ConversationType;
  allowUrgent?: boolean;
}) {
  const [text, setText] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentions, setMentions] = useState<{ userId: string; name: string }[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  const isGroup = conversationType === "group";

  useEffect(() => {
    if (!isGroup) return;
    let active = true;
    void getGroupMembers(conversationId).then((ms) => {
      if (active) setMembers(ms);
    });
    return () => {
      active = false;
    };
  }, [conversationId, isGroup]);

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    return members
      .filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
      .slice(0, 8);
  }, [members, mentionQuery]);

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setText(value);

    if (!isGroup || cursor === null) return;

    const beforeCursor = value.slice(0, cursor);
    const atMatch = beforeCursor.match(/@([^\s@]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1] ?? "");
      setMentionStart(beforeCursor.length - atMatch[0].length);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionStart(-1);
    }
  }

  function insertMention(member: GroupMember) {
    if (mentionStart < 0) return;
    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionStart + 1 + (mentionQuery ?? "").length);
    const insertText = `@${member.name} `;
    const newText = before + insertText + after;
    setText(newText);
    setMentions((prev) => {
      if (prev.some((m) => m.userId === member.userId)) return prev;
      return [...prev, { userId: member.userId, name: member.name }];
    });
    setMentionQuery(null);
    setMentionStart(-1);
    const newCursor = before.length + insertText.length;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]!);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        setMentionStart(-1);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  }

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
    const activeMentions = mentions.filter((m) => text.includes(`@${m.name}`));
    if (activeMentions.length > 0) {
      fd.set("mentions", JSON.stringify(activeMentions));
    }
    startTransition(async () => {
      try {
        const res = await sendMessage(fd);
        if (res.ok) {
          setText("");
          setUrgent(false);
          setMentions([]);
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
      <div className="relative flex items-end gap-2">
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-10 z-10 mb-1 w-56 overflow-hidden rounded-lg bg-neutral-1 shadow-lg ring-1 ring-border">
            {filteredMembers.map((m, i) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => insertMention(m)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-copy-13 transition-colors ${
                  i === mentionIndex
                    ? "bg-neutral-3 text-neutral-9"
                    : "text-neutral-7 hover:bg-neutral-2"
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-caption-10 text-accent">
                  {m.role === "teacher" ? "师" : m.role === "parent" ? "家" : "屏"}
                </span>
                <span className="truncate">{m.name}</span>
              </button>
            ))}
          </div>
        )}
        <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-neutral-2 text-neutral-7 ring-1 ring-border transition-colors hover:bg-neutral-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <input
            ref={fileRef}
            type="file"
            name="file"
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
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          rows={1}
          placeholder={isGroup ? "输入消息… @提及成员" : "输入消息…"}
          className="flex-1 resize-none rounded-lg bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
          onKeyDown={handleKeyDown}
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

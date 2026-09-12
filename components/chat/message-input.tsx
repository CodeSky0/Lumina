"use client";

import { useRef, useState, useTransition, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { sendMessage, getGroupMembers, type GroupMember } from "@/lib/messages/actions";
import type { ConversationType } from "@/lib/db/schema";
import { EASE } from "@/lib/motion";

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

  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);

  const isGroup = conversationType === "group";

  const [bursts, setBursts] = useState<{ id: number; particles: { angle: number; dist: number }[] }[]>([]);
  const [sendHovered, setSendHovered] = useState(false);

  function triggerBurst() {
    const id = Date.now();
    const particles = Array.from({ length: 10 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: 26 + Math.random() * 16,
    }));
    setBursts((prev) => [...prev, { id, particles }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 700);
  }

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

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start();
      setRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((d) => d + 1);
      }, 1000);
    } catch {
      setFeedback("无法访问麦克风，请检查权限");
    }
  }

  function stopRecording(send: boolean) {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    const duration = recordDuration;

    recorder.onstop = () => {
      if (send && audioChunksRef.current.length > 0) {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const ext = (recorder.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        const fd = new FormData();
        fd.set("conversationId", conversationId);
        fd.set("text", "");
        fd.set("file", file);
        fd.set("duration", String(duration));
        startTransition(async () => {
          try {
            const res = await sendMessage(fd);
            if (!res.ok) setFeedback(res.error);
          } catch {
            setFeedback("语音发送失败，请重试");
          }
        });
      }
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordStreamRef.current = null;
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    };

    recorder.stop();
    setRecording(false);
  }

  function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
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
        {recording ? (
          <>
            <div className="flex flex-1 items-center gap-3 rounded-lg bg-error/10 px-3 py-2 ring-1 ring-error">
              <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" />
              </span>
              <span className="text-copy-14 text-error">{formatDuration(recordDuration)}</span>
              <span className="text-copy-13 text-neutral-6">录音中…</span>
            </div>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              className="flex h-9 shrink-0 items-center justify-center rounded-lg bg-neutral-2 px-3 text-copy-13 text-neutral-7 ring-1 ring-border transition-colors hover:bg-neutral-3"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => stopRecording(true)}
              disabled={pending}
              className="flex h-9 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "发送中" : "发送"}
            </button>
          </>
        ) : (
          <>
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
            <button
              type="button"
              onClick={startRecording}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-2 text-neutral-7 ring-1 ring-border transition-colors hover:bg-neutral-3"
              title="语音消息"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </button>
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
            <div
              className="relative"
              onMouseEnter={() => setSendHovered(true)}
              onMouseLeave={() => setSendHovered(false)}
            >
              <motion.span
                aria-hidden
                className="pointer-events-none absolute -inset-1 rounded-lg bg-accent/30 blur-md"
                animate={sendHovered ? { opacity: [0.4, 0.7, 0.4], scale: [1, 1.15, 1] } : { opacity: 0, scale: 1 }}
                transition={sendHovered ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3, ease: EASE.out }}
              />
              <button
                type="submit"
                onClick={triggerBurst}
                disabled={pending || (!text.trim() && !fileRef.current?.files?.[0])}
                className="relative flex h-9 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                <span className="relative z-10">{pending ? "发送中" : "发送"}</span>
                {pending && (
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                )}
                <AnimatePresence>
                  {bursts.map((burst) => (
                    <span key={burst.id} className="pointer-events-none absolute inset-0">
                      {burst.particles.map((p, i) => (
                        <motion.span
                          key={i}
                          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-accent"
                          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                          animate={{
                            x: Math.cos(p.angle) * p.dist,
                            y: Math.sin(p.angle) * p.dist,
                            opacity: 0,
                            scale: 0.3,
                          }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.6, ease: EASE.out }}
                        />
                      ))}
                    </span>
                  ))}
                </AnimatePresence>
              </button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}

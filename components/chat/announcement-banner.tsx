"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getClassAnnouncements,
  createAnnouncement,
  type AnnouncementItem,
} from "@/lib/announcements/actions";

export function AnnouncementBanner({
  classId,
  isTeacher,
}: {
  classId: string;
  isTeacher: boolean;
}) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getClassAnnouncements(classId).then((anns) => {
      if (active) setAnnouncements(anns);
    });
    return () => {
      active = false;
    };
  }, [classId]);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % announcements.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  if (announcements.length === 0 && !isTeacher) return null;

  const current = announcements[currentIdx];

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setFeedback(null);
    const fd = new FormData();
    fd.set("classId", classId);
    fd.set("title", title);
    fd.set("content", content);
    startTransition(async () => {
      try {
        const res = await createAnnouncement(fd);
        if (res.ok) {
          setTitle("");
          setContent("");
          setShowDialog(false);
          const anns = await getClassAnnouncements(classId);
          setAnnouncements(anns);
        } else {
          setFeedback(res.error);
        }
      } catch {
        setFeedback("发布失败，请重试");
      }
    });
  }

  return (
    <div className="border-b border-border bg-accent/5">
      {current && (
        <div className="flex items-start gap-2 px-4 py-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent text-caption-10 font-medium text-white">
            公告
          </span>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-copy-13 font-medium text-neutral-9">
              {current.title}
            </p>
            <p className="truncate text-copy-13 text-neutral-7">
              {current.content}
            </p>
          </div>
          {announcements.length > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              {announcements.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i === currentIdx ? "bg-accent" : "bg-neutral-4"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {isTeacher && (
        <div className={`${current ? "border-t border-accent/10" : ""} px-4 py-1.5`}>
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-1 text-label-12 text-accent transition-colors hover:opacity-80"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            {current ? "发布新公告" : "发布公告"}
          </button>
        </div>
      )}

      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-neutral-1 p-4 shadow-xl ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 font-serif text-title-20 font-medium text-neutral-10">
              发布班级公告
            </h3>
            {feedback && (
              <p className="mb-2 text-copy-13 text-error">{feedback}</p>
            )}
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="公告标题"
                maxLength={100}
                className="w-full rounded-lg bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="公告内容"
                maxLength={1000}
                rows={4}
                className="w-full resize-none rounded-lg bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDialog(false)}
                  className="rounded-lg px-3 py-1.5 text-copy-13 text-neutral-7 ring-1 ring-border transition-colors hover:bg-neutral-2"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={pending || !title.trim() || !content.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-copy-13 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "发布中" : "发布"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

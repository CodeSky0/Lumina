"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  getClassMessages,
  getMyClasses,
  sendMessage,
  type ClassMessage,
  type MyClass,
} from "@/lib/messages/actions";

export default function TeacherPanel({ teacherName }: { teacherName: string }) {
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getMyClasses().then((cs) => {
      setClasses(cs);
      if (cs.length > 0) setSelectedClassId(cs[0]!.classId);
    });
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    void getClassMessages(selectedClassId).then(setMessages);
    const t = setInterval(() => {
      void getClassMessages(selectedClassId).then(setMessages);
    }, 5000);
    return () => clearInterval(t);
  }, [selectedClassId]);

  const selectedClass = classes.find((c) => c.classId === selectedClassId);

  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedClassId) return;
    setFeedback(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("classId", selectedClassId);
    if (fileRef.current?.files?.[0]) {
      fd.set("file", fileRef.current.files[0]);
    }
    startTransition(async () => {
      try {
        const res = await sendMessage(fd);
        if (res.ok) {
          form.reset();
          void getClassMessages(selectedClassId).then(setMessages);
        } else {
          setFeedback(res.error);
        }
      } catch {
        setFeedback("发送失败，请重试");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl gap-6 p-6">
      {/* 班级列表 */}
      <aside className="w-56 shrink-0 space-y-3">
        <h1 className="font-serif text-title-24 font-medium text-neutral-10">
          教师端
        </h1>
        <p className="text-copy-13 text-neutral-7">{teacherName}</p>
        <h2 className="mt-4 text-label-12 font-medium text-neutral-7">
          执教班级
        </h2>
        {classes.length === 0 && (
          <p className="text-copy-13 text-neutral-6">暂无执教班级</p>
        )}
        {classes.map((c) => (
          <button
            key={c.classId}
            onClick={() => setSelectedClassId(c.classId)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-copy-14 transition-colors ${
              selectedClassId === c.classId
                ? "bg-accent text-white"
                : "text-neutral-9 hover:bg-neutral-3"
            }`}
          >
            {c.className}
          </button>
        ))}
      </aside>

      {/* 主区 */}
      <main className="flex-1 space-y-6">
        {!selectedClass ? (
          <p className="text-copy-14 text-neutral-7">请选择左侧班级</p>
        ) : (
          <>
            <section className="space-y-4 rounded-xl bg-neutral-2 p-5 ring-1 ring-border">
              <h2 className="font-serif text-title-20 font-medium text-neutral-9">
                发布通知 — {selectedClass.className}
              </h2>
              <form onSubmit={handleSend} className="space-y-4">
                <textarea
                  name="text"
                  rows={3}
                  placeholder="输入通知内容…"
                  className="w-full rounded-lg bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
                />
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-copy-14 text-neutral-9">
                    <input type="checkbox" name="urgent" value="true" /> 紧急
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,image/webp"
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-md bg-accent px-4 py-2 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "发送中…" : "发送"}
                  </button>
                </div>
                {feedback && (
                  <p className="text-copy-13 text-error">{feedback}</p>
                )}
              </form>
            </section>

            <section className="space-y-4 rounded-xl bg-neutral-2 p-5 ring-1 ring-border">
              <h2 className="font-serif text-title-20 font-medium text-neutral-9">
                收件箱（家长留言）
              </h2>
              <ul className="space-y-3">
                {messages.map((m) => (
                  <MessageRow key={m.id} m={m} />
                ))}
                {messages.length === 0 && (
                  <p className="text-copy-13 text-neutral-6">暂无消息</p>
                )}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MessageRow({ m }: { m: ClassMessage }) {
  const time = m.createdAt.toLocaleString("zh-CN", { hour12: false });
  return (
    <li
      className={`rounded-lg bg-neutral-1 p-3 text-copy-14 ring-1 ${
        m.type === "urgent" ? "ring-error" : "ring-border"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between text-label-12 text-neutral-7">
        <span>
          {m.senderName}
          {m.type === "urgent" && (
            <span className="ml-2 font-medium text-error">紧急</span>
          )}
        </span>
        <span>{time}</span>
      </div>
      {m.type === "image" ? (
        <img
          src={m.content}
          alt="图片消息"
          className="max-h-48 rounded-md"
        />
      ) : (
        <p className="whitespace-pre-wrap text-neutral-9">{m.content}</p>
      )}
    </li>
  );
}

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
    void getMyClasses().then(setClasses);
  }, []);

  // 轮询收件箱（5s）
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
      const res = await sendMessage(fd);
      if (res.ok) {
        form.reset();
        void getClassMessages(selectedClassId).then(setMessages);
      } else {
        setFeedback(res.error);
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl gap-6 p-6">
      {/* 班级列表 */}
      <aside className="w-56 shrink-0 space-y-2">
        <h1 className="text-xl font-bold">教师端</h1>
        <p className="text-sm text-gray-600">{teacherName}</p>
        <h2 className="mt-4 text-sm font-semibold text-gray-500">执教班级</h2>
        {classes.length === 0 && (
          <p className="text-sm text-gray-400">暂无执教班级</p>
        )}
        {classes.map((c) => (
          <button
            key={c.classId}
            onClick={() => setSelectedClassId(c.classId)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
              selectedClassId === c.classId
                ? "bg-black text-white"
                : "hover:bg-gray-100"
            }`}
          >
            {c.className}
          </button>
        ))}
      </aside>

      {/* 主区 */}
      <main className="flex-1 space-y-6">
        {!selectedClass ? (
          <p className="text-gray-500">请选择左侧班级</p>
        ) : (
          <>
            <section className="rounded-xl border p-5">
              <h2 className="mb-3 text-lg font-semibold">
                发布通知 — {selectedClass.className}
              </h2>
              <form onSubmit={handleSend} className="space-y-3">
                <textarea
                  name="text"
                  rows={3}
                  placeholder="输入通知内容…"
                  className="w-full rounded-lg border px-3 py-2"
                />
                <div className="flex items-center gap-4">
                  <label className="text-sm">
                    <input type="checkbox" name="urgent" value="true" /> 紧急
                  </label>
                  <input ref={fileRef} type="file" name="file" accept="image/jpeg,image/png,image/webp" />
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
                  >
                    {pending ? "发送中…" : "发送"}
                  </button>
                </div>
                {feedback && (
                  <p className="text-sm text-red-600">{feedback}</p>
                )}
              </form>
            </section>

            <section className="rounded-xl border p-5">
              <h2 className="mb-3 text-lg font-semibold">
                收件箱（家长留言）
              </h2>
              <ul className="space-y-3">
                {messages.map((m) => (
                  <MessageRow key={m.id} m={m} />
                ))}
                {messages.length === 0 && (
                  <p className="text-sm text-gray-400">暂无消息</p>
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
      className={`rounded-lg border p-3 text-sm ${
        m.type === "urgent" ? "border-red-400 bg-red-50" : ""
      }`}
    >
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>
          {m.senderName}
          {m.type === "urgent" && (
            <span className="ml-2 font-semibold text-red-600">紧急</span>
          )}
        </span>
        <span>{time}</span>
      </div>
      {m.type === "image" ? (
        <img
          src={m.content}
          alt="图片消息"
          className="max-h-48 rounded"
        />
      ) : (
        <p className="whitespace-pre-wrap">{m.content}</p>
      )}
    </li>
  );
}

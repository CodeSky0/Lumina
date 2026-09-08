"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  getClassMessages,
  getMyClasses,
  sendMessage,
  type ClassMessage,
  type MyClass,
} from "@/lib/messages/actions";

const STATUS_LABEL: Record<string, string> = {
  pending: "待送达",
  delivered: "已送达",
  displayed: "已展示",
};

export default function ParentPanel({ parentName }: { parentName: string }) {
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getMyClasses().then((cs) => {
      setClasses(cs);
      // 家长仅显示孩子所在班级，默认选第一个
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
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">家长端</h1>
        <p className="text-sm text-gray-600">{parentName}</p>
      </div>

      {classes.length === 0 ? (
        <p className="text-gray-500">尚未关联孩子班级，请联系管理员绑定。</p>
      ) : (
        <>
          {/* 多孩子时显示班级选择（均为孩子所在班，非任意切换） */}
          {classes.length > 1 && (
            <div className="flex gap-2">
              {classes.map((c) => (
                <button
                  key={c.classId}
                  onClick={() => setSelectedClassId(c.classId)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    selectedClassId === c.classId
                      ? "bg-black text-white"
                      : "border"
                  }`}
                >
                  {c.className}（{c.studentName}）
                </button>
              ))}
            </div>
          )}

          {selectedClass && (
            <>
              <section className="rounded-xl border p-5">
                <h2 className="mb-3 text-lg font-semibold">
                  发送消息 — {selectedClass.className}
                  {selectedClass.studentName &&
                    `（学生：${selectedClass.studentName}）`}
                </h2>
                <form onSubmit={handleSend} className="space-y-3">
                  <textarea
                    name="text"
                    rows={3}
                    placeholder="输入消息…"
                    className="w-full rounded-lg border px-3 py-2"
                  />
                  <div className="flex items-center gap-4">
                    <input
                      ref={fileRef}
                      type="file"
                      name="file"
                      accept="image/jpeg,image/png,image/webp"
                    />
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
                <h2 className="mb-3 text-lg font-semibold">消息与送达状态</h2>
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-lg border p-3 text-sm ${
                        m.type === "urgent" ? "border-red-400 bg-red-50" : ""
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {m.senderName}
                          {m.type === "urgent" && (
                            <span className="ml-2 font-semibold text-red-600">
                              紧急
                            </span>
                          )}
                        </span>
                        <span>
                          {m.createdAt.toLocaleString("zh-CN", {
                            hour12: false,
                          })}{" "}
                          · {STATUS_LABEL[m.status]}
                        </span>
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
                  ))}
                  {messages.length === 0 && (
                    <p className="text-sm text-gray-400">暂无消息</p>
                  )}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

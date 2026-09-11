"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
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
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="font-serif text-title-28 font-medium text-neutral-10">
          家长端
        </h1>
        <p className="text-copy-13 text-neutral-7">{parentName}</p>
      </div>

      {classes.length === 0 ? (
        <p className="text-copy-14 text-neutral-7">
          尚未关联孩子班级，请联系管理员绑定。
        </p>
      ) : (
        <>
          {classes.length > 1 && (
            <div className="flex gap-2">
              {classes.map((c) => (
                <button
                  key={c.classId}
                  onClick={() => setSelectedClassId(c.classId)}
                  className={`rounded-lg px-3 py-2 text-copy-14 transition-colors ${
                    selectedClassId === c.classId
                      ? "bg-accent text-white"
                      : "bg-neutral-2 text-neutral-9 ring-1 ring-border hover:bg-neutral-3"
                  }`}
                >
                  {c.className}（{c.studentName}）
                </button>
              ))}
            </div>
          )}

          {selectedClass && (
            <>
              <section className="space-y-4 rounded-xl bg-neutral-2 p-5 ring-1 ring-border">
                <h2 className="font-serif text-title-20 font-medium text-neutral-9">
                  发送消息 — {selectedClass.className}
                  {selectedClass.studentName &&
                    `（学生：${selectedClass.studentName}）`}
                </h2>
                <form onSubmit={handleSend} className="space-y-4">
                  <textarea
                    name="text"
                    rows={3}
                    placeholder="输入消息…"
                    className="w-full rounded-lg bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
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
                  消息与送达状态
                </h2>
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {messages.map((m) => (
                      <motion.li
                        key={m.id}
                        className={`rounded-lg bg-neutral-1 p-3 text-copy-14 ring-1 ${
                          m.type === "urgent" ? "ring-error" : "ring-border"
                        }`}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      >
                      <div className="mb-1.5 flex items-center justify-between text-label-12 text-neutral-7">
                        <span>
                          {m.senderName}
                          {m.type === "urgent" && (
                            <span className="ml-2 font-medium text-error">
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
                          className="max-h-48 rounded-md"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-neutral-9">
                          {m.content}
                        </p>
                      )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                  {messages.length === 0 && (
                    <p className="text-copy-13 text-neutral-6">暂无消息</p>
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

"use client";

import { useState, useTransition } from "react";
import { Button, Card, Dialog, Input, useToast } from "@/components/ui";
import {
  askQuestion,
  answerQuestion,
  getQuestionDetail,
  getQuestions,
  type QuestionItem,
  type QuestionDetail,
} from "@/lib/qawall/actions";

interface QaWallClientProps {
  initialQuestions: QuestionItem[];
  userId: string;
  userName: string;
  userRole: string;
}

export function QaWallClient({ initialQuestions, userRole }: QaWallClientProps) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [showAsk, setShowAsk] = useState(false);
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  function handleAsk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await askQuestion({
        title: String(f.get("title")),
        content: String(f.get("content")),
      });
      if (!result.ok) {
        show("error", result.error);
        return;
      }
      setShowAsk(false);
      const fresh = await getQuestions();
      setQuestions(fresh);
      show("success", "提问成功");
    });
  }

  function handleOpenDetail(id: string) {
    startTransition(async () => {
      const d = await getQuestionDetail(id);
      if (d) setDetail(d);
    });
  }

  function handleAnswer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!detail) return;
    const f = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await answerQuestion({
        questionId: detail.id,
        content: String(f.get("content")),
      });
      if (!result.ok) {
        show("error", result.error);
        return;
      }
      const d = await getQuestionDetail(detail.id);
      if (d) setDetail(d);
      const fresh = await getQuestions();
      setQuestions(fresh);
      show("success", "回答成功");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-title-24 font-medium text-neutral-10">答疑墙</h1>
        <Button onClick={() => setShowAsk(true)}>提问</Button>
      </div>

      <div className="space-y-3">
        {questions.length === 0 && (
          <Card className="p-8 text-center text-copy-14 text-neutral-6">
            暂无问题，点击&ldquo;提问&rdquo;发起第一个问题
          </Card>
        )}
        {questions.map((q) => (
          <button
            key={q.id}
            onClick={() => handleOpenDetail(q.id)}
            className="block w-full text-left"
          >
            <Card className="p-4 transition-colors hover:bg-neutral-2">
              <h3 className="text-copy-16 font-medium text-neutral-10">{q.title}</h3>
              <p className="mt-1 line-clamp-2 text-copy-14 text-neutral-7">{q.content}</p>
              <div className="mt-2 flex items-center gap-3 text-caption-10 text-neutral-5">
                <span>{q.askerName}</span>
                <span>
                  {new Date(q.createdAt).toLocaleString("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>{q.answerCount} 回答</span>
                {q.resolvedAt && <span className="text-success">已解决</span>}
              </div>
            </Card>
          </button>
        ))}
      </div>

      <Dialog open={showAsk} onClose={() => setShowAsk(false)} title="提问">
        <form onSubmit={handleAsk} className="space-y-4">
          <Input name="title" label="标题" placeholder="简短描述你的问题" required />
          <div>
            <label className="mb-1 block text-label-12 font-medium text-neutral-7">详细内容</label>
            <textarea
              name="content"
              required
              minLength={2}
              maxLength={2000}
              rows={5}
              className="w-full rounded-lg border border-border bg-neutral-1 px-3 py-2 text-copy-14"
              placeholder="详细描述你的问题…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAsk(false)}>取消</Button>
            <Button type="submit" disabled={pending}>{pending ? "提交中…" : "提交"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.title ?? ""}>
        {detail && (
          <div className="space-y-4">
            <div className="border-b border-border pb-3">
              <p className="text-copy-14 text-neutral-8">{detail.content}</p>
              <p className="mt-2 text-caption-10 text-neutral-5">
                {detail.askerName} · {new Date(detail.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="text-label-12 font-medium text-neutral-7">回答（{detail.answers.length}）</h4>
              {detail.answers.length === 0 && (
                <p className="text-copy-14 text-neutral-6">暂无回答</p>
              )}
              {detail.answers.map((a) => (
                <div key={a.id} className="rounded-lg bg-neutral-2 p-3">
                  <p className="text-copy-14 text-neutral-8">{a.content}</p>
                  <p className="mt-1 text-caption-10 text-neutral-5">
                    {a.answererName} · {new Date(a.createdAt).toLocaleString("zh-CN")}
                  </p>
                </div>
              ))}
            </div>
            {(userRole === "teacher" || userRole === "admin") && (
              <form onSubmit={handleAnswer} className="space-y-2 border-t border-border pt-3">
                <textarea
                  name="content"
                  required
                  minLength={2}
                  maxLength={2000}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-neutral-1 px-3 py-2 text-copy-14"
                  placeholder="写下你的回答…"
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={pending}>{pending ? "提交中…" : "回答"}</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

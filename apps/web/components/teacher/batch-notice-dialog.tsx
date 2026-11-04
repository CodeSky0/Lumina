"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Megaphone } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { validateMessage } from "@/lib/messages";
import type { BatchNoticeResult, Channel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { InlineError } from "@/components/ui/async-state";

export function BatchNoticeDialog({ open, channels, onClose }: { open: boolean; channels: Channel[]; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [type, setType] = useState<"notice" | "urgent">("notice");
  const [validation, setValidation] = useState("");
  const mutation = useMutation({
    mutationFn: (body: { channel_ids: string[]; content: string; type: "notice" | "urgent" }) => apiFetch<BatchNoticeResult[] | { items?: BatchNoticeResult[]; results?: BatchNoticeResult[] }>("/api/v1/teacher/batch-notices", { method: "POST", body }),
  });
  const results = Array.isArray(mutation.data) ? mutation.data : mutation.data?.items ?? mutation.data?.results;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setValidation("");
    if (selected.size === 0) { setValidation("请至少选择一个目标通道"); return; }
    const contentError = validateMessage(type, content);
    if (contentError) { setValidation(contentError); return; }
    mutation.mutate({ channel_ids: Array.from(selected), content: content.trim(), type });
  }

  return (
    <Dialog open={open} title="发送批量通知" description="按通道逐个提交，服务端会返回每个目标的实际处理结果。" onClose={mutation.isPending ? undefined : onClose} className="max-w-2xl">
      <form onSubmit={submit} className="space-y-5">
        <fieldset><legend className="mb-3 text-sm font-medium text-zinc-700">目标通道</legend><div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 p-2">
          {channels.map((channel) => <label key={channel.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 hover:bg-zinc-50"><input type="checkbox" checked={selected.has(channel.id)} onChange={() => toggle(channel.id)} className="h-4 w-4 accent-indigo-500" /><span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{channel.name}</span><span className="text-xs text-zinc-400">{channel.class_name ?? channel.grade}</span></label>)}
        </div><p className="mt-2 text-xs text-zinc-500">已选择 {selected.size} 个通道</p></fieldset>
        <div className="space-y-2"><Label htmlFor="batch-type">通知级别</Label><Select id="batch-type" value={type} onChange={(event) => setType(event.target.value as "notice" | "urgent")}><option value="notice">普通通知</option><option value="urgent">紧急通知（需要教室确认）</option></Select></div>
        <div className="space-y-2"><Label htmlFor="batch-content">通知内容</Label><Textarea id="batch-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} placeholder="输入发送到所有已选通道的通知内容" required /></div>
        {(validation || mutation.error) && <InlineError error={validation || mutation.error} />}
        {results && <div className="rounded-xl border border-zinc-200" aria-live="polite"><h3 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">逐通道处理结果</h3><ul className="max-h-40 divide-y divide-zinc-100 overflow-y-auto">{results.map((result) => <li key={result.channel_id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"><span className="truncate">{channels.find((channel) => channel.id === result.channel_id)?.name ?? result.channel_id}</span><span className={result.success ? "text-emerald-600" : "text-red-600"}>{result.success ? "发送成功" : result.error ?? result.message?.content ?? "发送失败"}</span></li>)}</ul></div>}
        {mutation.isSuccess && !results && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700" role="status">批量通知请求已由服务端成功处理。</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>关闭</Button><Button type="submit" isLoading={mutation.isPending}><Megaphone className="h-4 w-4" />发送到 {selected.size} 个通道</Button></div>
      </form>
    </Dialog>
  );
}

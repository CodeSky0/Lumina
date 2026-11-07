"use client";

import { useRef, useState, type FormEvent } from "react";
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

type BatchTarget = { channel_id: string; client_msg_id: string };
type BatchNoticeResponse = BatchNoticeResult[] | { items?: BatchNoticeResult[]; results?: BatchNoticeResult[] };

function batchResults(data?: BatchNoticeResponse): BatchNoticeResult[] | undefined {
  return Array.isArray(data) ? data : data?.items ?? data?.results;
}

export function BatchNoticeDialog({ open, channels, onClose }: { open: boolean; channels: Channel[]; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [type, setType] = useState<"notice" | "urgent">("notice");
  const [validation, setValidation] = useState("");
  const targetsRef = useRef<BatchTarget[] | undefined>(undefined);
  const hasSuccessfulTargetsRef = useRef(false);
  const mutation = useMutation({
    mutationFn: (body: { targets: BatchTarget[]; content: string; type: "notice" | "urgent" }) => apiFetch<BatchNoticeResponse>("/api/v1/teacher/batch-notices", { method: "POST", body }),
    onSuccess: (data, variables) => {
      const items = batchResults(data);
      if (!items) {
        targetsRef.current = undefined;
        return;
      }
      const succeeded = new Set(items.filter((result) => result.success).map((result) => result.channel_id));
      if (succeeded.size > 0) hasSuccessfulTargetsRef.current = true;
      targetsRef.current = variables.targets.filter((target) => !succeeded.has(target.channel_id));
    },
  });
  const results = batchResults(mutation.data);
  const successCount = results?.filter((result) => result.success).length ?? 0;
  const failureCount = (results?.length ?? 0) - successCount;
  const remainingCount = targetsRef.current?.length ?? 0;
  const hasSuccessfulTargets = hasSuccessfulTargetsRef.current;
  const batchComplete = mutation.isSuccess && remainingCount === 0;
  const batchLocked = mutation.isSuccess || hasSuccessfulTargets;

  function toggle(id: string) {
    targetsRef.current = undefined;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function startNewBatch() {
    targetsRef.current = undefined;
    hasSuccessfulTargetsRef.current = false;
    mutation.reset();
    setSelected(new Set());
    setContent("");
    setType("notice");
    setValidation("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (batchComplete) return;
    setValidation("");
    if (selected.size === 0) { setValidation("请至少选择一个目标通道"); return; }
    const contentError = validateMessage(type, content);
    if (contentError) { setValidation(contentError); return; }
    const targets = targetsRef.current ?? Array.from(selected, (channel_id) => ({ channel_id, client_msg_id: crypto.randomUUID() }));
    targetsRef.current = targets;
    mutation.mutate({ targets, content: content.trim(), type });
  }

  return (
    <Dialog open={open} title="发送批量通知" description="按通道逐个提交，服务端会返回每个目标的实际处理结果。" onClose={mutation.isPending ? undefined : onClose} className="max-w-2xl">
      <form onSubmit={submit} className="space-y-5">
        <fieldset><legend className="mb-3 text-copy-14 font-medium text-neutral-8">目标通道</legend><div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {channels.map((channel) => <label key={channel.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 hover:bg-neutral-1"><input type="checkbox" checked={selected.has(channel.id)} disabled={batchLocked} onChange={() => toggle(channel.id)} className="h-4 w-4 accent-accent" /><span className="min-w-0 flex-1 truncate text-copy-14 text-neutral-9">{channel.name}</span><span className="text-label-12 text-neutral-6">{channel.class_name ?? channel.grade}</span></label>)}
        </div><p className="mt-2 text-label-12 text-neutral-7">将发送到已选班级，共 {selected.size} 个通道</p></fieldset>
        <div className="space-y-2"><Label htmlFor="batch-type">通知级别</Label><Select id="batch-type" value={type} disabled={batchLocked} onChange={(event) => { targetsRef.current = undefined; setType(event.target.value as "notice" | "urgent"); }}><option value="notice">通知</option><option value="urgent">紧急通知（需要教室确认）</option></Select></div>
        <div className="space-y-2"><Label htmlFor="batch-content">通知内容</Label><Textarea id="batch-content" value={content} disabled={batchLocked} onChange={(event) => { targetsRef.current = undefined; setContent(event.target.value); }} maxLength={2000} placeholder="输入发送到所有已选通道的通知内容" required /></div>
        {(validation || mutation.error) && <InlineError error={validation || mutation.error} />}
        {results && <div className="rounded-md border border-border" aria-live="polite"><h3 className="border-b border-border px-4 py-3 text-copy-14 font-medium">逐通道处理结果</h3><p className="border-b border-border px-4 py-2 text-copy-14 text-neutral-7">成功 {successCount} 个，失败 {failureCount} 个</p><ul className="max-h-40 divide-y divide-border overflow-y-auto">{results.map((result) => <li key={result.channel_id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-copy-14"><span className="truncate">{channels.find((channel) => channel.id === result.channel_id)?.name ?? result.channel_id}</span><span className={result.success ? "text-success" : "text-error"}>{result.success ? "发送成功" : result.error ?? result.message?.content ?? "发送失败"}</span></li>)}</ul></div>}
        {mutation.isSuccess && !results && <p className="rounded-md bg-success/10 p-3 text-copy-14 text-success" role="status">批量通知请求已由服务端成功处理。</p>}
        <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>关闭</Button>{batchComplete ? <Button type="button" onClick={startNewBatch}><Megaphone className="h-4 w-4" />新建批次</Button> : <Button type="submit" isLoading={mutation.isPending}><Megaphone className="h-4 w-4" />{mutation.isSuccess || hasSuccessfulTargets ? `重试剩余 ${remainingCount} 个通道` : `发送到 ${selected.size} 个通道`}</Button>}</div>
      </form>
    </Dialog>
  );
}

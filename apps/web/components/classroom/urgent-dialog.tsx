"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Siren, SpeakerHigh } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import type { Announcement, Message, UrgentPendingData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { InlineError } from "@/components/ui/async-state";
import { useUrgentAudio } from "@/components/classroom/use-urgent-audio";

export interface PendingItem {
  id: string;
  kind: "message" | "announcement";
  title: string;
  content: string;
  sender?: string;
  channelId?: string;
  className?: string;
}

function isMessage(item: Message | Announcement): item is Message {
  return "channel_id" in item;
}

export function normalizePending(data: UrgentPendingData | Array<Message | Announcement>): PendingItem[] {
  if (Array.isArray(data)) {
    return data.map((item) => isMessage(item)
      ? { id: item.id, kind: "message", title: "紧急消息", content: item.content, sender: item.sender_name, channelId: item.channel_id, className: item.channel_name }
      : { id: item.id, kind: "announcement", title: item.title, content: item.content, sender: item.publisher_name });
  }
  const messages = (data.messages ?? []).map((item) => ({ id: item.id, kind: "message" as const, title: "紧急消息", content: item.content, sender: item.sender_name, channelId: item.channel_id, className: item.channel_name }));
  const announcements = (data.announcements ?? []).map((item) => ({ id: item.id, kind: "announcement" as const, title: item.title, content: item.content, sender: item.publisher_name }));
  const items = (data.items ?? []).map((item) => isMessage(item)
    ? { id: item.id, kind: "message" as const, title: "紧急消息", content: item.content, sender: item.sender_name, channelId: item.channel_id, className: item.channel_name }
    : { id: item.id, kind: "announcement" as const, title: item.title, content: item.content, sender: item.publisher_name });
  return [...messages, ...announcements, ...items];
}

export function UrgentDialog() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["urgent-pending"],
    queryFn: async () => normalizePending(await apiFetch<UrgentPendingData | Array<Message | Announcement>>("/api/v1/classroom/urgent-pending")),
  });
  const current = query.data?.[0];
  const currentKey = current ? `${current.kind}:${current.id}` : undefined;
  const audio = useUrgentAudio(currentKey);
  const [escalated, setEscalated] = useState(false);
  useEffect(() => {
    setEscalated(false);
    if (!current) return;
    const timer = window.setTimeout(() => setEscalated(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [currentKey]);
  const confirmMutation = useMutation({
    mutationFn: async (item: PendingItem) => {
      const path = item.kind === "message" ? `/api/v1/messages/${encodeURIComponent(item.id)}/confirm` : `/api/v1/announcements/${encodeURIComponent(item.id)}/confirm`;
      await apiFetch<void>(path, { method: "POST" });
      await queryClient.refetchQueries({ queryKey: ["urgent-pending"], type: "active" });
      void queryClient.invalidateQueries({ queryKey: ["announcements"] });
      if (item.kind === "message") void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  return (
    <Dialog open={Boolean(current) || query.isError} blocking fullscreen title={current?.title ?? "紧急公告加载失败"} description={current ? "此提醒必须确认。只有服务端保存确认成功后才会关闭。" : "紧急信息尚未加载，请重试；在此期间保持阻断以避免遗漏提醒。"} className={cn("max-w-3xl border-error/30 p-7 sm:p-10", escalated && "animate-pulse ring-2 ring-error/25")}>
      {query.isError && !current ? <div className="space-y-5" role="alert"><InlineError error={query.error} /><Button type="button" variant="danger" size="touch" onClick={() => void query.refetch()} isLoading={query.isFetching}>重试加载紧急信息</Button></div> : current && <div className="space-y-7">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-error/12 text-error"><Siren className="h-9 w-9" aria-hidden="true" /></div>
        <div><p className="text-copy-14 font-medium text-error">{current.sender ? `来自 ${current.sender}` : "校园紧急通知"}</p>{current.className && <p className="mt-2 text-copy-16 font-medium text-neutral-9">确认班级：{current.className}</p>}<p className="mt-4 whitespace-pre-wrap break-words text-title-24 font-medium leading-relaxed text-neutral-10">{current.content}</p></div>
        {escalated && <p role="alert" className="rounded-md bg-error/12 p-4 text-copy-16 font-medium text-error">紧急通知已等待超过 30 秒，请立即确认。</p>}
        {query.isError && <InlineError error={query.error} />}
        {confirmMutation.isError && <InlineError error={confirmMutation.error} />}
        {audio.error && <InlineError error={audio.error} />}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!audio.unlocked ? <Button type="button" variant="secondary" size="touch" onClick={() => void audio.unlock()}><SpeakerHigh className="h-6 w-6" />启用提示音</Button> : <span className="flex min-h-12 items-center gap-2 text-copy-14 text-neutral-7"><SpeakerHigh className="h-5 w-5" />提示音已启用</span>}
          <Button type="button" variant="danger" size="touch" className="min-h-16 min-w-56" isLoading={confirmMutation.isPending} onClick={() => confirmMutation.mutate(current)}><CheckCircle className="h-6 w-6" />我已阅读并确认{current.className ? `（${current.className}）` : ""}</Button>
        </div>
      </div>}
    </Dialog>
  );
}

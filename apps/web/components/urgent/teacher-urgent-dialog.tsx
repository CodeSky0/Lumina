"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Siren } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import type { Announcement, Message, UrgentPendingData } from "@/lib/types";
import { normalizePending } from "@/components/classroom/urgent-dialog";
import { useSessionStore } from "@/stores/session";
import { useRealtimeStore } from "@/stores/realtime";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function TeacherUrgentDialog() {
  const role = useSessionStore((state) => state.user?.role);
  const requestChannel = useRealtimeStore((state) => state.requestChannel);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const query = useQuery({
    queryKey: ["urgent-pending", "teacher"],
    enabled: role === "teacher",
    queryFn: async () => normalizePending(await apiFetch<UrgentPendingData | Array<Message | Announcement>>("/api/v1/teacher/urgent-pending")),
  });
  const current = query.data?.find((item) => !dismissed.has(`${item.kind}:${item.id}`));
  if (role !== "teacher" || !current) return null;

  const dismiss = () => setDismissed((previous) => new Set(previous).add(`${current.kind}:${current.id}`));
  const openChannel = () => {
    if (current.channelId) requestChannel(current.channelId);
    dismiss();
  };

  return (
    <Dialog open title={current.title} description="教师端仅查看紧急内容；班级确认由对应教室端完成。" onClose={dismiss} className="max-w-2xl border-red-200">
      <div className="space-y-5">
        <div className="flex items-center gap-3 text-red-700"><Siren className="h-7 w-7" /><p className="font-medium">{current.sender ? `来自 ${current.sender}` : "校园紧急通知"}</p></div>
        {current.className && <p className="text-sm font-medium text-zinc-600">目标班级：{current.className}</p>}
        <p className="whitespace-pre-wrap break-words text-lg leading-8 text-zinc-900">{current.content}</p>
        <div className="flex justify-end"><Button variant={current.channelId ? "primary" : "secondary"} onClick={current.channelId ? openChannel : dismiss}>{current.channelId ? "查看对应通道" : "知道了"}</Button></div>
      </div>
    </Dialog>
  );
}

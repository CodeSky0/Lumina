"use client";

import { useRealtimeStore } from "@/stores/realtime";
import { cn } from "@/lib/utils";

const labels = {
  idle: "未连接",
  connecting: "正在连接",
  connected: "实时连接正常",
  reconnecting: "正在恢复连接",
  offline: "网络已断开",
  maintenance: "服务维护中",
};

export function ConnectionIndicator({ dark = false }: { dark?: boolean }) {
  const status = useRealtimeStore((state) => state.status);
  return (
    <div className={cn("flex items-center gap-2 text-label-12", dark ? "text-neutral-6" : "text-neutral-7")} role="status" aria-live="polite">
      <span className={cn("h-2 w-2 rounded-full", status === "connected" ? "bg-success" : status === "idle" ? "bg-neutral-5" : "animate-pulseSoft bg-warning")} aria-hidden="true" />
      {labels[status]}
    </div>
  );
}
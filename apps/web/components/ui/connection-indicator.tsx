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
    <div className={cn("flex items-center gap-2 text-xs", dark ? "text-zinc-400" : "text-zinc-500")} role="status" aria-live="polite">
      <span className={cn("h-2 w-2 rounded-full", status === "connected" ? "bg-emerald-500" : status === "idle" ? "bg-zinc-400" : "animate-pulseSoft bg-amber-500")} aria-hidden="true" />
      {labels[status]}
    </div>
  );
}

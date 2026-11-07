"use client";

import { useRealtimeStore } from "@/stores/realtime";

export function ConnectionBanner() {
  const status = useRealtimeStore((state) => state.status);
  const syncing = useRealtimeStore((state) => state.syncing);
  if (!["reconnecting", "maintenance"].includes(status) && !syncing) return null;
  const maintenance = status === "maintenance";
  const text = maintenance ? "服务维护中，正在尝试恢复连接…" : syncing ? "连接已恢复，正在同步离线消息…" : "连接已断开，正在重连…";
  return <div role="status" aria-live="polite" className="fixed left-1/2 top-3 z-[100] -translate-x-1/2 rounded-full border border-warning/30 bg-paper/95 px-4 py-2 text-center text-copy-13 font-medium text-warning shadow-whisper backdrop-blur-sm animate-slideDown">{text}</div>;
}
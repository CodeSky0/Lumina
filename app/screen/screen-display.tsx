"use client";

import { useEffect, useState } from "react";

/**
 * 教室大屏显示组件 — 全屏免打扰，黑底高对比度大字体。
 * 骨架阶段：空闲显示时钟日期；实时 WS 监听待接入（见 lib/realtime/contract.ts）。
 */
export default function ScreenDisplay() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = now
    ? now.toLocaleTimeString("zh-CN", { hour12: false })
    : "--:--:--";
  const date = now
    ? now.toLocaleDateString("zh-CN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <main className="screen-mode flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="font-mono text-[12rem] leading-none tabular-nums">
        {time}
      </div>
      <div className="mt-6 text-4xl opacity-70">{date}</div>
      <p className="mt-16 text-xl opacity-40">Lumina 流光 · 等待消息…</p>
    </main>
  );
}

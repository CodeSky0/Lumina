"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useScreenWs } from "@/lib/realtime/use-screen-ws";
import type { ScreenMessage } from "@/lib/realtime/contract";

/** 紧急消息提示音（Web Audio API 生成 beep） */
function beep(): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* 自动播放策略可能阻止，忽略 */
  }
}

const displayDuration = (m: ScreenMessage): number =>
  m.type === "urgent" ? 15000 : 10000;

type State = {
  current: ScreenMessage | null;
  queue: ScreenMessage[];
  shownAt: number;
};
type Action = { type: "new"; msg: ScreenMessage } | { type: "tick" };

function reducer(s: State, a: Action): State {
  if (a.type === "new") {
    if (a.msg.type === "urgent") {
      return { current: a.msg, queue: s.queue, shownAt: Date.now() };
    }
    return { ...s, queue: [...s.queue, a.msg] };
  }
  // tick
  if (s.current) {
    if (Date.now() - s.shownAt > displayDuration(s.current)) {
      return { ...s, current: null };
    }
    return s;
  }
  if (s.queue.length > 0) {
    const [next, ...rest] = s.queue;
    if (!next) return s;
    return { current: next, queue: rest, shownAt: Date.now() };
  }
  return s;
}

export default function ScreenDisplay({
  wsUrl,
  className,
}: {
  wsUrl: string | null;
  className: string;
}) {
  const { messages, connected } = useScreenWs(wsUrl);
  const [state, dispatch] = useReducer(reducer, {
    current: null,
    queue: [],
    shownAt: 0,
  });
  const processedIds = useRef<Set<string>>(new Set());

  // 处理新消息
  useEffect(() => {
    for (const m of messages) {
      if (processedIds.current.has(m.messageId)) continue;
      processedIds.current.add(m.messageId);
      if (m.type === "urgent") beep();
      dispatch({ type: "new", msg: m });
    }
  }, [messages]);

  // 轮播 tick
  useEffect(() => {
    const t = setInterval(() => dispatch({ type: "tick" }), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="screen-mode relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className={`absolute right-4 top-4 h-3 w-3 rounded-full ${
          connected ? "bg-green-500" : "bg-red-500"
        }`}
      />

      {state.current ? <MessageView msg={state.current} /> : <Clock />}

      <div className="absolute bottom-4 left-4 text-sm opacity-40">
        {className}
      </div>
    </main>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
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
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="font-mono text-[12rem] leading-none tabular-nums">
        {time}
      </div>
      <div className="mt-6 text-4xl opacity-70">{date}</div>
    </div>
  );
}

function MessageView({ msg }: { msg: ScreenMessage }) {
  const [imgReady, setImgReady] = useState(false);

  useEffect(() => {
    setImgReady(false);
    if (msg.type === "image") {
      const img = new Image();
      img.onload = () => setImgReady(true);
      img.src = msg.content;
    }
  }, [msg]);

  const isUrgent = msg.type === "urgent";

  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center p-12 ${
        isUrgent ? "animate-pulse" : ""
      }`}
    >
      <div
        className={`w-full max-w-5xl rounded-2xl border-4 p-10 ${
          isUrgent ? "border-red-500 bg-red-950/40" : "border-white/20"
        }`}
      >
        <div className="mb-4 flex items-center gap-3 text-2xl opacity-70">
          <span>{msg.senderName}</span>
          {isUrgent && (
            <span className="rounded bg-red-600 px-3 py-1 text-xl font-bold text-white">
              紧急
            </span>
          )}
        </div>
        {msg.type === "image" ? (
          imgReady ? (
            <img
              src={msg.content}
              alt="图片消息"
              className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
            />
          ) : (
            <p className="text-3xl opacity-50">图片加载中…</p>
          )
        ) : (
          <p className="text-6xl leading-relaxed">{msg.content}</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useScreenWs } from "@/lib/realtime/use-screen-ws";
import type { ScreenMessage } from "@/lib/realtime/contract";

/** 紧急消息提示音（Web Audio API 生成 beep） */
let audioCtx: AudioContext | null = null;

function beep(): void {
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
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

  useEffect(() => {
    for (const m of messages) {
      if (processedIds.current.has(m.messageId)) continue;
      processedIds.current.add(m.messageId);
      if (m.type === "urgent") beep();
      dispatch({ type: "new", msg: m });
    }
  }, [messages]);

  useEffect(() => {
    const t = setInterval(() => dispatch({ type: "tick" }), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="screen-mode relative min-h-screen overflow-hidden bg-neutral-1 text-neutral-9">
      <div
        className={`absolute right-4 top-4 h-3 w-3 rounded-full ${
          connected ? "bg-success" : "bg-error"
        }`}
      />

      {state.current ? <MessageView msg={state.current} /> : <Clock />}

      <div className="absolute bottom-4 left-4 text-copy-14 text-neutral-7">
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
      <div className="font-mono text-[12rem] leading-none tabular-nums text-neutral-10">
        {time}
      </div>
      <div className="mt-6 text-display-36 text-neutral-7">{date}</div>
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
        className={`w-full max-w-5xl rounded-2xl p-10 ring-2 ${
          isUrgent
            ? "bg-error/10 ring-error"
            : "bg-neutral-2 ring-border"
        }`}
      >
        <div className="mb-4 flex items-center gap-3 text-display-36 text-neutral-7">
          <span>{msg.senderName}</span>
          {isUrgent && (
            <span className="rounded-md bg-error px-3 py-1 text-title-20 font-medium text-white">
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
            <p className="text-display-36 text-neutral-6">图片加载中…</p>
          )
        ) : (
          <p className="text-[3.75rem] leading-relaxed text-neutral-10">
            {msg.content}
          </p>
        )}
      </div>
    </div>
  );
}

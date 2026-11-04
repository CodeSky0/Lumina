"use client";

import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";

interface Notice {
  id: number;
  title: string;
  body: string;
}

export function RealtimeNotification() {
  const [notice, setNotice] = useState<Notice>();
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ title: string; body: string }>).detail;
      setNotice({ id: Date.now(), title: detail.title, body: detail.body });
    };
    window.addEventListener("lumina:message-notification", listener);
    return () => window.removeEventListener("lumina:message-notification", listener);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return (
    <div role="status" className="fixed bottom-5 right-5 z-[90] w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-indigo-200 bg-white p-4 shadow-xl">
      <button type="button" className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center text-zinc-400" onClick={() => setNotice(undefined)} aria-label="关闭消息通知"><X className="h-4 w-4" /></button>
      <p className="pr-7 text-sm font-semibold text-zinc-900">{notice.title}</p>
      <p className="mt-1 break-words text-sm text-zinc-600">{notice.body}</p>
    </div>
  );
}

"use client";

/**
 * 大屏 WebSocket 客户端 — 连接 CF Durable Object，断线自动重连 + 补发。
 */
import { useEffect, useRef, useState } from "react";
import { screenMessageSchema, type ScreenMessage } from "./contract";

const MAX_QUEUED = 100;
const RECONNECT_DELAY = 3000;

export function useScreenWs(wsUrl: string | null): {
  messages: ScreenMessage[];
  connected: boolean;
} {
  const [messages, setMessages] = useState<ScreenMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const lastCreatedAt = useRef<string | null>(null);

  useEffect(() => {
    if (!wsUrl) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const ws = new WebSocket(wsUrl!);
      ws.onopen = () => {
        setConnected(true);
        if (lastCreatedAt.current) {
          ws.send(
            JSON.stringify({
              kind: "backfill",
              since: lastCreatedAt.current,
            }),
          );
        }
      };
      ws.onmessage = (ev) => {
        let raw: unknown;
        try {
          raw = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch {
          return;
        }
        if (typeof raw !== "object" || raw === null) return;
        const frame = raw as { kind?: string; messages?: unknown[] };

        if (frame.kind === "message") {
          try {
            const msg = screenMessageSchema.parse(raw);
            lastCreatedAt.current = msg.createdAt;
            setMessages((prev) => [...prev, msg].slice(-MAX_QUEUED));
          } catch {
            /* ignore invalid */
          }
        } else if (frame.kind === "backfill" && Array.isArray(frame.messages)) {
          const msgs: ScreenMessage[] = [];
          for (const m of frame.messages) {
            try {
              msgs.push(screenMessageSchema.parse(m));
            } catch {
              /* skip invalid */
            }
          }
          if (msgs.length > 0) {
            lastCreatedAt.current = msgs[msgs.length - 1]!.createdAt;
            setMessages((prev) => [...prev, ...msgs].slice(-MAX_QUEUED));
          }
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) timer = setTimeout(connect, RECONNECT_DELAY);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
    };
  }, [wsUrl]);

  return { messages, connected };
}

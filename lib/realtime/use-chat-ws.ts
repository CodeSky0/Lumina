"use client";

/**
 * 通用聊天 WebSocket 客户端 — 连接 CF Durable Object，断线自动重连 + 补发。
 * 适用于教师端、家长端、大屏端。
 */
import { useEffect, useRef, useState } from "react";
import { chatMessageSchema, type ChatMessage } from "./contract";

const MAX_QUEUED = 200;
const RECONNECT_DELAY = 3000;

export function useChatWs(wsUrl: string | null): {
  messages: ChatMessage[];
  connected: boolean;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const lastCreatedAt = useRef<string | null>(null);

  useEffect(() => {
    if (!wsUrl) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    function connect() {
      ws = new WebSocket(wsUrl!);
      ws.onopen = () => {
        setConnected(true);
        if (lastCreatedAt.current) {
          ws!.send(
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
            const msg = chatMessageSchema.parse(raw);
            lastCreatedAt.current = msg.createdAt;
            setMessages((prev) => [...prev, msg].slice(-MAX_QUEUED));
          } catch {
            /* ignore invalid */
          }
        } else if (frame.kind === "backfill" && Array.isArray(frame.messages)) {
          const msgs: ChatMessage[] = [];
          for (const m of frame.messages) {
            try {
              msgs.push(chatMessageSchema.parse(m));
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
      ws.onerror = () => ws?.close();
    }

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [wsUrl]);

  return { messages, connected };
}

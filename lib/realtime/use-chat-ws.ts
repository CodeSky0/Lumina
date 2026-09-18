"use client";

/**
 * 通用聊天 WebSocket 客户端 — 连接 CF Durable Object，断线自动重连 + 补发。
 * 适用于教师端、家长端、大屏端。
 */
import { useEffect, useRef, useState } from "react";
import {
  chatMessageSchema,
  presenceFrameSchema,
  messageStatusSchema,
  type ChatMessage,
  type PresenceUser,
} from "./contract";

const MAX_QUEUED = 200;
const RECONNECT_DELAY = 3000;

export type MessageStatusUpdate = {
  messageId: string;
  status: "delivered" | "displayed";
  readerId: string;
  readerRole: string;
};

export function useChatWs(
  wsUrl: string | null,
  userInfo?: { userId: string; name: string; role: "parent" | "teacher" | "classroom" | "admin" },
  onStatusChange?: (update: MessageStatusUpdate) => void,
): {
  messages: ChatMessage[];
  connected: boolean;
  presence: PresenceUser[];
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const lastCreatedAt = useRef<string | null>(null);
  const statusCbRef = useRef(onStatusChange);
  useEffect(() => {
    statusCbRef.current = onStatusChange;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on wsUrl change is intentional
    setMessages([]);
    setPresence([]);
    lastCreatedAt.current = null;
    if (!wsUrl) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    function connect() {
      ws = new WebSocket(wsUrl!);
      ws.onopen = () => {
        setConnected(true);
        if (userInfo) {
          ws!.send(
            JSON.stringify({
              kind: "join",
              userId: userInfo.userId,
              name: userInfo.name,
              role: userInfo.role,
            }),
          );
        }
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
        } else if (frame.kind === "presence") {
          try {
            const pf = presenceFrameSchema.parse(raw);
            setPresence(pf.users);
          } catch {
            /* ignore invalid */
          }
        } else if (frame.kind === "message-status") {
          try {
            const sf = messageStatusSchema.parse(raw);
            statusCbRef.current?.({
              messageId: sf.messageId,
              status: sf.status,
              readerId: sf.readerId,
              readerRole: sf.readerRole,
            });
          } catch {
            /* ignore invalid */
          }
        }
      };
      ws.onclose = () => {
        setConnected(false);
        setPresence([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- userInfo fields are individually tracked to avoid spurious reconnects
  }, [wsUrl, userInfo?.userId, userInfo?.name, userInfo?.role]);

  return { messages, connected, presence };
}

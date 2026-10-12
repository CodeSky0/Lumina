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
  messageRecallSchema,
  type ChatMessage,
  type PresenceUser,
} from "./contract";

const MAX_QUEUED = 200;
const RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 30000;

export type MessageStatusUpdate = {
  messageId: string;
  status: "delivered" | "displayed";
  readerId: string;
  readerRole: string;
};

export type MessageRecallUpdate = {
  messageId: string;
  deletedAt: string;
};

export function useChatWs(
  wsUrl: string | null,
  userInfo?: { userId: string; name: string; role: "parent" | "teacher" | "classroom" | "admin" },
  onStatusChange?: (update: MessageStatusUpdate) => void,
  onRecall?: (update: MessageRecallUpdate) => void,
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
  const recallCbRef = useRef(onRecall);
  useEffect(() => {
    statusCbRef.current = onStatusChange;
  });
  useEffect(() => {
    recallCbRef.current = onRecall;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on wsUrl change is intentional
    setMessages([]);
    setPresence([]);
    lastCreatedAt.current = null;
    if (!wsUrl) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
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
        // 心跳机制：定期发送 ping 检测半开连接
        heartbeatTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ kind: "ping" }));
          }
        }, HEARTBEAT_INTERVAL);
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
            // 去重：过滤掉已存在的消息，防止重连后重复显示
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.messageId));
              const deduped = msgs.filter((m) => !existingIds.has(m.messageId));
              if (deduped.length === 0) return prev;
              const newest = deduped[deduped.length - 1]!.createdAt;
              if (!lastCreatedAt.current || newest > lastCreatedAt.current) {
                lastCreatedAt.current = newest;
              }
              return [...prev, ...deduped].slice(-MAX_QUEUED);
            });
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
        } else if (frame.kind === "message-recall") {
          try {
            const rf = messageRecallSchema.parse(raw);
            recallCbRef.current?.({
              messageId: rf.messageId,
              deletedAt: rf.deletedAt,
            });
          } catch {
            /* ignore invalid */
          }
        }
      };
      ws.onclose = () => {
        setConnected(false);
        setPresence([]);
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (!closed) timer = setTimeout(connect, RECONNECT_DELAY);
      };
      ws.onerror = () => {
        if (ws?.readyState !== WebSocket.CLOSED) ws?.close();
      };
    }

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- userInfo fields are individually tracked to avoid spurious reconnects
  }, [wsUrl, userInfo?.userId, userInfo?.name, userInfo?.role]);

  return { messages, connected, presence };
}

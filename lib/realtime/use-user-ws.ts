"use client";

/**
 * 用户级事件 WebSocket — 连接 user-{userId} DO，接收未读计数/通知事件。
 * 独立于会话级 WS，切换会话不影响此连接。事件流不存历史，无需 backfill。
 */
import { useEffect, useRef, useState } from "react";
import {
  userMessageEventSchema,
  userNotificationEventSchema,
  type UserMessageEvent,
  type UserNotificationEvent,
} from "./contract";

const RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 30000;

export function useUserWs(
  wsUrl: string | null,
  userId: string | null,
  onUserMessage?: (event: UserMessageEvent) => void,
  onUserNotification?: (event: UserNotificationEvent) => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const msgCbRef = useRef(onUserMessage);
  const notifCbRef = useRef(onUserNotification);
  useEffect(() => {
    msgCbRef.current = onUserMessage;
  });
  useEffect(() => {
    notifCbRef.current = onUserNotification;
  });

  useEffect(() => {
    if (!wsUrl || !userId) return;
    const fullUrl = `${wsUrl.replace(/\/$/, "").replace(/^http/, "ws")}/ws/user-${userId}`;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let ws: WebSocket | null = null;

    function connect() {
      ws = new WebSocket(fullUrl);
      ws.onopen = () => {
        setConnected(true);
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
        const frame = raw as { kind?: string };

        if (frame.kind === "user-message") {
          try {
            const evt = userMessageEventSchema.parse(raw);
            msgCbRef.current?.(evt);
          } catch {
            /* ignore invalid */
          }
        } else if (frame.kind === "user-notification") {
          try {
            const evt = userNotificationEventSchema.parse(raw);
            notifCbRef.current?.(evt);
          } catch {
            /* ignore invalid */
          }
        }
      };
      ws.onclose = () => {
        setConnected(false);
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
  }, [wsUrl, userId]);

  return { connected };
}

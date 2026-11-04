"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { messageFromEventData, prependMessageToPages } from "@/lib/messages";
import { synchronizeRealtime } from "@/lib/message-sync";
import { RealtimeBatch } from "@/lib/realtime-batch";
import { invalidateRealtimeQueries } from "@/lib/realtime-sync";
import type { MessagePage, RealtimeEvent } from "@/lib/types";
import { RealtimeClient } from "@/lib/websocket";
import { useSessionStore } from "@/stores/session";
import { useRealtimeStore } from "@/stores/realtime";

type RealtimeListener = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
  subscribe: (listener: RealtimeListener) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const userId = useSessionStore((state) => state.user?.id);
  const setStatus = useRealtimeStore((state) => state.setStatus);
  const setSyncing = useRealtimeStore((state) => state.setSyncing);
  const markSynced = useRealtimeStore((state) => state.markSynced);
  const activeChannelId = useRealtimeStore((state) => state.activeChannelId);
  const activeChannelRef = useRef(activeChannelId);
  const listeners = useMemo(() => new Set<RealtimeListener>(), []);

  useEffect(() => { activeChannelRef.current = activeChannelId; }, [activeChannelId]);

  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      setSyncing(false);
      return;
    }
    const batch = new RealtimeBatch((events) => {
      const deliveries = new Set<string>();
      for (const event of events) {
        const message = event.type === "new_message" ? messageFromEventData(event.data) : null;
        if (message) {
          queryClient.setQueriesData<InfiniteData<MessagePage>>(
            { queryKey: ["messages", message.channel_id, ""] },
            (old) => prependMessageToPages(old, message),
          );
          if (message.sender_id !== userId) deliveries.add(message.id);
          if (message.sender_id !== userId && message.channel_id !== activeChannelRef.current) {
            window.dispatchEvent(new CustomEvent("lumina:message-notification", { detail: { title: message.sender_name, body: message.content.slice(0, 30) } }));
          }
        }
        invalidateRealtimeQueries(queryClient, event, message);
        for (const listener of listeners) listener(event);
      }
      if (deliveries.size > 0) {
        void apiFetch<void>("/api/v1/messages/delivery-ack", { method: "POST", body: { message_ids: Array.from(deliveries) } }).catch(() => undefined);
      }
    });
    const client = new RealtimeClient({
      getTicket: async () => {
        const result = await apiFetch<string | { ticket: string }>("/api/v1/auth/ws-ticket", { method: "POST" });
        return typeof result === "string" ? result : result.ticket;
      },
      onStatus: setStatus,
      onOpen: () => {
        setSyncing(true);
        void queryClient.invalidateQueries();
        void synchronizeRealtime(queryClient, activeChannelRef.current)
          .catch(() => queryClient.invalidateQueries())
          .finally(markSynced);
      },
      onEvent: (event) => batch.push(event),
    });
    client.start();
    return () => {
      batch.stop();
      client.stop();
    };
  }, [userId, listeners, queryClient, setStatus, setSyncing, markSynced]);

  const value = useMemo<RealtimeContextValue>(() => ({
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  }), [listeners]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error("useRealtime 必须在 RealtimeProvider 内使用");
  return context;
}

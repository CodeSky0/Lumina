"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { messageFromEventData, prependMessageToPages } from "@/lib/messages";
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
  const listeners = useMemo(() => new Set<RealtimeListener>(), []);

  useEffect(() => {
    if (!userId) {
      setStatus("idle");
      return;
    }
    const client = new RealtimeClient({
      getTicket: async () => {
        const result = await apiFetch<string | { ticket: string }>("/api/v1/auth/ws-ticket", { method: "POST" });
        return typeof result === "string" ? result : result.ticket;
      },
      onStatus: setStatus,
      onOpen: () => {
        void queryClient.invalidateQueries();
      },
      onEvent: (event) => {
        const message = event.type === "new_message" ? messageFromEventData(event.data) : null;
        if (message) {
          queryClient.setQueriesData<InfiniteData<MessagePage>>(
            { queryKey: ["messages", message.channel_id, ""] },
            (old) => prependMessageToPages(old, message),
          );
        }
        invalidateRealtimeQueries(queryClient, event, message);
        for (const listener of listeners) listener(event);
      },
    });
    client.start();
    return () => client.stop();
  }, [userId, listeners, queryClient, setStatus]);

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

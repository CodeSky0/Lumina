"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { prependMessageToPages } from "@/lib/messages";
import { MessageSendQueue, type QueuedMessage, type SendMessageInput } from "@/lib/message-send-queue";
import type { Message, MessagePage } from "@/lib/types";
import { useRealtimeStore } from "@/stores/realtime";
import { useSessionStore } from "@/stores/session";

interface MessageSendContextValue {
  items: QueuedMessage[];
  enqueue: (channelId: string, input: SendMessageInput) => string;
  retry: (clientMsgId: string) => void;
}

const MessageSendContext = createContext<MessageSendContextValue | null>(null);

export function MessageSendProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const status = useRealtimeStore((state) => state.status);
  const syncing = useRealtimeStore((state) => state.syncing);
  const [items, setItems] = useState<QueuedMessage[]>([]);
  const [queue] = useState(() => new MessageSendQueue({
    send: (channelId, input, clientMsgId) => apiFetch<Message>(`/api/v1/channels/${encodeURIComponent(channelId)}/messages`, {
      method: "POST",
      body: { ...input, client_msg_id: clientMsgId },
    }),
    onSent: (message) => {
      queryClient.setQueryData<InfiniteData<MessagePage> | undefined>(["messages", message.channel_id, ""], (old) => prependMessageToPages(old, message));
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  }));

  useEffect(() => queue.subscribe(setItems), [queue]);
  useEffect(() => {
    queue.setPaused(status !== "connected" || syncing);
  }, [queue, status, syncing]);
  useEffect(() => {
    if (items.length === 0) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [items.length]);
  useEffect(() => () => queue.stop(), [queue]);

  const value = useMemo<MessageSendContextValue>(() => ({
    items,
    enqueue: (channelId, input) => queue.enqueue(channelId, input),
    retry: (clientMsgId) => queue.retry(clientMsgId),
  }), [items, queue]);

  return <MessageSendContext.Provider value={value}>{children}</MessageSendContext.Provider>;
}

export function useMessageSender(): MessageSendContextValue {
  const context = useContext(MessageSendContext);
  if (!context) throw new Error("useMessageSender 必须在 MessageSendProvider 内使用");
  return context;
}

function localMessage(item: QueuedMessage, userId: string, displayName: string): Message {
  return {
    id: `local-${item.client_msg_id}`,
    client_msg_id: item.client_msg_id,
    channel_id: item.channel_id,
    sender_id: userId,
    sender_name: displayName,
    type: item.input.type,
    content: item.input.content,
    metadata: item.input.metadata ?? {},
    reply_to_id: item.input.reply_to_id,
    is_pinned: false,
    created_at: item.created_at,
    delivery_count: 0,
    read_count: 0,
    delivery_state: item.state,
    retryable: item.retryable,
    error: item.error,
  };
}

export function combineQueuedMessages(messages: Message[], queued: Message[]): Message[] {
  const persistedClientIds = new Set(messages.map((message) => message.client_msg_id).filter(Boolean));
  return [...messages, ...queued.filter((message) => !message.client_msg_id || !persistedClientIds.has(message.client_msg_id))];
}

export function useQueuedMessages(channelId: string): Message[] {
  const { items } = useMessageSender();
  const user = useSessionStore((state) => state.user);
  return useMemo(() => {
    if (!user) return [];
    return items.filter((item) => item.channel_id === channelId).map((item) => localMessage(item, user.id, user.display_name));
  }, [items, channelId, user]);
}

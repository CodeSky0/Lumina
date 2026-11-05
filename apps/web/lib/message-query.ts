"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { enqueueDeliveryAcks } from "@/lib/delivery-ack";
import { normalizeMessagePage } from "@/lib/messages";
import type { Message, MessagePageData } from "@/lib/types";
import { useSessionStore } from "@/stores/session";

export const MESSAGE_PAGE_SIZE = 30;

export function useChannelMessages(channelId?: string, query = "") {
  const userId = useSessionStore((state) => state.user?.id);
  return useInfiniteQuery({
    queryKey: ["messages", channelId, query],
    enabled: Boolean(channelId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) });
      if (pageParam) params.set("before_id", pageParam);
      if (query.trim()) params.set("q", query.trim());
      const data = await apiFetch<Message[] | MessagePageData>(`/api/v1/channels/${encodeURIComponent(channelId ?? "")}/messages?${params}`);
      const page = normalizeMessagePage(data, MESSAGE_PAGE_SIZE);
      enqueueDeliveryAcks(page.messages, userId);
      return page;
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
  });
}

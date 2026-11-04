"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { normalizeMessagePage } from "@/lib/messages";
import type { Message, MessagePageData } from "@/lib/types";

export const MESSAGE_PAGE_SIZE = 30;

export function useChannelMessages(channelId?: string, query = "") {
  return useInfiniteQuery({
    queryKey: ["messages", channelId, query],
    enabled: Boolean(channelId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) });
      if (pageParam) params.set("before_id", pageParam);
      if (query.trim()) params.set("q", query.trim());
      const data = await apiFetch<Message[] | MessagePageData>(`/api/v1/channels/${encodeURIComponent(channelId ?? "")}/messages?${params}`);
      return normalizeMessagePage(data, MESSAGE_PAGE_SIZE);
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
  });
}

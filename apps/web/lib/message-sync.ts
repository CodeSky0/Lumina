import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { enqueueDeliveryAcks } from "@/lib/delivery-ack";
import { compareMessageIds, mergeMessages, prependMessageToPages } from "@/lib/messages";
import { extractItems } from "@/lib/utils";
import type { Channel, ListResult, Message, MessagePage } from "@/lib/types";
import { useSessionStore } from "@/stores/session";

interface SyncPage {
  items: Message[];
  next_after_id?: string;
  has_more: boolean;
}

interface MessageSyncOptions {
  signal?: AbortSignal;
  userId?: string;
}

function latestCachedId(data: InfiniteData<MessagePage> | undefined): string | undefined {
  const messages = mergeMessages(data?.pages ?? []);
  return messages[messages.length - 1]?.id;
}

export async function syncChannelMessages(queryClient: QueryClient, channelId: string, options: MessageSyncOptions = {}): Promise<void> {
  const queryKey = ["messages", channelId, ""] as const;
  const userId = options.userId ?? useSessionStore.getState().user?.id;
  let afterId = latestCachedId(queryClient.getQueryData<InfiniteData<MessagePage>>(queryKey)) ?? "0";
  for (let page = 0; page < 1000; page += 1) {
    options.signal?.throwIfAborted();
    const params = new URLSearchParams({ after_id: afterId, limit: "100" });
    const result = options.signal
      ? await apiFetch<SyncPage>(`/api/v1/channels/${encodeURIComponent(channelId)}/messages/sync?${params}`, { signal: options.signal })
      : await apiFetch<SyncPage>(`/api/v1/channels/${encodeURIComponent(channelId)}/messages/sync?${params}`);
    options.signal?.throwIfAborted();
    const items = [...result.items].sort((a, b) => compareMessageIds(a.id, b.id));
    queryClient.setQueryData<InfiniteData<MessagePage> | undefined>(queryKey, (old) => {
      let next = old;
      for (const message of items) next = prependMessageToPages(next, message);
      return next;
    });
    enqueueDeliveryAcks(items, userId);
    const lastId = result.next_after_id ?? items[items.length - 1]?.id;
    if (!result.has_more) break;
    if (!lastId || compareMessageIds(lastId, afterId) <= 0) throw new Error("增量同步游标未前进");
    afterId = lastId;
  }
  options.signal?.throwIfAborted();
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
    queryClient.invalidateQueries({ queryKey: ["channels"] }),
  ]);
}

export async function synchronizeRealtime(queryClient: QueryClient, activeChannelId?: string, options: MessageSyncOptions = {}): Promise<void> {
  const userId = options.userId ?? useSessionStore.getState().user?.id;
  const result = options.signal
    ? await apiFetch<ListResult<Channel>>("/api/v1/channels", { signal: options.signal })
    : await apiFetch<ListResult<Channel>>("/api/v1/channels");
  options.signal?.throwIfAborted();
  const channels = extractItems(result);
  queryClient.setQueryData(["channels"], channels);
  const ordered = [...channels].sort((a, b) => a.id === activeChannelId ? -1 : b.id === activeChannelId ? 1 : 0);
  for (const channel of ordered) await syncChannelMessages(queryClient, channel.id, { ...options, userId });
  options.signal?.throwIfAborted();
  await queryClient.invalidateQueries({ queryKey: ["urgent-pending"] });
}

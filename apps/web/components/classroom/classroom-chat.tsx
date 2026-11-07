"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ChatsCircle } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { useChannelMessages } from "@/lib/message-query";
import { mergeMessages } from "@/lib/messages";
import { combineQueuedMessages, useMessageSender, useQueuedMessages } from "@/lib/message-sender";
import type { Channel, Message } from "@/lib/types";
import { useSessionStore } from "@/stores/session";
import { useRealtimeStore } from "@/stores/realtime";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, InlineError } from "@/components/ui/async-state";
import { MessageItem } from "@/components/teacher/message-item";
import { Composer } from "@/components/teacher/composer";

export function ClassroomChat({ channel, onClose }: { channel?: Channel; onClose: () => void }) {
  const queryClient = useQueryClient();
  const user = useSessionStore((state) => state.user);
  const setActiveChannel = useRealtimeStore((state) => state.setActiveChannel);
  const messagesQuery = useChannelMessages(channel?.id);
  const queuedMessages = useQueuedMessages(channel?.id ?? "");
  const { retry } = useMessageSender();
  const messages = useMemo(() => combineQueuedMessages(mergeMessages(messagesQuery.data?.pages ?? []), queuedMessages), [messagesQuery.data, queuedMessages]);
  const messageMap = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);
  const readMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/v1/messages/${encodeURIComponent(id)}/read`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["channels"] }),
  });
  const onRead = useCallback((message: Message) => readMutation.mutateAsync(message.id), [readMutation.mutateAsync]);
  const [replyTo, setReplyTo] = useState<Message>();
  useEffect(() => setReplyTo(undefined), [channel?.id]);
  useEffect(() => {
    setActiveChannel(channel?.id);
    return () => setActiveChannel(undefined);
  }, [channel?.id, setActiveChannel]);

  return (
    <Dialog open={Boolean(channel)} title={channel?.name ?? "班级消息"} description={[channel?.subject_name, channel?.teacher_name].filter(Boolean).join(" · ") || "本班实时消息"} onClose={onClose} className="flex h-[88dvh] max-w-6xl flex-col p-0 sm:p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-5 sm:[&>div:first-child]:px-8 sm:[&>div:first-child]:pt-6">
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-8">
        {readMutation.isError && <InlineError error={readMutation.error} />}
        {messagesQuery.isPending ? <ListSkeleton rows={4} /> : messagesQuery.isError ? <ErrorState error={messagesQuery.error} onRetry={() => void messagesQuery.refetch()} /> : messages.length === 0 ? <EmptyState icon={<ChatsCircle className="h-7 w-7" />} title="本科目还没有消息" description="教师发送的消息会实时显示在这里，无需刷新页面。" /> : <>
          {messagesQuery.hasNextPage && <div className="mb-4 flex justify-center"><Button size="touch" variant="secondary" onClick={() => void messagesQuery.fetchNextPage()} isLoading={messagesQuery.isFetchingNextPage}><ArrowUp className="h-5 w-5" />查看更早消息</Button></div>}
          <div role="log" aria-live="polite">{user && messages.map((message) => <MessageItem key={message.id} message={message} currentUserId={user.id} replyTarget={message.reply_to_id ? messageMap.get(message.reply_to_id) : undefined} large onRead={onRead} onReply={setReplyTo} onRetry={retry} />)}</div>
        </>}
      </div>
      {channel && <Composer channel={channel} replyTo={replyTo} onCancelReply={() => setReplyTo(undefined)} allowedTypes={["text"]} large />}
      <div className="y-meta border-t border-border px-5 py-4 text-label-12 text-neutral-6">消息通过实时连接更新；断线恢复后会自动向服务端同步。</div>
    </Dialog>
  );
}

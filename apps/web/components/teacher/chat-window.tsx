"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUp, ChatsCircle, MagnifyingGlass, X } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { useChannelMessages } from "@/lib/message-query";
import { mergeMessages } from "@/lib/messages";
import type { Channel, Message } from "@/lib/types";
import { useSessionStore } from "@/stores/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, InlineError } from "@/components/ui/async-state";
import { MessageItem } from "@/components/teacher/message-item";
import { Composer } from "@/components/teacher/composer";

export function ChatWindow({ channel, onBack }: { channel?: Channel; onBack?: () => void }) {
  const queryClient = useQueryClient();
  const user = useSessionStore((state) => state.user);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [replyTo, setReplyTo] = useState<Message>();
  const endRef = useRef<HTMLDivElement>(null);
  const messagesQuery = useChannelMessages(channel?.id, query);
  const messages = useMemo(() => mergeMessages(messagesQuery.data?.pages ?? []), [messagesQuery.data]);
  const messageMap = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  useEffect(() => { setSearchInput(""); setQuery(""); setReplyTo(undefined); }, [channel?.id]);
  useEffect(() => {
    if (!messagesQuery.isFetchingNextPage) endRef.current?.scrollIntoView({ block: "end" });
  }, [channel?.id, messages.length, messagesQuery.isFetchingNextPage]);

  const readMutation = useMutation({
    mutationFn: (messageId: string) => apiFetch<void>(`/api/v1/messages/${encodeURIComponent(messageId)}/read`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["channels"] }),
  });
  const onRead = useCallback((message: Message) => readMutation.mutateAsync(message.id), [readMutation.mutateAsync]);

  function search(event: FormEvent) {
    event.preventDefault();
    setQuery(searchInput.trim());
  }

  if (!channel || !user) return <div className="hidden h-full items-center justify-center md:flex"><EmptyState icon={<ChatsCircle className="h-7 w-7" />} title="选择一个会话" description="从左侧选择班级或广播通道，查看历史消息并开始沟通。" /></div>;

  return (
    <section className="flex h-full min-h-0 flex-col bg-zinc-50/60" aria-label={`${channel.name}会话`}>
      <header className="border-b border-zinc-200 bg-white px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          {onBack && <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="返回会话列表"><ArrowLeft className="h-5 w-5" /></Button>}
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="truncate font-semibold text-zinc-950">{channel.name}</h2>{channel.online && <Badge tone="green">在线</Badge>}</div><p className="mt-0.5 truncate text-xs text-zinc-500">{[channel.class_name, channel.subject_name, channel.teacher_name].filter(Boolean).join(" · ") || "校园广播通道"}</p></div>
        </div>
        <form onSubmit={search} className="mt-3 flex gap-2" role="search">
          <div className="relative flex-1"><MagnifyingGlass className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="min-h-10 pl-9" placeholder="搜索当前通道内的消息" aria-label="搜索消息" maxLength={200} /></div>
          <Button type="submit" variant="secondary">搜索</Button>
          {query && <Button type="button" variant="ghost" size="icon" onClick={() => { setQuery(""); setSearchInput(""); }} aria-label="清除搜索"><X className="h-4 w-4" /></Button>}
        </form>
      </header>
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {readMutation.isError && <div className="mb-3"><InlineError error={readMutation.error} /></div>}
        {messagesQuery.isPending ? <ListSkeleton rows={5} /> : messagesQuery.isError ? <ErrorState error={messagesQuery.error} onRetry={() => void messagesQuery.refetch()} /> : (
          <>
            {messagesQuery.hasNextPage && <div className="mb-3 flex justify-center"><Button variant="ghost" size="sm" onClick={() => void messagesQuery.fetchNextPage()} isLoading={messagesQuery.isFetchingNextPage}><ArrowUp className="h-4 w-4" />加载更早消息</Button></div>}
            {messages.length === 0 ? <EmptyState title={query ? "没有找到相关消息" : "会话还没有消息"} description={query ? "搜索仅覆盖你有权访问的当前通道，请尝试其他关键词。" : "发送第一条消息，开始这个通道的沟通。"} /> : (
              <div role="log" aria-live="polite" aria-relevant="additions" className="mx-auto max-w-4xl">
                {messages.map((message) => <MessageItem key={message.id} message={message} currentUserId={user.id} replyTarget={message.reply_to_id ? messageMap.get(message.reply_to_id) : undefined} onReply={setReplyTo} onRead={onRead} />)}
              </div>
            )}
            <div ref={endRef} aria-hidden="true" />
          </>
        )}
      </div>
      <Composer key={channel.id} channel={channel} replyTo={replyTo} onCancelReply={() => setReplyTo(undefined)} />
    </section>
  );
}

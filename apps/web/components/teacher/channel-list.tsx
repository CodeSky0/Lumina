"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChatsCircle, Hash, MagnifyingGlass, Megaphone } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { extractItems, cn } from "@/lib/utils";
import type { Channel, ListResult } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/async-state";

export function useChannels() {
  return useQuery({
    queryKey: ["channels"],
    queryFn: async () => extractItems(await apiFetch<ListResult<Channel>>("/api/v1/channels")),
  });
}

export function ChannelList({ selectedId, onSelect }: { selectedId?: string; onSelect: (channel: Channel) => void }) {
  const channelsQuery = useChannels();
  const [filter, setFilter] = useState("");
  const channels = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase("zh-CN");
    return (channelsQuery.data ?? []).filter((channel) => !needle || [channel.name, channel.class_name, channel.subject_name, channel.teacher_name].some((value) => value?.toLocaleLowerCase("zh-CN").includes(needle)));
  }, [channelsQuery.data, filter]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-4">
        <div className="relative"><MagnifyingGlass className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-neutral-6" /><Input value={filter} onChange={(event) => setFilter(event.target.value)} className="pl-10" placeholder="筛选班级或科目" aria-label="筛选会话" /></div>
      </div>
      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto p-3">
        {channelsQuery.isPending ? <ListSkeleton rows={7} /> : channelsQuery.isError ? <ErrorState error={channelsQuery.error} onRetry={() => void channelsQuery.refetch()} /> : channels.length === 0 ? (
          <EmptyState icon={<ChatsCircle className="h-6 w-6" />} title={filter ? "没有匹配的会话" : "还没有可用会话"} description={filter ? "请尝试其他班级、科目或教师姓名。" : "教学任务或广播通道开通后，会显示在这里。"} />
        ) : (
          <div className="space-y-1" role="list" aria-label="会话列表">
            {channels.map((channel, index) => (
              <button key={channel.id} role="listitem" onClick={() => onSelect(channel)} className={cn("group/item flex w-full items-start gap-3 rounded-lg p-3 text-left outline-hidden transition-[background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] animate-rise hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-accent/60", selectedId === channel.id ? "bg-neutral-2 shadow-whisper ring-1 ring-accent/15" : "hover:bg-neutral-2/70")} style={{ animationDelay: `${Math.min(index, 10) * 28}ms` }} aria-current={selectedId === channel.id ? "true" : undefined}>
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/item:scale-105", selectedId === channel.id ? "bg-accent/10 text-accent" : "bg-neutral-2 text-neutral-7")} aria-hidden="true">{channel.type === "broadcast" ? <Megaphone className="h-5 w-5" /> : <Hash className="h-5 w-5" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-copy-14 font-medium text-neutral-9">{channel.name}</span>{channel.unread_count > 0 && <span className="flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-label-12 font-medium text-on-accent animate-pop" aria-label={`${channel.unread_count} 条未读`}>{channel.unread_count > 99 ? "99+" : channel.unread_count}</span>}</span>
                  <span className="mt-1 block truncate text-label-12 text-neutral-7">{[channel.class_name, channel.subject_name ?? channel.grade].filter(Boolean).join(" · ") || "校园广播"}</span>
                  <span className="mt-1.5 block truncate text-label-12 text-neutral-6">{channel.last_message?.content ?? "暂无消息"}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

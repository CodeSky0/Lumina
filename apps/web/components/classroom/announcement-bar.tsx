"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone, Warning } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { extractItems } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { Announcement, ListResult } from "@/lib/types";
import { ErrorState } from "@/components/ui/async-state";
import { Skeleton } from "@/components/ui/skeleton";

export function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => extractItems(await apiFetch<ListResult<Announcement>>("/api/v1/announcements")),
  });
}

export function AnnouncementBar() {
  const query = useAnnouncements();
  if (query.isPending) return <Skeleton className="h-24 w-full rounded-xl" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} title="公告加载失败" />;
  if (!query.data.length) return null;
  return (
    <section aria-labelledby="announcements-title" className="overflow-hidden rounded-xl border border-border bg-neutral-2 animate-rise">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent"><Megaphone className="h-4 w-4" aria-hidden="true" /></span><h2 id="announcements-title" className="text-title-20 font-medium text-neutral-10">校园公告</h2><span className="y-meta ml-auto hidden text-label-12 text-neutral-6 sm:inline">按发布时间排序</span></div>
      <ul className="divide-y divide-border">
        {query.data.slice(0, 3).map((announcement, index) => <li key={announcement.id} className="flex flex-col gap-2 px-5 py-4 transition-colors duration-300 animate-rise hover:bg-neutral-1/60 sm:flex-row sm:items-start" style={{ animationDelay: `${90 + index * 60}ms` }}><div className="min-w-0 flex-1"><div className="flex items-center gap-2">{announcement.type === "urgent" && <Warning className="h-4 w-4 shrink-0 text-error animate-pulseSoft" aria-label="紧急公告" />}<h3 className="text-copy-16 font-medium text-neutral-9">{announcement.title}</h3></div><p className="mt-1 whitespace-pre-wrap text-copy-14 leading-6 text-neutral-7">{announcement.content}</p></div><time className="y-meta shrink-0 text-label-12 text-neutral-6" dateTime={announcement.created_at}>{formatDateTime(announcement.created_at)}</time></li>)}
      </ul>
    </section>
  );
}
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
  if (query.isPending) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} title="公告加载失败" />;
  if (!query.data.length) return null;
  return (
    <section aria-labelledby="announcements-title" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3"><Megaphone className="h-6 w-6 text-indigo-600" aria-hidden="true" /><h2 id="announcements-title" className="text-lg font-semibold">校园公告</h2></div>
      <ul className="divide-y divide-zinc-100">
        {query.data.slice(0, 3).map((announcement) => <li key={announcement.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex items-center gap-2">{announcement.type === "urgent" && <Warning className="h-5 w-5 shrink-0 text-red-600" aria-label="紧急公告" />}<h3 className="text-lg font-medium text-zinc-900">{announcement.title}</h3></div><p className="mt-1 whitespace-pre-wrap text-lg leading-7 text-zinc-600">{announcement.content}</p></div><time className="shrink-0 text-sm text-zinc-400" dateTime={announcement.created_at}>{formatDateTime(announcement.created_at)}</time></li>)}
      </ul>
    </section>
  );
}

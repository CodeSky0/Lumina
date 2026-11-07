"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { InlineError } from "@/components/ui/async-state";

interface ConfirmationItem {
  user_id: string;
  class_id: string;
  class_name: string;
  confirmed: boolean;
  confirmed_at?: string;
}

export function ConfirmationStatus({ kind, id }: { kind: "message" | "announcement"; id: string }) {
  const path = kind === "message" ? `/api/v1/messages/${encodeURIComponent(id)}/confirmations` : `/api/v1/announcements/${encodeURIComponent(id)}/confirmations`;
  const query = useQuery({
    queryKey: ["confirmations", kind, id],
    queryFn: async () => (await apiFetch<{ items: ConfirmationItem[] }>(path)).items,
  });
  if (query.isPending) return <p className="mt-3 text-copy-14 text-neutral-7">正在加载班级确认状态…</p>;
  if (query.isError) return <InlineError error={query.error} />;
  const items = query.data ?? [];
  const confirmed = items.filter((item) => item.confirmed).length;
  return (
    <div className="mt-3 rounded-md border border-border bg-paper p-3 text-left" aria-live="polite">
      <p className="text-copy-14 font-medium text-neutral-9">已确认 {confirmed} / {items.length} 个班级</p>
      <ul className="mt-2 space-y-1.5">{items.map((item) => <li key={item.user_id} className="flex items-center justify-between gap-3 text-label-12"><span className="truncate text-neutral-7">{item.class_name}</span><span className={item.confirmed ? "text-success" : "font-medium text-error"}>{item.confirmed && item.confirmed_at ? `已确认 ${formatDateTime(item.confirmed_at)}` : "未确认"}</span></li>)}</ul>
    </div>
  );
}

export function ConfirmationDetails({ kind, id, summary, className, summaryClassName }: { kind: "message" | "announcement"; id: string; summary: string; className?: string; summaryClassName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className={className} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={summaryClassName}>{summary}</summary>
      {open && <ConfirmationStatus kind={kind} id={id} />}
    </details>
  );
}

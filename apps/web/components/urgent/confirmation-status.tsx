"use client";

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
  if (query.isPending) return <p className="mt-3 text-sm text-zinc-500">正在加载班级确认状态…</p>;
  if (query.isError) return <InlineError error={query.error} />;
  const items = query.data ?? [];
  const confirmed = items.filter((item) => item.confirmed).length;
  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-left" aria-live="polite">
      <p className="text-sm font-semibold text-zinc-800">已确认 {confirmed} / {items.length} 个班级</p>
      <ul className="mt-2 space-y-1.5">{items.map((item) => <li key={item.user_id} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-zinc-600">{item.class_name}</span><span className={item.confirmed ? "text-emerald-600" : "font-medium text-red-600"}>{item.confirmed && item.confirmed_at ? `已确认 ${formatDateTime(item.confirmed_at)}` : "未确认"}</span></li>)}</ul>
    </div>
  );
}

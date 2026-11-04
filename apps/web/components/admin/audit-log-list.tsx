"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminPage } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/async-state";

export function AuditLogList() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "audit-logs", page],
    queryFn: () => fetchAdminPage<AuditLog>("/api/v1/admin/audit-logs", page, 50),
  });
  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  const hasNext = page < totalPages;
  return <><PageHeader eyebrow="安全追踪" title="审计日志" description="只读查看认证、权限变更、资源管理、公告与撤回等服务端审计记录。" /><section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-panel">{query.isPending ? <div className="p-5"><ListSkeleton rows={7} /></div> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="暂无审计日志" description="服务端记录管理操作后，日志会按时间显示在这里。" /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs text-zinc-500"><th className="px-5 py-3.5">时间</th><th className="px-5 py-3.5">操作人</th><th className="px-5 py-3.5">动作</th><th className="px-5 py-3.5">资源</th><th className="px-5 py-3.5">来源地址</th><th className="px-5 py-3.5">详情</th></tr></thead><tbody className="divide-y divide-zinc-100">{items.map((log) => <tr key={log.id}><td className="whitespace-nowrap px-5 py-4 text-zinc-500">{formatDateTime(log.created_at)}</td><td className="px-5 py-4 font-medium text-zinc-800">{log.actor_name ?? log.actor_id ?? "系统"}</td><td className="px-5 py-4"><code className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700">{log.action}</code></td><td className="px-5 py-4 text-zinc-600">{[log.resource_type, log.resource_id].filter(Boolean).join(" / ") || "未关联"}</td><td className="px-5 py-4 font-mono text-xs text-zinc-500">{log.ip_address ?? "未记录"}</td><td className="max-w-xs px-5 py-4"><details><summary className="cursor-pointer text-indigo-600">查看</summary><pre className="mt-2 max-w-sm whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">{log.details === undefined ? "无附加详情" : typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}</pre></details></td></tr>)}</tbody></table></div>}<div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-sm text-zinc-500"><span>第 {page} 页</span><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>上一页</Button><Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</Button></div></div></section></>;
}

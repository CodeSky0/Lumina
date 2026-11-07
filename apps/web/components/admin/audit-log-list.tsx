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
  return <><PageHeader eyebrow="安全追踪" title="审计日志" description="只读查看认证、权限变更、资源管理、公告与撤回等服务端审计记录。" /><section className="overflow-hidden rounded-xl border border-border bg-neutral-2">{query.isPending ? <div className="p-5"><ListSkeleton rows={7} /></div> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="暂无审计日志" description="服务端记录管理操作后，日志会按时间显示在这里。" /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-copy-14"><thead><tr className="border-b border-border bg-neutral-1/70 text-label-12 font-medium uppercase tracking-[1.5px] text-neutral-6"><th className="px-5 py-3.5">时间</th><th className="px-5 py-3.5">操作人</th><th className="px-5 py-3.5">动作</th><th className="px-5 py-3.5">资源</th><th className="px-5 py-3.5">来源地址</th><th className="px-5 py-3.5">详情</th></tr></thead><tbody className="divide-y divide-border">{items.map((log, index) => <tr key={log.id} className="animate-fadeIn transition-colors hover:bg-neutral-1/60" style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}><td className="y-meta whitespace-nowrap px-5 py-4 text-neutral-7">{formatDateTime(log.created_at)}</td><td className="px-5 py-4 font-medium text-neutral-9">{log.actor_name ?? log.actor_id ?? "系统"}</td><td className="px-5 py-4"><code className="rounded bg-neutral-2 px-2 py-1 text-label-12 text-neutral-8">{log.action}</code></td><td className="px-5 py-4 text-neutral-7">{[log.resource_type, log.resource_id].filter(Boolean).join(" / ") || "未关联"}</td><td className="px-5 py-4 font-mono text-label-12 text-neutral-7">{log.ip_address ?? "未记录"}</td><td className="max-w-xs px-5 py-4"><details><summary className="cursor-pointer text-accent">查看</summary><pre className="animate-fadeIn mt-2 max-w-sm whitespace-pre-wrap break-words rounded-md bg-neutral-1 p-3 text-label-12 leading-5 text-neutral-7">{log.details === undefined ? "无附加详情" : typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}</pre></details></td></tr>)}</tbody></table></div>}<div className="flex items-center justify-between border-t border-border px-5 py-3 text-copy-14 text-neutral-7"><span>第 {page} 页</span><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>上一页</Button><Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</Button></div></div></section></>;
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Key, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { fetchAdminPage } from "@/lib/admin-api";
import type { ResourceKind } from "@/lib/admin";
import { RESOURCE_CONFIGS } from "@/components/admin/resource-config";
import { ResourceForm, type ResourceRow } from "@/components/admin/resource-form";
import { useAdminLookups } from "@/components/admin/use-admin-lookups";
import { DeviceCodeDialog } from "@/components/admin/device-code-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const PAGE_SIZE = 50;

export function ResourcePage({ kind }: { kind: ResourceKind }) {
  const queryClient = useQueryClient();
  const config = RESOURCE_CONFIGS[kind];
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceRow>();
  const [deleting, setDeleting] = useState<ResourceRow>();
  const [rotating, setRotating] = useState<ResourceRow>();
  const lookups = useAdminLookups(kind === "channels");
  const query = useQuery({
    queryKey: ["admin", kind, "list", page],
    queryFn: () => fetchAdminPage<ResourceRow>(config.endpoint, page, PAGE_SIZE),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`${config.endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => { setDeleting(undefined); void queryClient.invalidateQueries({ queryKey: ["admin", kind] }); },
  });

  function cell(row: ResourceRow, key: string) {
    const value = row[key];
    if (key === "active") return <Badge tone={value === false ? "red" : "green"}>{value === false ? "已停用" : "正常"}</Badge>;
    if (key === "type") return <Badge tone={value === "broadcast" ? "indigo" : "neutral"}>{value === "broadcast" ? "广播通道" : "科目通道"}</Badge>;
    if (key === "broadcast_scope") return value === "grade" ? "指定年级" : value === "class" ? "指定班级" : value === "school" ? "全校" : "未设置";
    if (key === "class_id" || key === "target_class_id") return lookups.classes.find((item) => item.id === value)?.name ?? row.class_name as string ?? "未设置";
    if (key === "subject_id") return lookups.subjects.find((item) => item.id === value)?.name ?? row.subject_name as string ?? "未设置";
    if (key === "teacher_id") return lookups.teachers.find((item) => item.id === value)?.display_name ?? row.teacher_name as string ?? "未设置";
    if (key === "color" && typeof value === "string") return <span className="flex items-center gap-2"><span className="h-4 w-4 rounded border border-black/10" style={{ backgroundColor: value }} />{value}</span>;
    if (value === undefined || value === null || value === "") return <span className="text-zinc-400">未设置</span>;
    return String(value);
  }

  const total = query.data?.total;
  const totalPages = query.data?.totalPages ?? 1;
  const hasNext = page < totalPages;
  return <>
    <PageHeader eyebrow="资源管理" title={config.title} description={config.description} action={<Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus className="h-4 w-4" />新增{config.singular}</Button>} />
    {lookups.error && <div className="mb-5"><ErrorState error={lookups.error} onRetry={() => void lookups.refetch()} title="关联资源加载失败" /></div>}
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-panel" aria-label={config.title}>
      {query.isPending || lookups.isPending ? <div className="p-5"><ListSkeleton rows={6} /></div> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? <EmptyState title={`暂无${config.singular}`} description={`点击“新增${config.singular}”创建第一条服务端记录。`} action={<Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><Plus className="h-4 w-4" />新增{config.singular}</Button>} /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><caption className="sr-only">{config.title}数据表</caption><thead><tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-500">{config.columns.map((column) => <th key={column.key} scope="col" className="px-5 py-3.5">{column.label}</th>)}<th scope="col" className="px-5 py-3.5 text-right">操作</th></tr></thead><tbody className="divide-y divide-zinc-100">{query.data.items.map((row) => {
        const assignmentManaged = kind === "channels" && row.type !== "broadcast";
        return <tr key={row.id} className="transition hover:bg-zinc-50/70">{config.columns.map((column) => <td key={column.key} className="max-w-56 truncate px-5 py-4 text-zinc-700">{cell(row, column.key)}</td>)}<td className="px-5 py-3"><div className="flex justify-end gap-1">{assignmentManaged ? <Link href="/admin/assignments" className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">去任务分配</Link> : <>
          {kind === "classes" && <Button variant="ghost" size="sm" onClick={() => setRotating(row)}><Key className="h-4 w-4" />轮换设备码</Button>}
          <Button variant="ghost" size="sm" onClick={() => { setEditing(row); setFormOpen(true); }}><PencilSimple className="h-4 w-4" />编辑</Button>
          <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(row)}><Trash className="h-4 w-4" />删除</Button>
        </>}</div></td></tr>;
      })}</tbody></table></div>}
      <div className="flex min-h-16 items-center justify-between border-t border-zinc-100 px-5 py-3 text-sm text-zinc-500"><span>第 {page} / {totalPages} 页{total !== undefined ? ` · 共 ${total} 条` : ""}</span><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page === 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</Button><Button variant="secondary" size="sm" disabled={!hasNext || query.isFetching} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</Button></div></div>
    </section>
    <ResourceForm kind={kind} record={editing} open={formOpen} lookups={lookups} onClose={() => { setFormOpen(false); setEditing(undefined); }} />
    {kind === "classes" && <DeviceCodeDialog open={Boolean(rotating)} record={rotating} onClose={() => setRotating(undefined)} />}
    <ConfirmDialog open={Boolean(deleting)} title={`删除${config.singular}？`} description={`即将删除“${String(deleting?.name ?? deleting?.display_name ?? deleting?.id ?? "")}”。服务端会校验关联资源，删除后无法恢复。`} confirmLabel="确认删除" isLoading={deleteMutation.isPending} error={deleteMutation.error} onClose={() => setDeleting(undefined)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
  </>;
}

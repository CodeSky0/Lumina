"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { fetchAdminPage } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import type { Assignment } from "@/lib/admin";
import { useAdminLookups } from "@/components/admin/use-admin-lookups";
import { AssignmentForm } from "@/components/admin/assignment-form";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/async-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function AssignmentManager() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment>();
  const [deleting, setDeleting] = useState<Assignment>();
  const lookups = useAdminLookups();
  const query = useQuery({
    queryKey: ["admin", "assignments", "list", page],
    queryFn: () => fetchAdminPage<Assignment>("/api/v1/admin/assignments", page, 50),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/v1/admin/assignments/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => { setDeleting(undefined); void queryClient.invalidateQueries({ queryKey: ["admin", "assignments"] }); void queryClient.invalidateQueries({ queryKey: ["admin", "channels"] }); },
  });
  const name = (assignment: Assignment, key: "teacher" | "class" | "subject") => {
    if (key === "teacher") return assignment.teacher_name ?? lookups.teachers.find((item) => item.id === assignment.teacher_id)?.display_name ?? assignment.teacher_id;
    if (key === "class") return assignment.class_name ?? lookups.classes.find((item) => item.id === assignment.class_id)?.name ?? assignment.class_id;
    return assignment.subject_name ?? lookups.subjects.find((item) => item.id === assignment.subject_id)?.name ?? assignment.subject_id;
  };
  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  const hasNext = page < totalPages;
  return <>
    <PageHeader eyebrow="教学组织" title="教学任务分配" description="组合教师、班级与科目，新增任务时由服务端事务生成唯一教学通道。" action={<Button onClick={() => { setEditing(undefined); setFormOpen(true); }} disabled={lookups.isPending || Boolean(lookups.error)}><Plus className="h-4 w-4" />分配任务</Button>} />
    {lookups.error ? <ErrorState error={lookups.error} onRetry={() => void lookups.refetch()} title="任务选项加载失败" /> : <section className="overflow-hidden rounded-xl border border-border bg-neutral-2">{query.isPending || lookups.isPending ? <div className="p-5"><ListSkeleton rows={6} /></div> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState title="暂无教学任务" description="创建任务后，对应教师与教室将获得本科目通道的访问权限。" action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />分配任务</Button>} /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-copy-14"><thead><tr className="border-b border-border bg-neutral-1/70 text-label-12 font-medium uppercase tracking-[1.5px] text-neutral-6"><th className="px-5 py-3.5">教师</th><th className="px-5 py-3.5">班级</th><th className="px-5 py-3.5">科目</th><th className="px-5 py-3.5">创建时间</th><th className="px-5 py-3.5 text-right">操作</th></tr></thead><tbody className="divide-y divide-border">{items.map((assignment) => <tr key={assignment.id}><td className="px-5 py-4 font-medium text-neutral-9">{name(assignment, "teacher")}</td><td className="px-5 py-4 text-neutral-7">{name(assignment, "class")}</td><td className="px-5 py-4 text-neutral-7">{name(assignment, "subject")}</td><td className="y-meta px-5 py-4 text-neutral-7">{assignment.created_at ? formatDateTime(assignment.created_at) : "未记录"}</td><td className="px-5 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => { setEditing(assignment); setFormOpen(true); }}><PencilSimple className="h-4 w-4" />编辑</Button><Button variant="ghost" size="sm" className="text-error" onClick={() => setDeleting(assignment)}><Trash className="h-4 w-4" />删除</Button></div></td></tr>)}</tbody></table></div>}<div className="flex items-center justify-between border-t border-border px-5 py-3 text-copy-14 text-neutral-7"><span>第 {page} 页</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>上一页</Button><Button size="sm" variant="secondary" disabled={!hasNext} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</Button></div></div></section>}
    <AssignmentForm open={formOpen} assignment={editing} lookups={lookups} onClose={() => { setFormOpen(false); setEditing(undefined); }} />
    <ConfirmDialog open={Boolean(deleting)} title="删除教学任务？" description="服务端将检查任务与通道关联。此操作可能同时影响成员访问，请确认后继续。" confirmLabel="删除任务" isLoading={deleteMutation.isPending} error={deleteMutation.error} onClose={() => setDeleting(undefined)} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} />
  </>;
}

"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Warning } from "@phosphor-icons/react";
import { apiFetch } from "@/lib/api";
import { fetchAdminPage } from "@/lib/admin-api";
import { formatDateTime } from "@/lib/format";
import { validateMessage } from "@/lib/messages";
import type { Announcement } from "@/lib/types";
import { useAdminLookups } from "@/components/admin/use-admin-lookups";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, InlineError } from "@/components/ui/async-state";
import { ConfirmationDetails } from "@/components/urgent/confirmation-status";

const PAGE_SIZE = 50;

type AnnouncementInput = {
  title: string;
  content: string;
  type: "notice" | "urgent";
  scope: "school" | "grade" | "class";
  grade?: number;
  target_class_id?: string;
};

export function AnnouncementManager() {
  const queryClient = useQueryClient();
  const lookups = useAdminLookups();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<"notice" | "urgent">("notice");
  const [scope, setScope] = useState<"school" | "grade" | "class">("school");
  const [grade, setGrade] = useState("");
  const [classId, setClassId] = useState("");
  const [validation, setValidation] = useState("");
  const query = useQuery({
    queryKey: ["admin", "announcements", "list", page],
    queryFn: () => fetchAdminPage<Announcement>("/api/v1/announcements", page, PAGE_SIZE),
  });
  const mutation = useMutation({
    mutationFn: (body: AnnouncementInput) => apiFetch<Announcement>("/api/v1/announcements", { method: "POST", body }),
    onSuccess: () => {
      setOpen(false); setTitle(""); setContent(""); setGrade(""); setClassId("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
      void queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) { setValidation("请填写公告标题"); return; }
    const error = validateMessage(type, content);
    if (error) { setValidation(error); return; }
    const numericGrade = Number(grade);
    if (scope === "grade" && (!grade.trim() || !Number.isInteger(numericGrade) || numericGrade < 1 || numericGrade > 12)) {
      setValidation("年级范围需要填写 1–12 的整数年级"); return;
    }
    if (scope === "class" && !classId) { setValidation("班级范围需要选择目标班级"); return; }
    setValidation("");
    const body: AnnouncementInput = { title: title.trim(), content: content.trim(), type, scope };
    if (scope === "grade") body.grade = numericGrade;
    if (scope === "class") body.target_class_id = classId;
    mutation.mutate(body);
  }

  const items = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  return <>
    <PageHeader eyebrow="校园广播" title="公告发布" description="面向全校、年级或班级发布公告；紧急公告会在教室端持续阻断，直到服务端确认。" action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />发布公告</Button>} />
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-panel">
      {query.isPending ? <div className="p-5"><ListSkeleton rows={5} /></div> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState icon={<Megaphone className="h-6 w-6" />} title="还没有公告" description="发布第一条校园公告，授权范围内的教室会实时收到更新。" /> : <ul className="divide-y divide-zinc-100">{items.map((announcement) => <li key={announcement.id} className="p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><Badge tone={announcement.type === "urgent" ? "red" : "yellow"}>{announcement.type === "urgent" ? "紧急" : "通知"}</Badge><Badge>{announcement.scope === "class" ? "班级" : announcement.scope === "grade" ? "年级" : "全校"}</Badge><time className="ml-auto text-xs text-zinc-400" dateTime={announcement.created_at}>{formatDateTime(announcement.created_at)}</time></div><h2 className="mt-3 flex items-center gap-2 font-semibold text-zinc-900">{announcement.type === "urgent" && <Warning className="h-4 w-4 text-red-600" />}{announcement.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{announcement.content}</p><p className="mt-3 text-xs text-zinc-400">发布人：{announcement.publisher_name}{announcement.grade !== undefined ? ` · ${announcement.grade} 年级` : ""}</p>{announcement.type === "urgent" && <ConfirmationDetails kind="announcement" id={announcement.id} summary="查看各班确认状态" className="mt-3" summaryClassName="cursor-pointer text-sm font-medium text-indigo-600" />}</li>)}</ul>}
      <div className="flex min-h-16 items-center justify-between border-t border-zinc-100 px-5 py-3 text-sm text-zinc-500"><span>第 {page} / {totalPages} 页{query.data?.total !== undefined ? ` · 共 ${query.data.total} 条` : ""}</span><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page === 1 || query.isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</Button><Button variant="secondary" size="sm" disabled={page >= totalPages || query.isFetching} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</Button></div></div>
    </section>
    <Dialog open={open} title="发布校园公告" description="公告将按授权范围持久化并实时推送，紧急公告需要教室逐条确认。" onClose={mutation.isPending ? undefined : () => setOpen(false)} className="max-w-2xl"><form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="announcement-title">公告标题</Label><Input id="announcement-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required /></div>
      <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="announcement-type">公告级别</Label><Select id="announcement-type" value={type} onChange={(event) => setType(event.target.value as "notice" | "urgent")}><option value="notice">普通通知</option><option value="urgent">紧急公告</option></Select></div><div className="space-y-2"><Label htmlFor="announcement-scope">发布范围</Label><Select id="announcement-scope" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option value="school">全校</option><option value="grade">指定年级</option><option value="class">指定班级</option></Select></div></div>
      {scope === "grade" && <div className="space-y-2"><Label htmlFor="announcement-grade">目标年级</Label><Input id="announcement-grade" type="number" min={1} max={12} step={1} value={grade} onChange={(event) => setGrade(event.target.value)} required /></div>}
      {scope === "class" && <div className="space-y-2"><Label htmlFor="announcement-class">目标班级</Label><Select id="announcement-class" value={classId} onChange={(event) => setClassId(event.target.value)} required><option value="">请选择班级</option>{lookups.classes.map((item) => <option key={item.id} value={item.id}>{item.grade} 年级 · {item.name}</option>)}</Select>{lookups.error && <InlineError error={lookups.error} />}</div>}
      <div className="space-y-2"><Label htmlFor="announcement-content">公告内容</Label><Textarea id="announcement-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} required /></div>
      {(validation || mutation.error) && <InlineError error={validation || mutation.error} />}
      <div className="flex justify-end gap-3 border-t border-zinc-100 pt-5"><Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={mutation.isPending}>取消</Button><Button type="submit" isLoading={mutation.isPending}>发布公告</Button></div>
    </form></Dialog>
  </>;
}

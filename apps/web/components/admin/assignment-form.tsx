"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Assignment } from "@/lib/admin";
import type { useAdminLookups } from "@/components/admin/use-admin-lookups";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/async-state";

export function AssignmentForm({ open, assignment, lookups, onClose }: {
  open: boolean;
  assignment?: Assignment;
  lookups: ReturnType<typeof useAdminLookups>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  useEffect(() => { if (open) { setTeacherId(assignment?.teacher_id ?? ""); setClassId(assignment?.class_id ?? ""); } }, [open, assignment]);
  const teacher = lookups.teachers.find((item) => item.id === teacherId);
  const subjectName = teacher?.subject_name ?? (teacher?.subject_id ? lookups.subjects.find((item) => item.id === teacher.subject_id)?.name : undefined);
  const missingSubject = Boolean(teacher) && !subjectName;
  const mutation = useMutation({
    mutationFn: (body: { teacher_id: string; class_id: string }) => apiFetch<Assignment>(assignment ? `/api/v1/admin/assignments/${encodeURIComponent(assignment.id)}` : "/api/v1/admin/assignments", { method: assignment ? "PATCH" : "POST", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "channels"] });
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
      onClose();
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (missingSubject) return;
    mutation.mutate({ teacher_id: teacherId, class_id: classId });
  }
  return <Dialog open={open} title={assignment ? "调整教学任务" : "分配教学任务"} description="选择教师与班级即可；科目由教师档案固定，同一教师可分配到多个班级。" onClose={mutation.isPending ? undefined : onClose}>
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="assignment-teacher">负责教师</Label><Select id="assignment-teacher" value={teacherId} onChange={(event) => setTeacherId(event.target.value)} required><option value="">请选择教师</option>{lookups.teachers.map((item) => <option key={item.id} value={item.id}>{item.display_name}（{item.username}）</option>)}</Select></div>
      <div className="space-y-2"><Label>教授科目</Label><div className="flex min-h-11 items-center rounded-md border border-border bg-neutral-1 px-3.5 text-copy-14 text-neutral-8">{teacher ? subjectName ?? "未设置科目" : "选择教师后自动带出"}</div><p className="text-label-12 leading-5 text-neutral-7">每位教师只教授一个科目；如需更换科目，请先在教师管理中调整。</p>{missingSubject && <InlineError error={new Error("该教师尚未设置教授科目，请先到教师管理中选择科目")} />}</div>
      <div className="space-y-2"><Label htmlFor="assignment-class">授课班级</Label><Select id="assignment-class" value={classId} onChange={(event) => setClassId(event.target.value)} required><option value="">请选择班级</option>{lookups.classes.map((item) => <option key={item.id} value={item.id}>{item.grade} 年级 · {item.name}</option>)}</Select></div>
      {mutation.isError && <InlineError error={mutation.error} />}
      <div className="flex justify-end gap-3 border-t border-border pt-5"><Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>取消</Button><Button type="submit" isLoading={mutation.isPending} disabled={missingSubject || !teacherId || !classId}>{assignment ? "保存任务" : "创建任务与通道"}</Button></div>
    </form>
  </Dialog>;
}
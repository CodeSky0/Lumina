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
  const [subjectId, setSubjectId] = useState("");
  useEffect(() => { if (open) { setTeacherId(assignment?.teacher_id ?? ""); setClassId(assignment?.class_id ?? ""); setSubjectId(assignment?.subject_id ?? ""); } }, [open, assignment]);
  const mutation = useMutation({
    mutationFn: (body: { teacher_id: string; class_id: string; subject_id: string }) => apiFetch<Assignment>(assignment ? `/api/v1/admin/assignments/${encodeURIComponent(assignment.id)}` : "/api/v1/admin/assignments", { method: assignment ? "PATCH" : "POST", body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "channels"] });
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
      onClose();
    },
  });
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate({ teacher_id: teacherId, class_id: classId, subject_id: subjectId }); }
  return <Dialog open={open} title={assignment ? "调整教学任务" : "分配教学任务"} description="教师、班级与科目组成唯一任务；新增成功后由服务端事务自动建立科目通道。" onClose={mutation.isPending ? undefined : onClose}>
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="assignment-teacher">负责教师</Label><Select id="assignment-teacher" value={teacherId} onChange={(event) => setTeacherId(event.target.value)} required><option value="">请选择教师</option>{lookups.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.display_name}（{teacher.username}）</option>)}</Select></div>
      <div className="space-y-2"><Label htmlFor="assignment-class">授课班级</Label><Select id="assignment-class" value={classId} onChange={(event) => setClassId(event.target.value)} required><option value="">请选择班级</option>{lookups.classes.map((item) => <option key={item.id} value={item.id}>{item.grade} · {item.name}</option>)}</Select></div>
      <div className="space-y-2"><Label htmlFor="assignment-subject">教授科目</Label><Select id="assignment-subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required><option value="">请选择科目</option>{lookups.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</Select></div>
      {mutation.isError && <InlineError error={mutation.error} />}
      <div className="flex justify-end gap-3 border-t border-border pt-5"><Button type="button" variant="secondary" onClick={onClose} disabled={mutation.isPending}>取消</Button><Button type="submit" isLoading={mutation.isPending}>{assignment ? "保存任务" : "创建任务与通道"}</Button></div>
    </form>
  </Dialog>;
}

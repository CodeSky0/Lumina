"use client";

import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  useToast,
} from "@/components/ui";
import {
  createSubject,
  deleteSubject,
  reorderSubjects,
  updateSubject,
  type SubjectListItem,
} from "@/lib/admin/actions";
import { ConfirmDialog } from "../components/confirm-dialog";

interface SubjectsTabProps {
  subjects: SubjectListItem[];
  onRefresh: () => Promise<void>;
}

export function SubjectsTab({ subjects, onRefresh }: SubjectsTabProps) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<SubjectListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubjectListItem | null>(null);
  const { show } = useToast();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createSubject({
          name: String(f.get("name")),
          slug: String(f.get("slug")),
        });
        setShowCreate(false);
        await onRefresh();
        show("success", "学科创建成功");
      } catch (err) {
        show("error", err instanceof Error ? err.message : "创建失败");
      }
    });
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    const f = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateSubject({
          id: editTarget.id,
          name: String(f.get("name")),
          slug: String(f.get("slug")),
        });
        setEditTarget(null);
        await onRefresh();
        show("success", "学科已更新");
      } catch (err) {
        show("error", err instanceof Error ? err.message : "更新失败");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteSubject(deleteTarget.id);
        setDeleteTarget(null);
        await onRefresh();
        show("success", "学科已删除");
      } catch (err) {
        show("error", err instanceof Error ? err.message : "删除失败");
      }
    });
  }

  function handleMove(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subjects.length) return;
    const reordered = [...subjects];
    const tmp = reordered[index]!;
    reordered[index] = reordered[targetIndex]!;
    reordered[targetIndex] = tmp;
    startTransition(async () => {
      try {
        await reorderSubjects({
          items: reordered.map((s, i) => ({ id: s.id, sortOrder: i })),
        });
        await onRefresh();
      } catch (err) {
        show("error", err instanceof Error ? err.message : "排序失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-20 font-medium text-neutral-10">
          学科管理（{subjects.length}）
        </h2>
        <Button onClick={() => setShowCreate(true)}>创建学科</Button>
      </div>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-copy-14">
            <thead>
              <tr className="border-b border-border text-label-12 text-neutral-7">
                <th className="px-4 py-3 text-left font-medium">排序</th>
                <th className="px-4 py-3 text-left font-medium">学科名称</th>
                <th className="px-4 py-3 text-left font-medium">标识</th>
                <th className="px-4 py-3 text-left font-medium">教师数</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-6">
                    暂无学科
                  </td>
                </tr>
              )}
              {subjects.map((s, i) => (
                <tr
                  key={s.id}
                  className="border-b border-border last:border-0 hover:bg-neutral-3/50"
                >
                  <td className="px-4 py-3 text-neutral-9">
                    <div className="flex items-center gap-1">
                      <span className="text-label-12 text-neutral-6">{i + 1}</span>
                      <button
                        type="button"
                        disabled={i === 0 || pending}
                        onClick={() => handleMove(i, "up")}
                        className="text-neutral-5 hover:text-neutral-9 disabled:opacity-30"
                        aria-label="上移"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={i === subjects.length - 1 || pending}
                        onClick={() => handleMove(i, "down")}
                        className="text-neutral-5 hover:text-neutral-9 disabled:opacity-30"
                        aria-label="下移"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-10">{s.name}</td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-label-12 text-neutral-7">{s.slug}</code>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={s.teacherCount > 0 ? "accent" : "neutral"}>
                      {s.teacherCount}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditTarget(s)}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleteTarget(s)}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="创建学科">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input name="name" label="学科名称" placeholder="如：语文" required />
          <Input name="slug" label="标识（小写字母/数字/连字符）" placeholder="如：chinese" required />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "创建中…" : "创建"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="编辑学科">
        <form onSubmit={handleEdit} className="space-y-4">
          <Input name="name" label="学科名称" defaultValue={editTarget?.name} required />
          <Input name="slug" label="标识" defaultValue={editTarget?.slug} required />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "保存中…" : "保存"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除学科"
        message={
          deleteTarget
            ? `确认删除学科「${deleteTarget.name}」？${deleteTarget.teacherCount > 0 ? `当前有 ${deleteTarget.teacherCount} 位教师归属此学科，删除后这些教师的学科将置空。` : ""}此操作不可撤销。`
            : ""
        }
        confirmLabel="删除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

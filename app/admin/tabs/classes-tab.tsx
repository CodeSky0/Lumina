"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  useToast,
} from "@/components/ui";
import {
  createClass,
  deleteClass,
  unbindScreenClass,
  type ClassListItem,
} from "@/lib/admin/actions";
import { ConfirmDialog } from "../components/confirm-dialog";

interface ClassesTabProps {
  classes: ClassListItem[];
  onRefresh: () => Promise<void>;
}

export function ClassesTab({ classes, onRefresh }: ClassesTabProps) {
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassListItem | null>(null);
  const [unbindTarget, setUnbindTarget] = useState<ClassListItem | null>(null);
  const { show } = useToast();

  const filtered = useMemo(() => {
    return classes.filter((c) =>
      !search || c.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [classes, search]);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createClass({ name: String(f.get("name")) });
        setShowCreate(false);
        await onRefresh();
        show("success", "班级创建成功");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteClass(deleteTarget.id);
        setDeleteTarget(null);
        await onRefresh();
        show("success", "班级已删除");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  function handleUnbindScreen() {
    if (!unbindTarget) return;
    startTransition(async () => {
      try {
        await unbindScreenClass(unbindTarget.id);
        setUnbindTarget(null);
        await onRefresh();
        show("success", "大屏已解绑");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "解绑失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-20 font-medium text-neutral-10">
          班级管理（{classes.length}）
        </h2>
        <Button onClick={() => setShowCreate(true)}>创建班级</Button>
      </div>

      <Input
        placeholder="搜索班级名称…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-copy-14">
            <thead>
              <tr className="border-b border-border text-label-12 text-neutral-7">
                <th className="px-4 py-3 text-left font-medium">班级名称</th>
                <th className="px-4 py-3 text-left font-medium">大屏绑定</th>
                <th className="px-4 py-3 text-left font-medium">教师数</th>
                <th className="px-4 py-3 text-left font-medium">学生数</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-6">
                    无匹配班级
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 hover:bg-neutral-3/50"
                >
                  <td className="px-4 py-3 text-neutral-10">{c.name}</td>
                  <td className="px-4 py-3">
                    {c.screenId ? (
                      <Badge tone="success">
                        {c.screenName ?? "已绑定"}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">未绑定</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-9">{c.teacherCount}</td>
                  <td className="px-4 py-3 text-neutral-9">{c.studentCount}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {c.screenId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setUnbindTarget(c)}
                      >
                        解绑大屏
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteTarget(c)}
                    >
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="创建班级">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input name="name" label="班级名称" required />
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除班级"
        message={`确认删除班级「${deleteTarget?.name}」？此操作将同时删除所有绑定关系，不可撤销。`}
        confirmLabel="删除"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!unbindTarget}
        title="解绑大屏"
        message={`确认将班级「${unbindTarget?.name}」的大屏解绑？`}
        confirmLabel="解绑"
        onConfirm={handleUnbindScreen}
        onCancel={() => setUnbindTarget(null)}
      />
    </div>
  );
}

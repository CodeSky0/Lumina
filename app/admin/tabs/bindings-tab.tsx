"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  useToast,
} from "@/components/ui";
import {
  bindParentStudent,
  bindScreenClass,
  bindTeacherClass,
  unbindParentStudent,
  unbindScreenClass,
  unbindTeacherClass,
  type ClassListItem,
  type ParentStudentBinding,
  type TeacherClassBinding,
  type UserListItem,
} from "@/lib/admin/actions";
import { ConfirmDialog } from "../components/confirm-dialog";

interface BindingsTabProps {
  users: UserListItem[];
  classes: ClassListItem[];
  teacherBindings: TeacherClassBinding[];
  parentBindings: ParentStudentBinding[];
  onRefresh: () => Promise<void>;
}

type UnbindTarget =
  | { type: "teacher"; teacherId: string; classId: string; label: string }
  | { type: "parent"; id: string; label: string }
  | { type: "screen"; classId: string; label: string };

export function BindingsTab({
  users,
  classes,
  teacherBindings,
  parentBindings,
  onRefresh,
}: BindingsTabProps) {
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [unbindTarget, setUnbindTarget] = useState<UnbindTarget | null>(null);
  const { show } = useToast();

  const teachers = useMemo(
    () => users.filter((u) => u.role === "teacher"),
    [users],
  );
  const parents = useMemo(
    () => users.filter((u) => u.role === "parent"),
    [users],
  );
  const screens = useMemo(
    () => users.filter((u) => u.role === "classroom"),
    [users],
  );

  const classOptions = classes.map((c) => ({ value: c.id, label: c.name }));
  const teacherOptions = teachers.map((u) => ({ value: u.id, label: u.name }));
  const parentOptions = parents.map((u) => ({ value: u.id, label: u.name }));
  const screenOptions = screens.map((u) => ({ value: u.id, label: u.name }));

  const filteredTeacherBindings = useMemo(() => {
    return teacherBindings.filter(
      (b) =>
        !search ||
        b.teacherName.toLowerCase().includes(search.toLowerCase()) ||
        b.className.toLowerCase().includes(search.toLowerCase()),
    );
  }, [teacherBindings, search]);

  const filteredParentBindings = useMemo(() => {
    return parentBindings.filter(
      (b) =>
        !search ||
        b.parentName.toLowerCase().includes(search.toLowerCase()) ||
        b.className.toLowerCase().includes(search.toLowerCase()) ||
        b.studentName.toLowerCase().includes(search.toLowerCase()),
    );
  }, [parentBindings, search]);

  const screenBindings = useMemo(() => {
    return classes
      .filter((c) => c.screenId)
      .map((c) => ({
        classId: c.id,
        className: c.name,
        screenName: c.screenName ?? "",
      }));
  }, [classes]);

  const filteredScreenBindings = useMemo(() => {
    return screenBindings.filter(
      (b) =>
        !search ||
        b.className.toLowerCase().includes(search.toLowerCase()) ||
        b.screenName.toLowerCase().includes(search.toLowerCase()),
    );
  }, [screenBindings, search]);

  function handleBindTeacher(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    startTransition(async () => {
      try {
        await bindTeacherClass({
          teacherId: String(f.get("teacherId")),
          classId: String(f.get("classId")),
        });
        form.reset();
        await onRefresh();
        show("success", "教师绑定成功");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "绑定失败");
      }
    });
  }

  function handleBindParent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    startTransition(async () => {
      try {
        await bindParentStudent({
          parentId: String(f.get("parentId")),
          classId: String(f.get("classId")),
          studentName: String(f.get("studentName")),
        });
        form.reset();
        await onRefresh();
        show("success", "家长绑定成功");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "绑定失败");
      }
    });
  }

  function handleBindScreen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    startTransition(async () => {
      try {
        await bindScreenClass({
          screenUserId: String(f.get("screenUserId")),
          classId: String(f.get("classId")),
        });
        form.reset();
        await onRefresh();
        show("success", "大屏绑定成功");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "绑定失败");
      }
    });
  }

  function handleUnbind() {
    if (!unbindTarget) return;
    startTransition(async () => {
      try {
        if (unbindTarget.type === "teacher") {
          await unbindTeacherClass({
            teacherId: unbindTarget.teacherId,
            classId: unbindTarget.classId,
          });
        } else if (unbindTarget.type === "parent") {
          await unbindParentStudent(unbindTarget.id);
        } else {
          await unbindScreenClass(unbindTarget.classId);
        }
        setUnbindTarget(null);
        await onRefresh();
        show("success", "解绑成功");
      } catch (e) {
        show("error", e instanceof Error ? e.message : "解绑失败");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-title-20 font-medium text-neutral-10">
          绑定关系
        </h2>
        <Input
          placeholder="搜索绑定关系…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {/* 教师 ↔ 班级 */}
      <Card title="教师 ↔ 班级">
        <form onSubmit={handleBindTeacher} className="flex flex-wrap items-end gap-3">
          <Select
            name="teacherId"
            placeholder="选教师"
            options={teacherOptions}
            required
          />
          <Select
            name="classId"
            placeholder="选班级"
            options={classOptions}
            required
          />
          <Button type="submit" disabled={pending}>
            绑定
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          {filteredTeacherBindings.length === 0 && (
            <p className="text-copy-13 text-neutral-6">暂无绑定</p>
          )}
          {filteredTeacherBindings.map((b) => (
            <div
              key={`${b.teacherId}-${b.classId}`}
              className="flex items-center justify-between rounded-md bg-neutral-1 px-3 py-2 text-copy-14 ring-1 ring-border"
            >
              <span className="text-neutral-9">
                <Badge tone="accent">{b.teacherName}</Badge>
                <span className="mx-2 text-neutral-6">→</span>
                <Badge tone="neutral">{b.className}</Badge>
              </span>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  setUnbindTarget({
                    type: "teacher",
                    teacherId: b.teacherId,
                    classId: b.classId,
                    label: `${b.teacherName} → ${b.className}`,
                  })
                }
              >
                解绑
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* 家长 ↔ 班级 */}
      <Card title="家长 ↔ 班级（学生）">
        <form onSubmit={handleBindParent} className="flex flex-wrap items-end gap-3">
          <Select
            name="parentId"
            placeholder="选家长"
            options={parentOptions}
            required
          />
          <Select
            name="classId"
            placeholder="选班级"
            options={classOptions}
            required
          />
          <Input
            name="studentName"
            placeholder="学生姓名"
            required
          />
          <Button type="submit" disabled={pending}>
            绑定
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          {filteredParentBindings.length === 0 && (
            <p className="text-copy-13 text-neutral-6">暂无绑定</p>
          )}
          {filteredParentBindings.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-md bg-neutral-1 px-3 py-2 text-copy-14 ring-1 ring-border"
            >
              <span className="text-neutral-9">
                <Badge tone="accent">{b.parentName}</Badge>
                <span className="mx-2 text-neutral-6">→</span>
                <Badge tone="neutral">{b.className}</Badge>
                <span className="ml-2 text-neutral-7">（学生：{b.studentName}）</span>
              </span>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  setUnbindTarget({
                    type: "parent",
                    id: b.id,
                    label: `${b.parentName} → ${b.className}（${b.studentName}）`,
                  })
                }
              >
                解绑
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* 大屏 ↔ 班级 */}
      <Card title="大屏 ↔ 班级">
        <form onSubmit={handleBindScreen} className="flex flex-wrap items-end gap-3">
          <Select
            name="screenUserId"
            placeholder="选大屏"
            options={screenOptions}
            required
          />
          <Select
            name="classId"
            placeholder="选班级"
            options={classOptions}
            required
          />
          <Button type="submit" disabled={pending}>
            绑定
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          {filteredScreenBindings.length === 0 && (
            <p className="text-copy-13 text-neutral-6">暂无绑定</p>
          )}
          {filteredScreenBindings.map((b) => (
            <div
              key={b.classId}
              className="flex items-center justify-between rounded-md bg-neutral-1 px-3 py-2 text-copy-14 ring-1 ring-border"
            >
              <span className="text-neutral-9">
                <Badge tone="success">{b.screenName}</Badge>
                <span className="mx-2 text-neutral-6">→</span>
                <Badge tone="neutral">{b.className}</Badge>
              </span>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  setUnbindTarget({
                    type: "screen",
                    classId: b.classId,
                    label: `${b.screenName} → ${b.className}`,
                  })
                }
              >
                解绑
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <ConfirmDialog
        open={!!unbindTarget}
        title="解绑确认"
        message={`确认解绑「${unbindTarget?.label}」？`}
        confirmLabel="解绑"
        onConfirm={handleUnbind}
        onCancel={() => setUnbindTarget(null)}
      />
    </div>
  );
}

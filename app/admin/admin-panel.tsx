"use client";

import { useEffect, useState, useTransition } from "react";
import {
  bindParentStudent,
  bindScreenClass,
  bindTeacherClass,
  createClass,
  createUser,
  deleteUser,
  listClasses,
  listParentStudentBindings,
  listTeacherClassBindings,
  listUsers,
  type ClassListItem,
  type CreatedUser,
  type ParentStudentBinding,
  type TeacherClassBinding,
  type UserListItem,
} from "@/lib/admin/actions";

const ROLE_LABELS: Record<string, string> = {
  parent: "家长",
  teacher: "教师",
  classroom: "大屏",
  admin: "管理员",
};

export default function AdminPanel() {
  const [pending, startTransition] = useTransition();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [classes, setClasses] = useState<ClassListItem[]>([]);
  const [teacherBindings, setTeacherBindings] = useState<TeacherClassBinding[]>(
    [],
  );
  const [parentBindings, setParentBindings] = useState<ParentStudentBinding[]>(
    [],
  );
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [u, c, tb, pb] = await Promise.all([
      listUsers(),
      listClasses(),
      listTeacherClassBindings(),
      listParentStudentBindings(),
    ]);
    setUsers(u);
    setClasses(c);
    setTeacherBindings(tb);
    setParentBindings(pb);
  }

  useEffect(() => {
    void refresh();
  }, []);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <h1 className="font-serif text-title-28 font-medium text-neutral-10">
        管理端
      </h1>
      {error && (
        <p className="rounded-md bg-neutral-2 p-3 text-copy-13 text-error ring-1 ring-border">
          {error}
        </p>
      )}

      {/* 创建用户 */}
      <section className="space-y-4 rounded-xl bg-neutral-2 p-6 ring-1 ring-border">
        <h2 className="font-serif text-title-20 font-medium text-neutral-9">
          创建用户
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(async () => {
              const res = await createUser({
                role: String(f.get("role")) as CreatedUser["role"],
                name: String(f.get("name")),
              });
              setCreated(res);
            });
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="space-y-1.5">
            <span className="block text-label-12 font-medium text-neutral-9">
              角色
            </span>
            <select
              name="role"
              className="rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="parent">家长</option>
              <option value="teacher">教师</option>
              <option value="classroom">大屏</option>
              <option value="admin">管理员</option>
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="block text-label-12 font-medium text-neutral-9">
              姓名
            </span>
            <input
              name="name"
              required
              className="rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            创建
          </button>
        </form>
        {created && (
          <div className="rounded-md bg-neutral-3 p-4 text-copy-13 ring-1 ring-border">
            <p className="font-medium text-neutral-10">
              用户已创建 — Token 仅显示一次，请立即保存！
            </p>
            <p className="mt-2 text-neutral-9">
              姓名：{created.name}（{ROLE_LABELS[created.role]}）
            </p>
            <p className="mt-1 break-all text-neutral-9">
              登录 ID：
              <code className="mx-1 font-mono text-copy-13">{created.username}</code>
              <button
                onClick={() => navigator.clipboard.writeText(created.username)}
                className="text-accent underline"
              >
                复制
              </button>
            </p>
            <p className="mt-1 break-all text-neutral-9">
              Token：
              <code className="mx-1 font-mono text-copy-13">{created.token}</code>
              <button
                onClick={() => navigator.clipboard.writeText(created.token)}
                className="text-accent underline"
              >
                复制
              </button>
            </p>
            <button
              onClick={() => setCreated(null)}
              className="mt-2 text-neutral-7 underline"
            >
              关闭
            </button>
          </div>
        )}
      </section>

      {/* 创建班级 */}
      <section className="space-y-4 rounded-xl bg-neutral-2 p-6 ring-1 ring-border">
        <h2 className="font-serif text-title-20 font-medium text-neutral-9">
          创建班级
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => createClass({ name: String(f.get("name")) }));
            e.currentTarget.reset();
          }}
          className="flex items-end gap-3"
        >
          <label className="space-y-1.5">
            <span className="block text-label-12 font-medium text-neutral-9">
              班级名称
            </span>
            <input
              name="name"
              required
              className="rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            创建
          </button>
        </form>
      </section>

      {/* 绑定管理 */}
      <section className="space-y-4 rounded-xl bg-neutral-2 p-6 ring-1 ring-border">
        <h2 className="font-serif text-title-20 font-medium text-neutral-9">
          绑定关系
        </h2>

        {/* 教师↔班级 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              bindTeacherClass({
                teacherId: String(f.get("teacherId")),
                classId: String(f.get("classId")),
              }),
            );
            e.currentTarget.reset();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <span className="text-label-12 font-medium text-neutral-9">
            教师↔班级：
          </span>
          <Select
            name="teacherId"
            placeholder="选教师"
            options={users
              .filter((u) => u.role === "teacher")
              .map((u) => ({ value: u.id, label: u.name }))}
          />
          <Select
            name="classId"
            placeholder="选班级"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-3 py-2 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            绑定
          </button>
        </form>

        {/* 家长↔班级(学生) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              bindParentStudent({
                parentId: String(f.get("parentId")),
                classId: String(f.get("classId")),
                studentName: String(f.get("studentName")),
              }),
            );
            e.currentTarget.reset();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <span className="text-label-12 font-medium text-neutral-9">
            家长↔班级：
          </span>
          <Select
            name="parentId"
            placeholder="选家长"
            options={users
              .filter((u) => u.role === "parent")
              .map((u) => ({ value: u.id, label: u.name }))}
          />
          <Select
            name="classId"
            placeholder="选班级"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <input
            name="studentName"
            placeholder="学生姓名"
            required
            className="rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-3 py-2 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            绑定
          </button>
        </form>

        {/* 大屏↔班级 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              bindScreenClass({
                screenUserId: String(f.get("screenUserId")),
                classId: String(f.get("classId")),
              }),
            );
            e.currentTarget.reset();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <span className="text-label-12 font-medium text-neutral-9">
            大屏↔班级：
          </span>
          <Select
            name="screenUserId"
            placeholder="选大屏"
            options={users
              .filter((u) => u.role === "classroom")
              .map((u) => ({ value: u.id, label: u.name }))}
          />
          <Select
            name="classId"
            placeholder="选班级"
            options={classes.map((c) => ({ value: c.id, label: c.name }))}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-3 py-2 text-copy-14 font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            绑定
          </button>
        </form>
      </section>

      {/* 列表 */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-neutral-2 p-6 ring-1 ring-border">
          <h2 className="mb-4 font-serif text-title-20 font-medium text-neutral-9">
            用户（{users.length}）
          </h2>
          <ul className="space-y-2">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between text-copy-14"
              >
                <span className="text-neutral-9">
                  <span className="mr-2 rounded-md bg-neutral-3 px-1.5 py-0.5 text-label-12 text-neutral-7">
                    {ROLE_LABELS[u.role]}
                  </span>
                  {u.name}
                  <code className="ml-2 font-mono text-label-12 text-neutral-7">
                    {u.username.slice(0, 8)}…
                  </code>
                </span>
                <button
                  onClick={() => run(() => deleteUser(u.id))}
                  className="text-label-12 text-error underline"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-neutral-2 p-6 ring-1 ring-border">
          <h2 className="mb-4 font-serif text-title-20 font-medium text-neutral-9">
            班级（{classes.length}）
          </h2>
          <ul className="space-y-2">
            {classes.map((c) => (
              <li key={c.id} className="text-copy-14 text-neutral-9">
                {c.name}
                {c.screenId && (
                  <span className="ml-2 text-label-12 text-success">
                    已绑大屏
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-neutral-2 p-6 ring-1 ring-border">
          <h2 className="mb-4 font-serif text-title-20 font-medium text-neutral-9">
            教师↔班级
          </h2>
          <ul className="space-y-2">
            {teacherBindings.map((b) => (
              <li
                key={`${b.teacherId}-${b.classId}`}
                className="text-copy-14 text-neutral-9"
              >
                {b.teacherName} → {b.className}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-neutral-2 p-6 ring-1 ring-border">
          <h2 className="mb-4 font-serif text-title-20 font-medium text-neutral-9">
            家长↔班级(学生)
          </h2>
          <ul className="space-y-2">
            {parentBindings.map((b) => (
              <li key={b.id} className="text-copy-14 text-neutral-9">
                {b.parentName} → {b.className}（学生：{b.studentName}）
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Select({
  name,
  placeholder,
  options,
}: {
  name: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      required
      defaultValue=""
      className="rounded-md bg-neutral-1 px-3 py-2 text-copy-14 text-neutral-9 ring-1 ring-border outline-none focus:ring-2 focus:ring-accent"
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

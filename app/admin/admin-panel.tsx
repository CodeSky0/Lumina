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
      <h1 className="text-3xl font-bold">管理端</h1>
      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {/* 创建用户 */}
      <section className="space-y-3 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">创建用户</h2>
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
          <label className="space-y-1 text-sm">
            <span className="block font-medium">角色</span>
            <select name="role" className="rounded border px-2 py-1.5">
              <option value="parent">家长</option>
              <option value="teacher">教师</option>
              <option value="classroom">大屏</option>
              <option value="admin">管理员</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="block font-medium">姓名</span>
            <input
              name="name"
              required
              className="rounded border px-2 py-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-4 py-1.5 text-white disabled:opacity-50"
          >
            创建
          </button>
        </form>
        {created && (
          <div className="rounded bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-800">
              用户已创建 — Token 仅显示一次，请立即保存！
            </p>
            <p className="mt-2">
              姓名：{created.name}（{ROLE_LABELS[created.role]}）
            </p>
            <p className="mt-1 break-all">
              登录 ID：
              <code className="mx-1">{created.username}</code>
              <button
                onClick={() => navigator.clipboard.writeText(created.username)}
                className="text-blue-600 underline"
              >
                复制
              </button>
            </p>
            <p className="mt-1 break-all">
              Token：
              <code className="mx-1">{created.token}</code>
              <button
                onClick={() => navigator.clipboard.writeText(created.token)}
                className="text-blue-600 underline"
              >
                复制
              </button>
            </p>
            <button
              onClick={() => setCreated(null)}
              className="mt-2 text-gray-500 underline"
            >
              关闭
            </button>
          </div>
        )}
      </section>

      {/* 创建班级 */}
      <section className="space-y-3 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">创建班级</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => createClass({ name: String(f.get("name")) }));
            e.currentTarget.reset();
          }}
          className="flex items-end gap-3"
        >
          <label className="space-y-1 text-sm">
            <span className="block font-medium">班级名称</span>
            <input
              name="name"
              required
              className="rounded border px-2 py-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-4 py-1.5 text-white disabled:opacity-50"
          >
            创建
          </button>
        </form>
      </section>

      {/* 绑定管理 */}
      <section className="space-y-4 rounded-xl border p-6">
        <h2 className="text-xl font-semibold">绑定关系</h2>

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
          }}
          className="flex flex-wrap items-end gap-2 text-sm"
        >
          <span className="font-medium">教师↔班级：</span>
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
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
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
          className="flex flex-wrap items-end gap-2 text-sm"
        >
          <span className="font-medium">家长↔班级：</span>
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
            className="rounded border px-2 py-1.5"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
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
          }}
          className="flex flex-wrap items-end gap-2 text-sm"
        >
          <span className="font-medium">大屏↔班级：</span>
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
            className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
          >
            绑定
          </button>
        </form>
      </section>

      {/* 列表 */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-6">
          <h2 className="mb-3 text-xl font-semibold">
            用户（{users.length}）
          </h2>
          <ul className="space-y-1 text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between">
                <span>
                  <span className="mr-2 rounded bg-gray-100 px-1.5 text-xs">
                    {ROLE_LABELS[u.role]}
                  </span>
                  {u.name}
                  <code className="ml-2 text-xs text-gray-500">
                    {u.username.slice(0, 8)}…
                  </code>
                </span>
                <button
                  onClick={() => run(() => deleteUser(u.id))}
                  className="text-xs text-red-600 underline"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border p-6">
          <h2 className="mb-3 text-xl font-semibold">
            班级（{classes.length}）
          </h2>
          <ul className="space-y-1 text-sm">
            {classes.map((c) => (
              <li key={c.id}>
                {c.name}
                {c.screenId && (
                  <span className="ml-2 text-xs text-green-600">已绑大屏</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-6">
          <h2 className="mb-3 text-xl font-semibold">教师↔班级</h2>
          <ul className="space-y-1 text-sm">
            {teacherBindings.map((b) => (
              <li key={`${b.teacherId}-${b.classId}`}>
                {b.teacherName} → {b.className}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border p-6">
          <h2 className="mb-3 text-xl font-semibold">家长↔班级(学生)</h2>
          <ul className="space-y-1 text-sm">
            {parentBindings.map((b) => (
              <li key={b.id}>
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
    <select name={name} required className="rounded border px-2 py-1.5">
      <option value="" disabled selected>
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

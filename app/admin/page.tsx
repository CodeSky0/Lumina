import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "admin") redirect("/admin/login");

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-8">
      <h1 className="text-3xl font-bold">管理端</h1>
      <p className="mt-2 text-gray-600">欢迎，{session.user.name}</p>
      <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
        创建用户/生成凭证 · 教师↔班级 · 家长↔班级(学生) · 大屏↔班级
        <br />
        <span className="text-sm">（骨架占位 — 待接入 CRUD）</span>
      </div>
    </main>
  );
}

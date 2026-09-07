import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export default async function TeacherPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "teacher") redirect("/login");

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-8">
      <h1 className="text-3xl font-bold">教师端</h1>
      <p className="mt-2 text-gray-600">欢迎，{session.user.name}</p>
      <div className="mt-8 rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
        执教班级列表 · 发布通知 · 家长留言收件箱
        <br />
        <span className="text-sm">（骨架占位 — 待接入数据与实时通讯）</span>
      </div>
    </main>
  );
}

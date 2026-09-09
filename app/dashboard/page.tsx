import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import type { UserRole } from "@/lib/db/schema";

/** 登录后中转 — 服务端按 role 重定向至对应 Dashboard */
const ROLE_HOME: Record<UserRole, string> = {
  parent: "/parent",
  teacher: "/teacher",
  classroom: "/screen",
  admin: "/admin",
};

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  redirect(ROLE_HOME[session.user.role]);
}

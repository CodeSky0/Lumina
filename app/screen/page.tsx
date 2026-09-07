import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import ScreenDisplay from "./screen-display";

/** 教室大屏端 — 服务端校验 role=classroom 后渲染客户端展示组件 */
export default async function ScreenPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "classroom") redirect("/login");

  return <ScreenDisplay />;
}

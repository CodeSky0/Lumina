import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getMyScreenClass } from "@/lib/messages/actions";
import ScreenDisplay from "./screen-display";

/** 教室大屏端 — 服务端校验 role=classroom，获取绑定班级并构造 WS URL */
export default async function ScreenPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "classroom") redirect("/login");

  const screenClass = await getMyScreenClass();
  const cfWorkerUrl = process.env.CF_WORKER_URL;
  const wsUrl =
    screenClass && cfWorkerUrl
      ? `${cfWorkerUrl.replace(/\/$/, "").replace(/^http/, "ws")}/ws/${screenClass.classId}`
      : null;
  const className = screenClass?.className ?? "未绑定班级";

  return <ScreenDisplay wsUrl={wsUrl} className={className} />;
}

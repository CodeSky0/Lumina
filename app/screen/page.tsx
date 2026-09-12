import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getMyScreenClass } from "@/lib/messages/queries";
import ScreenDisplay from "./screen-display";

export default async function ScreenPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "classroom") redirect("/login");

  const screenClass = await getMyScreenClass();
  const className = screenClass?.className ?? "未绑定班级";
  const cfWorkerUrl = process.env.CF_WORKER_URL ?? null;

  return <ScreenDisplay userId={session.user.id} className={className} cfWorkerUrl={cfWorkerUrl} />;
}

import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getMyScreenClass } from "@/lib/messages/actions";
import ScreenDisplay from "./screen-display";

export default async function ScreenPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "classroom") redirect("/login");

  const screenClass = await getMyScreenClass();
  const className = screenClass?.className ?? "未绑定班级";

  return <ScreenDisplay userId={session.user.id} className={className} />;
}

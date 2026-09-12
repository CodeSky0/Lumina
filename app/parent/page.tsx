import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import ParentPanel from "./parent-panel";

export default async function ParentPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "parent") redirect("/login");

  const cfWorkerUrl = process.env.CF_WORKER_URL ?? null;
  return (
    <ParentPanel
      parentId={session.user.id}
      parentName={session.user.name}
      cfWorkerUrl={cfWorkerUrl}
    />
  );
}

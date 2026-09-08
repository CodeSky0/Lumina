import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import ParentPanel from "./parent-panel";

export default async function ParentPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "parent") redirect("/login");

  return <ParentPanel parentName={session.user.name} />;
}

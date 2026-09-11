import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import AdminPanel from "./admin-panel";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "admin") redirect("/admin/login");

  return <AdminPanel adminName={session.user.name} />;
}

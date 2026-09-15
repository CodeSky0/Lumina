import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";

export default async function RootPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  redirect("/dashboard");
}

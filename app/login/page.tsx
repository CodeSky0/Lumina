import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import LoginPageClient from "./login-client";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    if (session.user.role === "admin") redirect("/admin");
    redirect("/dashboard");
  }
  return <LoginPageClient />;
}

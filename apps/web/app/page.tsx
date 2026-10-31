"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";
import { destinationForRole } from "@/lib/auth-utils";
import { useSessionStore } from "@/stores/session";

export default function HomePage() {
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const status = useSessionStore((state) => state.status);
  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (status === "authenticated" && user) router.replace(destinationForRole(user.role));
  }, [router, status, user]);
  return <main id="main-content" className="flex min-h-[100dvh] items-center justify-center" role="status"><CircleNotch className="h-6 w-6 animate-spin text-indigo-500" /><span className="ml-3 text-sm text-zinc-500">正在进入 Lumina</span></main>;
}

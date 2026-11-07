"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";
import { canAccessRole, destinationForRole } from "@/lib/auth-utils";
import type { Role } from "@/lib/types";
import { useSessionStore } from "@/stores/session";

export function AuthGuard({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const status = useSessionStore((state) => state.status);
  const allowed = status === "authenticated" && canAccessRole(user?.role, role);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (status === "authenticated" && user && !canAccessRole(user.role, role)) {
      router.replace(destinationForRole(user.role));
    }
  }, [role, router, status, user]);

  if (!allowed) {
    return (
      <main id="main-content" className="flex min-h-[100dvh] items-center justify-center bg-paper" role="status">
        <div className="flex flex-col items-center gap-3 text-copy-14 text-neutral-7">
          <CircleNotch className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
          {status === "restoring" ? "正在安全恢复会话" : "正在前往可用工作区"}
        </div>
      </main>
    );
  }
  return children;
}

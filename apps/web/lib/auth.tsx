"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, refreshSession } from "@/lib/api";
import { destinationForRole } from "@/lib/auth-utils";
import type { AuthSession } from "@/lib/types";
import { useSessionStore } from "@/stores/session";

interface AuthContextValue {
  login: (username: string, password: string) => Promise<string>;
  deviceLogin: (code: string) => Promise<string>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSession = useSessionStore((state) => state.setSession);
  const clearSession = useSessionStore((state) => state.clearSession);
  const status = useSessionStore((state) => state.status);
  const [restoreStarted, setRestoreStarted] = useState(false);

  useEffect(() => {
    if (restoreStarted) return;
    setRestoreStarted(true);
    if (useSessionStore.getState().status === "authenticated") return;
    void refreshSession().catch(() => undefined);
  }, [restoreStarted]);

  useEffect(() => {
    if (status === "anonymous") queryClient.clear();
  }, [queryClient, status]);

  const finishLogin = useCallback((session: AuthSession) => {
    const previousUserId = useSessionStore.getState().user?.id;
    if (previousUserId !== session.user.id) queryClient.clear();
    setSession(session);
    return destinationForRole(session.user.role);
  }, [queryClient, setSession]);

  const login = useCallback(async (username: string, password: string) => {
    const session = await apiFetch<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: { username, password },
      skipAuth: true,
    });
    return finishLogin(session);
  }, [finishLogin]);

  const deviceLogin = useCallback(async (code: string) => {
    const session = await apiFetch<AuthSession>("/api/v1/auth/device", {
      method: "POST",
      body: { code },
      skipAuth: true,
    });
    return finishLogin(session);
  }, [finishLogin]);

  const logout = useCallback(async () => {
    try {
      await apiFetch<void>("/api/v1/auth/logout", { method: "POST" });
    } finally {
      clearSession();
      queryClient.clear();
      router.replace("/login");
    }
  }, [clearSession, queryClient, router]);

  const value = useMemo(() => ({ login, deviceLogin, logout }), [login, deviceLogin, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return context;
}

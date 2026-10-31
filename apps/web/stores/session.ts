import { create } from "zustand";
import type { AuthSession, User } from "@/lib/types";

export type AuthStatus = "restoring" | "authenticated" | "anonymous";

interface SessionState {
  user: User | null;
  accessToken: string | null;
  expiresAt: string | null;
  status: AuthStatus;
  setSession: (session: AuthSession) => void;
  setRestoring: () => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  accessToken: null,
  expiresAt: null,
  status: "restoring",
  setSession: (session) => set({
    user: session.user,
    accessToken: session.access_token,
    expiresAt: session.expires_at,
    status: "authenticated",
  }),
  setRestoring: () => set({ status: "restoring" }),
  clearSession: () => set({
    user: null,
    accessToken: null,
    expiresAt: null,
    status: "anonymous",
  }),
}));

/**
 * 服务端会话辅助 — 在 Server Component / Server Action 中获取当前登录用户。
 */
import { headers } from "next/headers";
import { auth } from "./server";
import type { UserRole } from "@/lib/db/schema";

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  tokenHash: string;
};

export type SessionInfo = {
  user: SessionUser;
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
};

/** 返回当前会话（含 user.role），未登录返回 null */
export async function getCurrentSession(): Promise<SessionInfo | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return null;
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      username: session.user.username as string,
      role: session.user.role as UserRole,
      tokenHash: session.user.tokenHash as string,
    },
    session: {
      id: session.session.id,
      token: session.session.token,
      expiresAt: session.session.expiresAt,
    },
  };
}

/** 要求已登录且角色匹配，否则抛出（在 Server Action/Component 中调用） */
export async function requireUser(role?: UserRole): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  if (role && session.user.role !== role) {
    throw new Error(`FORBIDDEN:需要 ${role} 角色`);
  }
  return session.user;
}

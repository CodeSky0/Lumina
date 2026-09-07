/**
 * Better-Auth 客户端 — 用于登录页等客户端组件调用 signIn/signOut。
 */
import { createAuthClient } from "better-auth/client";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

export type AuthClient = typeof authClient;

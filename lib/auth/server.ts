/**
 * Better-Auth 服务端实例。
 *
 * 认证方案：username + password（ID → username，Token → password）
 *   - username plugin 允许 UUID 字符（含 hyphen），禁用归一化保留原样
 *   - users 表复用为 better-auth user 表（usePlural 映射）
 *   - role / tokenHash 作为 additionalFields（input:false，由服务端逻辑写入）
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { username } from "better-auth/plugins";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getEnv } from "@/lib/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      verification: schema.verifications,
    },
  }),
  secret: getEnv().BETTER_AUTH_SECRET,
  baseURL: getEnv().BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  plugins: [
    username({
      /** 允许 UUID 字符：字母数字与连字符 */
      usernameValidator: (u) => /^[a-zA-Z0-9-]+$/.test(u),
      /** 禁用归一化，保留 UUID 原样 */
      usernameNormalization: false,
      /** UUID 36 字符，默认 30 不够 */
      maxUsernameLength: 100,
    }),
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        input: false,
      },
      tokenHash: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
  },
});

export type Auth = typeof auth;

/**
 * 一次性引导端点 — 仅当数据库中不存在任何 admin 时可调用。
 * POST /api/setup → 创建首个管理员，返回登录 ID + Token（仅此次）。
 * 有 admin 后本端点自动返回 403，不再可用。
 */
import { auth } from "@/lib/auth/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  // 安全闸：已有管理员则关闭引导
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "管理员已存在，引导端点已关闭" },
      { status: 403 },
    );
  }

  const username = randomUUID();
  const token = randomBytes(24).toString("hex");

  const res = await auth.api.signUpEmail({
    body: {
      email: `${username}@lumina.local`,
      name: "管理员",
      password: token,
      username,
    },
    headers: await headers(),
  });
  if (!res?.user) {
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }

  await db
    .update(schema.users)
    .set({ role: "admin", tokenHash: createHash("sha256").update(token).digest("hex") })
    .where(eq(schema.users.id, res.user.id));

  return NextResponse.json({
    name: "管理员",
    username,
    token,
    hint: "请立即保存！用此 ID + Token 登录 /admin/login",
  });
}

/**
 * 服务端数据查询 — 供 Server Component 直接调用。
 * 不使用 "use server" 指令，避免在 RSC 渲染中被编译为 Server Action 引用。
 */
import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/** 查询大屏端绑定的班级 */
export async function getMyScreenClass(): Promise<{
  classId: string;
  className: string;
} | null> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "classroom") return null;
  const rows = await db
    .select({
      classId: schema.classes.id,
      className: schema.classes.name,
    })
    .from(schema.classes)
    .where(eq(schema.classes.screenId, session.user.id))
    .limit(1);
  return rows[0] ?? null;
}

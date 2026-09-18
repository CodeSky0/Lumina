"use server";

import { db, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export type AuditLogItem = {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: Date;
};

export async function getRecentAuditLogs(
  limit = 50,
): Promise<AuditLogItem[]> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "admin") return [];

  const rows = await db
    .select({
      id: schema.auditLogs.id,
      userId: schema.auditLogs.userId,
      userName: schema.users.name,
      action: schema.auditLogs.action,
      targetType: schema.auditLogs.targetType,
      targetId: schema.auditLogs.targetId,
      detail: schema.auditLogs.detail,
      createdAt: schema.auditLogs.createdAt,
    })
    .from(schema.auditLogs)
    .innerJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    detail: (r.detail as Record<string, unknown> | null) ?? null,
  }));
}

"use server";

import { db, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export async function writeAuditLog(input: {
  userId: string;
  action: string;
  targetType: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      userId: input.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      detail: input.detail,
    });
  } catch {
    /* audit log failure should never block business operations */
  }
}

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

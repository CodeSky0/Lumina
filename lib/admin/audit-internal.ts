import { db, schema } from "@/lib/db";

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

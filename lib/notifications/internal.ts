import { db, schema } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/internal";

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  conversationId?: string;
}): Promise<void> {
  try {
    await db.insert(schema.notifications).values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      conversationId: input.conversationId,
    });
  } catch {
    /* notifications 表可能尚未创建，不阻断主流程 */
  }

  try {
    await sendPushToUser(input.userId, {
      title: input.title,
      body: input.body,
      conversationId: input.conversationId,
    });
  } catch {
    /* push failure should not block notification creation */
  }
}

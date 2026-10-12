import { db, schema } from "@/lib/db";
import { sendPushToUser } from "@/lib/push/internal";
import { publishUserMessageEvent } from "@/lib/realtime/publish";
import { toUserNotificationEvent } from "@/lib/realtime/contract";

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  conversationId?: string;
}): Promise<void> {
  let notificationId: string | null = null;

  try {
    const [row] = await db
      .insert(schema.notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        conversationId: input.conversationId,
      })
      .returning({ id: schema.notifications.id });
    notificationId = row?.id ?? null;
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

  if (notificationId) {
    try {
      await publishUserMessageEvent({
        userIds: [input.userId],
        event: toUserNotificationEvent({
          notificationId,
          title: input.title,
          body: input.body ?? null,
          conversationId: input.conversationId ?? null,
        }),
      });
    } catch {
      /* user event 推送失败不阻断 */
    }
  }
}

import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import webpush from "web-push";

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body?: string; conversationId?: string },
): Promise<void> {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) return;

  webpush.setVapidDetails(
    "mailto:notify@lumina.app",
    vapidPublicKey,
    vapidPrivateKey,
  );

  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    conversationId: payload.conversationId,
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        notificationPayload,
      );
    } catch {
      await db
        .delete(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.endpoint, sub.endpoint));
    }
  }
}

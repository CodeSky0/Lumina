"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import webpush from "web-push";

export async function subscribeToPush(
  subscription: PushSubscriptionJSON,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };

  const parsed = z
    .object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
    })
    .safeParse(subscription);

  if (!parsed.success) return { ok: false, error: "订阅数据校验失败" };

  await db
    .insert(schema.pushSubscriptions)
    .values({
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    })
    .onConflictDoNothing({
      target: schema.pushSubscriptions.endpoint,
    });

  return { ok: true };
}

export async function unsubscribeFromPush(
  endpoint: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };

  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.userId, session.user.id),
        eq(schema.pushSubscriptions.endpoint, endpoint),
      ),
    );

  return { ok: true };
}

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

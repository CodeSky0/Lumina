"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { sendPushToUser } from "@/lib/push/actions";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  conversationId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export async function getMyNotifications(): Promise<NotificationItem[]> {
  const session = await getCurrentSession();
  if (!session) return [];

  const rows = await db
    .select({
      id: schema.notifications.id,
      type: schema.notifications.type,
      title: schema.notifications.title,
      body: schema.notifications.body,
      conversationId: schema.notifications.conversationId,
      readAt: schema.notifications.readAt,
      createdAt: schema.notifications.createdAt,
    })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, session.user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50);

  return rows;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const session = await getCurrentSession();
  if (!session) return 0;

  const rows = await db
    .select({ id: schema.notifications.id })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, session.user.id),
        isNull(schema.notifications.readAt),
      ),
    );

  return rows.length;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };

  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.id, notificationId),
        eq(schema.notifications.userId, session.user.id),
      ),
    );

  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };

  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, session.user.id),
        isNull(schema.notifications.readAt),
      ),
    );

  return { ok: true };
}

export async function createNotification(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  conversationId?: string;
}): Promise<void> {
  await db.insert(schema.notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    conversationId: input.conversationId,
  });

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

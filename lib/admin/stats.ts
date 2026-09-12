"use server";

import { db, schema } from "@/lib/db";
import { sql, gte, desc } from "drizzle-orm";
import { getCurrentSession } from "@/lib/auth/session";

export type DashboardStats = {
  userCounts: { role: string; count: number }[];
  totalClasses: number;
  totalMessages: number;
  totalConversations: number;
  totalAnnouncements: number;
  messagesByDay: { date: string; count: number }[];
  recentUsers: { id: string; name: string; role: string; createdAt: Date }[];
};

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "admin") return null;

  const userCounts = await db
    .select({
      role: schema.users.role,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.users)
    .groupBy(schema.users.role);

  const totalClassesRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.classes);
  const totalClasses = totalClassesRow[0]?.count ?? 0;

  const totalMessagesRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.messages);
  const totalMessages = totalMessagesRow[0]?.count ?? 0;

  const totalConversationsRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.conversations);
  const totalConversations = totalConversationsRow[0]?.count ?? 0;

  const totalAnnouncementsRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.announcements);
  const totalAnnouncements = totalAnnouncementsRow[0]?.count ?? 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const messagesByDayRows = await db
    .select({
      date: sql<string>`to_char(${schema.messages.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.messages)
    .where(gte(schema.messages.createdAt, sevenDaysAgo))
    .groupBy(sql`to_char(${schema.messages.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${schema.messages.createdAt}, 'YYYY-MM-DD')`);

  const recentUsers = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .limit(10);

  return {
    userCounts,
    totalClasses,
    totalMessages,
    totalConversations,
    totalAnnouncements,
    messagesByDay: messagesByDayRows,
    recentUsers,
  };
}

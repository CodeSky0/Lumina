"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  assertTeacherCanPostToClass,
  ForbiddenError,
} from "@/lib/rbac";
import { createNotification } from "@/lib/notifications/actions";

export type AnnouncementItem = {
  id: string;
  classId: string;
  title: string;
  content: string;
  createdBy: string;
  creatorName: string;
  createdAt: Date;
};

export async function getClassAnnouncements(
  classId: string,
): Promise<AnnouncementItem[]> {
  const session = await getCurrentSession();
  if (!session) return [];

  const rows = await db
    .select({
      id: schema.announcements.id,
      classId: schema.announcements.classId,
      title: schema.announcements.title,
      content: schema.announcements.content,
      createdBy: schema.announcements.createdBy,
      creatorName: schema.users.name,
      createdAt: schema.announcements.createdAt,
    })
    .from(schema.announcements)
    .innerJoin(schema.users, eq(schema.announcements.createdBy, schema.users.id))
    .where(eq(schema.announcements.classId, classId))
    .orderBy(desc(schema.announcements.createdAt))
    .limit(20);

  return rows;
}

const createSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(1000),
});

export async function createAnnouncement(
  formData: FormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };
  const user = session.user;

  if (user.role !== "teacher" && user.role !== "admin") {
    return { ok: false, error: "仅教师可发布公告" };
  }

  const parsed = createSchema.safeParse({
    classId: formData.get("classId"),
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { ok: false, error: "参数校验失败" };
  const { classId, title, content } = parsed.data;

  try {
    await assertTeacherCanPostToClass(user.id, classId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "权限校验失败" };
  }

  const [ann] = await db
    .insert(schema.announcements)
    .values({
      classId,
      title,
      content,
      createdBy: user.id,
    })
    .returning();
  if (!ann) return { ok: false, error: "公告创建失败" };

  const parents = await db
    .select({ userId: schema.parentStudents.parentId })
    .from(schema.parentStudents)
    .where(eq(schema.parentStudents.classId, classId));

  const teachers = await db
    .select({ userId: schema.teacherClasses.teacherId })
    .from(schema.teacherClasses)
    .where(eq(schema.teacherClasses.classId, classId));

  const classInfo = await db
    .select({ name: schema.classes.name })
    .from(schema.classes)
    .where(eq(schema.classes.id, classId))
    .limit(1);
  const className = classInfo[0]?.name ?? "班级";

  const notifyTitle = `【${className}公告】${title}`;
  for (const p of [...parents, ...teachers]) {
    if (p.userId === user.id) continue;
    try {
      await createNotification({
        userId: p.userId,
        type: "announcement",
        title: notifyTitle,
        body: content.slice(0, 100),
      });
    } catch {
      /* notification failure should not block */
    }
  }

  return { ok: true, id: ann.id };
}

export async function deleteAnnouncement(
  announcementId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };
  const user = session.user;

  const rows = await db
    .select()
    .from(schema.announcements)
    .where(eq(schema.announcements.id, announcementId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: "公告不存在" };
  const ann = rows[0]!;

  if (user.role !== "admin" && ann.createdBy !== user.id) {
    return { ok: false, error: "只能删除自己发布的公告" };
  }

  await db
    .delete(schema.announcements)
    .where(eq(schema.announcements.id, announcementId));

  return { ok: true };
}

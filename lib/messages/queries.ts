/**
 * 服务端数据查询 — 供 Server Component 直接调用。
 * 不使用 "use server" 指令，避免在 RSC 渲染中被编译为 Server Action 引用。
 */
import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { and, asc, desc, eq } from "drizzle-orm";

/** 查询大屏端绑定的班级 */
export async function getMyScreenClass(): Promise<{
  classId: string;
  className: string;
} | null> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "classroom") return null;
  const rows = await db
    .select({
      classId: schema.classes.id,
      className: schema.classes.name,
    })
    .from(schema.classes)
    .where(eq(schema.classes.screenId, session.user.id))
    .limit(1);
  return rows[0] ?? null;
}

/** 大屏端任课教师（含学科与班主任标识） */
export type ScreenTeacher = {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  subjectSortOrder: number;
  isHeadTeacher: boolean;
};

/** 查询某班级所有任课教师，按学科 sortOrder 升序、同学科内班主任优先 */
export async function getScreenTeachers(
  classId: string,
): Promise<ScreenTeacher[]> {
  const rows = await db
    .select({
      teacherId: schema.users.id,
      teacherName: schema.users.name,
      subjectId: schema.subjects.id,
      subjectName: schema.subjects.name,
      subjectSlug: schema.subjects.slug,
      subjectSortOrder: schema.subjects.sortOrder,
      isHeadTeacher: schema.teacherClasses.isHeadTeacher,
    })
    .from(schema.teacherClasses)
    .innerJoin(schema.users, eq(schema.teacherClasses.teacherId, schema.users.id))
    .innerJoin(schema.subjects, eq(schema.users.subjectId, schema.subjects.id))
    .where(eq(schema.teacherClasses.classId, classId))
    .orderBy(
      asc(schema.subjects.sortOrder),
      desc(schema.teacherClasses.isHeadTeacher),
      asc(schema.users.name),
    );
  return rows;
}

/** 查询大屏端绑定班级的群聊会话（不存在则创建），返回 classId/className/conversationId */
export async function getScreenConversation(): Promise<{
  classId: string;
  className: string;
  conversationId: string;
} | null> {
  const screenClass = await getMyScreenClass();
  if (!screenClass) return null;

  const conv = await db
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.type, "group"),
        eq(schema.conversations.classId, screenClass.classId),
      ),
    )
    .limit(1);

  let conversationId: string;
  if (conv.length > 0) {
    conversationId = conv[0]!.id;
  } else {
    const [created] = await db
      .insert(schema.conversations)
      .values({ type: "group", classId: screenClass.classId })
      .returning();
    conversationId = created!.id;
  }

  return {
    classId: screenClass.classId,
    className: screenClass.className,
    conversationId,
  };
}

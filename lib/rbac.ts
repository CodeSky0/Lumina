/**
 * 服务端强制权限校验 (RBAC)。
 * 规格要求：所有权限检查必须在服务端强制执行，前端仅做 UI 禁用。
 * 这些函数在 Server Action 中调用，违规抛出 ForbiddenError（映射为 403）。
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class AuthError extends Error {
  readonly code = "UNAUTHORIZED" as const;
  constructor(message = "未登录") {
    super(message);
    this.name = "AuthError";
  }
}

/** 校验家长是否有权向指定班级发消息：target_class_id ∈ parent_students[parent_id] */
export async function assertParentCanPostToClass(
  parentId: string,
  classId: string,
): Promise<void> {
  const rows = await db
    .select({ id: schema.parentStudents.id })
    .from(schema.parentStudents)
    .where(
      and(
        eq(schema.parentStudents.parentId, parentId),
        eq(schema.parentStudents.classId, classId),
      ),
    )
    .limit(1);
  if (rows.length === 0) {
    throw new ForbiddenError("家长无权向该班级发送消息");
  }
}

/** 校验教师是否有权向指定班级发消息：target_class_id ∈ teacher_classes[teacher_id] */
export async function assertTeacherCanPostToClass(
  teacherId: string,
  classId: string,
): Promise<void> {
  const rows = await db
    .select({ teacherId: schema.teacherClasses.teacherId })
    .from(schema.teacherClasses)
    .where(
      and(
        eq(schema.teacherClasses.teacherId, teacherId),
        eq(schema.teacherClasses.classId, classId),
      ),
    )
    .limit(1);
  if (rows.length === 0) {
    throw new ForbiddenError("教师无权向该班级发送消息");
  }
}

/** 获取大屏用户绑定的唯一班级 id（screen_id 反查） */
export async function getClassroomClassId(
  screenUserId: string,
): Promise<string | null> {
  const rows = await db
    .select({ classId: schema.classes.id })
    .from(schema.classes)
    .where(eq(schema.classes.screenId, screenUserId))
    .limit(1);
  return rows[0]?.classId ?? null;
}

/** 校验大屏用户确实绑定了班级，返回 classId，否则抛 Forbidden */
export async function requireClassroomClassId(
  screenUserId: string,
): Promise<string> {
  const classId = await getClassroomClassId(screenUserId);
  if (!classId) {
    throw new ForbiddenError("该大屏未绑定班级");
  }
  return classId;
}

/** 通用角色断言 */
export function requireRole(actual: UserRole, expected: UserRole): void {
  if (actual !== expected) {
    throw new ForbiddenError(`需要 ${expected} 角色，当前为 ${actual}`);
  }
}

/** 获取家长可访问的班级 id 列表（用于家长端展示） */
export async function getParentClassIds(parentId: string): Promise<string[]> {
  const rows = await db
    .select({ classId: schema.parentStudents.classId })
    .from(schema.parentStudents)
    .where(eq(schema.parentStudents.parentId, parentId));
  return rows.map((r) => r.classId);
}

/** 获取教师执教的班级 id 列表 */
export async function getTeacherClassIds(teacherId: string): Promise<string[]> {
  const rows = await db
    .select({ classId: schema.teacherClasses.classId })
    .from(schema.teacherClasses)
    .where(eq(schema.teacherClasses.teacherId, teacherId));
  return rows.map((r) => r.classId);
}

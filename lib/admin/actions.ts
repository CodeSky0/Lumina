"use server";

/**
 * Admin CRUD Server Actions — 创建用户/生成凭证、班级、绑定关系、列表查询。
 * 全部强制 requireUser("admin")，非管理员调用抛 403。
 */
import { auth } from "@/lib/auth/server";
import { requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";

/* ------------------------------ 工具 ------------------------------ */

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/* ------------------------------ 用户 ------------------------------ */

const createUserSchema = z.object({
  role: z.enum(["parent", "teacher", "classroom", "admin"]),
  name: z.string().min(1).max(50),
});

export type CreatedUser = {
  id: string;
  username: string;
  token: string;
  name: string;
  role: UserRole;
};

/** 创建用户并生成唯一 ID/Token（Token 仅此次返回明文） */
export async function createUser(
  input: z.infer<typeof createUserSchema>,
): Promise<CreatedUser> {
  await requireUser("admin");
  const { role, name } = createUserSchema.parse(input);

  const username = randomUUID();
  const token = generateToken();

  const res = await auth.api.signUpEmail({
    body: {
      email: `${username}@lumina.local`,
      name,
      password: token,
      username,
    },
    headers: await headers(),
  });
  if (!res?.user) throw new Error("创建用户失败");
  const userId = res.user.id;

  await db
    .update(schema.users)
    .set({ role, tokenHash: sha256(token) })
    .where(eq(schema.users.id, userId));

  return { id: userId, username, token, name, role };
}

export type UserListItem = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  createdAt: Date;
};

export async function listUsers(): Promise<UserListItem[]> {
  await requireUser("admin");
  const rows = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(schema.users.createdAt);
  return rows;
}

export async function deleteUser(userId: string): Promise<void> {
  const currentUser = await requireUser("admin");
  if (currentUser.id === userId) {
    throw new Error("不能删除自己的账户");
  }
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

/* ------------------------------ 班级 ------------------------------ */

const createClassSchema = z.object({ name: z.string().min(1).max(50) });

export async function createClass(
  input: z.infer<typeof createClassSchema>,
): Promise<{ id: string; name: string }> {
  await requireUser("admin");
  const { name } = createClassSchema.parse(input);
  const [row] = await db
    .insert(schema.classes)
    .values({ name })
    .returning({ id: schema.classes.id, name: schema.classes.name });
  if (!row) throw new Error("创建班级失败");
  return row;
}

export type ClassListItem = {
  id: string;
  name: string;
  screenId: string | null;
  screenName: string | null;
  teacherCount: number;
  studentCount: number;
};

export async function listClasses(): Promise<ClassListItem[]> {
  await requireUser("admin");
  const rows = await db
    .select({
      id: schema.classes.id,
      name: schema.classes.name,
      screenId: schema.classes.screenId,
      screenName: schema.users.name,
    })
    .from(schema.classes)
    .leftJoin(schema.users, eq(schema.classes.screenId, schema.users.id))
    .orderBy(schema.classes.name);

  const teacherCounts = await Promise.all(
    rows.map((r) =>
      db
        .select({ id: schema.teacherClasses.teacherId })
        .from(schema.teacherClasses)
        .where(eq(schema.teacherClasses.classId, r.id))
        .then((rows) => rows.length),
    ),
  );
  const studentCounts = await Promise.all(
    rows.map((r) =>
      db
        .select({ id: schema.parentStudents.id })
        .from(schema.parentStudents)
        .where(eq(schema.parentStudents.classId, r.id))
        .then((rows) => rows.length),
    ),
  );

  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    screenId: r.screenId,
    screenName: r.screenName,
    teacherCount: teacherCounts[i] ?? 0,
    studentCount: studentCounts[i] ?? 0,
  }));
}

export async function deleteClass(classId: string): Promise<void> {
  await requireUser("admin");
  await db.delete(schema.classes).where(eq(schema.classes.id, classId));
}

/* ------------------------------ 绑定：教师↔班级 ------------------------------ */

const bindTeacherSchema = z.object({
  teacherId: z.string().min(1),
  classId: z.string().min(1),
});

export async function bindTeacherClass(
  input: z.infer<typeof bindTeacherSchema>,
): Promise<void> {
  await requireUser("admin");
  const { teacherId, classId } = bindTeacherSchema.parse(input);
  await db
    .insert(schema.teacherClasses)
    .values({ teacherId, classId })
    .onConflictDoNothing();
}

export async function unbindTeacherClass(
  input: z.infer<typeof bindTeacherSchema>,
): Promise<void> {
  await requireUser("admin");
  const { teacherId, classId } = bindTeacherSchema.parse(input);
  await db
    .delete(schema.teacherClasses)
    .where(
      and(
        eq(schema.teacherClasses.teacherId, teacherId),
        eq(schema.teacherClasses.classId, classId),
      ),
    );
}

export type TeacherClassBinding = {
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
};

export async function listTeacherClassBindings(): Promise<
  TeacherClassBinding[]
> {
  await requireUser("admin");
  const rows = await db
    .select({
      teacherId: schema.teacherClasses.teacherId,
      teacherName: schema.users.name,
      classId: schema.teacherClasses.classId,
      className: schema.classes.name,
    })
    .from(schema.teacherClasses)
    .innerJoin(schema.users, eq(schema.teacherClasses.teacherId, schema.users.id))
    .innerJoin(
      schema.classes,
      eq(schema.teacherClasses.classId, schema.classes.id),
    );
  return rows;
}

/* ------------------------------ 绑定：家长↔班级(学生) ------------------------------ */

const bindParentSchema = z.object({
  parentId: z.string().min(1),
  classId: z.string().min(1),
  studentName: z.string().min(1).max(50),
});

export async function bindParentStudent(
  input: z.infer<typeof bindParentSchema>,
): Promise<void> {
  await requireUser("admin");
  const { parentId, classId, studentName } = bindParentSchema.parse(input);
  await db
    .insert(schema.parentStudents)
    .values({ parentId, classId, studentName })
    .onConflictDoNothing();
}

export async function unbindParentStudent(id: string): Promise<void> {
  await requireUser("admin");
  await db.delete(schema.parentStudents).where(eq(schema.parentStudents.id, id));
}

export type ParentStudentBinding = {
  id: string;
  parentId: string;
  parentName: string;
  classId: string;
  className: string;
  studentName: string;
};

export async function listParentStudentBindings(): Promise<
  ParentStudentBinding[]
> {
  await requireUser("admin");
  const rows = await db
    .select({
      id: schema.parentStudents.id,
      parentId: schema.parentStudents.parentId,
      parentName: schema.users.name,
      classId: schema.parentStudents.classId,
      className: schema.classes.name,
      studentName: schema.parentStudents.studentName,
    })
    .from(schema.parentStudents)
    .innerJoin(schema.users, eq(schema.parentStudents.parentId, schema.users.id))
    .innerJoin(
      schema.classes,
      eq(schema.parentStudents.classId, schema.classes.id),
    );
  return rows;
}

/* ------------------------------ 绑定：大屏↔班级 ------------------------------ */

const bindScreenSchema = z.object({
  screenUserId: z.string().min(1),
  classId: z.string().min(1),
});

/** 将大屏用户绑定到唯一班级（classes.screenId） */
export async function bindScreenClass(
  input: z.infer<typeof bindScreenSchema>,
): Promise<void> {
  await requireUser("admin");
  const { screenUserId, classId } = bindScreenSchema.parse(input);

  const [screenUser] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, screenUserId))
    .limit(1);
  if (!screenUser || screenUser.role !== "classroom") {
    throw new Error("只能绑定大屏角色的用户");
  }

  await db
    .update(schema.classes)
    .set({ screenId: null })
    .where(eq(schema.classes.screenId, screenUserId));

  await db
    .update(schema.classes)
    .set({ screenId: screenUserId })
    .where(eq(schema.classes.id, classId));
}

export async function unbindScreenClass(classId: string): Promise<void> {
  await requireUser("admin");
  await db
    .update(schema.classes)
    .set({ screenId: null })
    .where(eq(schema.classes.id, classId));
}

/* ------------------------------ 引导：首个管理员 ------------------------------ */

/** DB 中是否已存在管理员 */
export async function hasAdmin(): Promise<boolean> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"))
    .limit(1);
  return rows.length > 0;
}

const createFirstAdminSchema = z.object({
  name: z.string().min(1).max(50),
  token: z.string().min(8).max(100),
});

export type CreateFirstAdminResult =
  | { ok: true; username: string }
  | { ok: false; error: string };

/** 创建首个管理员（仅当 DB 无 admin 时可用），返回生成的登录 ID */
export async function createFirstAdmin(
  input: z.infer<typeof createFirstAdminSchema>,
): Promise<CreateFirstAdminResult> {
  if (await hasAdmin()) return { ok: false, error: "管理员已存在" };
  const { name, token } = createFirstAdminSchema.parse(input);
  const username = randomUUID();
  const res = await auth.api.signUpEmail({
    body: {
      email: `${username}@lumina.local`,
      name,
      password: token,
      username,
    },
    headers: await headers(),
  });
  if (!res?.user) return { ok: false, error: "创建失败" };

  if (await hasAdmin()) {
    await db.delete(schema.users).where(eq(schema.users.id, res.user.id));
    return { ok: false, error: "管理员已存在" };
  }

  await db
    .update(schema.users)
    .set({ role: "admin", tokenHash: sha256(token) })
    .where(eq(schema.users.id, res.user.id));
  return { ok: true, username };
}

"use server";

/**
 * Admin CRUD Server Actions — 创建用户/生成凭证、班级、绑定关系、列表查询。
 * 全部强制 requireUser("admin")，非管理员调用抛 403。
 */
import { hashPassword } from "@better-auth/utils/password";
import { auth } from "@/lib/auth/server";
import { requireUser } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { UserRole } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { writeAuditLog } from "@/lib/admin/audit";

/* ------------------------------ 工具 ------------------------------ */

const ROLE_PREFIX: Record<UserRole, string> = {
  parent: "P",
  teacher: "T",
  classroom: "C",
  admin: "A",
};

const SHORT_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateShortCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += SHORT_CODE_CHARS[bytes[i]! % SHORT_CODE_CHARS.length]!;
  }
  return code;
}

async function generateUniqueUsername(role: UserRole): Promise<string> {
  const prefix = ROLE_PREFIX[role];
  for (let attempt = 0; attempt < 10; attempt++) {
    const username = `${prefix}-${generateShortCode()}`;
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);
    if (existing.length === 0) return username;
  }
  throw new Error("生成唯一 ID 失败，请重试");
}

function generateToken(): string {
  return randomBytes(12).toString("base64url");
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
  const admin = await requireUser("admin");
  const { role, name } = createUserSchema.parse(input);

  const username = await generateUniqueUsername(role);
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

  await writeAuditLog({ userId: admin.id, action: "create", targetType: "user", targetId: userId, detail: { role, name, username } });

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
  await writeAuditLog({ userId: currentUser.id, action: "delete", targetType: "user", targetId: userId });
}

export type ResetTokenResult = {
  id: string;
  username: string;
  token: string;
  name: string;
  role: UserRole;
};

/** 重置用户 Token：生成新 Token，更新密码哈希与 tokenHash，返回明文（仅此次返回） */
export async function resetUserToken(userId: string): Promise<ResetTokenResult> {
  const admin = await requireUser("admin");

  const [user] = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) throw new Error("用户不存在");

  const newToken = generateToken();
  const hashedPassword = await hashPassword(newToken);

  await db
    .update(schema.accounts)
    .set({ password: hashedPassword })
    .where(eq(schema.accounts.userId, userId));

  await db
    .update(schema.users)
    .set({ tokenHash: sha256(newToken) })
    .where(eq(schema.users.id, userId));

  await writeAuditLog({ userId: admin.id, action: "reset_token", targetType: "user", targetId: userId });

  return {
    id: user.id,
    username: user.username,
    token: newToken,
    name: user.name,
    role: user.role,
  };
}

/* ------------------------------ 批量导入 ------------------------------ */

export type BatchResultItem = {
  name: string;
  role: UserRole;
  username: string;
  token: string;
  className?: string;
  studentName?: string;
  error?: string;
};

const batchTeacherSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        className: z.string().optional(),
      }),
    )
    .min(1)
    .max(500),
});

/** 批量创建教师，可选绑定班级 */
export async function batchCreateTeachers(
  input: z.infer<typeof batchTeacherSchema>,
): Promise<BatchResultItem[]> {
  await requireUser("admin");
  const { items } = batchTeacherSchema.parse(input);

  const allClasses = await db
    .select({ id: schema.classes.id, name: schema.classes.name })
    .from(schema.classes);
  const classMap = new Map(allClasses.map((c) => [c.name, c.id]));

  const results: BatchResultItem[] = [];
  for (const item of items) {
    try {
      const username = await generateUniqueUsername("teacher");
      const token = generateToken();
      const res = await auth.api.signUpEmail({
        body: {
          email: `${username}@lumina.local`,
          name: item.name,
          password: token,
          username,
        },
        headers: await headers(),
      });
      if (!res?.user) throw new Error("创建失败");
      const userId = res.user.id;

      await db
        .update(schema.users)
        .set({ role: "teacher", tokenHash: sha256(token) })
        .where(eq(schema.users.id, userId));

      if (item.className) {
        const classId = classMap.get(item.className);
        if (classId) {
          await db
            .insert(schema.teacherClasses)
            .values({ teacherId: userId, classId })
            .onConflictDoNothing();
        }
      }

      results.push({
        name: item.name,
        role: "teacher",
        username,
        token,
        className: item.className,
      });
    } catch (e) {
      results.push({
        name: item.name,
        role: "teacher",
        username: "",
        token: "",
        className: item.className,
        error: e instanceof Error ? e.message : "创建失败",
      });
    }
  }
  return results;
}

const batchStudentSchema = z.object({
  items: z
    .array(
      z.object({
        studentName: z.string().min(1).max(50),
        parentName: z.string().min(1).max(50),
        className: z.string().min(1),
      }),
    )
    .min(1)
    .max(500),
});

/** 批量创建学生/家长：同一家长姓名只创建一个用户，多个孩子绑定到同一账号 */
export async function batchCreateStudents(
  input: z.infer<typeof batchStudentSchema>,
): Promise<BatchResultItem[]> {
  await requireUser("admin");
  const { items } = batchStudentSchema.parse(input);

  const allClasses = await db
    .select({ id: schema.classes.id, name: schema.classes.name })
    .from(schema.classes);
  const classMap = new Map(allClasses.map((c) => [c.name, c.id]));

  const parentCache = new Map<string, { id: string; username: string; token: string }>();
  const results: BatchResultItem[] = [];

  for (const item of items) {
    try {
      const classId = classMap.get(item.className);
      if (!classId) {
        results.push({
          name: item.parentName,
          role: "parent",
          username: "",
          token: "",
          className: item.className,
          studentName: item.studentName,
          error: `班级"${item.className}"不存在`,
        });
        continue;
      }

      let parent = parentCache.get(item.parentName);
      if (!parent) {
        const username = await generateUniqueUsername("parent");
        const token = generateToken();
        const res = await auth.api.signUpEmail({
          body: {
            email: `${username}@lumina.local`,
            name: item.parentName,
            password: token,
            username,
          },
          headers: await headers(),
        });
        if (!res?.user) throw new Error("创建家长失败");
        const userId = res.user.id;

        await db
          .update(schema.users)
          .set({ role: "parent", tokenHash: sha256(token) })
          .where(eq(schema.users.id, userId));

        parent = { id: userId, username, token };
        parentCache.set(item.parentName, parent);
      }

      await db
        .insert(schema.parentStudents)
        .values({
          parentId: parent.id,
          classId,
          studentName: item.studentName,
        })
        .onConflictDoNothing();

      results.push({
        name: item.parentName,
        role: "parent",
        username: parent.username,
        token: parent.token,
        className: item.className,
        studentName: item.studentName,
      });
    } catch (e) {
      results.push({
        name: item.parentName,
        role: "parent",
        username: "",
        token: "",
        className: item.className,
        studentName: item.studentName,
        error: e instanceof Error ? e.message : "创建失败",
      });
    }
  }
  return results;
}

/* ------------------------------ 班级 ------------------------------ */

const createClassSchema = z.object({ name: z.string().min(1).max(50) });

export async function createClass(
  input: z.infer<typeof createClassSchema>,
): Promise<{ id: string; name: string }> {
  const admin = await requireUser("admin");
  const { name } = createClassSchema.parse(input);
  const [row] = await db
    .insert(schema.classes)
    .values({ name })
    .returning({ id: schema.classes.id, name: schema.classes.name });
  if (!row) throw new Error("创建班级失败");
  await writeAuditLog({ userId: admin.id, action: "create", targetType: "class", targetId: row.id, detail: { name } });
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
  const admin = await requireUser("admin");
  await db.delete(schema.classes).where(eq(schema.classes.id, classId));
  await writeAuditLog({ userId: admin.id, action: "delete", targetType: "class", targetId: classId });
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
  const username = await generateUniqueUsername("admin");
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

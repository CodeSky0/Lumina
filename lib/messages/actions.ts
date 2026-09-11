"use server";

/**
 * 消息发送与查询 Server Actions。
 * 发送：强制 RBAC（家长/教师仅能向已绑定班级发）+ 图片经 uploadImage + 写库 + 推送 CF Worker。
 */
import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { MessageType, MessageStatus, UserRole } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { uploadImage } from "@/lib/images/upload";
import {
  assertParentCanPostToClass,
  assertTeacherCanPostToClass,
  ForbiddenError,
} from "@/lib/rbac";
import { toPublishPayload } from "@/lib/realtime/contract";
import { publishMessage } from "@/lib/realtime/publish";
import { z } from "zod";

/* ------------------------------ 发送 ------------------------------ */

const sendSchema = z.object({
  classId: z.string().uuid(),
  text: z.string().max(1000).optional(),
  file: z.instanceof(File).optional(),
  urgent: z.boolean().optional(),
});

export type SendResult =
  | { ok: true; id: string; status: MessageStatus }
  | { ok: false; error: string };

/** 发送消息（文本/图片/紧急）。家长/教师通用，按 role 校验权限。 */
export async function sendMessage(
  formData: FormData,
): Promise<SendResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };
  const user = session.user;

  const parsed = sendSchema.safeParse({
    classId: formData.get("classId"),
    text: formData.get("text") || undefined,
    file: formData.get("file") || undefined,
    urgent: formData.get("urgent") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: "参数校验失败" };
  }
  const { classId, text, file, urgent } = parsed.data;

  try {
    if (user.role === "parent") {
      await assertParentCanPostToClass(user.id, classId);
    } else if (user.role === "teacher") {
      await assertTeacherCanPostToClass(user.id, classId);
    } else {
      return { ok: false, error: "仅家长/教师可发送消息" };
    }
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: "无权向该班级发送消息" };
    }
    return { ok: false, error: "权限校验失败，请重试" };
  }

  let content: string;
  let type: MessageType;
  let mimeType: string | null = null;

  if (file && file.size > 0) {
    const upload = await uploadImage(file);
    if (!upload.ok) return upload;
    content = upload.url;
    type = urgent ? "urgent" : "image";
    mimeType = upload.mimeType;
  } else if (urgent) {
    content = (text ?? "").trim();
    if (!content) return { ok: false, error: "紧急消息不能为空" };
    type = "urgent";
  } else {
    content = (text ?? "").trim();
    if (!content) return { ok: false, error: "消息不能为空" };
    type = "text";
  }

  const [msg] = await db
    .insert(schema.messages)
    .values({
      senderId: user.id,
      targetClassId: classId,
      content,
      type,
      mimeType,
      status: "pending",
    })
    .returning();
  if (!msg) return { ok: false, error: "消息写入失败" };

  // 推送至 CF Worker Durable Object 广播给大屏
  await publishMessage(
    toPublishPayload({
      classId,
      messageId: msg.id,
      senderName: user.name,
      type,
      content,
      mimeType,
      createdAt: msg.createdAt,
    }),
  );

  return { ok: true, id: msg.id, status: "pending" };
}

/* ------------------------------ 查询：我的班级 ------------------------------ */

export type MyClass = {
  classId: string;
  className: string;
  studentName?: string;
};

/** 当前用户可访问的班级（家长=孩子所在班，教师=执教班） */
export async function getMyClasses(): Promise<MyClass[]> {
  const session = await getCurrentSession();
  if (!session) return [];
  const user = session.user;

  if (user.role === "parent") {
    const rows = await db
      .select({
        classId: schema.parentStudents.classId,
        className: schema.classes.name,
        studentName: schema.parentStudents.studentName,
      })
      .from(schema.parentStudents)
      .innerJoin(
        schema.classes,
        eq(schema.parentStudents.classId, schema.classes.id),
      )
      .where(eq(schema.parentStudents.parentId, user.id));
    return rows;
  }
  if (user.role === "teacher") {
    const rows = await db
      .select({
        classId: schema.teacherClasses.classId,
        className: schema.classes.name,
      })
      .from(schema.teacherClasses)
      .innerJoin(
        schema.classes,
        eq(schema.teacherClasses.classId, schema.classes.id),
      )
      .where(eq(schema.teacherClasses.teacherId, user.id));
    return rows;
  }
  return [];
}

/* ------------------------------ 查询：班级消息 ------------------------------ */

export type ClassMessage = {
  id: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  type: MessageType;
  mimeType: string | null;
  status: MessageStatus;
  createdAt: Date;
};

/** 获取某班级消息列表（需有权访问该班级）。limit 默认 100。 */
export async function getClassMessages(
  classId: string,
): Promise<ClassMessage[]> {
  const session = await getCurrentSession();
  if (!session) return [];
  const user = session.user;

  if (user.role === "parent") {
    await assertParentCanPostToClass(user.id, classId);
  } else if (user.role === "teacher") {
    await assertTeacherCanPostToClass(user.id, classId);
  } else {
    return [];
  }

  const rows = await db
    .select({
      id: schema.messages.id,
      senderName: schema.users.name,
      senderRole: schema.users.role,
      content: schema.messages.content,
      type: schema.messages.type,
      mimeType: schema.messages.mimeType,
      status: schema.messages.status,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.senderId, schema.users.id))
    .where(eq(schema.messages.targetClassId, classId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(100);
  return rows;
}

/* ------------------------------ 查询：大屏班级 ------------------------------ */

/** 大屏获取自己绑定的班级 id（用于 WS 房间订阅） */
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

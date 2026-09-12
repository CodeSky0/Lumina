"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { MessageType, MessageStatus, UserRole, ConversationType } from "@/lib/db/schema";
import { and, desc, eq, or, inArray, gt, ne, sql } from "drizzle-orm";
import { uploadImage } from "@/lib/images/upload";
import {
  assertParentCanPostToClass,
  assertTeacherCanPostToClass,
  getClassroomClassId,
  ForbiddenError,
} from "@/lib/rbac";
import { toPublishPayload, toDirectPublishPayload } from "@/lib/realtime/contract";
import { publishMessage } from "@/lib/realtime/publish";
import { z } from "zod";

/* ------------------------------ 会话列表 ------------------------------ */

export type ConversationItem = {
  conversationId: string;
  type: ConversationType;
  title: string;
  subtitle: string;
  classId: string | null;
  participantAId: string | null;
  participantBId: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
};

export async function getMyConversations(): Promise<ConversationItem[]> {
  const session = await getCurrentSession();
  if (!session) return [];
  const user = session.user;

  const items: ConversationItem[] = [];

  if (user.role === "parent") {
    const classRows = await db
      .select({
        classId: schema.parentStudents.classId,
        className: schema.classes.name,
        studentName: schema.parentStudents.studentName,
      })
      .from(schema.parentStudents)
      .innerJoin(schema.classes, eq(schema.parentStudents.classId, schema.classes.id))
      .where(eq(schema.parentStudents.parentId, user.id));

    for (const c of classRows) {
      const conv = await db
        .select()
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.type, "group"),
            eq(schema.conversations.classId, c.classId),
          ),
        )
        .limit(1);

      let conversationId: string;
      if (conv.length > 0) {
        conversationId = conv[0]!.id;
      } else {
        const [created] = await db
          .insert(schema.conversations)
          .values({ type: "group", classId: c.classId })
          .returning();
        conversationId = created!.id;
      }

      const lastMsg = await db
        .select({
          content: schema.messages.content,
          type: schema.messages.type,
          createdAt: schema.messages.createdAt,
        })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(1);

      items.push({
        conversationId,
        type: "group",
        title: c.className,
        subtitle: c.studentName ? `学生：${c.studentName}` : "",
        classId: c.classId,
        participantAId: null,
        participantBId: null,
        lastMessagePreview: lastMsg[0]
          ? lastMsg[0].type === "image"
            ? "[图片]"
            : lastMsg[0].type === "urgent"
              ? "[紧急] " + lastMsg[0].content
              : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
      });
    }

    const teacherRows = await db
      .select({
        teacherId: schema.teacherClasses.teacherId,
        teacherName: schema.users.name,
        classId: schema.teacherClasses.classId,
        className: schema.classes.name,
      })
      .from(schema.teacherClasses)
      .innerJoin(schema.users, eq(schema.teacherClasses.teacherId, schema.users.id))
      .innerJoin(schema.classes, eq(schema.teacherClasses.classId, schema.classes.id))
      .where(
        inArray(
          schema.teacherClasses.classId,
          classRows.map((c) => c.classId),
        ),
      );

    for (const t of teacherRows) {
      const existing = await db
        .select()
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.type, "direct"),
            or(
              and(
                eq(schema.conversations.participantAId, user.id),
                eq(schema.conversations.participantBId, t.teacherId),
              ),
              and(
                eq(schema.conversations.participantAId, t.teacherId),
                eq(schema.conversations.participantBId, user.id),
              ),
            ),
          ),
        )
        .limit(1);

      let conversationId: string;
      if (existing.length > 0) {
        conversationId = existing[0]!.id;
      } else {
        const [created] = await db
          .insert(schema.conversations)
          .values({
            type: "direct",
            participantAId: t.teacherId,
            participantBId: user.id,
          })
          .returning();
        conversationId = created!.id;
      }

      const lastMsg = await db
        .select({
          content: schema.messages.content,
          type: schema.messages.type,
          createdAt: schema.messages.createdAt,
        })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(1);

      items.push({
        conversationId,
        type: "direct",
        title: t.teacherName,
        subtitle: `${t.className} 教师`,
        classId: null,
        participantAId: t.teacherId,
        participantBId: user.id,
        lastMessagePreview: lastMsg[0]
          ? lastMsg[0].type === "image"
            ? "[图片]"
            : lastMsg[0].type === "urgent"
              ? "[紧急] " + lastMsg[0].content
              : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
      });
    }
  } else if (user.role === "teacher") {
    const classRows = await db
      .select({
        classId: schema.teacherClasses.classId,
        className: schema.classes.name,
      })
      .from(schema.teacherClasses)
      .innerJoin(schema.classes, eq(schema.teacherClasses.classId, schema.classes.id))
      .where(eq(schema.teacherClasses.teacherId, user.id));

    for (const c of classRows) {
      const conv = await db
        .select()
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.type, "group"),
            eq(schema.conversations.classId, c.classId),
          ),
        )
        .limit(1);

      let conversationId: string;
      if (conv.length > 0) {
        conversationId = conv[0]!.id;
      } else {
        const [created] = await db
          .insert(schema.conversations)
          .values({ type: "group", classId: c.classId })
          .returning();
        conversationId = created!.id;
      }

      const lastMsg = await db
        .select({
          content: schema.messages.content,
          type: schema.messages.type,
          createdAt: schema.messages.createdAt,
        })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(1);

      items.push({
        conversationId,
        type: "group",
        title: c.className,
        subtitle: "班级群",
        classId: c.classId,
        participantAId: null,
        participantBId: null,
        lastMessagePreview: lastMsg[0]
          ? lastMsg[0].type === "image"
            ? "[图片]"
            : lastMsg[0].type === "urgent"
              ? "[紧急] " + lastMsg[0].content
              : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
      });
    }

    const parentRows = await db
      .select({
        parentId: schema.parentStudents.parentId,
        parentName: schema.users.name,
        classId: schema.parentStudents.classId,
        className: schema.classes.name,
        studentName: schema.parentStudents.studentName,
      })
      .from(schema.parentStudents)
      .innerJoin(schema.users, eq(schema.parentStudents.parentId, schema.users.id))
      .innerJoin(schema.classes, eq(schema.parentStudents.classId, schema.classes.id))
      .where(
        inArray(
          schema.parentStudents.classId,
          classRows.map((c) => c.classId),
        ),
      );

    const seenParents = new Set<string>();
    for (const p of parentRows) {
      const key = `${p.parentId}`;
      if (seenParents.has(key)) continue;
      seenParents.add(key);

      const existing = await db
        .select()
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.type, "direct"),
            or(
              and(
                eq(schema.conversations.participantAId, user.id),
                eq(schema.conversations.participantBId, p.parentId),
              ),
              and(
                eq(schema.conversations.participantAId, p.parentId),
                eq(schema.conversations.participantBId, user.id),
              ),
            ),
          ),
        )
        .limit(1);

      let conversationId: string;
      if (existing.length > 0) {
        conversationId = existing[0]!.id;
      } else {
        const [created] = await db
          .insert(schema.conversations)
          .values({
            type: "direct",
            participantAId: user.id,
            participantBId: p.parentId,
          })
          .returning();
        conversationId = created!.id;
      }

      const lastMsg = await db
        .select({
          content: schema.messages.content,
          type: schema.messages.type,
          createdAt: schema.messages.createdAt,
        })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(1);

      const studentNames = parentRows
        .filter((r) => r.parentId === p.parentId)
        .map((r) => r.studentName)
        .join("、");

      items.push({
        conversationId,
        type: "direct",
        title: p.parentName,
        subtitle: `学生：${studentNames}`,
        classId: null,
        participantAId: user.id,
        participantBId: p.parentId,
        lastMessagePreview: lastMsg[0]
          ? lastMsg[0].type === "image"
            ? "[图片]"
            : lastMsg[0].type === "urgent"
              ? "[紧急] " + lastMsg[0].content
              : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
      });
    }
  } else if (user.role === "classroom") {
    const classId = await getClassroomClassId(user.id);
    if (classId) {
      const classInfo = await db
        .select({ name: schema.classes.name })
        .from(schema.classes)
        .where(eq(schema.classes.id, classId))
        .limit(1);

      const conv = await db
        .select()
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.type, "group"),
            eq(schema.conversations.classId, classId),
          ),
        )
        .limit(1);

      let conversationId: string;
      if (conv.length > 0) {
        conversationId = conv[0]!.id;
      } else {
        const [created] = await db
          .insert(schema.conversations)
          .values({ type: "group", classId })
          .returning();
        conversationId = created!.id;
      }

      const lastMsg = await db
        .select({
          content: schema.messages.content,
          type: schema.messages.type,
          createdAt: schema.messages.createdAt,
        })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(1);

      items.push({
        conversationId,
        type: "group",
        title: classInfo[0]?.name ?? "班级群",
        subtitle: "教室大屏",
        classId,
        participantAId: null,
        participantBId: null,
        lastMessagePreview: lastMsg[0]
          ? lastMsg[0].type === "image"
            ? "[图片]"
            : lastMsg[0].type === "urgent"
              ? "[紧急] " + lastMsg[0].content
              : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
      });
    }
  }

  if (items.length > 0) {
    const conversationIds = items.map((i) => i.conversationId);

    const reads = await db
      .select({
        conversationId: schema.messageReads.conversationId,
        lastReadAt: schema.messageReads.lastReadAt,
      })
      .from(schema.messageReads)
      .where(
        and(
          eq(schema.messageReads.userId, user.id),
          inArray(schema.messageReads.conversationId, conversationIds),
        ),
      );

    const readMap = new Map(reads.map((r) => [r.conversationId, r.lastReadAt]));

    for (const item of items) {
      const lastReadAt = readMap.get(item.conversationId);
      const conditions = [
        eq(schema.messages.conversationId, item.conversationId),
        ne(schema.messages.senderId, user.id),
      ];
      if (lastReadAt) {
        conditions.push(gt(schema.messages.createdAt, lastReadAt));
      }
      const count = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.messages)
        .where(and(...conditions));
      item.unreadCount = count[0]?.count ?? 0;
    }
  }

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "group" ? -1 : 1;
    const aTime = a.lastMessageAt?.getTime() ?? 0;
    const bTime = b.lastMessageAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return items;
}

/* ------------------------------ 发送消息 ------------------------------ */

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().max(1000).optional(),
  file: z.instanceof(File).optional(),
  urgent: z.boolean().optional(),
});

export type SendResult =
  | { ok: true; id: string; status: MessageStatus }
  | { ok: false; error: string };

export async function sendMessage(
  formData: FormData,
): Promise<SendResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };
  const user = session.user;

  const parsed = sendSchema.safeParse({
    conversationId: formData.get("conversationId"),
    text: formData.get("text") || undefined,
    file: formData.get("file") || undefined,
    urgent: formData.get("urgent") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: "参数校验失败" };
  }
  const { conversationId, text, file, urgent } = parsed.data;

  const conv = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .limit(1);
  if (conv.length === 0) {
    return { ok: false, error: "会话不存在" };
  }
  const conversation = conv[0]!;

  try {
    await assertCanAccessConversation(user.id, user.role, conversation);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "权限校验失败" };
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
      conversationId,
      content,
      type,
      mimeType,
      status: "delivered",
    })
    .returning();
  if (!msg) return { ok: false, error: "消息写入失败" };

  if (conversation.type === "group" && conversation.classId) {
    await publishMessage(
      toPublishPayload({
        classId: conversation.classId,
        messageId: msg.id,
        senderName: user.name,
        senderId: user.id,
        senderRole: user.role,
        type,
        content,
        mimeType,
        createdAt: msg.createdAt,
      }),
    );
  } else if (
    conversation.type === "direct" &&
    conversation.participantAId &&
    conversation.participantBId
  ) {
    await publishMessage(
      toDirectPublishPayload({
        userAId: conversation.participantAId,
        userBId: conversation.participantBId,
        messageId: msg.id,
        senderName: user.name,
        senderId: user.id,
        senderRole: user.role,
        type,
        content,
        mimeType,
        createdAt: msg.createdAt,
      }),
    );
  }

  return { ok: true, id: msg.id, status: "delivered" };
}

/* ------------------------------ 查询消息 ------------------------------ */

export type ClassMessage = {
  id: string;
  senderName: string;
  senderRole: UserRole;
  senderId: string;
  content: string;
  type: MessageType;
  mimeType: string | null;
  status: MessageStatus;
  createdAt: Date;
};

export async function getConversationMessages(
  conversationId: string,
): Promise<ClassMessage[]> {
  const session = await getCurrentSession();
  if (!session) return [];
  const user = session.user;

  const conv = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .limit(1);
  if (conv.length === 0) return [];
  const conversation = conv[0]!;

  try {
    await assertCanAccessConversation(user.id, user.role, conversation);
  } catch {
    return [];
  }

  await db
    .update(schema.messages)
    .set({ status: "displayed" })
    .where(
      and(
        eq(schema.messages.conversationId, conversationId),
        ne(schema.messages.senderId, user.id),
        eq(schema.messages.status, "delivered"),
      ),
    );

  const rows = await db
    .select({
      id: schema.messages.id,
      senderName: schema.users.name,
      senderRole: schema.users.role,
      senderId: schema.users.id,
      content: schema.messages.content,
      type: schema.messages.type,
      mimeType: schema.messages.mimeType,
      status: schema.messages.status,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.senderId, schema.users.id))
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(100);
  return rows;
}

/* ------------------------------ 已读标记 ------------------------------ */

export async function markConversationRead(
  conversationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };
  const user = session.user;

  const conv = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, conversationId))
    .limit(1);
  if (conv.length === 0) return { ok: false, error: "会话不存在" };

  try {
    await assertCanAccessConversation(user.id, user.role, conv[0]!);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "权限校验失败" };
  }

  await db
    .insert(schema.messageReads)
    .values({
      userId: user.id,
      conversationId,
      lastReadAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.messageReads.userId, schema.messageReads.conversationId],
      set: {
        lastReadAt: new Date(),
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}

/* ------------------------------ 权限校验 ------------------------------ */

async function assertCanAccessConversation(
  userId: string,
  role: UserRole,
  conversation: { type: ConversationType; classId: string | null; participantAId: string | null; participantBId: string | null },
): Promise<void> {
  if (conversation.type === "group" && conversation.classId) {
    if (role === "parent") {
      await assertParentCanPostToClass(userId, conversation.classId);
    } else if (role === "teacher") {
      await assertTeacherCanPostToClass(userId, conversation.classId);
    } else if (role === "classroom") {
      const boundClassId = await getClassroomClassId(userId);
      if (boundClassId !== conversation.classId) {
        throw new ForbiddenError("大屏无权访问该班级会话");
      }
    } else {
      throw new ForbiddenError("无权访问该会话");
    }
  } else if (conversation.type === "direct") {
    if (
      userId !== conversation.participantAId &&
      userId !== conversation.participantBId
    ) {
      throw new ForbiddenError("无权访问该私信会话");
    }
  } else {
    throw new ForbiddenError("无权访问该会话");
  }
}

/* ------------------------------ 兼容查询 ------------------------------ */

export type MyClass = {
  classId: string;
  className: string;
  studentName?: string;
};

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
      .innerJoin(schema.classes, eq(schema.parentStudents.classId, schema.classes.id))
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
      .innerJoin(schema.classes, eq(schema.teacherClasses.classId, schema.classes.id))
      .where(eq(schema.teacherClasses.teacherId, user.id));
    return rows;
  }
  return [];
}

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

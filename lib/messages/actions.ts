"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { MessageType, MessageStatus, UserRole, ConversationType } from "@/lib/db/schema";
import { and, desc, eq, or, inArray, gt, ne, sql, ilike, isNull, lt } from "drizzle-orm";
import { uploadImage, uploadFile } from "@/lib/images/upload";
import {
  assertParentCanPostToClass,
  assertTeacherCanPostToClass,
  getClassroomClassId,
  ForbiddenError,
} from "@/lib/rbac";
import { toPublishPayload, toDirectPublishPayload, toStatusPublishPayload, toDirectStatusPublishPayload, toRecallPublishPayload, toDirectRecallPublishPayload, toUserMessageEvent, messagePreview } from "@/lib/realtime/contract";
import { publishMessage, publishMessageStatus, publishMessageRecall, publishUserMessageEvent } from "@/lib/realtime/publish";
import { createNotification } from "@/lib/notifications/internal";
import { rateLimit } from "@/lib/security/rate-limit";
import { sanitizeAndTruncate, isFileSafe } from "@/lib/security/sanitize";
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
  pinned: boolean;
  muted: boolean;
};

export async function getMyConversations(): Promise<ConversationItem[]> {
  try {
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
            : lastMsg[0].type === "audio"
              ? "[语音]"
              : lastMsg[0].type === "file"
                ? "[文件]"
                : lastMsg[0].type === "urgent"
                  ? "[紧急] " + lastMsg[0].content
                  : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
        pinned: false,
        muted: false,
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
            : lastMsg[0].type === "audio"
              ? "[语音]"
              : lastMsg[0].type === "file"
                ? "[文件]"
                : lastMsg[0].type === "urgent"
                  ? "[紧急] " + lastMsg[0].content
                  : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
        pinned: false,
        muted: false,
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
            : lastMsg[0].type === "audio"
              ? "[语音]"
              : lastMsg[0].type === "file"
                ? "[文件]"
                : lastMsg[0].type === "urgent"
                  ? "[紧急] " + lastMsg[0].content
                  : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
        pinned: false,
        muted: false,
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
            : lastMsg[0].type === "audio"
              ? "[语音]"
              : lastMsg[0].type === "file"
                ? "[文件]"
                : lastMsg[0].type === "urgent"
                  ? "[紧急] " + lastMsg[0].content
                  : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
        pinned: false,
        muted: false,
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
            : lastMsg[0].type === "audio"
              ? "[语音]"
              : lastMsg[0].type === "file"
                ? "[文件]"
                : lastMsg[0].type === "urgent"
                  ? "[紧急] " + lastMsg[0].content
                  : lastMsg[0].content
          : null,
        lastMessageAt: lastMsg[0]?.createdAt ?? null,
        unreadCount: 0,
        pinned: false,
        muted: false,
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

    const prefs = await db
      .select({
        conversationId: schema.conversationPreferences.conversationId,
        pinned: schema.conversationPreferences.pinned,
        muted: schema.conversationPreferences.muted,
      })
      .from(schema.conversationPreferences)
      .where(
        and(
          eq(schema.conversationPreferences.userId, user.id),
          inArray(schema.conversationPreferences.conversationId, conversationIds),
        ),
      );

    const prefMap = new Map(prefs.map((p) => [p.conversationId, p]));
    for (const item of items) {
      const pref = prefMap.get(item.conversationId);
      if (pref) {
        item.pinned = pref.pinned;
        item.muted = pref.muted;
      }
    }

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
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.type !== b.type) return a.type === "group" ? -1 : 1;
    const aTime = a.lastMessageAt?.getTime() ?? 0;
    const bTime = b.lastMessageAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return items;
  } catch {
    return [];
  }
}

/* ------------------------------ 群成员列表（@提及） ------------------------------ */

export type GroupMember = {
  userId: string;
  name: string;
  role: UserRole;
};

export async function getGroupMembers(
  conversationId: string,
): Promise<GroupMember[]> {
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

  if (conversation.type !== "group" || !conversation.classId) return [];

  try {
    await assertCanAccessConversation(user.id, user.role, conversation);
  } catch {
    return [];
  }

  const classId = conversation.classId;

  const teachers = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.teacherClasses)
    .innerJoin(schema.users, eq(schema.teacherClasses.teacherId, schema.users.id))
    .where(eq(schema.teacherClasses.classId, classId));

  const parents = await db
    .select({
      userId: schema.users.id,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.parentStudents)
    .innerJoin(schema.users, eq(schema.parentStudents.parentId, schema.users.id))
    .where(eq(schema.parentStudents.classId, classId));

  const seen = new Set<string>();
  const members: GroupMember[] = [];
  for (const m of [...teachers, ...parents]) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    members.push(m);
  }

  return members.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

/* ------------------------------ 发送消息 ------------------------------ */

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  text: z.string().max(1000).optional(),
  file: z.instanceof(File).optional(),
  urgent: z.boolean().optional(),
  mentions: z.string().optional(),
});

export type SendResult =
  | { ok: true; id: string; status: MessageStatus; content: string }
  | { ok: false; error: string };

export async function sendMessage(
  formData: FormData,
): Promise<SendResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };
  const user = session.user;

  const rl = rateLimit(`send:${user.id}`, 30, 60_000);
  if (!rl.ok) return { ok: false, error: "发送过于频繁，请稍后再试" };

  const parsed = sendSchema.safeParse({
    conversationId: formData.get("conversationId"),
    text: formData.get("text") || undefined,
    file: formData.get("file") || undefined,
    urgent: formData.get("urgent") === "true",
    mentions: (formData.get("mentions") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "参数校验失败" };
  }
  const { conversationId, text, file, urgent, mentions } = parsed.data;

  let parsedMentions: { userId: string; name: string }[] = [];
  if (mentions) {
    try {
      const raw = JSON.parse(mentions);
      if (Array.isArray(raw)) {
        parsedMentions = raw
          .filter(
            (m): m is { userId: string; name: string } =>
              typeof m === "object" &&
              m !== null &&
              typeof m.userId === "string" &&
              typeof m.name === "string",
          )
          .slice(0, 50);
      }
    } catch {
      /* ignore invalid mentions */
    }
  }

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
    if (!isFileSafe(file.name, file.type)) {
      return { ok: false, error: "不支持的文件类型" };
    }
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    if (isImage) {
      const upload = await uploadImage(file);
      if (!upload.ok) return upload;
      content = upload.url;
      type = "image";
      mimeType = upload.mimeType;
    } else if (isAudio) {
      const upload = await uploadFile(file);
      if (!upload.ok) return upload;
      content = JSON.stringify({ url: upload.url, duration: Number(formData.get("duration") ?? 0) });
      type = "audio";
      mimeType = upload.mimeType;
    } else {
      const upload = await uploadFile(file);
      if (!upload.ok) return upload;
      content = JSON.stringify({ url: upload.url, name: file.name, size: upload.size });
      type = "file";
      mimeType = upload.mimeType;
    }
  } else if (urgent) {
    content = sanitizeAndTruncate(text ?? "", 1000);
    if (!content) return { ok: false, error: "紧急消息不能为空" };
    type = "urgent";
  } else {
    content = sanitizeAndTruncate(text ?? "", 1000);
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
      mentions: parsedMentions.length > 0 ? parsedMentions : null,
    })
    .returning();
  if (!msg) return { ok: false, error: "消息写入失败" };

  for (const m of parsedMentions) {
    if (m.userId === user.id) continue;
    try {
      await createNotification({
        userId: m.userId,
        type: "mention",
        title: `${user.name} @提到了你`,
        body: content.slice(0, 100),
        conversationId,
      });
    } catch {
      /* notification failure should not block message send */
    }
  }

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

  try {
    const memberIds = await getConversationMemberIds(conversation, user.id);
    if (memberIds.length > 0) {
      await publishUserMessageEvent({
        userIds: memberIds,
        event: toUserMessageEvent({
          conversationId,
          messageId: msg.id,
          senderName: user.name,
          senderRole: user.role,
          preview: messagePreview(type, content),
          type,
          createdAt: msg.createdAt,
        }),
      });
    }
  } catch {
    /* user event 推送失败不阻断发送 */
  }

  return { ok: true, id: msg.id, status: "delivered", content };
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
  deletedAt: Date | null;
  editedAt: Date | null;
  editHistory: { content: string; editedAt: string }[] | null;
  mentions: { userId: string; name: string }[] | null;
  createdAt: Date;
};

export async function getConversationMessages(
  conversationId: string,
  beforeCursor?: string,
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

  const whereCondition = beforeCursor
    ? and(
        eq(schema.messages.conversationId, conversationId),
        lt(schema.messages.createdAt, new Date(beforeCursor)),
      )
    : eq(schema.messages.conversationId, conversationId);

  // 校验游标时间有效性
  if (beforeCursor) {
    const cursorDate = new Date(beforeCursor);
    if (Number.isNaN(cursorDate.getTime())) return [];
  }

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
      deletedAt: schema.messages.deletedAt,
      editedAt: schema.messages.editedAt,
      editHistory: schema.messages.editHistory,
      mentions: schema.messages.mentions,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.senderId, schema.users.id))
    .where(whereCondition)
    .orderBy(desc(schema.messages.createdAt))
    .limit(50);
  return rows.map((r) =>
    r.deletedAt ? { ...r, content: "", editHistory: null } : r,
  );
}

/* ------------------------------ 增量拉取（断线补发） ------------------------------ */

/**
 * 增量拉取某会话中他人发的消息（createdAt > afterCreatedAt）。
 * 用于 WS 断线重连后从 DB 补发，不依赖 DO 内存 backfill。
 */
export async function getMessagesSince(
  conversationId: string,
  afterCreatedAt?: string,
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

  const conditions = [
    eq(schema.messages.conversationId, conversationId),
    ne(schema.messages.senderId, user.id),
  ];
  if (afterCreatedAt) {
    const afterDate = new Date(afterCreatedAt);
    if (!Number.isNaN(afterDate.getTime())) {
      conditions.push(gt(schema.messages.createdAt, afterDate));
    }
  }

  const rows = await db
    .select({
      id: schema.messages.id,
      senderName: schema.users.name,
      senderRole: schema.users.role,
      senderId: schema.messages.senderId,
      content: schema.messages.content,
      type: schema.messages.type,
      mimeType: schema.messages.mimeType,
      status: schema.messages.status,
      deletedAt: schema.messages.deletedAt,
      editedAt: schema.messages.editedAt,
      editHistory: schema.messages.editHistory,
      mentions: schema.messages.mentions,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.senderId, schema.users.id))
    .where(and(...conditions))
    .orderBy(desc(schema.messages.createdAt))
    .limit(100);

  return rows.map((r) =>
    r.deletedAt ? { ...r, content: "", editHistory: null } : r,
  );
}

/** 查询会话中所有成员 ID（排除发送者），用于 user-level 事件推送 */
async function getConversationMemberIds(
  conversation: { type: ConversationType; classId: string | null; participantAId: string | null; participantBId: string | null },
  senderId: string,
): Promise<string[]> {
  if (conversation.type === "group" && conversation.classId) {
    const teachers = await db
      .select({ id: schema.users.id })
      .from(schema.teacherClasses)
      .innerJoin(schema.users, eq(schema.teacherClasses.teacherId, schema.users.id))
      .where(eq(schema.teacherClasses.classId, conversation.classId));
    const parents = await db
      .select({ id: schema.users.id })
      .from(schema.parentStudents)
      .innerJoin(schema.users, eq(schema.parentStudents.parentId, schema.users.id))
      .where(eq(schema.parentStudents.classId, conversation.classId));
    const classroom = await db
      .select({ id: schema.classes.screenId })
      .from(schema.classes)
      .where(eq(schema.classes.id, conversation.classId))
      .limit(1);
    const ids = new Set<string>();
    for (const t of teachers) if (t.id !== senderId) ids.add(t.id);
    for (const p of parents) if (p.id !== senderId) ids.add(p.id);
    if (classroom[0]?.id && classroom[0].id !== senderId) ids.add(classroom[0].id);
    return [...ids];
  }
  if (conversation.type === "direct") {
    const ids: string[] = [];
    if (conversation.participantAId && conversation.participantAId !== senderId) ids.push(conversation.participantAId);
    if (conversation.participantBId && conversation.participantBId !== senderId) ids.push(conversation.participantBId);
    return ids;
  }
  return [];
}

/* ------------------------------ 消息状态上报 ------------------------------ */

async function publishStatusEvent(
  conversation: { type: ConversationType; classId: string | null; participantAId: string | null; participantBId: string | null },
  messageId: string,
  status: "delivered" | "displayed",
  reader: { id: string; role: UserRole },
): Promise<void> {
  if (conversation.type === "group" && conversation.classId) {
    await publishMessageStatus(
      toStatusPublishPayload({
        classId: conversation.classId,
        messageId,
        status,
        readerId: reader.id,
        readerRole: reader.role,
      }),
    );
  } else if (
    conversation.type === "direct" &&
    conversation.participantAId &&
    conversation.participantBId
  ) {
    await publishMessageStatus(
      toDirectStatusPublishPayload({
        userAId: conversation.participantAId,
        userBId: conversation.participantBId,
        messageId,
        status,
        readerId: reader.id,
        readerRole: reader.role,
      }),
    );
  }
}

export async function markMessageRead(
  messageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };
  const user = session.user;

  const rows = await db
    .select({
      id: schema.messages.id,
      senderId: schema.messages.senderId,
      status: schema.messages.status,
      conversationId: schema.messages.conversationId,
    })
    .from(schema.messages)
    .where(eq(schema.messages.id, messageId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: "消息不存在" };
  const msg = rows[0]!;

  if (msg.senderId === user.id) return { ok: false, error: "不能为自己发的消息上报状态" };

  const conv = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.id, msg.conversationId))
    .limit(1);
  if (conv.length === 0) return { ok: false, error: "会话不存在" };
  const conversation = conv[0]!;

  try {
    await assertCanAccessConversation(user.id, user.role, conversation);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    return { ok: false, error: "权限校验失败" };
  }

  if (msg.status !== "delivered") return { ok: true };

  await db
    .update(schema.messages)
    .set({ status: "displayed" })
    .where(eq(schema.messages.id, messageId));

  await publishStatusEvent(conversation, messageId, "displayed", user);

  return { ok: true };
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

  const now = new Date();
  await db
    .insert(schema.messageReads)
    .values({
      userId: user.id,
      conversationId,
      lastReadAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.messageReads.userId, schema.messageReads.conversationId],
      set: {
        lastReadAt: now,
        updatedAt: now,
      },
    });

  // 批量将该会话中他人发的 delivered 消息更新为 displayed，并推送状态变更
  const updated = await db
    .update(schema.messages)
    .set({ status: "displayed" })
    .where(
      and(
        eq(schema.messages.conversationId, conversationId),
        ne(schema.messages.senderId, user.id),
        eq(schema.messages.status, "delivered"),
        isNull(schema.messages.deletedAt),
      ),
    )
    .returning({ id: schema.messages.id });

  const conversation = conv[0]!;
  for (const m of updated) {
    try {
      await publishStatusEvent(conversation, m.id, "displayed", user);
    } catch {
      /* 推送失败不阻塞已读标记 */
    }
  }

  return { ok: true };
}

/* ------------------------------ 会话偏好 ------------------------------ */

export async function setConversationPreferences(
  conversationId: string,
  pinned?: boolean,
  muted?: boolean,
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

  const values: { pinned?: boolean; muted?: boolean } = {};
  if (pinned !== undefined) values.pinned = pinned;
  if (muted !== undefined) values.muted = muted;

  // 无更新字段时直接返回，避免空 INSERT 覆盖已有偏好
  if (pinned === undefined && muted === undefined) {
    return { ok: true };
  }

  await db
    .insert(schema.conversationPreferences)
    .values({
      userId: user.id,
      conversationId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [schema.conversationPreferences.userId, schema.conversationPreferences.conversationId],
      set: {
        ...values,
        updatedAt: new Date(),
      },
    });

  return { ok: true };
}

/* ------------------------------ 撤回与编辑 ------------------------------ */

const RECALL_WINDOW_MS = 2 * 60 * 1000;

export async function recallMessage(
  messageId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };
  const user = session.user;

  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.id, messageId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: "消息不存在" };
  const msg = rows[0]!;

  if (msg.senderId !== user.id) {
    return { ok: false, error: "只能撤回自己的消息" };
  }
  if (msg.deletedAt) {
    return { ok: false, error: "消息已撤回" };
  }
  if (Date.now() - msg.createdAt.getTime() > RECALL_WINDOW_MS) {
    return { ok: false, error: "超过 2 分钟不可撤回" };
  }

  try {
    const conv = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, msg.conversationId))
      .limit(1);
    if (conv.length > 0) {
      await assertCanAccessConversation(user.id, user.role, conv[0]!);
    }
  } catch {
    return { ok: false, error: "无权操作此消息" };
  }

  const now = new Date();
  await db
    .update(schema.messages)
    .set({ deletedAt: now })
    .where(eq(schema.messages.id, messageId));

  // 推送撤回事件，让其他客户端实时看到消息被撤回
  try {
    const conv = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, msg.conversationId))
      .limit(1);
    if (conv.length > 0) {
      const conversation = conv[0]!;
      if (conversation.type === "group" && conversation.classId) {
        await publishMessageRecall(
          toRecallPublishPayload({
            classId: conversation.classId,
            messageId,
            deletedAt: now,
          }),
        );
      } else if (
        conversation.type === "direct" &&
        conversation.participantAId &&
        conversation.participantBId
      ) {
        await publishMessageRecall(
          toDirectRecallPublishPayload({
            userAId: conversation.participantAId,
            userBId: conversation.participantBId,
            messageId,
            deletedAt: now,
          }),
        );
      }
    }
  } catch {
    /* 推送失败不阻塞撤回操作 */
  }

  return { ok: true };
}

export async function editMessage(
  messageId: string,
  newText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "未登录" };
  const user = session.user;

  const trimmed = newText.trim();
  if (!trimmed) return { ok: false, error: "消息内容不能为空" };
  if (trimmed.length > 1000) return { ok: false, error: "消息过长" };

  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.id, messageId))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: "消息不存在" };
  const msg = rows[0]!;

  if (msg.senderId !== user.id) {
    return { ok: false, error: "只能编辑自己的消息" };
  }
  if (msg.deletedAt) {
    return { ok: false, error: "已撤回的消息不可编辑" };
  }
  if (msg.type !== "text") {
    return { ok: false, error: "只能编辑文本消息" };
  }

  try {
    const conv = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, msg.conversationId))
      .limit(1);
    if (conv.length > 0) {
      await assertCanAccessConversation(user.id, user.role, conv[0]!);
    }
  } catch {
    return { ok: false, error: "无权操作此消息" };
  }

  const history = msg.editHistory ?? [];
  const now = new Date();
  history.push({
    content: msg.content,
    editedAt: msg.editedAt?.toISOString() ?? msg.createdAt.toISOString(),
  });
  // 限制编辑历史最多保留 20 条，防止 JSONB 字段无限膨胀
  const trimmedHistory = history.slice(-20);

  await db
    .update(schema.messages)
    .set({
      content: trimmed,
      editedAt: now,
      editHistory: trimmedHistory,
    })
    .where(eq(schema.messages.id, messageId));

  return { ok: true };
}

/* ------------------------------ 消息搜索 ------------------------------ */

export type SearchResult = {
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  content: string;
  senderName: string;
  createdAt: Date;
};

export async function searchMessages(query: string): Promise<SearchResult[]> {
  const session = await getCurrentSession();
  if (!session) return [];

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // 转义 LIKE 通配符，防止搜索 % 或 _ 时匹配非预期内容
  const escapedQuery = trimmed.replace(/[%_\\]/g, "\\$&");

  const conversations = await getMyConversations();
  const conversationIds = conversations.map((c) => c.conversationId);
  if (conversationIds.length === 0) return [];

  const titleMap = new Map(conversations.map((c) => [c.conversationId, c.title]));

  const rows = await db
    .select({
      messageId: schema.messages.id,
      conversationId: schema.messages.conversationId,
      content: schema.messages.content,
      senderName: schema.users.name,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .innerJoin(schema.users, eq(schema.messages.senderId, schema.users.id))
    .where(
      and(
        inArray(schema.messages.conversationId, conversationIds),
        eq(schema.messages.type, "text"),
        ilike(schema.messages.content, `%${escapedQuery}%`),
        isNull(schema.messages.deletedAt),
      ),
    )
    .orderBy(desc(schema.messages.createdAt))
    .limit(50);

  return rows.map((r) => ({
    messageId: r.messageId,
    conversationId: r.conversationId,
    conversationTitle: titleMap.get(r.conversationId) ?? "未知会话",
    content: r.content,
    senderName: r.senderName,
    createdAt: r.createdAt,
  }));
}

/* ------------------------------ 权限校验 ------------------------------ */

async function assertCanAccessConversation(
  userId: string,
  role: UserRole,
  conversation: { type: ConversationType; classId: string | null; participantAId: string | null; participantBId: string | null },
): Promise<void> {
  // admin 拥有所有会话的访问权限（审计/管理需要）
  if (role === "admin") return;

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
  if (user.role === "classroom") {
    const classId = await getClassroomClassId(user.id);
    if (!classId) return [];
    const rows = await db
      .select({
        classId: schema.classes.id,
        className: schema.classes.name,
      })
      .from(schema.classes)
      .where(eq(schema.classes.id, classId));
    return rows;
  }
  if (user.role === "admin") {
    const rows = await db
      .select({
        classId: schema.classes.id,
        className: schema.classes.name,
      })
      .from(schema.classes);
    return rows;
  }
  return [];
}

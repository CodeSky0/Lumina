/**
 * 实时通讯接口契约 — Next.js 与 Cloudflare Durable Object Worker 之间的协议定义。
 *
 * 数据流：
 *   Server Action 写入 DB → POST {CF_WORKER_URL}/publish → DO 广播 → 所有端 WS 收消息
 *
 * 房间命名规则：
 *   班级群聊: class-{classId}
 *   私信: dm-{sortedUserAId}-{sortedUserBId}
 */
import { z } from "zod";
import type { MessageType, UserRole } from "@/lib/db/schema";

/** 班级群聊房间名 */
export function roomNameForClass(classId: string): string {
  return `class-${classId}`;
}

/** 私信房间名（两个 userId 排序后拼接，保证双向一致） */
export function roomNameForDirect(userAId: string, userBId: string): string {
  const [a, b] = [userAId, userBId].sort();
  return `dm-${a}-${b}`;
}

/* --------------------------- Next.js → Worker (HTTP) --------------------------- */

export const publishPayloadSchema = z.object({
  roomName: z.string().min(1),
  messageId: z.uuid(),
  senderName: z.string(),
  senderId: z.string(),
  senderRole: z.enum(["parent", "teacher", "classroom", "admin"]),
  type: z.enum(["text", "image", "urgent", "file", "audio"]),
  content: z.string(),
  mimeType: z.string().nullable(),
  createdAt: z.string(),
});

export type PublishPayload = z.infer<typeof publishPayloadSchema>;

/** 消息状态变更推送载荷（Next.js → Worker） */
export const statusPublishPayloadSchema = z.object({
  roomName: z.string().min(1),
  messageId: z.uuid(),
  status: z.enum(["delivered", "displayed"]),
  readerId: z.string(),
  readerRole: z.enum(["parent", "teacher", "classroom", "admin"]),
});

export type StatusPublishPayload = z.infer<typeof statusPublishPayloadSchema>;

/** 消息撤回推送载荷（Next.js → Worker） */
export const recallPublishPayloadSchema = z.object({
  roomName: z.string().min(1),
  messageId: z.uuid(),
  deletedAt: z.string(),
});

export type RecallPublishPayload = z.infer<typeof recallPublishPayloadSchema>;

/* --------------------------- Worker → 客户端 (WebSocket) -------------------------- */

export const chatMessageSchema = z.object({
  kind: z.literal("message"),
  messageId: z.uuid(),
  senderName: z.string(),
  senderId: z.string(),
  senderRole: z.enum(["parent", "teacher", "classroom", "admin"]),
  type: z.enum(["text", "image", "urgent", "file", "audio"]),
  content: z.string(),
  mimeType: z.string().nullable(),
  createdAt: z.string(),
});

export const chatControlSchema = z.object({
  kind: z.enum(["ack", "backfill", "heartbeat"]),
  messageId: z.uuid().optional(),
  messages: z.array(chatMessageSchema).optional(),
  serverTime: z.string().optional(),
});

export const presenceUserSchema = z.object({
  userId: z.string(),
  name: z.string(),
  role: z.enum(["parent", "teacher", "classroom", "admin"]),
});

export const presenceFrameSchema = z.object({
  kind: z.literal("presence"),
  users: z.array(presenceUserSchema),
});

/** 消息状态变更帧（Worker → 客户端） */
export const messageStatusSchema = z.object({
  kind: z.literal("message-status"),
  messageId: z.uuid(),
  status: z.enum(["delivered", "displayed"]),
  readerId: z.string(),
  readerRole: z.enum(["parent", "teacher", "classroom", "admin"]),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatControl = z.infer<typeof chatControlSchema>;
export type PresenceUser = z.infer<typeof presenceUserSchema>;
export type PresenceFrame = z.infer<typeof presenceFrameSchema>;
export type MessageStatusFrame = z.infer<typeof messageStatusSchema>;

/** 消息撤回帧（Worker → 客户端） */
export const messageRecallSchema = z.object({
  kind: z.literal("message-recall"),
  messageId: z.uuid(),
  deletedAt: z.string(),
});

export type MessageRecallFrame = z.infer<typeof messageRecallSchema>;
export type ChatFrame = ChatMessage | ChatControl | PresenceFrame | MessageStatusFrame | MessageRecallFrame;

/* --------------------------- 客户端 → Worker (WebSocket) -------------------------- */

export const clientFrameSchema = z.object({
  kind: z.enum(["subscribe", "backfill", "ping", "join"]),
  room: z.string().optional(),
  since: z.string().optional(),
  userId: z.string().optional(),
  name: z.string().optional(),
  role: z.enum(["parent", "teacher", "classroom", "admin"]).optional(),
});

export type ClientFrame = z.infer<typeof clientFrameSchema>;

/** 便捷构造：把 DB 行转为发布载荷（班级群聊） */
export function toPublishPayload(input: {
  classId: string;
  messageId: string;
  senderName: string;
  senderId: string;
  senderRole: UserRole;
  type: MessageType;
  content: string;
  mimeType: string | null;
  createdAt: Date;
}): PublishPayload {
  return {
    roomName: roomNameForClass(input.classId),
    messageId: input.messageId,
    senderName: input.senderName,
    senderId: input.senderId,
    senderRole: input.senderRole,
    type: input.type,
    content: input.content,
    mimeType: input.mimeType,
    createdAt: input.createdAt.toISOString(),
  };
}

/** 便捷构造：把 DB 行转为发布载荷（私信） */
export function toDirectPublishPayload(input: {
  userAId: string;
  userBId: string;
  messageId: string;
  senderName: string;
  senderId: string;
  senderRole: UserRole;
  type: MessageType;
  content: string;
  mimeType: string | null;
  createdAt: Date;
}): PublishPayload {
  return {
    roomName: roomNameForDirect(input.userAId, input.userBId),
    messageId: input.messageId,
    senderName: input.senderName,
    senderId: input.senderId,
    senderRole: input.senderRole,
    type: input.type,
    content: input.content,
    mimeType: input.mimeType,
    createdAt: input.createdAt.toISOString(),
  };
}

/** 便捷构造：消息状态变更发布载荷（班级群聊） */
export function toStatusPublishPayload(input: {
  classId: string;
  messageId: string;
  status: "delivered" | "displayed";
  readerId: string;
  readerRole: UserRole;
}): StatusPublishPayload {
  return {
    roomName: roomNameForClass(input.classId),
    messageId: input.messageId,
    status: input.status,
    readerId: input.readerId,
    readerRole: input.readerRole,
  };
}

/** 便捷构造：消息状态变更发布载荷（私信） */
export function toDirectStatusPublishPayload(input: {
  userAId: string;
  userBId: string;
  messageId: string;
  status: "delivered" | "displayed";
  readerId: string;
  readerRole: UserRole;
}): StatusPublishPayload {
  return {
    roomName: roomNameForDirect(input.userAId, input.userBId),
    messageId: input.messageId,
    status: input.status,
    readerId: input.readerId,
    readerRole: input.readerRole,
  };
}

/** 便捷构造：消息撤回发布载荷（班级群聊） */
export function toRecallPublishPayload(input: {
  classId: string;
  messageId: string;
  deletedAt: Date;
}): RecallPublishPayload {
  return {
    roomName: roomNameForClass(input.classId),
    messageId: input.messageId,
    deletedAt: input.deletedAt.toISOString(),
  };
}

/** 便捷构造：消息撤回发布载荷（私信） */
export function toDirectRecallPublishPayload(input: {
  userAId: string;
  userBId: string;
  messageId: string;
  deletedAt: Date;
}): RecallPublishPayload {
  return {
    roomName: roomNameForDirect(input.userAId, input.userBId),
    messageId: input.messageId,
    deletedAt: input.deletedAt.toISOString(),
  };
}

/* --------------------------- User-level 事件通道 -------------------------- */
/**
 * 用户级事件通道 — 每用户一个独立 WS room，用于实时推送未读计数/通知事件。
 * 与会话级 room（class-xxx / dm-xxx）并行：会话 room 推全量消息，user room 推轻量事件。
 */

/** 用户级事件房间名 */
export function roomNameForUser(userId: string): string {
  return `user-${userId}`;
}

/** 用户级新消息事件帧（Worker → 客户端） */
export const userMessageEventSchema = z.object({
  kind: z.literal("user-message"),
  conversationId: z.uuid(),
  messageId: z.uuid(),
  senderName: z.string(),
  senderRole: z.enum(["parent", "teacher", "classroom", "admin"]),
  preview: z.string(),
  type: z.enum(["text", "image", "urgent", "file", "audio"]),
  createdAt: z.string(),
});

export type UserMessageEvent = z.infer<typeof userMessageEventSchema>;

/** 用户级通知事件帧（Worker → 客户端） */
export const userNotificationEventSchema = z.object({
  kind: z.literal("user-notification"),
  notificationId: z.uuid(),
  title: z.string(),
  body: z.string().nullable(),
  conversationId: z.string().nullable(),
});

export type UserNotificationEvent = z.infer<typeof userNotificationEventSchema>;

/** 用户级事件联合类型 */
export type UserEvent = UserMessageEvent | UserNotificationEvent;

/** 用户级事件批量推送载荷（Next.js → Worker） */
export const userEventPublishPayloadSchema = z.object({
  userIds: z.array(z.string()).min(1),
  event: z.union([userMessageEventSchema, userNotificationEventSchema]),
});

export type UserEventPublishPayload = z.infer<typeof userEventPublishPayloadSchema>;

/** 便捷构造：新消息事件 */
export function toUserMessageEvent(input: {
  conversationId: string;
  messageId: string;
  senderName: string;
  senderRole: UserRole;
  preview: string;
  type: MessageType;
  createdAt: Date;
}): UserMessageEvent {
  return {
    kind: "user-message",
    conversationId: input.conversationId,
    messageId: input.messageId,
    senderName: input.senderName,
    senderRole: input.senderRole,
    preview: input.preview,
    type: input.type,
    createdAt: input.createdAt.toISOString(),
  };
}

/** 便捷构造：通知事件 */
export function toUserNotificationEvent(input: {
  notificationId: string;
  title: string;
  body: string | null;
  conversationId: string | null;
}): UserNotificationEvent {
  return {
    kind: "user-notification",
    notificationId: input.notificationId,
    title: input.title,
    body: input.body,
    conversationId: input.conversationId,
  };
}

/** 消息预览文本（用于侧边栏 lastMessagePreview / user 事件 preview） */
export function messagePreview(type: MessageType, content: string): string {
  switch (type) {
    case "image":
      return "[图片]";
    case "audio":
      return "[语音]";
    case "file":
      return "[文件]";
    case "urgent":
      return "[紧急] " + content.slice(0, 50);
    default:
      return content.slice(0, 50);
  }
}

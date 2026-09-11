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
import type { MessageType } from "@/lib/db/schema";

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
  type: z.enum(["text", "image", "urgent"]),
  content: z.string(),
  mimeType: z.string().nullable(),
  createdAt: z.string(),
});

export type PublishPayload = z.infer<typeof publishPayloadSchema>;

/* --------------------------- Worker → 客户端 (WebSocket) -------------------------- */

export const chatMessageSchema = z.object({
  kind: z.literal("message"),
  messageId: z.uuid(),
  senderName: z.string(),
  senderId: z.string(),
  type: z.enum(["text", "image", "urgent"]),
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

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatControl = z.infer<typeof chatControlSchema>;
export type ChatFrame = ChatMessage | ChatControl;

/* --------------------------- 客户端 → Worker (WebSocket) -------------------------- */

export const clientFrameSchema = z.object({
  kind: z.enum(["subscribe", "backfill", "ping"]),
  room: z.string().optional(),
  since: z.string().optional(),
});

export type ClientFrame = z.infer<typeof clientFrameSchema>;

/** 便捷构造：把 DB 行转为发布载荷（班级群聊） */
export function toPublishPayload(input: {
  classId: string;
  messageId: string;
  senderName: string;
  senderId: string;
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
    type: input.type,
    content: input.content,
    mimeType: input.mimeType,
    createdAt: input.createdAt.toISOString(),
  };
}

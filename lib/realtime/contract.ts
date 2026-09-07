/**
 * 实时通讯接口契约 — Next.js 与 Cloudflare Durable Object Worker 之间的协议定义。
 *
 * 数据流：
 *   Server Action 写入 DB → POST {CF_WORKER_URL}/publish → DO 广播 → 大屏 WS 收消息
 *
 * 大屏侧 WS 消息格式见 ScreenMessage。Worker 侧实现见 cf-worker/。
 */
import { z } from "zod";
import type { MessageType } from "@/lib/db/schema";

/** WS 房间命名规则：每个班级一个房间 class-{classId} */
export function roomNameForClass(classId: string): string {
  return `class-${classId}`;
}

/* --------------------------- Next.js → Worker (HTTP) --------------------------- */

/** Server Action 写库后发给 CF Worker 的发布请求体 */
export const publishPayloadSchema = z.object({
  classId: z.uuid(),
  messageId: z.uuid(),
  senderName: z.string(),
  type: z.enum(["text", "image", "urgent"]),
  content: z.string(),
  mimeType: z.string().nullable(),
  createdAt: z.string(),
});

export type PublishPayload = z.infer<typeof publishPayloadSchema>;

/* --------------------------- Worker → 大屏 (WebSocket) -------------------------- */

/** 大屏通过 WS 收到的消息（DO 广播） */
export const screenMessageSchema = z.object({
  kind: z.literal("message"),
  messageId: z.uuid(),
  senderName: z.string(),
  type: z.enum(["text", "image", "urgent"]),
  content: z.string(),
  mimeType: z.string().nullable(),
  createdAt: z.string(),
});

/** 大屏 WS 收到的确认/补发控制帧 */
export const screenControlSchema = z.object({
  kind: z.enum(["ack", "backfill", "heartbeat"]),
  /** ack: 已送达消息 id；backfill: 断线补发的消息数组 */
  messageId: z.uuid().optional(),
  messages: z.array(screenMessageSchema).optional(),
  serverTime: z.string().optional(),
});

export type ScreenMessage = z.infer<typeof screenMessageSchema>;
export type ScreenControl = z.infer<typeof screenControlSchema>;
export type ScreenFrame = ScreenMessage | ScreenControl;

/* --------------------------- 大屏 → Worker (WebSocket) -------------------------- */

/** 大屏发给 DO 的帧：订阅房间 / 请求补发 */
export const clientFrameSchema = z.object({
  kind: z.enum(["subscribe", "backfill", "ping"]),
  room: z.string().optional(),
  since: z.string().optional(),
});

export type ClientFrame = z.infer<typeof clientFrameSchema>;

/** 便捷构造：把 DB 行转为发布载荷 */
export function toPublishPayload(input: {
  classId: string;
  messageId: string;
  senderName: string;
  type: MessageType;
  content: string;
  mimeType: string | null;
  createdAt: Date;
}): PublishPayload {
  return {
    classId: input.classId,
    messageId: input.messageId,
    senderName: input.senderName,
    type: input.type,
    content: input.content,
    mimeType: input.mimeType,
    createdAt: input.createdAt.toISOString(),
  };
}

import type { InfiniteData } from "@tanstack/react-query";
import type { Message, MessagePage, MessagePageData, MessageType } from "@/lib/types";
import { isTwoMinuteRecallWindow } from "@/lib/auth-utils";

export const MAX_TEXT_LENGTH = 2000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function compareMessageIds(a: string, b: string): number {
  try {
    const left = BigInt(a);
    const right = BigInt(b);
    return left < right ? -1 : left > right ? 1 : 0;
  } catch {
    return a.localeCompare(b);
  }
}

export function mergeMessages(pages: MessagePage[]): Message[] {
  const unique = new Map<string, Message>();
  for (const page of pages) {
    for (const message of page.messages) unique.set(message.id, message);
  }
  return Array.from(unique.values()).sort((a, b) => compareMessageIds(a.id, b.id));
}

export function normalizeMessagePage(data: Message[] | MessagePageData, limit: number): MessagePage {
  const messages = Array.isArray(data)
    ? data
    : data.items ?? data.messages ?? data.data ?? [];
  const ordered = [...messages].sort((a, b) => compareMessageIds(a.id, b.id));
  const oldest = ordered[0]?.id;
  const explicitCursor = Array.isArray(data) ? undefined : data.next_before_id;
  const hasMore = Array.isArray(data)
    ? messages.length === limit
    : data.has_more ?? (explicitCursor ? true : messages.length === limit);
  return { messages: ordered, hasMore, nextCursor: explicitCursor ?? (hasMore ? oldest : undefined) };
}

export function prependMessageToPages(
  data: InfiniteData<MessagePage> | undefined,
  message: Message,
): InfiniteData<MessagePage> | undefined {
  if (!data || data.pages.length === 0) return data;
  if (data.pages.some((page) => page.messages.some((item) => item.id === message.id))) return data;
  const pages = [...data.pages];
  const lastIndex = pages.length - 1;
  pages[lastIndex] = {
    ...pages[lastIndex],
    messages: mergeMessages([{ messages: [...pages[lastIndex].messages, message], hasMore: false }]),
  };
  return { ...data, pages };
}

export function canRecall(message: Message, userId: string, now = Date.now()): boolean {
  return message.sender_id === userId && !message.deleted_at && isTwoMinuteRecallWindow(message.created_at, now);
}

export function validateMessage(type: MessageType, content: string): string | null {
  const length = Array.from(content.trim()).length;
  if (["text", "notice", "urgent"].includes(type) && length === 0) return "请输入消息内容";
  if (length > MAX_TEXT_LENGTH) return `消息不能超过 ${MAX_TEXT_LENGTH} 字`;
  return null;
}

export function validateUpload(file: File, kind: "image" | "file"): string | null {
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (file.size === 0) return "不能上传空文件";
  if (file.size > max) return kind === "image" ? "图片不能超过 5 MiB" : "文件不能超过 20 MiB";
  if (kind === "image" && !file.type.startsWith("image/")) return "请选择有效的图片文件";
  return null;
}

export function messageFromEventData(data: unknown): Message | null {
  if (!data || typeof data !== "object") return null;
  const candidate = "message" in data ? (data as { message?: unknown }).message : data;
  if (!candidate || typeof candidate !== "object") return null;
  const value = candidate as Partial<Message>;
  return typeof value.id === "string" && typeof value.channel_id === "string" ? value as Message : null;
}

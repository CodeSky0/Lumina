import { describe, expect, it } from "vitest";
import type { InfiniteData } from "@tanstack/react-query";
import { canRecall, compareMessageIds, mergeMessages, normalizeMessagePage, prependMessageToPages, validateMessage, validateUpload } from "@/lib/messages";
import type { Message, MessagePage } from "@/lib/types";

function message(id: string, overrides: Partial<Message> = {}): Message {
  return {
    id, channel_id: "ch-1", sender_id: "teacher-1", sender_name: "教师", type: "text",
    content: `消息 ${id}`, metadata: {}, is_pinned: false, created_at: "2026-10-30T12:00:00Z", read_count: 0,
    ...overrides,
  };
}

describe("消息游标、排序与去重", () => {
  it("用 BigInt 比较超过 JS 安全整数的消息 ID", () => {
    expect(compareMessageIds("9007199254740993", "9007199254740992")).toBe(1);
    expect(compareMessageIds("9007199254740992", "9007199254740992")).toBe(0);
  });

  it("跨游标页按 ID 去重并稳定升序", () => {
    const pages: MessagePage[] = [
      { messages: [message("12"), message("9")], hasMore: true },
      { messages: [message("9"), message("7")], hasMore: false },
    ];
    expect(mergeMessages(pages).map((item) => item.id)).toEqual(["7", "9", "12"]);
  });

  it("尊重服务端游标与 has_more，不凭空制造下一页", () => {
    expect(normalizeMessagePage({ messages: [message("3")], has_more: false }, 1)).toMatchObject({ hasMore: false, nextCursor: undefined });
    expect(normalizeMessagePage({ messages: [message("3")], next_before_id: "3" }, 1)).toMatchObject({ hasMore: true, nextCursor: "3" });
  });

  it("实时消息只追加到最新页，重复事件不改变缓存", () => {
    const original: InfiniteData<MessagePage> = { pages: [{ messages: [message("1")], hasMore: false }], pageParams: [undefined] };
    const updated = prependMessageToPages(original, message("2"));
    expect(updated?.pages[0].messages.map((item) => item.id)).toEqual(["1", "2"]);
    expect(prependMessageToPages(updated, message("2"))).toBe(updated);
  });
});

describe("消息权限与输入边界", () => {
  it("只有发送者本人能在两分钟内撤回", () => {
    const now = new Date("2026-10-30T12:01:00Z").getTime();
    expect(canRecall(message("1"), "teacher-1", now)).toBe(true);
    expect(canRecall(message("1"), "other", now)).toBe(false);
    expect(canRecall(message("1", { deleted_at: "2026-10-30T12:00:30Z" }), "teacher-1", now)).toBe(false);
  });

  it("按 Unicode 字符校验 2000 字限制", () => {
    expect(validateMessage("text", " ".repeat(3))).toBe("请输入消息内容");
    expect(validateMessage("text", "你".repeat(2000))).toBeNull();
    expect(validateMessage("text", "你".repeat(2001))).toContain("2000");
  });

  it("分别限制图片 5 MiB 和文件 20 MiB", () => {
    const image = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    const file = new File([new Uint8Array(1)], "notes.txt", { type: "text/plain" });
    expect(validateUpload(image, "image")).toContain("5 MiB");
    expect(validateUpload(file, "image")).toContain("图片");
    expect(validateUpload(file, "file")).toBeNull();
  });
});

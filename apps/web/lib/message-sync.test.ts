import { beforeEach, describe, expect, it, vi } from "vitest";
import { InfiniteData, QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { syncChannelMessages } from "@/lib/message-sync";
import type { Message, MessagePage } from "@/lib/types";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

function message(id: string): Message {
  return { id, channel_id: "ch-1", sender_id: "teacher-1", sender_name: "教师", type: "text", content: `消息${id}`, metadata: {}, is_pinned: false, created_at: "2026-11-04T12:00:00Z", delivery_count: 0, read_count: 0 };
}

describe("消息增量同步", () => {
  beforeEach(() => vi.mocked(apiFetch).mockReset());

  it("从本地最大 ID 拉取并按数据库 ID 合并去重", async () => {
    const client = new QueryClient();
    const initial: InfiniteData<MessagePage> = { pages: [{ messages: [message("9"), message("11")], hasMore: false }], pageParams: [undefined] };
    client.setQueryData(["messages", "ch-1", ""], initial);
    vi.mocked(apiFetch).mockResolvedValue({ items: [message("11"), message("12")], next_after_id: "12", has_more: false });

    await syncChannelMessages(client, "ch-1");

    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("after_id=11"));
    const result = client.getQueryData<InfiniteData<MessagePage>>(["messages", "ch-1", ""]);
    expect(result?.pages.flatMap((page) => page.messages).map((item) => item.id)).toEqual(["9", "11", "12"]);
  });

  it("has_more 时使用服务端游标继续拉取直到完成", async () => {
    const client = new QueryClient();
    client.setQueryData(["messages", "ch-1", ""], { pages: [{ messages: [message("9")], hasMore: false }], pageParams: [undefined] });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ items: [message("10")], next_after_id: "10", has_more: true })
      .mockResolvedValueOnce({ items: [message("11")], next_after_id: "11", has_more: false });

    await syncChannelMessages(client, "ch-1");

    expect(vi.mocked(apiFetch).mock.calls[0][0]).toContain("after_id=9");
    expect(vi.mocked(apiFetch).mock.calls[1][0]).toContain("after_id=10");
    const result = client.getQueryData<InfiniteData<MessagePage>>(["messages", "ch-1", ""]);
    expect(result?.pages.flatMap((page) => page.messages).map((item) => item.id)).toEqual(["9", "10", "11"]);
  });
});

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { InfiniteData, QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { deliveryAckScheduler } from "@/lib/delivery-ack";
import { syncChannelMessages, synchronizeRealtime } from "@/lib/message-sync";
import type { Channel, Message, MessagePage } from "@/lib/types";
import { useSessionStore } from "@/stores/session";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

function message(id: string): Message {
  return { id, channel_id: "ch-1", sender_id: "teacher-1", sender_name: "教师", type: "text", content: `消息${id}`, metadata: {}, is_pinned: false, created_at: "2026-11-04T12:00:00Z", delivery_count: 0, read_count: 0 };
}

function session(userId: string) {
  return { access_token: `token-${userId}`, expires_at: "2026-11-05T12:00:00Z", user: { id: userId, username: userId, display_name: userId, role: "teacher" as const } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("消息增量同步", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    deliveryAckScheduler.stop();
    useSessionStore.getState().clearSession();
  });

  afterEach(() => {
    deliveryAckScheduler.stop();
    useSessionStore.getState().clearSession();
  });

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

  it("同步恢复的非本人消息进入统一 ACK", async () => {
    useSessionStore.getState().setSession(session("self"));
    const client = new QueryClient();
    vi.mocked(apiFetch).mockResolvedValueOnce({ items: [message("12")], next_after_id: "12", has_more: false }).mockResolvedValue(undefined);

    await syncChannelMessages(client, "ch-1");
    await deliveryAckScheduler.flush();

    expect(apiFetch).toHaveBeenCalledWith("/api/v1/messages/delivery-ack", { method: "POST", body: { message_ids: ["12"] } });
  });

  it("cleanup 后旧同步晚完成不写缓存、不标同步也不恢复新账号 ACK 队列", async () => {
    useSessionStore.getState().setSession(session("old-user"));
    deliveryAckScheduler.start("old-user");
    const controller = new AbortController();
    const pending = deferred<{ items: Channel[] }>();
    vi.mocked(apiFetch).mockReturnValueOnce(pending.promise);
    const client = new QueryClient();
    const setQueryData = vi.spyOn(client, "setQueryData");
    const syncing = synchronizeRealtime(client, undefined, { signal: controller.signal, userId: "old-user" });

    controller.abort();
    useSessionStore.getState().setSession(session("new-user"));
    deliveryAckScheduler.start("new-user");
    pending.resolve({ items: [{ id: "ch-1", name: "旧账号通道", type: "normal", active: true, unread_count: 0 }] });

    await expect(syncing).rejects.toMatchObject({ name: "AbortError" });
    expect(setQueryData).not.toHaveBeenCalled();
    expect(vi.mocked(apiFetch).mock.calls.filter(([path]) => path === "/api/v1/messages/delivery-ack")).toHaveLength(0);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});

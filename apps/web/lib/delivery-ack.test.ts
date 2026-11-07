import { describe, expect, it, vi } from "vitest";
import { DeliveryAckScheduler } from "@/lib/delivery-ack";
import type { Message } from "@/lib/types";

function message(id: string, senderId = "other"): Message {
  return { id, channel_id: "ch-1", sender_id: senderId, sender_name: "发送人", type: "text", content: id, metadata: {}, is_pinned: false, created_at: "2026-11-04T12:00:00Z", delivery_count: 0, read_count: 0 };
}

describe("DeliveryAckScheduler", () => {
  it("每批最多 100 条，过滤本人消息并完成所有分片", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const scheduler = new DeliveryAckScheduler(send);
    const messages = Array.from({ length: 205 }, (_, index) => message(String(index + 1)));
    scheduler.enqueue([...messages, message("own", "self")], "self");

    await scheduler.flush();

    expect(send.mock.calls.map(([ids]) => ids.length)).toEqual([100, 100, 5]);
    expect(send.mock.calls.flatMap(([ids]) => ids)).not.toContain("own");
  });

  it("失败批次保留到后续消息批次且只发送一次成功项", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("网络失败")).mockResolvedValue(undefined);
    const scheduler = new DeliveryAckScheduler(send);
    scheduler.enqueue([message("failed-1")], "self");
    await scheduler.flush();

    scheduler.enqueue([message("next-2")], "self");
    await scheduler.flush();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual(["failed-1", "next-2"]);
    scheduler.enqueue([], "self");
    await scheduler.flush();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("连接恢复后的 flush 重试原失败标识", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("断线")).mockResolvedValue(undefined);
    const scheduler = new DeliveryAckScheduler(send);
    scheduler.enqueue([message("retry-1")], "self");
    await scheduler.flush();

    await scheduler.flush();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toEqual(["retry-1"]);
    expect(send.mock.calls[1][0]).toEqual(["retry-1"]);
  });

  it("旧账号挂起请求不阻塞新账号的独立调度", async () => {
    const first = new Promise<void>(() => undefined);
    const second = Promise.resolve();
    const send = vi.fn().mockImplementationOnce(() => first).mockImplementationOnce(() => second);
    const scheduler = new DeliveryAckScheduler(send);
    scheduler.enqueue([message("old-1")], "old");
    const oldFlush = scheduler.flush();
    await Promise.resolve();
    scheduler.stop("old");

    scheduler.enqueue([message("new-1")], "new");
    await scheduler.flush();
    await Promise.resolve();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual(["new-1"]);
    void oldFlush;
  });
});

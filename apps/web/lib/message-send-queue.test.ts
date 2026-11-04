import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { MessageSendQueue, type SendMessageInput } from "@/lib/message-send-queue";
import type { Message } from "@/lib/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function message(id: string, channelId: string, clientMsgId: string): Message {
  return { id, channel_id: channelId, sender_id: "teacher-1", sender_name: "教师", client_msg_id: clientMsgId, type: "text", content: "内容", metadata: {}, is_pinned: false, created_at: "2026-11-04T12:00:00Z", delivery_count: 0, read_count: 0 };
}

const input = (content: string): SendMessageInput => ({ type: "text", content });

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("MessageSendQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("同通道严格串行，不同通道可以并行", async () => {
    const first = deferred<Message>();
    const other = deferred<Message>();
    const second = deferred<Message>();
    const send = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => other.promise)
      .mockImplementationOnce(() => second.promise);
    let sequence = 0;
    const queue = new MessageSendQueue({ send, createId: () => `id-${++sequence}` });
    queue.enqueue("ch-1", input("一"));
    queue.enqueue("ch-1", input("二"));
    queue.enqueue("ch-2", input("其他通道"));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][2]).toBe("id-1");
    expect(send.mock.calls[1][2]).toBe("id-3");

    first.resolve(message("10", "ch-1", "id-1"));
    await flushPromises();
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2][2]).toBe("id-2");
    other.resolve(message("11", "ch-2", "id-3"));
    second.resolve(message("12", "ch-1", "id-2"));
    await flushPromises();
    expect(queue.getItems()).toHaveLength(0);
  });

  it("暂停期间只入队，恢复后按原顺序发送", () => {
    const send = vi.fn((_channelId: string, _input: SendMessageInput, _clientMsgId: string) => new Promise<Message>(() => undefined));
    let sequence = 0;
    const queue = new MessageSendQueue({ send, createId: () => `paused-${++sequence}` });
    queue.setPaused(true);
    queue.enqueue("ch-1", input("一"));
    queue.enqueue("ch-1", input("二"));
    expect(send).not.toHaveBeenCalled();
    queue.setPaused(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].content).toBe("一");
  });

  it("4xx 保留失败项且不自动重试，手动重试复用原 UUID", async () => {
    const failure = deferred<Message>();
    const success = deferred<Message>();
    const send = vi.fn().mockImplementationOnce(() => failure.promise).mockImplementationOnce(() => success.promise);
    const queue = new MessageSendQueue({ send, createId: () => "stable-uuid" });
    queue.enqueue("ch-1", input("非法请求"));
    failure.reject(new ApiError("正文无效", 422, "CONTENT_INVALID"));
    await flushPromises();
    expect(queue.getItems()[0]).toMatchObject({ state: "failed", retryable: false, client_msg_id: "stable-uuid" });
    queue.setPaused(true);
    queue.setPaused(false);
    expect(send).toHaveBeenCalledTimes(1);

    queue.retry("stable-uuid");
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][2]).toBe("stable-uuid");
    success.resolve(message("10", "ch-1", "stable-uuid"));
    await flushPromises();
    expect(queue.getItems()).toHaveLength(0);
  });

  it("网络错误在连接恢复后自动重试且复用 UUID", async () => {
    const failure = deferred<Message>();
    const success = deferred<Message>();
    const send = vi.fn().mockImplementationOnce(() => failure.promise).mockImplementationOnce(() => success.promise);
    const queue = new MessageSendQueue({ send, createId: () => "network-uuid" });
    queue.enqueue("ch-1", input("断线消息"));
    failure.reject(new ApiError("网络断开", 0, "NETWORK_ERROR"));
    await flushPromises();
    expect(queue.getItems()[0]).toMatchObject({ state: "failed", retryable: true });
    queue.setPaused(true);
    queue.setPaused(false);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][2]).toBe("network-uuid");
    success.resolve(message("10", "ch-1", "network-uuid"));
    await flushPromises();
    expect(queue.getItems()).toHaveLength(0);
  });

  it("100ms 内多次入队只通知一次订阅者", () => {
    const send = vi.fn(() => new Promise<Message>(() => undefined));
    const queue = new MessageSendQueue({ send, createId: () => crypto.randomUUID() });
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.enqueue("ch-1", input("一"));
    queue.enqueue("ch-1", input("二"));
    queue.enqueue("ch-1", input("三"));
    vi.advanceTimersByTime(99);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toHaveLength(3);
  });
});

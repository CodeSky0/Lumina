// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageItem } from "@/components/teacher/message-item";
import type { Message } from "@/lib/types";

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
  readonly unobserve = vi.fn();
  readonly takeRecords = vi.fn(() => []);
  constructor(readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }
  intersect() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const message: Message = {
  id: "m1", channel_id: "ch1", sender_id: "teacher", sender_name: "教师", type: "text",
  content: "已读测试", metadata: {}, is_pinned: false, created_at: "2026-10-31T12:00:00Z", read_count: 0,
};

afterEach(() => {
  cleanup();
  MockIntersectionObserver.instances = [];
  vi.unstubAllGlobals();
});

describe("消息已读请求时序", () => {
  it("请求失败不标记完成，后续进入视口可以重试并成功停止观察", async () => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    const onRead = vi.fn().mockRejectedValueOnce(new Error("网络失败")).mockResolvedValueOnce(undefined);
    render(<QueryClientProvider client={new QueryClient()}><MessageItem message={message} currentUserId="classroom" onRead={onRead} /></QueryClientProvider>);
    const observer = MockIntersectionObserver.instances[0];

    await act(async () => observer.intersect());
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(1));
    expect(observer.disconnect).not.toHaveBeenCalled();

    await act(async () => observer.intersect());
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(2));
    expect(observer.disconnect).toHaveBeenCalled();
  });
});

describe("逐条消息发送状态", () => {
  it("按持久化和回执数据显示已发送、已送达和已读", () => {
    const client = new QueryClient();
    const own = { ...message, sender_id: "teacher", delivery_count: 0, read_count: 0 };
    const view = render(<QueryClientProvider client={client}><MessageItem message={own} currentUserId="teacher" onRead={vi.fn()} /></QueryClientProvider>);
    expect(screen.getByText("已发送")).toBeTruthy();
    view.rerender(<QueryClientProvider client={client}><MessageItem message={{ ...own, delivery_count: 1 }} currentUserId="teacher" onRead={vi.fn()} /></QueryClientProvider>);
    expect(screen.getByText("已送达")).toBeTruthy();
    view.rerender(<QueryClientProvider client={client}><MessageItem message={{ ...own, delivery_count: 1, read_count: 1 }} currentUserId="teacher" onRead={vi.fn()} /></QueryClientProvider>);
    expect(screen.getByText("1 人已读")).toBeTruthy();
  });

  it("失败消息使用原客户端 UUID 重试", () => {
    const onRetry = vi.fn();
    const failed: Message = { ...message, id: "local-stable-id", client_msg_id: "stable-id", sender_id: "teacher", delivery_state: "failed", retryable: true, error: "网络中断" };
    render(<QueryClientProvider client={new QueryClient()}><MessageItem message={failed} currentUserId="teacher" onRead={vi.fn()} onRetry={onRetry} /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "发送失败，重试：网络中断" }));
    expect(onRetry).toHaveBeenCalledWith("stable-id");
  });
});

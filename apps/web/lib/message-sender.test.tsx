// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { combineQueuedMessages, MessageSendProvider, useMessageSender, useQueuedMessages } from "@/lib/message-sender";
import type { Message } from "@/lib/types";
import { useRealtimeStore } from "@/stores/realtime";
import { useSessionStore } from "@/stores/session";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const message = (id: string, clientMsgId?: string): Message => ({ id, client_msg_id: clientMsgId, channel_id: "ch-1", sender_id: "teacher-1", sender_name: "教师", type: "text", content: "消息", metadata: {}, is_pinned: false, created_at: "2026-11-04T12:00:00Z", delivery_count: 0, read_count: 0 });

afterEach(() => {
  cleanup();
  useSessionStore.getState().clearSession();
  useRealtimeStore.getState().setStatus("idle");
  useRealtimeStore.getState().setSyncing(false);
  vi.mocked(apiFetch).mockReset();
});

describe("消息发送 Provider", () => {
  it("服务端消息与本地项按 client_msg_id 去重，未确认项保留在后", () => {
    const combined = combineQueuedMessages([message("10", "same"), message("11")], [message("local-same", "same"), message("local-new", "new")]);
    expect(combined.map((item) => item.id)).toEqual(["10", "11", "local-new"]);
  });

  it("本地队列映射为气泡并注册 beforeunload 提醒", async () => {
    vi.useFakeTimers();
    useSessionStore.getState().setSession({ access_token: "token", expires_at: "2026-11-05T12:00:00Z", user: { id: "teacher-1", username: "teacher", display_name: "教师", role: "teacher" } });
    useRealtimeStore.getState().setStatus("connected");
    vi.mocked(apiFetch).mockReturnValue(new Promise<Message>(() => undefined));
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><MessageSendProvider>{children}</MessageSendProvider></QueryClientProvider>;
    const { result } = renderHook(() => ({ sender: useMessageSender(), queued: useQueuedMessages("ch-1") }), { wrapper });
    act(() => { result.current.sender.enqueue("ch-1", { type: "text", content: "待发消息" }); });
    act(() => { vi.advanceTimersByTime(100); });

    expect(result.current.queued).toHaveLength(1);
    expect(result.current.queued[0]).toMatchObject({ id: "local-" + result.current.queued[0].client_msg_id, content: "待发消息", delivery_state: "sending" });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    vi.useRealTimers();
  });

  it("发送成功失效整个通道消息查询前缀", async () => {
    useSessionStore.getState().setSession({ access_token: "token", expires_at: "2026-11-05T12:00:00Z", user: { id: "teacher-1", username: "teacher", display_name: "教师", role: "teacher" } });
    useRealtimeStore.getState().setStatus("connected");
    vi.mocked(apiFetch).mockResolvedValue(message("10", "client-1"));
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><MessageSendProvider>{children}</MessageSendProvider></QueryClientProvider>;
    const { result } = renderHook(() => useMessageSender(), { wrapper });

    act(() => { result.current.enqueue("ch-1", { type: "text", content: "新消息" }); });

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["messages", "ch-1"] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["channels"] });
  });

  it("StrictMode effect 重放后队列仍可发送", async () => {
    useSessionStore.getState().setSession({ access_token: "token", expires_at: "2026-11-05T12:00:00Z", user: { id: "teacher-1", username: "teacher", display_name: "教师", role: "teacher" } });
    useRealtimeStore.getState().setStatus("connected");
    vi.mocked(apiFetch).mockResolvedValue(message("10", "strict-id"));
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><React.StrictMode><MessageSendProvider>{children}</MessageSendProvider></React.StrictMode></QueryClientProvider>;
    const { result } = renderHook(() => useMessageSender(), { wrapper });

    let id = "";
    act(() => { id = result.current.enqueue("ch-1", { type: "text", content: "StrictMode 消息" }); });

    expect(id).not.toBe("");
    await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalled());
  });
});

// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { deliveryAckScheduler } from "@/lib/delivery-ack";
import type { AuthSession, Message, RealtimeEvent } from "@/lib/types";
import { useSessionStore } from "@/stores/session";
import { useRealtimeStore } from "@/stores/realtime";

const harness = vi.hoisted(() => ({ clients: [] as Array<{ options: { onOpen: (reconnected: boolean) => void; onEvent: (event: RealtimeEvent) => void }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> }));
const syncHarness = vi.hoisted(() => ({ synchronize: vi.fn() }));

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/message-sync", () => ({ synchronizeRealtime: syncHarness.synchronize }));
vi.mock("@/lib/websocket", () => ({
  RealtimeClient: class {
    options: { onOpen: (reconnected: boolean) => void; onEvent: (event: RealtimeEvent) => void };
    start = vi.fn();
    stop = vi.fn();
    constructor(options: { onOpen: (reconnected: boolean) => void; onEvent: (event: RealtimeEvent) => void }) {
      this.options = options;
      harness.clients.push(this);
    }
  },
}));

import { RealtimeProvider } from "@/lib/realtime";

function session(userId: string, token: string): AuthSession {
  return { access_token: token, expires_at: "2026-10-31T12:00:00Z", user: { id: userId, username: userId, display_name: userId, role: "teacher" } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function message(id: string): Message {
  return { id, channel_id: "ch-1", sender_id: "other-user", sender_name: "发送人", type: "text", content: "搜索命中", metadata: {}, is_pinned: false, created_at: "2026-11-04T12:00:00Z", delivery_count: 0, read_count: 0 };
}

function event(id: string): RealtimeEvent {
  return { event_id: `event-${id}`, type: "new_message", channel_id: "ch-1", occurred_at: "2026-11-04T12:00:00Z", data: message(id) };
}

function renderProvider(queryClient: QueryClient) {
  return render(<QueryClientProvider client={queryClient}><RealtimeProvider><div /></RealtimeProvider></QueryClientProvider>);
}

function ackCalls() {
  return vi.mocked(apiFetch).mock.calls.filter(([path]) => path === "/api/v1/messages/delivery-ack");
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  syncHarness.synchronize.mockReset().mockResolvedValue(undefined);
  deliveryAckScheduler.stop();
  useRealtimeStore.getState().setSyncing(false);
});

afterEach(() => {
  cleanup();
  deliveryAckScheduler.stop();
  useSessionStore.getState().clearSession();
  harness.clients.length = 0;
  vi.useRealTimers();
});

describe("RealtimeProvider 生命周期", () => {
  it("token 刷新不重连，每次 onOpen 补同步，用户切换只重建连接", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    useSessionStore.getState().setSession(session("user-1", "token-1"));
    const view = renderProvider(queryClient);
    expect(harness.clients).toHaveLength(1);

    act(() => harness.clients[0].options.onOpen(false));
    expect(invalidate).toHaveBeenCalledTimes(1);

    act(() => useSessionStore.getState().setSession(session("user-1", "token-2")));
    expect(harness.clients).toHaveLength(1);
    expect(harness.clients[0].stop).not.toHaveBeenCalled();

    act(() => useSessionStore.getState().setSession(session("user-2", "token-3")));
    expect(harness.clients).toHaveLength(2);
    expect(harness.clients[0].stop).toHaveBeenCalledTimes(1);
    act(() => useSessionStore.getState().clearSession());
    expect(harness.clients[1].stop).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it("旧连接 synchronize 晚完成不执行 markSynced", async () => {
    const pending = deferred<void>();
    syncHarness.synchronize.mockReturnValueOnce(pending.promise);
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    useSessionStore.getState().setSession(session("user-1", "token-1"));
    renderProvider(queryClient);
    act(() => harness.clients[0].options.onOpen(false));
    const version = useRealtimeStore.getState().syncVersion;

    act(() => useSessionStore.getState().setSession(session("user-2", "token-2")));
    await act(async () => {
      pending.resolve();
      await pending.promise;
      await Promise.resolve();
    });

    expect(useRealtimeStore.getState().syncVersion).toBe(version);
    expect(harness.clients[0].stop).toHaveBeenCalledTimes(1);
  });

  it("new_message 失效消息前缀，失败 ACK 在重连后复用原标识", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("断线")).mockResolvedValue(undefined);
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    useSessionStore.getState().setSession(session("current-user", "token-1"));
    renderProvider(queryClient);
    act(() => harness.clients[0].options.onEvent(event("m-1")));
    act(() => vi.advanceTimersByTime(100));
    await act(async () => { await Promise.resolve(); });
    expect(ackCalls()).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["messages", "ch-1"] });

    act(() => harness.clients[0].options.onOpen(true));
    await act(async () => { await Promise.resolve(); });

    expect(ackCalls()).toHaveLength(2);
    expect(ackCalls()[0][1]?.body).toEqual({ message_ids: ["m-1"] });
    expect(ackCalls()[1][1]?.body).toEqual({ message_ids: ["m-1"] });
  });
});

// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/types";
import { useSessionStore } from "@/stores/session";

const harness = vi.hoisted(() => ({ clients: [] as Array<{ options: { onOpen: (reconnected: boolean) => void }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> }));

vi.mock("@/lib/websocket", () => ({
  RealtimeClient: class {
    options: { onOpen: (reconnected: boolean) => void };
    start = vi.fn();
    stop = vi.fn();
    constructor(options: { onOpen: (reconnected: boolean) => void }) {
      this.options = options;
      harness.clients.push(this);
    }
  },
}));

import { RealtimeProvider } from "@/lib/realtime";

function session(userId: string, token: string): AuthSession {
  return { access_token: token, expires_at: "2026-10-31T12:00:00Z", user: { id: userId, username: userId, display_name: userId, role: "teacher" } };
}

afterEach(() => {
  cleanup();
  useSessionStore.getState().clearSession();
  harness.clients.length = 0;
});

describe("RealtimeProvider 生命周期", () => {
  it("token 刷新不重连，每次 onOpen 补同步，用户切换只重建连接", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);
    useSessionStore.getState().setSession(session("user-1", "token-1"));
    const view = render(<QueryClientProvider client={queryClient}><RealtimeProvider><div /></RealtimeProvider></QueryClientProvider>);
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
});

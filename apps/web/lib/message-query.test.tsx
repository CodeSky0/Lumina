// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { deliveryAckScheduler } from "@/lib/delivery-ack";
import { useChannelMessages } from "@/lib/message-query";
import type { Message } from "@/lib/types";
import { useSessionStore } from "@/stores/session";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

function message(id: string, senderId: string): Message {
  return { id, channel_id: "ch-1", sender_id: senderId, sender_name: senderId, type: "text", content: "历史消息", metadata: {}, is_pinned: false, created_at: "2026-11-04T12:00:00Z", delivery_count: 0, read_count: 0 };
}

afterEach(() => {
  cleanup();
  deliveryAckScheduler.stop();
  useSessionStore.getState().clearSession();
  vi.mocked(apiFetch).mockReset();
});

describe("REST 历史消息送达确认", () => {
  it("只确认历史恢复的非本人消息", async () => {
    useSessionStore.getState().setSession({ access_token: "token", expires_at: "2026-11-05T12:00:00Z", user: { id: "self", username: "self", display_name: "本人", role: "teacher" } });
    vi.mocked(apiFetch).mockResolvedValueOnce({ items: [message("m-1", "self"), message("m-2", "other")], has_more: false }).mockResolvedValue(undefined);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useChannelMessages("ch-1", "历史"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/v1/messages/delivery-ack", { method: "POST", body: { message_ids: ["m-2"] } }));
    expect(vi.mocked(apiFetch).mock.calls.filter(([path]) => path === "/api/v1/messages/delivery-ack")).toHaveLength(1);
  });
});

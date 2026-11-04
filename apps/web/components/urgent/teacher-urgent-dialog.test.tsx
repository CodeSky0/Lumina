// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import type { Message } from "@/lib/types";
import { useSessionStore } from "@/stores/session";
import { useRealtimeStore } from "@/stores/realtime";
import { TeacherUrgentDialog } from "@/components/urgent/teacher-urgent-dialog";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const urgent: Message = {
  id: "m-urgent", channel_id: "ch-1", channel_name: "高一（01）班", sender_id: "teacher-2", sender_name: "教师乙",
  type: "urgent", content: "请立即锁定教室门窗", metadata: {}, is_pinned: false,
  created_at: "2026-11-04T12:00:00Z", delivery_count: 0, read_count: 0,
};

afterEach(() => {
  cleanup();
  useSessionStore.getState().clearSession();
  useRealtimeStore.getState().requestChannel(undefined);
  vi.mocked(apiFetch).mockReset();
});

describe("教师端全局紧急通知", () => {
  it("展示消息并跳转通道，但不伪造教室确认", async () => {
    useSessionStore.getState().setSession({ access_token: "token", expires_at: "2026-11-05T12:00:00Z", user: { id: "teacher-1", username: "teacher-1", display_name: "教师甲", role: "teacher" } });
    vi.mocked(apiFetch).mockResolvedValue({ messages: [urgent], announcements: [] });
    render(<QueryClientProvider client={new QueryClient()}><TeacherUrgentDialog /></QueryClientProvider>);

    expect(await screen.findByText("请立即锁定教室门窗")).toBeTruthy();
    expect(screen.getByText("目标班级：高一（01）班")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "查看对应通道" }));

    expect(useRealtimeStore.getState().requestedChannelId).toBe("ch-1");
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/teacher/urgent-pending");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

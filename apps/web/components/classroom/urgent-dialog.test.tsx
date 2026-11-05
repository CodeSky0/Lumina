// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import type { Announcement, Message } from "@/lib/types";

const audioHarness = vi.hoisted(() => ({ useUrgentAudio: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("@/components/classroom/use-urgent-audio", () => ({ useUrgentAudio: audioHarness.useUrgentAudio }));

import { normalizePending, UrgentDialog } from "@/components/classroom/urgent-dialog";

const announcement: Announcement = {
  id: "a1", title: "校舍火警", content: "立即疏散", type: "urgent", scope: "school",
  publisher_id: "admin", publisher_name: "管理员", created_at: "2026-10-31T12:00:00Z",
};

const urgentMessage: Message = {
  id: "shared", channel_id: "ch-1", sender_id: "teacher", sender_name: "教师", type: "urgent", content: "立即锁定门窗",
  metadata: {}, is_pinned: false, created_at: "2026-10-31T12:00:00Z", delivery_count: 0, read_count: 0,
};

beforeEach(() => {
  audioHarness.useUrgentAudio.mockImplementation(() => ({ unlocked: true, unlock: vi.fn(), error: "" }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(apiFetch).mockReset();
  audioHarness.useUrgentAudio.mockReset();
});

describe("紧急公告阻断与 DTO", () => {
  it("初次接口错误显示不可关闭的重试对话框，成功后展示真实标题和发布人", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("初次加载失败")).mockResolvedValueOnce({ messages: [], announcements: [announcement] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><UrgentDialog /></QueryClientProvider>);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("紧急公告加载失败")).toBeTruthy();
    expect(screen.getByText("初次加载失败")).toBeTruthy();
    expect(screen.queryByLabelText("关闭对话框")).toBeNull();

    await userEvent.setup().click(screen.getByRole("button", { name: "重试加载紧急信息" }));
    expect(await screen.findByText("校舍火警")).toBeTruthy();
    expect(screen.getByText("来自 管理员")).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("紧急弹窗使用公告 title 与 publisher_name", () => {
    expect(normalizePending([announcement])).toEqual([{ id: "a1", kind: "announcement", title: "校舍火警", content: "立即疏散", sender: "管理员" }]);
  });

  it("30 秒未确认后加强提醒，弹窗全屏且确认按钮至少 64px", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockResolvedValue({ messages: [], announcements: [announcement] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><UrgentDialog /></QueryClientProvider>);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("校舍火警")).toBeTruthy();

    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByRole("alert").textContent).toContain("超过 30 秒");
    expect(screen.getByRole("dialog").className).toContain("h-[100dvh]");
    expect(screen.getByRole("button", { name: "我已阅读并确认" }).className).toContain("min-h-16");
  });

  it("消息与公告同 ID 时音频键和 30 秒计时仍按 kind 隔离", async () => {
    vi.useFakeTimers();
    vi.mocked(apiFetch).mockResolvedValue({ messages: [urgentMessage], announcements: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><UrgentDialog /></QueryClientProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText("立即锁定门窗")).toBeTruthy();
    expect(audioHarness.useUrgentAudio).toHaveBeenCalledWith("message:shared");

    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.queryByText(/超过 30 秒/)).toBeNull();
    await act(async () => {
      client.setQueryData(["urgent-pending"], normalizePending({ messages: [], announcements: [{ ...announcement, id: "shared" }] }));
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();
    });
    expect(screen.getByText("立即疏散")).toBeTruthy();
    expect(audioHarness.useUrgentAudio).toHaveBeenCalledWith("announcement:shared");

    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.queryByText(/超过 30 秒/)).toBeNull();
    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByText(/超过 30 秒/)).toBeTruthy();
  });
});

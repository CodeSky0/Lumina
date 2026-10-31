// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import type { Announcement } from "@/lib/types";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("@/components/classroom/use-urgent-audio", () => ({ useUrgentAudio: () => ({ unlocked: true, unlock: vi.fn(), error: "" }) }));

import { normalizePending, UrgentDialog } from "@/components/classroom/urgent-dialog";

const announcement: Announcement = {
  id: "a1", title: "校舍火警", content: "立即疏散", type: "urgent", scope: "school",
  publisher_id: "admin", publisher_name: "管理员", created_at: "2026-10-31T12:00:00Z",
};

afterEach(cleanup);

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
});

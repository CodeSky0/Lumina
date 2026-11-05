// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { ConfirmationDetails, ConfirmationStatus } from "@/components/urgent/confirmation-status";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.mocked(apiFetch).mockReset();
});

describe("紧急通知确认进度", () => {
  it("显示每个班级的已确认和未确认真实状态", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [
      { user_id: "room-1", class_id: "class-1", class_name: "高一（01）班", confirmed: true, confirmed_at: "2026-11-04T12:00:00Z" },
      { user_id: "room-2", class_id: "class-2", class_name: "高一（02）班", confirmed: false },
    ] });
    render(<QueryClientProvider client={new QueryClient()}><ConfirmationStatus kind="announcement" id="a-1" /></QueryClientProvider>);
    expect(await screen.findByText("已确认 1 / 2 个班级")).toBeTruthy();
    expect(screen.getByText("高一（01）班")).toBeTruthy();
    expect(screen.getByText("高一（02）班")).toBeTruthy();
    expect(screen.getByText("未确认")).toBeTruthy();
    expect(screen.getByText(/已确认 11\/04/)).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/announcements/a-1/confirmations");
  });

  it("50 个折叠详情不请求，只有展开项挂载查询", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [] });
    const client = new QueryClient();
    render(<QueryClientProvider client={client}>{Array.from({ length: 50 }, (_, index) => <ConfirmationDetails key={index} kind="announcement" id={`a-${index}`} summary={`确认状态 ${index}`} />)}</QueryClientProvider>);
    expect(apiFetch).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByText("确认状态 49"));

    expect(await screen.findByText("已确认 0 / 0 个班级")).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/announcements/a-49/confirmations");
  });
});

// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import type { Channel } from "@/lib/types";
import { BatchNoticeDialog } from "@/components/teacher/batch-notice-dialog";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

const channels: Channel[] = [{ id: "ch-1", name: "高一（01）班 · 语文", class_name: "高一（01）班", type: "normal", active: true, unread_count: 0 }];

afterEach(() => {
  cleanup();
  vi.mocked(apiFetch).mockReset();
});

describe("批量通知幂等", () => {
  it("网络失败后的再次提交复用目标 UUID，并显示成功汇总", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("网络失败")).mockResolvedValueOnce({ items: [{ channel_id: "ch-1", success: true }] });
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><BatchNoticeDialog open channels={channels} onClose={vi.fn()} /></QueryClientProvider>);
    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByLabelText("通知内容"), "停课通知");
    await user.click(screen.getByRole("button", { name: "发送到 1 个通道" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const first = vi.mocked(apiFetch).mock.calls[0][1]?.body as { targets: Array<{ client_msg_id: string }> };

    await user.click(screen.getByRole("button", { name: "发送到 1 个通道" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    const second = vi.mocked(apiFetch).mock.calls[1][1]?.body as { targets: Array<{ client_msg_id: string }> };
    expect(first.targets[0].client_msg_id).toBeTruthy();
    expect(second.targets).toEqual(first.targets);
    expect(await screen.findByText("成功 1 个，失败 0 个")).toBeTruthy();
  });
});

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
const channelPair: Channel[] = [...channels, { id: "ch-2", name: "高一（02）班 · 语文", class_name: "高一（02）班", type: "normal", active: true, unread_count: 0 }];

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
    expect(await screen.findByText("逐通道处理结果")).toBeTruthy();
    expect(await screen.findByText("成功 1 个，失败 0 个")).toBeTruthy();
  });

  it("部分成功后重试断网也不重复成功目标", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ items: [{ channel_id: "ch-1", success: true }, { channel_id: "ch-2", success: false, error: "目标不可用" }] })
      .mockRejectedValueOnce(new Error("重试断网"))
      .mockResolvedValueOnce({ items: [{ channel_id: "ch-2", success: true }] });
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><BatchNoticeDialog open channels={channelPair} onClose={vi.fn()} /></QueryClientProvider>);
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.type(screen.getByLabelText("通知内容"), "停课通知");
    await user.click(screen.getByRole("button", { name: "发送到 2 个通道" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const first = vi.mocked(apiFetch).mock.calls[0][1]?.body as { targets: Array<{ channel_id: string; client_msg_id: string }> };

    await user.click(screen.getByRole("button", { name: "重试剩余 1 个通道" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "重试剩余 1 个通道" })).toBeTruthy();
    expect(screen.getAllByRole("checkbox").every((checkbox) => (checkbox as HTMLInputElement).disabled)).toBe(true);

    await user.click(screen.getByRole("button", { name: "重试剩余 1 个通道" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3));
    const third = vi.mocked(apiFetch).mock.calls[2][1]?.body as { targets: Array<{ channel_id: string; client_msg_id: string }> };
    expect(third.targets).toEqual([{ channel_id: "ch-2", client_msg_id: first.targets[1].client_msg_id }]);
  });

  it("部分成功只重试失败目标原 UUID，全部成功后必须新建批次", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ items: [{ channel_id: "ch-1", success: true }, { channel_id: "ch-2", success: false, error: "目标不可用" }] })
      .mockResolvedValueOnce({ items: [{ channel_id: "ch-2", success: true }] })
      .mockResolvedValueOnce({ items: [{ channel_id: "ch-1", success: true }] });
    const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><BatchNoticeDialog open channels={channelPair} onClose={vi.fn()} /></QueryClientProvider>);
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await user.type(screen.getByLabelText("通知内容"), "停课通知");
    await user.click(screen.getByRole("button", { name: "发送到 2 个通道" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const first = vi.mocked(apiFetch).mock.calls[0][1]?.body as { targets: Array<{ channel_id: string; client_msg_id: string }> };
    expect(await screen.findByText("成功 1 个，失败 1 个")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "重试剩余 1 个通道" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    const second = vi.mocked(apiFetch).mock.calls[1][1]?.body as { targets: Array<{ channel_id: string; client_msg_id: string }> };
    expect(second.targets).toEqual([{ channel_id: "ch-2", client_msg_id: first.targets[1].client_msg_id }]);
    expect(second.targets.some((target) => target.channel_id === "ch-1")).toBe(false);

    expect(await screen.findByRole("button", { name: "新建批次" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /发送到|重试剩余/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "新建批次" }));
    expect(apiFetch).toHaveBeenCalledTimes(2);

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.type(screen.getByLabelText("通知内容"), "新批次通知");
    await user.click(screen.getByRole("button", { name: "发送到 1 个通道" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3));
    const third = vi.mocked(apiFetch).mock.calls[2][1]?.body as { targets: Array<{ channel_id: string; client_msg_id: string }> };
    expect(third.targets[0].channel_id).toBe("ch-1");
    expect(third.targets[0].client_msg_id).not.toBe(first.targets[0].client_msg_id);
  });
});

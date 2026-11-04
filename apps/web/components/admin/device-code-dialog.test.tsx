// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

import { DeviceCodeDialog } from "@/components/admin/device-code-dialog";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("班级设备码轮换", () => {
  it("仅当次显示并可复制，关闭重开后不保留也不持久化", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ code: "DEVICE-ONLY-ONCE", notice: "设备码仅显示一次，旧设备码已失效" });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const client = new QueryClient();
    const onClose = vi.fn();
    const view = render(<QueryClientProvider client={client}><DeviceCodeDialog open record={{ id: "c1", name: "一班" }} onClose={onClose} /></QueryClientProvider>);

    await user.click(screen.getByRole("button", { name: "确认轮换" }));
    expect(await screen.findByText("DEVICE-ONLY-ONCE")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "复制设备码" }));
    expect(writeText).toHaveBeenCalledWith("DEVICE-ONLY-ONCE");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    view.rerender(<QueryClientProvider client={client}><DeviceCodeDialog open={false} record={{ id: "c1", name: "一班" }} onClose={onClose} /></QueryClientProvider>);
    view.rerender(<QueryClientProvider client={client}><DeviceCodeDialog open record={{ id: "c1", name: "一班" }} onClose={onClose} /></QueryClientProvider>);
    expect(screen.queryByText("DEVICE-ONLY-ONCE")).toBeNull();
  });
});

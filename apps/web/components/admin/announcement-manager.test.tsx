// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import type { Announcement } from "@/lib/types";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("@/components/admin/use-admin-lookups", () => ({
  useAdminLookups: () => ({
    classes: [{ id: "c1", name: "一班", grade: 3, active: true }], teachers: [], subjects: [], channels: [],
    isPending: false, error: undefined, refetch: vi.fn(),
  }),
}));

import { AnnouncementManager } from "@/components/admin/announcement-manager";

const announcement: Announcement = {
  id: "a1", title: "已有公告", content: "内容", type: "notice", scope: "school",
  publisher_id: "admin", publisher_name: "发布管理员", created_at: "2026-10-31T12:00:00Z",
};

beforeEach(() => {
  vi.mocked(apiFetch).mockResolvedValue({ items: [announcement], total: 1, page: 1, size: 50, total_pages: 1 });
});
afterEach(cleanup);

function renderManager() {
  return render(<QueryClientProvider client={new QueryClient()}><AnnouncementManager /></QueryClientProvider>);
}

describe("公告管理 DTO", () => {
  it("响应展示 publisher_name，年级范围提交 number grade", async () => {
    const user = userEvent.setup();
    renderManager();
    expect(await screen.findByText("发布人：发布管理员")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "发布公告" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("公告标题"), { target: { value: "年级通知" } });
    fireEvent.change(within(dialog).getByLabelText("公告内容"), { target: { value: "请注意" } });
    await user.selectOptions(within(dialog).getByLabelText("发布范围"), "grade");
    await user.type(within(dialog).getByLabelText("目标年级"), "4");
    await user.click(within(dialog).getByRole("button", { name: "发布公告" }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/v1/announcements", expect.objectContaining({ method: "POST" })));
    const call = vi.mocked(apiFetch).mock.calls.find(([, options]) => options?.method === "POST");
    expect(call?.[1]?.body).toEqual({ title: "年级通知", content: "请注意", type: "notice", scope: "grade", grade: 4 });
  });

  it("班级范围提交 target_class_id", async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByText("发布人：发布管理员");
    await user.click(screen.getByRole("button", { name: "发布公告" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("公告标题"), { target: { value: "班级通知" } });
    fireEvent.change(within(dialog).getByLabelText("公告内容"), { target: { value: "请注意" } });
    await user.selectOptions(within(dialog).getByLabelText("发布范围"), "class");
    await user.selectOptions(within(dialog).getByLabelText("目标班级"), "c1");
    await user.click(within(dialog).getByRole("button", { name: "发布公告" }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/v1/announcements", expect.objectContaining({ method: "POST" })));
    const call = vi.mocked(apiFetch).mock.calls.find(([, options]) => options?.method === "POST");
    expect(call?.[1]?.body).toEqual({ title: "班级通知", content: "请注意", type: "notice", scope: "class", target_class_id: "c1" });
  });
});

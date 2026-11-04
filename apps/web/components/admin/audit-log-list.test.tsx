// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

import { AuditLogList } from "@/components/admin/audit-log-list";

afterEach(cleanup);

describe("审计日志 DTO", () => {
  it("展示 ip_address 与 details，并以 size 请求分页", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ items: [{ id: "log1", actor_name: "管理员", action: "class.update", resource_type: "class", resource_id: "c1", ip_address: "203.0.113.8", details: { grade: 3 }, created_at: "2026-10-31T12:00:00Z" }], total: 1, total_pages: 1 });
    render(<QueryClientProvider client={new QueryClient()}><AuditLogList /></QueryClientProvider>);
    expect(await screen.findByText("203.0.113.8")).toBeTruthy();
    expect(document.querySelector("pre")?.textContent).toContain('"grade": 3');
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/admin/audit-logs?page=1&size=50");
  });
});

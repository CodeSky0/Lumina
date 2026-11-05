// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session";

vi.mock("@/components/classroom/urgent-dialog", () => ({ UrgentDialog: () => <div>教室全局紧急弹窗</div> }));
vi.mock("@/components/urgent/teacher-urgent-dialog", () => ({ TeacherUrgentDialog: () => <div>教师全局紧急弹窗</div> }));

import { GlobalUrgentHost } from "@/components/urgent/global-urgent-host";

afterEach(() => {
  cleanup();
  useSessionStore.getState().clearSession();
});

describe("GlobalUrgentHost", () => {
  it("教室角色使用全局教室弹窗", () => {
    useSessionStore.getState().setSession({ access_token: "token", expires_at: "2026-11-05T12:00:00Z", user: { id: "room", username: "room", display_name: "教室", role: "classroom" } });
    render(<GlobalUrgentHost />);
    expect(screen.getByText("教室全局紧急弹窗")).toBeTruthy();
    expect(screen.queryByText("教师全局紧急弹窗")).toBeNull();
  });

  it("教师角色保留原教师全局弹窗", () => {
    useSessionStore.getState().setSession({ access_token: "token", expires_at: "2026-11-05T12:00:00Z", user: { id: "teacher", username: "teacher", display_name: "教师", role: "teacher" } });
    render(<GlobalUrgentHost />);
    expect(screen.getByText("教师全局紧急弹窗")).toBeTruthy();
    expect(screen.queryByText("教室全局紧急弹窗")).toBeNull();
  });
});

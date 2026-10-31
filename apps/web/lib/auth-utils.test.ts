import { describe, expect, it } from "vitest";
import { canAccessRole, destinationForRole, isTwoMinuteRecallWindow } from "@/lib/auth-utils";

 describe("角色路由与权限守卫", () => {
  it("每种角色只进入自己的工作区", () => {
    expect(destinationForRole("admin")).toBe("/admin");
    expect(destinationForRole("teacher")).toBe("/teacher");
    expect(destinationForRole("classroom")).toBe("/classroom");
    expect(canAccessRole("teacher", "teacher")).toBe(true);
    expect(canAccessRole("teacher", "admin")).toBe(false);
    expect(canAccessRole("classroom", "teacher")).toBe(false);
    expect(canAccessRole(undefined, "admin")).toBe(false);
  });
});

describe("两分钟撤回窗口", () => {
  const createdAt = "2026-10-30T12:00:00.000Z";
  const created = new Date(createdAt).getTime();
  it("接受窗口边界内的撤回并拒绝超时与无效时间", () => {
    expect(isTwoMinuteRecallWindow(createdAt, created)).toBe(true);
    expect(isTwoMinuteRecallWindow(createdAt, created + 120_000)).toBe(true);
    expect(isTwoMinuteRecallWindow(createdAt, created + 120_001)).toBe(false);
    expect(isTwoMinuteRecallWindow("invalid", created)).toBe(false);
  });
});

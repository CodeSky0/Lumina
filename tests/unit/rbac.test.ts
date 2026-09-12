import { describe, it, expect } from "vitest";
import { ForbiddenError, AuthError, requireRole } from "@/lib/rbac";
import type { UserRole } from "@/lib/db/schema";

describe("ForbiddenError", () => {
  it("has code FORBIDDEN and custom message", () => {
    const err = new ForbiddenError("无权访问");
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("无权访问");
    expect(err.name).toBe("ForbiddenError");
  });

  it("is an instance of Error", () => {
    const err = new ForbiddenError("test");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("AuthError", () => {
  it("has code UNAUTHORIZED and default message", () => {
    const err = new AuthError();
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("未登录");
    expect(err.name).toBe("AuthError");
  });

  it("accepts custom message", () => {
    const err = new AuthError("会话过期");
    expect(err.message).toBe("会话过期");
  });

  it("is an instance of Error", () => {
    const err = new AuthError();
    expect(err).toBeInstanceOf(Error);
  });
});

describe("requireRole", () => {
  it("does not throw when role matches", () => {
    expect(() => requireRole("teacher" as UserRole, "teacher")).not.toThrow();
    expect(() => requireRole("parent" as UserRole, "parent")).not.toThrow();
    expect(() => requireRole("classroom" as UserRole, "classroom")).not.toThrow();
    expect(() => requireRole("admin" as UserRole, "admin")).not.toThrow();
  });

  it("throws ForbiddenError when role does not match", () => {
    expect(() => requireRole("parent" as UserRole, "teacher")).toThrow(ForbiddenError);
    expect(() => requireRole("teacher" as UserRole, "admin")).toThrow(ForbiddenError);
    expect(() => requireRole("classroom" as UserRole, "parent")).toThrow(ForbiddenError);
  });

  it("error message includes expected and actual roles", () => {
    try {
      requireRole("parent" as UserRole, "teacher");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).message).toContain("teacher");
      expect((err as ForbiddenError).message).toContain("parent");
    }
  });
});

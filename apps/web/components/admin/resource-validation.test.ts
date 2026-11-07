import { describe, expect, it } from "vitest";
import { buildResourceBody, initialValues, validateResource } from "@/components/admin/resource-form";
import { RESOURCE_CONFIGS } from "@/components/admin/resource-config";

describe("管理资源表单真实 DTO", () => {
  it("班级新增提交数字年级和教室凭据，编辑数字回显且不重复提交凭据", () => {
    const create = { name: " 一班 ", grade: "3", classroom_username: " room-1 ", classroom_password: "Classroom@2026", active: true };
    expect(validateResource("classes", create, false)).toBeNull();
    expect(buildResourceBody("classes", create, false)).toEqual({ name: "一班", grade: 3, classroom_username: "room-1", classroom_password: "Classroom@2026", active: true });
    expect(initialValues("classes", { id: "c1", grade: 3 })).toMatchObject({ grade: "3" });
    expect(initialValues("classes", { id: "c1", grade: 3 })).not.toHaveProperty("classroom_password");
    expect(buildResourceBody("classes", { ...create, classroom_password: "" }, true)).toEqual({ name: "一班", grade: 3, active: true });
  });

  it("班级必填和年级范围校验不被绕过", () => {
    expect(validateResource("classes", { name: "", grade: "3", classroom_username: "room", classroom_password: "Classroom@2026", active: true }, false)).toBe("请填写班级名称");
    expect(validateResource("classes", { name: "一班", grade: "高一", classroom_username: "room", classroom_password: "Classroom@2026", active: true }, false)).toContain("1–12");
  });

  it("教师新建需要科目与密码，编辑允许留空密码并使用 active", () => {
    const base = { username: "teacher", display_name: "教师", subject_id: "subject-1", password: "", active: true };
    expect(validateResource("teachers", base, false)).toBe("请填写登录密码");
    expect(validateResource("teachers", { username: "teacher", display_name: "教师", password: "a-secure-password", active: true }, false)).toBe("请填写教授科目");
    expect(validateResource("teachers", base, true)).toBeNull();
    expect(buildResourceBody("teachers", base, true)).toEqual({ username: "teacher", display_name: "教师", subject_id: "subject-1", active: true });
  });

  it("科目 icon 必填", () => {
    expect(validateResource("subjects", { name: "数学", icon: "", color: "#6366f1", active: true }, false)).toBe("请填写图标标识");
    expect(validateResource("subjects", { name: "数学", icon: "math", color: "#6366f1", active: true }, false)).toBeNull();
  });

  it("通道只提交广播 DTO，按范围保留数字年级或目标班级", () => {
    expect(RESOURCE_CONFIGS.channels.fields.map((field) => field.name)).toEqual(["name", "scope", "grade", "target_class_id", "active"]);
    expect(RESOURCE_CONFIGS.channels.columns.some((column) => column.key === "online")).toBe(false);
    expect(buildResourceBody("channels", { name: "年级广播", scope: "grade", grade: "2", target_class_id: "", active: true }, false)).toEqual({ name: "年级广播", scope: "grade", grade: 2, active: true });
    expect(buildResourceBody("channels", { name: "班级广播", scope: "class", grade: "", target_class_id: "c1", active: false }, false)).toEqual({ name: "班级广播", scope: "class", target_class_id: "c1", active: false });
    expect(validateResource("channels", { name: "全校广播", scope: "school", grade: "", target_class_id: "", active: true }, false)).toBeNull();
  });
});

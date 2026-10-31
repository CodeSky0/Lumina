import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourceForm } from "@/components/admin/resource-form";

describe("班级表单渲染", () => {
  it("编辑时回显数字年级并隐藏仅新增凭据", () => {
    const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ResourceForm kind="classes" open record={{ id: "class-1", name: "一班", grade: 3, classroom_username: "room-1" }} lookups={{ classes: [], teachers: [], subjects: [], channels: [] } as never} onClose={() => undefined} /></QueryClientProvider>);
    const grade = html.match(/<input[^>]*id="resource-grade"[^>]*>/)?.[0] ?? "";
    expect(grade).toContain('type="number"');
    expect(grade).toContain('value="3"');
    expect(html).not.toContain('id="resource-classroom_username"');
    expect(html).not.toContain('id="resource-classroom_password"');
  });

  it("新增时包含教室账号与密码", () => {
    const html = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ResourceForm kind="classes" open lookups={{ classes: [], teachers: [], subjects: [], channels: [] } as never} onClose={() => undefined} /></QueryClientProvider>);
    expect(html).toContain('id="resource-classroom_username"');
    expect(html).toContain('id="resource-classroom_password"');
  });
});

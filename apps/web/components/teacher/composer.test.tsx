// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Channel } from "@/lib/types";
import { Composer } from "@/components/teacher/composer";

const channel: Channel = { id: "ch-1", name: "高一（01）班 · 语文 · 教师001", type: "normal", active: true, unread_count: 0, online: false };

describe("教室大屏回复编辑器", () => {
  it("仅提供普通文本并使用触控尺寸", () => {
    render(<QueryClientProvider client={new QueryClient()}><Composer channel={channel} allowedTypes={["text"]} large onCancelReply={vi.fn()} /></QueryClientProvider>);
    expect(screen.queryByRole("button", { name: "紧急" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "消息内容" }).className).toContain("text-lg");
    expect(screen.getByRole("button", { name: "发送" }).className).toContain("min-h-14");
    expect(screen.getByRole("button", { name: "图片" }).className).toContain("min-h-14");
  });
});

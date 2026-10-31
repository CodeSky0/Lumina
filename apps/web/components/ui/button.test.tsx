import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("触控按钮", () => {
  it("touchIcon 的最小触控区域为 48px", () => {
    const html = renderToStaticMarkup(<Button size="touchIcon" aria-label="触控图标">+</Button>);
    expect(html).toContain("h-12");
    expect(html).toContain("min-h-12");
    expect(html).toContain("w-12");
  });
});

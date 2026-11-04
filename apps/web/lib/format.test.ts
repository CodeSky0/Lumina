import { describe, expect, it } from "vitest";
import { formatFileSize, readableKey } from "@/lib/format";
import { extractItems, isSafeHexColor } from "@/lib/utils";

 describe("格式化与列表契约兼容", () => {
  it("解析数组和 items 分页列表", () => {
    expect(extractItems([{ id: "1" }])).toEqual([{ id: "1" }]);
    expect(extractItems({ items: [{ id: "2" }], total: 1 })).toEqual([{ id: "2" }]);
    expect(extractItems({ total: 0 })).toEqual([]);
  });

  it("只接受安全的六位颜色值并格式化文件大小", () => {
    expect(isSafeHexColor("#6366f1")).toBe(true);
    expect(isSafeHexColor("url(javascript:alert(1))")).toBe(false);
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("真实 dashboard 与设置键均有中文映射", () => {
    const keys = ["classes", "teachers", "classrooms", "subjects", "assignments", "channels", "messages", "announcements", "message_retention_days", "announcement_default_type", "maintenance_mode", "uploads_enabled"];
    for (const key of keys) expect(readableKey(key)).not.toBe(key);
    expect(readableKey("announcement_default_type")).toBe("默认公告类型");
    expect(readableKey("maintenance_mode")).toBe("维护模式");
  });
});

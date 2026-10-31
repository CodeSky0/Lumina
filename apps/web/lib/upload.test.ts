import { describe, expect, it } from "vitest";
import { uploadMessageFields } from "@/lib/upload";
import type { BatchNoticeResult, Upload } from "@/lib/types";

describe("上传与批量结果 DTO", () => {
  it("消息附件读取上传响应的 mime", () => {
    const upload: Upload = { id: "f1", original_name: "资料.txt", mime: "text/plain", size: 12, kind: "file" };
    const file = new File(["hello"], "本地.txt", { type: "application/octet-stream" });
    expect(uploadMessageFields(upload, file)).toEqual({ fileName: "资料.txt", metadata: { file_id: "f1", file_name: "资料.txt", mime_type: "text/plain", size: 12 } });
  });

  it("批量结果的 message 保留 Message 对象", () => {
    const result: BatchNoticeResult = { channel_id: "ch1", success: true, message: { id: "m1", channel_id: "ch1", sender_id: "t1", sender_name: "教师", type: "notice", content: "通知", metadata: {}, is_pinned: false, created_at: "2026-10-31T12:00:00Z", read_count: 0 } };
    expect(result.message?.content).toBe("通知");
  });
});

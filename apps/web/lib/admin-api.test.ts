import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdminPage, fetchAllAdminPages, normalizeAdminPage } from "@/lib/admin-api";
import { LOOKUP_PAGE_SIZES } from "@/components/admin/use-admin-lookups";

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("管理分页契约", () => {
  it("使用 size 参数并以 total_pages 判定页数", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ items: [{ id: "1" }], total: 99, page: 2, size: 50, total_pages: 4 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchAdminPage("/api/v1/admin/teachers", 2, 50)).resolves.toMatchObject({ totalPages: 4 });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admin/teachers?page=2&size=50");
    expect(normalizeAdminPage({ items: [], total: 500, total_pages: 3 }).totalPages).toBe(3);
  });

  it("lookup 按 total_pages 取全后续页而非截断", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ items: [{ id: "1" }], total: 3, total_pages: 3 }))
      .mockResolvedValueOnce(response({ items: [{ id: "2" }], total: 3, total_pages: 3 }))
      .mockResolvedValueOnce(response({ items: [{ id: "3" }], total: 3, total_pages: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchAllAdminPages<{ id: string }>("/api/v1/admin/classes", 20)).resolves.toEqual([{ id: "1" }, { id: "2" }, { id: "3" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/v1/admin/classes?page=1&size=20",
      "/api/v1/admin/classes?page=2&size=20",
      "/api/v1/admin/classes?page=3&size=20",
    ]);
  });

  it("任务 lookup 使用教师 50、班级 20 及完整科目/通道分页", () => {
    expect(LOOKUP_PAGE_SIZES).toEqual({ classes: 20, teachers: 50, subjects: 50, channels: 50 });
  });
});

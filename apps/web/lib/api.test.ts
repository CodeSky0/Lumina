import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, refreshSession, resetRefreshForTests } from "@/lib/api";
import { useSessionStore } from "@/stores/session";
import type { AuthSession } from "@/lib/types";

const session: AuthSession = {
  access_token: "new-access-token",
  expires_at: "2026-10-31T12:00:00Z",
  user: { id: "u1", username: "teacher", display_name: "教师", role: "teacher" },
};

function dataResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  resetRefreshForTests();
  useSessionStore.getState().clearSession();
});
afterEach(() => vi.unstubAllGlobals());

describe("API 契约与认证", () => {
  it("解析 data 信封并携带内存 Bearer 与刷新 Cookie", async () => {
    useSessionStore.getState().setSession(session);
    const fetchMock = vi.fn().mockResolvedValue(dataResponse({ id: "channel-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch<{ id: string }>("/api/v1/channels")).resolves.toEqual({ id: "channel-1" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer new-access-token");
    expect(init.credentials).toBe("include");
  });

  it("保留统一错误码、中文信息和 request_id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "请求过于频繁", request_id: "req-42" } }), { status: 429 })));
    const error = await apiFetch("/api/v1/channels").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: "RATE_LIMITED", message: "请求过于频繁", requestId: "req-42" });
  });

  it("并发刷新共享同一个 Promise，成功后仅更新内存会话", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const first = refreshSession();
    const second = refreshSession();
    expect(first).toBe(second);
    resolveResponse(dataResponse(session));
    await expect(Promise.all([first, second])).resolves.toEqual([session, session]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().accessToken).toBe("new-access-token");
    expect(useSessionStore.getState().status).toBe("authenticated");
  });

  it("刷新失败时清除 Access Token 和用户", async () => {
    useSessionStore.getState().setSession(session);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(dataResponse(null, 401)));
    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(useSessionStore.getState().user).toBeNull();
    expect(useSessionStore.getState().status).toBe("anonymous");
  });

  it("业务请求 401 后刷新并用新令牌重试一次", async () => {
    useSessionStore.getState().setSession({ ...session, access_token: "expired" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(dataResponse(null, 401))
      .mockResolvedValueOnce(dataResponse(session))
      .mockResolvedValueOnce(dataResponse(["ok"]));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch<string[]>("/api/v1/channels")).resolves.toEqual(["ok"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect(new Headers(retryInit.headers).get("Authorization")).toBe("Bearer new-access-token");
  });
});

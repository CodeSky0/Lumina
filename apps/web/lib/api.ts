import { useSessionStore } from "@/stores/session";
import type { ApiErrorBody, AuthSession, DataEnvelope } from "@/lib/types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(message: string, status: number, code = "REQUEST_FAILED", requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown>;
  skipAuth?: boolean;
  responseType?: "json" | "blob";
};

function makeHeaders(options: ApiRequestOptions): Headers {
  const headers = new Headers(options.headers);
  const token = useSessionStore.getState().accessToken;
  if (!options.skipAuth && token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !(options.body instanceof Blob) && typeof options.body !== "string") {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", options.responseType === "blob" ? "*/*" : "application/json");
  return headers;
}

function serializeBody(body: ApiRequestOptions["body"]): BodyInit | undefined {
  if (!body || typeof body === "string" || body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
    return body as BodyInit | undefined;
  }
  if (body instanceof URLSearchParams || ArrayBuffer.isView(body)) return body as BodyInit;
  return JSON.stringify(body);
}

async function request(path: string, options: ApiRequestOptions): Promise<Response> {
  try {
    return await fetch(path, {
      ...options,
      body: serializeBody(options.body),
      headers: makeHeaders(options),
      credentials: "include",
    });
  } catch {
    throw new ApiError("无法连接服务器，请检查网络后重试", 0, "NETWORK_ERROR");
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let body: { error?: ApiErrorBody } | undefined;
  try {
    body = await response.json() as { error?: ApiErrorBody };
  } catch {
    body = undefined;
  }
  const fallback = response.status === 403
    ? "当前账号没有执行此操作的权限"
    : response.status === 429
      ? "操作过于频繁，请稍后再试"
      : `请求失败（${response.status}）`;
  return new ApiError(
    body?.error?.message ?? fallback,
    response.status,
    body?.error?.code ?? "REQUEST_FAILED",
    body?.error?.request_id,
  );
}

let refreshPromise: Promise<AuthSession> | null = null;

export function refreshSession(): Promise<AuthSession> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await request("/api/v1/auth/refresh", { method: "POST", skipAuth: true });
      if (!response.ok) throw await parseError(response);
      const envelope = await response.json() as DataEnvelope<AuthSession>;
      useSessionStore.getState().setSession(envelope.data);
      return envelope.data;
    } catch (error) {
      useSessionStore.getState().clearSession();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  let response = await request(path, options);
  if (response.status === 401 && !options.skipAuth && path !== "/api/v1/auth/refresh") {
    await refreshSession();
    response = await request(path, options);
  }
  if (!response.ok) throw await parseError(response);
  if (options.responseType === "blob") return await response.blob() as T;
  if (response.status === 204) return undefined as T;
  const envelope = await response.json() as DataEnvelope<T>;
  return envelope.data;
}

export async function downloadFile(id: string, filename: string): Promise<void> {
  const blob = await apiFetch<Blob>(`/api/v1/files/${encodeURIComponent(id)}`, { responseType: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function resetRefreshForTests(): void {
  refreshPromise = null;
}

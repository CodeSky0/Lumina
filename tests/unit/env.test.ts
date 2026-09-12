import { describe, it, expect, afterEach } from "vitest";
import { isRealtimeConfigured } from "@/lib/env";

describe("isRealtimeConfigured", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns true when both CF_WORKER_URL and CF_WORKER_AUTH_TOKEN are set", () => {
    process.env.CF_WORKER_URL = "https://lumina-realtime.example.workers.dev";
    process.env.CF_WORKER_AUTH_TOKEN = "secret-token";
    expect(isRealtimeConfigured()).toBe(true);
  });

  it("returns false when CF_WORKER_URL is missing", () => {
    delete process.env.CF_WORKER_URL;
    process.env.CF_WORKER_AUTH_TOKEN = "secret-token";
    expect(isRealtimeConfigured()).toBe(false);
  });

  it("returns false when CF_WORKER_AUTH_TOKEN is missing", () => {
    process.env.CF_WORKER_URL = "https://lumina-realtime.example.workers.dev";
    delete process.env.CF_WORKER_AUTH_TOKEN;
    expect(isRealtimeConfigured()).toBe(false);
  });

  it("returns false when both are missing", () => {
    delete process.env.CF_WORKER_URL;
    delete process.env.CF_WORKER_AUTH_TOKEN;
    expect(isRealtimeConfigured()).toBe(false);
  });

  it("returns false when CF_WORKER_URL is empty string", () => {
    process.env.CF_WORKER_URL = "";
    process.env.CF_WORKER_AUTH_TOKEN = "secret-token";
    expect(isRealtimeConfigured()).toBe(false);
  });
});

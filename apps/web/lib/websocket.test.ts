import { describe, expect, it } from "vitest";
import { createWebSocketUrl, EventDeduplicator, parseRealtimeEvent, reconnectDelay } from "@/lib/websocket";

const event = {
  event_id: "evt-1",
  type: "new_message",
  channel_id: "ch-1",
  occurred_at: "2026-10-30T12:00:00Z",
  data: {},
};

describe("WebSocket 工具", () => {
  it("按 event_id 去重并有界淘汰最旧记录", () => {
    const dedupe = new EventDeduplicator(2);
    expect(dedupe.accept("a")).toBe(true);
    expect(dedupe.accept("a")).toBe(false);
    expect(dedupe.accept("b")).toBe(true);
    expect(dedupe.accept("c")).toBe(true);
    expect(dedupe.accept("a")).toBe(true);
    expect(dedupe.accept("b")).toBe(true);
    expect(dedupe.accept("b")).toBe(false);
  });

  it("只接受契约事件信封并拒绝未知类型", () => {
    expect(parseRealtimeEvent(event)).toEqual(event);
    expect(parseRealtimeEvent({ ...event, type: "polling_update" })).toBeNull();
    expect(parseRealtimeEvent({ ...event, event_id: 12 })).toBeNull();
    expect(parseRealtimeEvent(null)).toBeNull();
  });

  it("指数退避包含抖动并在 30 秒封顶", () => {
    expect(reconnectDelay(0, 0)).toBe(500);
    expect(reconnectDelay(0, 1)).toBe(1000);
    expect(reconnectDelay(3, 0)).toBe(4000);
    expect(reconnectDelay(20, 1)).toBe(30_000);
    expect(reconnectDelay(4, 0.5)).toBeGreaterThanOrEqual(8000);
    expect(reconnectDelay(4, 0.5)).toBeLessThanOrEqual(16_000);
  });

  it("同源升级协议并编码一次性 ticket", () => {
    expect(createWebSocketUrl("a/b+c=", { protocol: "https:", host: "campus.example" })).toBe("wss://campus.example/ws?ticket=a%2Fb%2Bc%3D");
    expect(createWebSocketUrl("ticket", { protocol: "http:", host: "localhost:3000" })).toBe("ws://localhost:3000/ws?ticket=ticket");
  });
});

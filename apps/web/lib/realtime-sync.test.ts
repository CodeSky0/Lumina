import { describe, expect, it, vi } from "vitest";
import { invalidateRealtimeQueries, isConfirmedReadAck } from "@/lib/realtime-sync";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/types";

function event(type: RealtimeEventType, data: unknown = {}): RealtimeEvent {
  return { event_id: `evt-${type}`, type, channel_id: "ch-1", occurred_at: "2026-10-31T12:00:00Z", data };
}

function invalidator() {
  return { invalidateQueries: vi.fn().mockResolvedValue(undefined) };
}

describe("实时事件缓存失效", () => {
  it("message_deleted 同步 messages、channels 与 urgent-pending", () => {
    const client = invalidator();
    invalidateRealtimeQueries(client, event("message_deleted"));
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["messages", "ch-1"] });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["channels"] });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["urgent-pending"] });
  });

  it("仅 confirmed read_ack 额外失效 urgent-pending", () => {
    const client = invalidator();
    invalidateRealtimeQueries(client, event("read_ack", { confirmed: false }));
    expect(client.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["urgent-pending"] });
    const confirmed = event("read_ack", { confirmed: true, confirmed_at: "2026-10-31T12:00:00Z" });
    expect(isConfirmedReadAck(confirmed)).toBe(true);
    invalidateRealtimeQueries(client, confirmed);
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["urgent-pending"] });
  });

  it("公告失效事件同步公告与紧急待确认列表", () => {
    const client = invalidator();
    invalidateRealtimeQueries(client, event("announcement_invalidated", { announcement_id: "a1" }));
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["announcements"] });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["urgent-pending"] });
  });

  it("presence 只触发 channels 重新同步", () => {
    const client = invalidator();
    invalidateRealtimeQueries(client, event("presence", { online: false }));
    expect(client.invalidateQueries).toHaveBeenCalledTimes(1);
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["channels"] });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeBatch } from "@/lib/realtime-batch";
import type { RealtimeEvent } from "@/lib/types";

const event = (eventId: string): RealtimeEvent => ({ event_id: eventId, type: "new_message", channel_id: "ch-1", occurred_at: "2026-11-04T12:00:00Z", data: {} });

describe("RealtimeBatch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("100ms 内合并更新并按 event_id 去重", () => {
    const flush = vi.fn();
    const batch = new RealtimeBatch(flush);
    batch.push(event("evt-1"));
    batch.push(event("evt-1"));
    batch.push(event("evt-2"));
    vi.advanceTimersByTime(99);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0][0].map((item: RealtimeEvent) => item.event_id)).toEqual(["evt-1", "evt-2"]);
  });

  it("停止后取消未执行刷新", () => {
    const flush = vi.fn();
    const batch = new RealtimeBatch(flush);
    batch.push(event("evt-1"));
    batch.stop();
    vi.advanceTimersByTime(100);
    expect(flush).not.toHaveBeenCalled();
  });
});

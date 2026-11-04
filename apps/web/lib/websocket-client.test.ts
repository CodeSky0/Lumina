// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeClient } from "@/lib/websocket";
import type { RealtimeEvent } from "@/lib/types";

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readonly send = vi.fn();
  readonly close = vi.fn(() => this.onclose?.());
  constructor(readonly url: string) { FakeSocket.instances.push(this); }
  open() { this.onopen?.(); }
  emit(event: RealtimeEvent) { this.onmessage?.({ data: JSON.stringify(event) }); }
}

const shutdown: RealtimeEvent = { event_id: "shutdown-1", type: "server_shutdown", occurred_at: "2026-11-04T12:00:00Z", data: { reason: "maintenance" } };

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("RealtimeClient 生命周期", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("维护事件保持维护态，重连不再发送应用层 ping", async () => {
    const statuses: string[] = [];
    const events: RealtimeEvent[] = [];
    const client = new RealtimeClient({
      getTicket: vi.fn().mockResolvedValue("ticket"),
      onStatus: (status) => statuses.push(status),
      onEvent: (event) => events.push(event),
      onOpen: vi.fn(),
      createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
    });
    client.start();
    await flush();
    const socket = FakeSocket.instances[0];
    socket.open();
    socket.emit(shutdown);
    expect(events).toEqual([shutdown]);
    expect(statuses[statuses.length - 1]).toBe("maintenance");
    socket.close();
    expect(statuses[statuses.length - 1]).toBe("maintenance");

    await vi.advanceTimersByTimeAsync(30_000);
    await flush();
    expect(socket.send).not.toHaveBeenCalled();
    client.stop();
  });

  it("断线按退避重连并报告 reconnected，停止后不再建连", async () => {
    const onOpen = vi.fn();
    const client = new RealtimeClient({
      getTicket: vi.fn().mockResolvedValue("ticket"),
      onStatus: vi.fn(),
      onEvent: vi.fn(),
      onOpen,
      createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
    });
    client.start();
    await flush();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].close();
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].open();
    expect(onOpen).toHaveBeenNthCalledWith(2, true);
    FakeSocket.instances[1].close();
    client.stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});

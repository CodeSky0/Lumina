import type { RealtimeEvent } from "@/lib/types";

export class RealtimeBatch {
  private events: RealtimeEvent[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly flush: (events: RealtimeEvent[]) => void, private readonly capacity = 2048) {}

  push(event: RealtimeEvent): void {
    if (this.seen.has(event.event_id)) return;
    this.seen.add(event.event_id);
    this.order.push(event.event_id);
    if (this.order.length > this.capacity) {
      const oldest = this.order.shift();
      if (oldest) this.seen.delete(oldest);
    }
    this.events.push(event);
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const events = this.events;
      this.events = [];
      this.flush(events);
    }, 100);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.events = [];
  }
}

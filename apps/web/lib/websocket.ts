import type { RealtimeEvent, RealtimeEventType } from "@/lib/types";
import type { RealtimeStatus } from "@/stores/realtime";

const EVENT_TYPES = new Set<RealtimeEventType>([
  "new_message", "message_edited", "message_deleted", "announcement", "announcement_invalidated", "typing", "presence", "read_ack", "delivery_ack", "server_shutdown", "urgent_confirmed",
]);

export class EventDeduplicator {
  private readonly seen = new Set<string>();
  private readonly order: string[] = [];

  constructor(private readonly capacity = 2048) {}

  accept(eventId: string): boolean {
    if (!eventId || this.seen.has(eventId)) return false;
    this.seen.add(eventId);
    this.order.push(eventId);
    if (this.order.length > this.capacity) {
      const oldest = this.order.shift();
      if (oldest) this.seen.delete(oldest);
    }
    return true;
  }
}

export function reconnectDelay(attempt: number, random = Math.random()): number {
  const capped = Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
  return Math.floor(capped * (0.5 + Math.min(1, Math.max(0, random)) * 0.5));
}

export function createWebSocketUrl(ticket: string, location: Pick<Location, "protocol" | "host">): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws?ticket=${encodeURIComponent(ticket)}`;
}

export function parseRealtimeEvent(raw: unknown): RealtimeEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as Partial<RealtimeEvent>;
  if (typeof event.event_id !== "string" || typeof event.occurred_at !== "string") return null;
  if (!event.type || !EVENT_TYPES.has(event.type)) return null;
  return event as RealtimeEvent;
}

interface RealtimeClientOptions {
  getTicket: () => Promise<string>;
  onEvent: (event: RealtimeEvent) => void;
  onStatus: (status: RealtimeStatus) => void;
  onOpen: (reconnected: boolean) => void;
  createSocket?: (url: string) => WebSocket;
}

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private stopped = true;
  private hasConnected = false;
  private maintenance = false;
  private readonly deduplicator = new EventDeduplicator();

  constructor(private readonly options: RealtimeClientOptions) {}

  start(): void {
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
    this.maintenance = false;
    this.options.onStatus("idle");
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    this.options.onStatus(this.maintenance ? "maintenance" : this.hasConnected ? "reconnecting" : "connecting");
    try {
      const ticket = await this.options.getTicket();
      if (this.stopped) return;
      const createSocket = this.options.createSocket ?? ((url: string) => new WebSocket(url));
      const socket = createSocket(createWebSocketUrl(ticket, window.location));
      this.socket = socket;

      socket.onopen = () => {
        const reconnected = this.hasConnected;
        this.hasConnected = true;
        this.maintenance = false;
        this.attempt = 0;
        this.options.onStatus("connected");
        this.options.onOpen(reconnected);
      };
      socket.onmessage = (message) => {
        try {
          const event = parseRealtimeEvent(JSON.parse(String(message.data)));
          if (event && this.deduplicator.accept(event.event_id)) {
            if (event.type === "server_shutdown") {
              this.maintenance = true;
              this.options.onStatus("maintenance");
            }
            this.options.onEvent(event);
          }
        } catch {
          // 非契约事件不进入业务状态，连接继续保持。
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (this.stopped) return;
        this.options.onStatus(this.maintenance ? "maintenance" : "reconnecting");
        const delay = reconnectDelay(this.attempt);
        this.attempt += 1;
        this.reconnectTimer = setTimeout(() => void this.connect(), delay);
      };
    } catch {
      if (this.stopped) return;
      this.options.onStatus(this.maintenance ? "maintenance" : "reconnecting");
      const delay = reconnectDelay(this.attempt);
      this.attempt += 1;
      this.reconnectTimer = setTimeout(() => void this.connect(), delay);
    }
  }
}

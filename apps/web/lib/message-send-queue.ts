import { ApiError } from "@/lib/api";
import type { Message, MessageType } from "@/lib/types";

export interface SendMessageInput {
  type: MessageType;
  content: string;
  reply_to_id?: string;
  metadata?: Message["metadata"];
}

export interface QueuedMessage {
  client_msg_id: string;
  channel_id: string;
  input: SendMessageInput;
  state: "sending" | "failed";
  retryable: boolean;
  created_at: string;
  error?: string;
}

interface MessageSendQueueOptions {
  send: (channelId: string, input: SendMessageInput, clientMsgId: string) => Promise<Message>;
  onSent?: (message: Message) => void;
  createId?: () => string;
  now?: () => number;
}

function clientMessageId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class MessageSendQueue {
  private readonly items = new Map<string, QueuedMessage>();
  private readonly listeners = new Set<(items: QueuedMessage[]) => void>();
  private readonly running = new Set<string>();
  private readonly createId: () => string;
  private readonly now: () => number;
  private paused = false;
  private notifyTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly options: MessageSendQueueOptions) {
    this.createId = options.createId ?? clientMessageId;
    this.now = options.now ?? Date.now;
  }

  getItems(): QueuedMessage[] {
    return Array.from(this.items.values());
  }

  getChannelItems(channelId: string): QueuedMessage[] {
    return this.getItems().filter((item) => item.channel_id === channelId);
  }

  subscribe(listener: (items: QueuedMessage[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  enqueue(channelId: string, input: SendMessageInput): string {
    const id = this.createId();
    this.items.set(id, { client_msg_id: id, channel_id: channelId, input, state: "sending", retryable: true, created_at: new Date(this.now()).toISOString() });
    this.scheduleNotification();
    this.pump(channelId);
    return id;
  }

  retry(clientMsgId: string): void {
    const item = this.items.get(clientMsgId);
    if (!item) return;
    item.state = "sending";
    item.error = undefined;
    this.scheduleNotification();
    this.pump(item.channel_id);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (!paused) {
      for (const item of this.items.values()) {
        if (item.state === "failed" && item.retryable) {
          item.state = "sending";
          item.error = undefined;
        }
      }
      this.scheduleNotification();
      this.pumpAll();
    }
  }

  stop(): void {
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.notifyTimer = undefined;
    this.listeners.clear();
  }

  private pumpAll(): void {
    for (const channelId of new Set(this.getItems().map((item) => item.channel_id))) this.pump(channelId);
  }

  private pump(channelId: string): void {
    if (this.paused || this.running.has(channelId)) return;
    const item = this.getItems().find((candidate) => candidate.channel_id === channelId);
    if (!item || item.state !== "sending") return;
    this.running.add(channelId);
    void (async () => {
      try {
        const message = await this.options.send(channelId, item.input, item.client_msg_id);
        this.items.delete(item.client_msg_id);
        this.options.onSent?.(message);
        this.scheduleNotification();
      } catch (error) {
        const current = this.items.get(item.client_msg_id);
        if (current) {
          current.state = "failed";
          current.retryable = !(error instanceof ApiError && error.status >= 400 && error.status < 500);
          current.error = error instanceof Error ? error.message : "发送失败";
        }
        this.scheduleNotification();
      } finally {
        this.running.delete(channelId);
        this.pump(channelId);
      }
    })();
  }

  private scheduleNotification(): void {
    if (this.notifyTimer || this.listeners.size === 0) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = undefined;
      const items = this.getItems();
      for (const listener of this.listeners) listener(items);
    }, 100);
  }
}

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
  send: (channelId: string, input: SendMessageInput, clientMsgId: string, signal?: AbortSignal) => Promise<Message>;
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
  private readonly controllers = new Map<string, AbortController>();
  private readonly createId: () => string;
  private readonly now: () => number;
  private paused = false;
  private stopped = false;
  private generation = 0;
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
    if (this.stopped) return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.generation += 1;
  }

  enqueue(channelId: string, input: SendMessageInput): string {
    if (this.stopped) return "";
    const id = this.createId();
    this.items.set(id, { client_msg_id: id, channel_id: channelId, input, state: "sending", retryable: true, created_at: new Date(this.now()).toISOString() });
    this.scheduleNotification();
    this.pump(channelId);
    return id;
  }

  retry(clientMsgId: string): void {
    if (this.stopped) return;
    const item = this.items.get(clientMsgId);
    if (!item) return;
    item.state = "sending";
    item.error = undefined;
    this.scheduleNotification();
    this.pump(item.channel_id);
  }

  setPaused(paused: boolean): void {
    if (this.stopped || this.paused === paused) return;
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
    if (this.stopped) return;
    this.stopped = true;
    this.generation += 1;
    if (this.notifyTimer) clearTimeout(this.notifyTimer);
    this.notifyTimer = undefined;
    this.listeners.clear();
    this.items.clear();
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    this.running.clear();
  }

  private pumpAll(): void {
    if (this.stopped) return;
    for (const channelId of new Set(this.getItems().map((item) => item.channel_id))) this.pump(channelId);
  }

  private pump(channelId: string): void {
    if (this.stopped || this.paused || this.running.has(channelId)) return;
    const item = this.getItems().find((candidate) => candidate.channel_id === channelId);
    if (!item || item.state !== "sending") return;
    const generation = this.generation;
    const controller = new AbortController();
    this.running.add(channelId);
    this.controllers.set(channelId, controller);
    void (async () => {
      try {
        const message = await this.options.send(channelId, item.input, item.client_msg_id, controller.signal);
        if (this.stopped || generation !== this.generation) return;
        this.items.delete(item.client_msg_id);
        this.options.onSent?.(message);
        this.scheduleNotification();
      } catch (error) {
        if (this.stopped || generation !== this.generation) return;
        const current = this.items.get(item.client_msg_id);
        if (current) {
          current.state = "failed";
          current.retryable = !(error instanceof ApiError && error.status >= 400 && error.status < 500);
          current.error = error instanceof Error ? error.message : "发送失败";
        }
        this.scheduleNotification();
      } finally {
        if (generation !== this.generation) return;
        this.running.delete(channelId);
        this.controllers.delete(channelId);
        this.pump(channelId);
      }
    })();
  }

  private scheduleNotification(): void {
    if (this.stopped || this.notifyTimer || this.listeners.size === 0) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = undefined;
      if (this.stopped) return;
      const items = this.getItems();
      for (const listener of this.listeners) listener(items);
    }, 100);
  }
}

import { apiFetch } from "@/lib/api";
import { useSessionStore } from "@/stores/session";
import type { Message } from "@/lib/types";

export const DELIVERY_ACK_BATCH_SIZE = 100;

type DeliveryAckSender = (messageIds: string[], signal?: AbortSignal) => Promise<unknown>;

export class DeliveryAckScheduler {
  private readonly pending = new Set<string>();
  private userId?: string;
  private generation = 0;
  private flushRequested = false;
  private autoFlushScheduled = false;
  private controller?: AbortController;
  private inFlight?: { generation: number; promise: Promise<void> };

  constructor(private readonly send: DeliveryAckSender = (messageIds, signal) => apiFetch<void>("/api/v1/messages/delivery-ack", {
    method: "POST",
    body: { message_ids: messageIds },
    signal,
  })) {}

  start(userId: string): void {
    if (this.userId === userId) return;
    this.stop();
    this.userId = userId;
    this.controller = new AbortController();
  }

  stop(userId?: string): void {
    if (userId && this.userId !== userId) return;
    this.generation += 1;
    this.controller?.abort();
    this.controller = undefined;
    this.userId = undefined;
    this.pending.clear();
    this.flushRequested = false;
    this.autoFlushScheduled = false;
  }

  enqueue(messages: Message[], userId: string): void {
    if (!userId || (this.userId && this.userId !== userId)) return;
    if (!this.userId) this.start(userId);
    for (const message of messages) {
      if (message.sender_id !== userId) this.pending.add(message.id);
    }
    if (!this.autoFlushScheduled) {
      this.autoFlushScheduled = true;
      const generation = this.generation;
      queueMicrotask(() => {
        if (!this.autoFlushScheduled || this.generation !== generation) return;
        this.autoFlushScheduled = false;
        void this.flush();
      });
    }
  }

  flush(): Promise<void> {
    this.autoFlushScheduled = false;
    if (!this.userId || this.pending.size === 0) return Promise.resolve();
    this.flushRequested = true;
    const generation = this.generation;
    if (this.inFlight?.generation === generation) return this.inFlight.promise;
    const promise = this.run(generation).finally(() => {
      if (this.inFlight?.promise === promise) this.inFlight = undefined;
      if (this.generation === generation && this.flushRequested && this.userId && this.pending.size > 0) void this.flush();
    });
    this.inFlight = { generation, promise };
    return promise;
  }

  private async run(generation: number): Promise<void> {
    while (this.flushRequested && this.generation === generation && this.userId && this.pending.size > 0) {
      this.flushRequested = false;
      const userId = this.userId;
      let failed = false;
      while (this.generation === generation && this.userId === userId && this.pending.size > 0) {
        const batch = Array.from(this.pending).slice(0, DELIVERY_ACK_BATCH_SIZE);
        try {
          await this.send(batch, this.controller?.signal);
        } catch {
          failed = true;
          break;
        }
        if (this.generation !== generation || this.userId !== userId) return;
        for (const id of batch) this.pending.delete(id);
      }
      if (this.generation !== generation || this.userId !== userId || (failed && !this.flushRequested)) return;
    }
  }
}

export const deliveryAckScheduler = new DeliveryAckScheduler();

export function enqueueDeliveryAcks(messages: Message[], userId?: string): void {
  if (!userId || useSessionStore.getState().user?.id !== userId) return;
  deliveryAckScheduler.start(userId);
  deliveryAckScheduler.enqueue(messages, userId);
}

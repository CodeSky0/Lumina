import type { Message, RealtimeEvent } from "@/lib/types";

export interface QueryInvalidator {
  invalidateQueries: (filters: { queryKey: unknown[] }) => Promise<unknown>;
}

export function isConfirmedReadAck(event: RealtimeEvent): boolean {
  if (event.type !== "read_ack" || !event.data || typeof event.data !== "object") return false;
  const data = event.data as Record<string, unknown>;
  return data.confirmed === true || typeof data.confirmed_at === "string";
}

export function invalidateRealtimeQueries(queryClient: QueryInvalidator, event: RealtimeEvent, message?: Message | null): void {
  if (message) {
    void queryClient.invalidateQueries({ queryKey: ["channels"] });
    if (message.type === "urgent") void queryClient.invalidateQueries({ queryKey: ["urgent-pending"] });
  }
  if (["message_edited", "message_deleted", "read_ack"].includes(event.type)) {
    if (event.channel_id) void queryClient.invalidateQueries({ queryKey: ["messages", event.channel_id] });
    void queryClient.invalidateQueries({ queryKey: ["channels"] });
  }
  if (event.type === "message_deleted" || isConfirmedReadAck(event)) {
    void queryClient.invalidateQueries({ queryKey: ["urgent-pending"] });
  }
  if (event.type === "presence") {
    void queryClient.invalidateQueries({ queryKey: ["channels"] });
  }
  if (event.type === "announcement" || event.type === "announcement_invalidated") {
    void queryClient.invalidateQueries({ queryKey: ["announcements"] });
    void queryClient.invalidateQueries({ queryKey: ["urgent-pending"] });
  }
}

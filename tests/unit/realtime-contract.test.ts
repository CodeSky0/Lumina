import { describe, it, expect } from "vitest";
import {
  roomNameForClass,
  roomNameForDirect,
  toPublishPayload,
  toDirectPublishPayload,
  publishPayloadSchema,
  chatMessageSchema,
  chatControlSchema,
  clientFrameSchema,
} from "@/lib/realtime/contract";

describe("roomNameForClass", () => {
  it("returns class-{classId} format", () => {
    expect(roomNameForClass("abc-123")).toBe("class-abc-123");
  });

  it("handles empty string", () => {
    expect(roomNameForClass("")).toBe("class-");
  });
});

describe("roomNameForDirect", () => {
  it("sorts user IDs alphabetically for consistency", () => {
    const a = roomNameForDirect("userA", "userB");
    const b = roomNameForDirect("userB", "userA");
    expect(a).toBe(b);
    expect(a).toBe("dm-userA-userB");
  });

  it("handles identical user IDs", () => {
    expect(roomNameForDirect("same", "same")).toBe("dm-same-same");
  });
});

describe("toPublishPayload", () => {
  it("converts DB row to publish payload with class room name", () => {
    const payload = toPublishPayload({
      classId: "cls-1",
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      senderName: "张老师",
      senderId: "teacher-1",
      senderRole: "teacher",
      type: "text",
      content: "你好",
      mimeType: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    expect(payload.roomName).toBe("class-cls-1");
    expect(payload.messageId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(payload.senderName).toBe("张老师");
    expect(payload.type).toBe("text");
    expect(payload.content).toBe("你好");
    expect(payload.mimeType).toBeNull();
    expect(payload.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("handles urgent type", () => {
    const payload = toPublishPayload({
      classId: "cls-1",
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      senderName: "张老师",
      senderId: "teacher-1",
      senderRole: "teacher",
      type: "urgent",
      content: "紧急通知",
      mimeType: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(payload.type).toBe("urgent");
  });
});

describe("toDirectPublishPayload", () => {
  it("converts DB row to publish payload with DM room name", () => {
    const payload = toDirectPublishPayload({
      userAId: "teacher-1",
      userBId: "parent-1",
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      senderName: "张老师",
      senderId: "teacher-1",
      senderRole: "teacher",
      type: "text",
      content: "私信内容",
      mimeType: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    expect(payload.roomName).toBe("dm-parent-1-teacher-1");
    expect(payload.content).toBe("私信内容");
  });
});

describe("publishPayloadSchema", () => {
  it("validates a correct payload", () => {
    const valid = {
      roomName: "class-1",
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      senderName: "张老师",
      senderId: "teacher-1",
      senderRole: "teacher",
      type: "text",
      content: "你好",
      mimeType: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(publishPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid type", () => {
    const invalid = {
      roomName: "class-1",
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      senderName: "张老师",
      senderId: "teacher-1",
      senderRole: "teacher",
      type: "invalid",
      content: "你好",
      mimeType: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(publishPayloadSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects non-UUID messageId", () => {
    const invalid = {
      roomName: "class-1",
      messageId: "not-a-uuid",
      senderName: "张老师",
      senderId: "teacher-1",
      senderRole: "teacher",
      type: "text",
      content: "你好",
      mimeType: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(publishPayloadSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects empty roomName", () => {
    const invalid = {
      roomName: "",
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      senderName: "张老师",
      senderId: "teacher-1",
      senderRole: "teacher",
      type: "text",
      content: "你好",
      mimeType: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(publishPayloadSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("chatMessageSchema", () => {
  it("validates a correct message frame", () => {
    const valid = {
      kind: "message",
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      senderName: "张老师",
      senderId: "teacher-1",
      senderRole: "teacher",
      type: "text",
      content: "你好",
      mimeType: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(chatMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects wrong kind", () => {
    const invalid = {
      kind: "ack",
      messageId: "550e8400-e29b-41d4-a716-446655440000",
      senderName: "张老师",
      senderId: "teacher-1",
      senderRole: "teacher",
      type: "text",
      content: "你好",
      mimeType: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(chatMessageSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("chatControlSchema", () => {
  it("validates ack frame", () => {
    const valid = {
      kind: "ack",
      messageId: "550e8400-e29b-41d4-a716-446655440000",
    };
    expect(chatControlSchema.safeParse(valid).success).toBe(true);
  });

  it("validates backfill frame with messages", () => {
    const valid = {
      kind: "backfill",
      messages: [
        {
          kind: "message",
          messageId: "550e8400-e29b-41d4-a716-446655440000",
          senderName: "张老师",
          senderId: "teacher-1",
          senderRole: "teacher",
          type: "text",
          content: "你好",
          mimeType: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    expect(chatControlSchema.safeParse(valid).success).toBe(true);
  });

  it("validates heartbeat frame", () => {
    const valid = {
      kind: "heartbeat",
      serverTime: "2026-01-01T00:00:00.000Z",
    };
    expect(chatControlSchema.safeParse(valid).success).toBe(true);
  });
});

describe("clientFrameSchema", () => {
  it("validates subscribe frame", () => {
    const valid = { kind: "subscribe", room: "class-1" };
    expect(clientFrameSchema.safeParse(valid).success).toBe(true);
  });

  it("validates backfill frame", () => {
    const valid = { kind: "backfill", since: "2026-01-01T00:00:00.000Z" };
    expect(clientFrameSchema.safeParse(valid).success).toBe(true);
  });

  it("validates ping frame", () => {
    const valid = { kind: "ping" };
    expect(clientFrameSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid kind", () => {
    const invalid = { kind: "invalid" };
    expect(clientFrameSchema.safeParse(invalid).success).toBe(false);
  });
});

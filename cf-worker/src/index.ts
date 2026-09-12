/**
 * Lumina 实时通讯 Worker — Cloudflare Durable Objects
 *
 * 架构：
 *   - 班级群聊：RoomDO 实例 id = class-{classId}，教师/家长/大屏均可连接
 *   - 私信：RoomDO 实例 id = dm-{userAId}-{userBId}（排序后拼接）
 *   - 所有端通过 GET /ws/{roomName} 升级为 WebSocket
 *   - Next.js 写库后 POST /publish 触发 DO 广播
 *   - DO 内存缓存最近 50 条消息，支持断线补发 (backfill)
 *
 * 路由：
 *   POST /publish        — 鉴权后转发给目标 DO
 *   GET  /ws/{roomName}  — WebSocket 升级到目标 DO
 */

interface Env {
  ROOM: DurableObjectNamespace;
  LUMINA_API_TOKEN: string;
}

interface PublishPayload {
  roomName: string;
  messageId: string;
  senderName: string;
  senderId: string;
  senderRole: "parent" | "teacher" | "classroom" | "admin";
  type: "text" | "image" | "urgent" | "file" | "audio";
  content: string;
  mimeType: string | null;
  createdAt: string;
}

interface ChatMessage {
  kind: "message";
  messageId: string;
  senderName: string;
  senderId: string;
  senderRole: "parent" | "teacher" | "classroom" | "admin";
  type: "text" | "image" | "urgent" | "file" | "audio";
  content: string;
  mimeType: string | null;
  createdAt: string;
}

interface HeartbeatFrame {
  kind: "heartbeat";
  serverTime: string;
}

interface BackfillFrame {
  kind: "backfill";
  messages: ChatMessage[];
}

interface PresenceUser {
  userId: string;
  name: string;
  role: "parent" | "teacher" | "classroom" | "admin";
}

interface PresenceFrame {
  kind: "presence";
  users: PresenceUser[];
}

const RECENT_LIMIT = 50;

/* -------------------------------------------------------------------------- */
/* Durable Object — 每个会话一个实例                                           */
/* -------------------------------------------------------------------------- */

export class RoomDO implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly recent: ChatMessage[] = [];
  private readonly presence = new Map<string, PresenceUser>();
  private readonly wsToUserId = new Map<WebSocket, string>();

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/publish" && request.method === "POST") {
      return this.handlePublish(request);
    }

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket();
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handlePublish(request: Request): Promise<Response> {
    let payload: PublishPayload;
    try {
      payload = (await request.json()) as PublishPayload;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    if (
      typeof payload.roomName !== "string" ||
      typeof payload.messageId !== "string" ||
      typeof payload.senderName !== "string" ||
      typeof payload.senderId !== "string" ||
      typeof payload.type !== "string" ||
      !["text", "image", "urgent", "file", "audio"].includes(payload.type) ||
      typeof payload.content !== "string" ||
      (payload.mimeType !== null && typeof payload.mimeType !== "string") ||
      typeof payload.createdAt !== "string"
    ) {
      return new Response("Bad Request", { status: 400 });
    }

    const frame: ChatMessage = {
      kind: "message",
      messageId: payload.messageId,
      senderName: payload.senderName,
      senderId: payload.senderId,
      senderRole: payload.senderRole,
      type: payload.type,
      content: payload.content,
      mimeType: payload.mimeType,
      createdAt: payload.createdAt,
    };

    this.recent.push(frame);
    if (this.recent.length > RECENT_LIMIT) {
      this.recent.splice(0, this.recent.length - RECENT_LIMIT);
    }

    const sockets = this.state.getWebSockets();
    const data = JSON.stringify(frame);
    for (const ws of sockets) {
      try {
        ws.send(data);
      } catch {
        // 单个 socket 发送失败不影响其他
      }
    }

    return new Response("OK", { status: 200 });
  }

  private handleWebSocket(): Response {
    const pair = new WebSocketPair();
    const server = pair[0];
    const client = pair[1];

    this.state.acceptWebSocket(server);

    const hello: HeartbeatFrame = {
      kind: "heartbeat",
      serverTime: new Date().toISOString(),
    };
    server.send(JSON.stringify(hello));

    const presenceFrame: PresenceFrame = {
      kind: "presence",
      users: [...this.presence.values()],
    };
    server.send(JSON.stringify(presenceFrame));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const text =
      typeof message === "string" ? message : new TextDecoder().decode(message);
    let frame: unknown;
    try {
      frame = JSON.parse(text);
    } catch {
      return;
    }
    if (typeof frame !== "object" || frame === null) return;
    const f = frame as { kind?: string; since?: string; userId?: string; name?: string; role?: string };

    if (f.kind === "join" && typeof f.userId === "string" && typeof f.name === "string" && typeof f.role === "string") {
      const user: PresenceUser = {
        userId: f.userId,
        name: f.name,
        role: f.role as PresenceUser["role"],
      };
      this.presence.set(user.userId, user);
      this.wsToUserId.set(ws, user.userId);
      this.broadcastPresence();
      return;
    }

    if (f.kind === "backfill" && typeof f.since === "string") {
      const missed = this.recent.filter((m) => m.createdAt > f.since!);
      const resp: BackfillFrame = { kind: "backfill", messages: missed };
      ws.send(JSON.stringify(resp));
      return;
    }
    if (f.kind === "ping") {
      const hb: HeartbeatFrame = {
        kind: "heartbeat",
        serverTime: new Date().toISOString(),
      };
      ws.send(JSON.stringify(hb));
    }
  }

  private broadcastPresence(): void {
    const frame: PresenceFrame = {
      kind: "presence",
      users: [...this.presence.values()],
    };
    const data = JSON.stringify(frame);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // ignore
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    const userId = this.wsToUserId.get(ws);
    if (userId) {
      this.presence.delete(userId);
      this.wsToUserId.delete(ws);
      this.broadcastPresence();
    }
  }

  async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
    // 同上
  }
}

/* -------------------------------------------------------------------------- */
/* Worker 入口                                                                 */
/* -------------------------------------------------------------------------- */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/publish" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (!auth || auth !== `Bearer ${env.LUMINA_API_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      const upstream = request.clone();
      let roomName: unknown;
      try {
        const body = (await request.json()) as { roomName?: unknown };
        roomName = body.roomName;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      if (typeof roomName !== "string" || roomName.length === 0) {
        return new Response("Missing roomName", { status: 400 });
      }
      const id = env.ROOM.idFromName(roomName);
      const stub = env.ROOM.get(id);
      return stub.fetch(upstream);
    }

    if (
      url.pathname.startsWith("/ws/") &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      const roomName = url.pathname.slice(4);
      if (roomName.length === 0) {
        return new Response("Missing roomName", { status: 400 });
      }
      const id = env.ROOM.idFromName(roomName);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};

/**
 * Lumina 实时通讯 Worker — Cloudflare Durable Objects
 *
 * 架构：
 *   - 每个班级对应一个 RoomDO 实例（id = classId）
 *   - 大屏通过 GET /ws/:classId 升级为 WebSocket，连接到对应 DO
 *   - Next.js 写库后 POST /publish 触发 DO 广播
 *   - DO 内存缓存最近 50 条消息，支持断线补发 (backfill)
 *
 * 路由：
 *   POST /publish        — 鉴权后转发给目标班级 DO
 *   GET  /ws/:classId    — WebSocket 升级到目标班级 DO
 */

interface Env {
  ROOM: DurableObjectNamespace;
  LUMINA_API_TOKEN: string;
}

/** Next.js → Worker 的发布载荷（与主应用 lib/realtime/contract.ts 保持一致） */
interface PublishPayload {
  classId: string;
  messageId: string;
  senderName: string;
  type: "text" | "image" | "urgent";
  content: string;
  mimeType: string | null;
  createdAt: string;
}

/** Worker → 大屏的消息帧 */
interface ScreenMessage {
  kind: "message";
  messageId: string;
  senderName: string;
  type: "text" | "image" | "urgent";
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
  messages: ScreenMessage[];
}

const RECENT_LIMIT = 50;

/* -------------------------------------------------------------------------- */
/* Durable Object — 每个班级一个实例                                           */
/* -------------------------------------------------------------------------- */

export class RoomDO implements DurableObject {
  private readonly state: DurableObjectState;
  /** 最近消息缓存，用于断线补发；DO 内存存活期间有效 */
  private readonly recent: ScreenMessage[] = [];

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 内部 HTTP：来自 Worker 入口的 /publish 转发
    if (url.pathname === "/publish" && request.method === "POST") {
      return this.handlePublish(request);
    }

    // WebSocket 升级
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
      typeof payload.classId !== "string" ||
      typeof payload.messageId !== "string" ||
      typeof payload.senderName !== "string" ||
      typeof payload.type !== "string" ||
      !["text", "image", "urgent"].includes(payload.type) ||
      typeof payload.content !== "string" ||
      (payload.mimeType !== null && typeof payload.mimeType !== "string") ||
      typeof payload.createdAt !== "string"
    ) {
      return new Response("Bad Request", { status: 400 });
    }

    const frame: ScreenMessage = {
      kind: "message",
      messageId: payload.messageId,
      senderName: payload.senderName,
      type: payload.type,
      content: payload.content,
      mimeType: payload.mimeType,
      createdAt: payload.createdAt,
    };

    // 写入最近缓存
    this.recent.push(frame);
    if (this.recent.length > RECENT_LIMIT) {
      this.recent.splice(0, this.recent.length - RECENT_LIMIT);
    }

    // 广播给所有已连接大屏（Hibernatable API）
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

    // 连接建立即发送心跳，便于客户端校时
    const hello: HeartbeatFrame = {
      kind: "heartbeat",
      serverTime: new Date().toISOString(),
    };
    server.send(JSON.stringify(hello));

    return new Response(null, { status: 101, webSocket: client });
  }

  /* ----------------------- Hibernatable WebSocket 钩子 ----------------------- */

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
    const f = frame as { kind?: string; since?: string };

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

  async webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    // Hibernatable API 自动管理连接，无需手动清理
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

    // POST /publish — Next.js 写库后推送
    if (url.pathname === "/publish" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (!auth || auth !== `Bearer ${env.LUMINA_API_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      // 先 clone 保留完整 body 以便转发给 DO
      const upstream = request.clone();
      let classId: unknown;
      try {
        const body = (await request.json()) as { classId?: unknown };
        classId = body.classId;
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
      if (typeof classId !== "string" || classId.length === 0) {
        return new Response("Missing classId", { status: 400 });
      }
      const id = env.ROOM.idFromName(classId);
      const stub = env.ROOM.get(id);
      return stub.fetch(upstream);
    }

    // GET /ws/:classId — 大屏 WebSocket 连接
    if (
      url.pathname.startsWith("/ws/") &&
      request.headers.get("Upgrade") === "websocket"
    ) {
      const classId = url.pathname.slice(4);
      if (classId.length === 0) {
        return new Response("Missing classId", { status: 400 });
      }
      const id = env.ROOM.idFromName(classId);
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    // 健康检查
    if (url.pathname === "/health") {
      return new Response("OK", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};

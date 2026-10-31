import {
  expect,
  request,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
export const BASE_URL = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
export const REPOSITORY_ROOT = path.resolve(__dirname, "../..");

export interface Account {
  username: string;
  password: string;
  role: "admin" | "teacher" | "classroom";
  destination: string;
}

const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "Admin@2026Lumina";
const teacherPassword = process.env.E2E_TEACHER_PASSWORD ?? "Teacher@2026Lumina";
const classroomPassword = process.env.E2E_CLASSROOM_PASSWORD ?? "Classroom@2026Lumina";

export const accounts = {
  admin: { username: "admin", password: adminPassword, role: "admin", destination: "/admin" } satisfies Account,
  teacher: { username: "teacher001", password: teacherPassword, role: "teacher", destination: "/teacher" } satisfies Account,
  classroom: { username: "class01", password: classroomPassword, role: "classroom", destination: "/classroom" } satisfies Account,
  secondClassroom: { username: "class02", password: classroomPassword, role: "classroom", destination: "/classroom" } satisfies Account,
};

const LOGIN_WINDOW_MS = 61_000;
const LOGINS_PER_WINDOW = 4;
const loginReservations: number[] = [];

async function paceRealLogin(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (loginReservations.length > 0 && loginReservations[0] <= now - LOGIN_WINDOW_MS) {
      loginReservations.shift();
    }
    if (loginReservations.length < LOGINS_PER_WINDOW) {
      loginReservations.push(now);
      return;
    }
    const waitMs = Math.max(100, loginReservations[0] + LOGIN_WINDOW_MS - now + 100);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  unread_count: number;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  read_count: number;
}

interface History {
  items: Message[];
  has_more: boolean;
  next_before_id?: string;
}

interface Pending {
  messages: Message[];
  announcements: Array<{ id: string }>;
}

interface Envelope<T> {
  data: T;
}

async function responseError(response: APIResponse): Promise<Error> {
  const body = await response.text();
  return new Error(`${response.url()} 返回 ${response.status()}: ${body}`);
}

export class LuminaApi {
  private constructor(
    private readonly context: APIRequestContext,
    private readonly accessToken: string,
    readonly user: { id: string; username: string; role: string },
  ) {}

  static async login(account: Account): Promise<LuminaApi> {
    await paceRealLogin();
    const context = await request.newContext({ baseURL: BASE_URL });
    const response = await context.post("/api/v1/auth/login", {
      data: { username: account.username, password: account.password },
    });
    if (!response.ok()) {
      const error = await responseError(response);
      await context.dispose();
      throw error;
    }
    const envelope = await response.json() as Envelope<{
      access_token: string;
      user: { id: string; username: string; role: string };
    }>;
    return new LuminaApi(context, envelope.data.access_token, envelope.data.user);
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async rawGet(pathname: string): Promise<APIResponse> {
    return this.context.get(pathname, { headers: this.headers() });
  }

  private async data<T>(response: APIResponse): Promise<T> {
    if (!response.ok()) throw await responseError(response);
    const envelope = await response.json() as Envelope<T>;
    return envelope.data;
  }

  async channels(): Promise<Channel[]> {
    return this.data(await this.context.get("/api/v1/channels", { headers: this.headers() }));
  }

  async channel(name: string): Promise<Channel> {
    const channel = (await this.channels()).find((item) => item.name === name);
    if (!channel) throw new Error(`账号 ${this.user.username} 找不到通道 ${name}`);
    return channel;
  }

  async history(channelId: string, limit = 100): Promise<History> {
    return this.data(await this.context.get(`/api/v1/channels/${channelId}/messages?limit=${limit}`, { headers: this.headers() }));
  }

  async send(channelId: string, content: string, type = "text", metadata: Record<string, unknown> = {}): Promise<Message> {
    return this.data(await this.context.post(`/api/v1/channels/${channelId}/messages`, {
      headers: this.headers(),
      data: { type, content, metadata },
    }));
  }

  async markRead(messageId: string): Promise<void> {
    await this.data(await this.context.post(`/api/v1/messages/${messageId}/read`, { headers: this.headers() }));
  }

  async pendingUrgent(): Promise<Pending> {
    return this.data(await this.context.get("/api/v1/classroom/urgent-pending", { headers: this.headers() }));
  }

  async confirmAllPending(): Promise<void> {
    const pending = await this.pendingUrgent();
    for (const message of pending.messages) {
      await this.data(await this.context.post(`/api/v1/messages/${message.id}/confirm`, { headers: this.headers() }));
    }
    for (const announcement of pending.announcements) {
      await this.data(await this.context.post(`/api/v1/announcements/${announcement.id}/confirm`, { headers: this.headers() }));
    }
  }

  async adminList<T>(path: string): Promise<T> {
    return this.data<T>(await this.rawGet(path));
  }

  async adminWrite<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: Record<string, unknown>): Promise<T> {
    const response = await this.context.fetch(path, { method, headers: this.headers(), data: body });
    return this.data<T>(response);
  }

  async createAnnouncement(title: string, content: string, type: "notice" | "urgent" = "urgent"): Promise<{ id: string }> {
    return this.data(await this.context.post("/api/v1/announcements", {
      headers: this.headers(),
      data: { title, content, type, scope: "school" },
    }));
  }

  async upload(channelId: string, filename: string, content: Buffer): Promise<{ id: string; original_name: string; mime: string; size: number }> {
    return this.data(await this.context.post("/api/v1/uploads", {
      headers: this.headers(),
      multipart: {
        channel_id: channelId,
        declared_size: String(content.byteLength),
        file: { name: filename, mimeType: "text/plain", buffer: content },
      },
    }));
  }

  async download(fileId: string): Promise<{ body: Buffer; contentType: string }> {
    const response = await this.rawGet(`/api/v1/files/${fileId}`);
    if (!response.ok()) throw await responseError(response);
    return { body: await response.body(), contentType: response.headers()["content-type"] ?? "" };
  }

  async close(): Promise<void> {
    await this.context.dispose();
  }
}

export async function waitForReady(timeoutMs = Number(process.env.E2E_WAIT_TIMEOUT_MS ?? 120_000)): Promise<void> {
  const context = await request.newContext({ baseURL: BASE_URL });
  const deadline = Date.now() + timeoutMs;
  let lastError = "尚未连接";
  try {
    while (Date.now() < deadline) {
      try {
        const response = await context.get("/health/ready", { timeout: 3_000 });
        if (response.ok()) return;
        lastError = `HTTP ${response.status()}: ${await response.text()}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  } finally {
    await context.dispose();
  }
  throw new Error(`Lumina 在 ${timeoutMs}ms 内未就绪：${lastError}`);
}

export async function loginUi(page: Page, account: Account): Promise<void> {
  await paceRealLogin();
  await page.goto("/login");
  await page.getByLabel("用户名", { exact: true }).fill(account.username);
  await page.getByLabel("密码", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "进入工作区" }).click();
  await expect(page).toHaveURL(new RegExp(`${account.destination}$`));
  const heading = account.role === "admin" ? "校园通讯概览" : account.role === "teacher" ? "教师工作区" : "今天的课堂消息";
  await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
}

export async function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ baseURL: BASE_URL, viewport: { width: 1440, height: 900 } });
}

export const CLASS_ONE_CHANNEL = "高一（01）班 · 语文 · 教师001";
export const CLASS_TWO_CHANNEL = "高一（02）班 · 语文 · 教师001";

export async function openTeacherChannel(page: Page, name = CLASS_ONE_CHANNEL): Promise<void> {
  const item = page.getByRole("listitem").filter({ hasText: name });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.getByRole("region", { name: `${name}会话` })).toBeVisible();
}

export async function openClassroomChannel(page: Page, name = CLASS_ONE_CHANNEL): Promise<void> {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const card = page.getByRole("button", { name: new RegExp(`^打开${escaped}消息，`) });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

export async function nginx(action: "stop" | "start" | "restart"): Promise<void> {
  const customCommand = action === "stop" ? process.env.E2E_PROXY_STOP_CMD : process.env.E2E_PROXY_START_CMD;
  if (customCommand) {
    await execFileAsync("/bin/sh", ["-c", customCommand], {
      cwd: REPOSITORY_ROOT,
      timeout: 45_000,
      env: process.env,
    });
    return;
  }
  await execFileAsync("docker", ["compose", action, "nginx"], {
    cwd: REPOSITORY_ROOT,
    timeout: 45_000,
    env: process.env,
  });
}

export function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 消息推送 — Next.js 写库后触发 Cloudflare Worker Durable Object 广播。
 * 未配置 CF_WORKER_URL / CF_WORKER_AUTH_TOKEN 时静默跳过。
 * 所有函数返回 boolean 表示推送是否成功，调用方可据此做可观测/兜底。
 */
import {
  publishPayloadSchema,
  type PublishPayload,
  statusPublishPayloadSchema,
  type StatusPublishPayload,
  recallPublishPayloadSchema,
  type RecallPublishPayload,
  userEventPublishPayloadSchema,
  type UserEventPublishPayload,
} from "./contract";

const PUSH_TIMEOUT_MS = 5000;

async function postWithTimeout(
  url: string,
  token: string,
  body: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[publish] CF Worker 响应非 2xx:", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[publish] 推送异常:", e instanceof Error ? e.message : e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function publishMessage(payload: PublishPayload): Promise<boolean> {
  const url = process.env.CF_WORKER_URL;
  const token = process.env.CF_WORKER_AUTH_TOKEN;
  if (!url || !token) return false;
  return postWithTimeout(
    `${url}/publish`,
    token,
    JSON.stringify(publishPayloadSchema.parse(payload)),
  );
}

/** 推送消息状态变更（已送达/已读）至 CF Worker 广播 */
export async function publishMessageStatus(
  payload: StatusPublishPayload,
): Promise<boolean> {
  const url = process.env.CF_WORKER_URL;
  const token = process.env.CF_WORKER_AUTH_TOKEN;
  if (!url || !token) return false;
  return postWithTimeout(
    `${url}/publish-status`,
    token,
    JSON.stringify(statusPublishPayloadSchema.parse(payload)),
  );
}

/** 推送消息撤回事件至 CF Worker 广播 */
export async function publishMessageRecall(
  payload: RecallPublishPayload,
): Promise<boolean> {
  const url = process.env.CF_WORKER_URL;
  const token = process.env.CF_WORKER_AUTH_TOKEN;
  if (!url || !token) return false;
  return postWithTimeout(
    `${url}/publish-recall`,
    token,
    JSON.stringify(recallPublishPayloadSchema.parse(payload)),
  );
}

/**
 * 批量推送用户级事件（新消息/通知）至多个用户的 user-{userId} DO。
 * 一次 POST 传递所有目标用户，Worker 内部分发到各 DO。
 */
export async function publishUserMessageEvent(
  payload: UserEventPublishPayload,
): Promise<boolean> {
  const url = process.env.CF_WORKER_URL;
  const token = process.env.CF_WORKER_AUTH_TOKEN;
  if (!url || !token) return false;
  return postWithTimeout(
    `${url}/publish-user-event`,
    token,
    JSON.stringify(userEventPublishPayloadSchema.parse(payload)),
  );
}

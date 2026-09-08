/**
 * 消息推送 — Next.js 写库后触发 Cloudflare Worker Durable Object 广播。
 * 未配置 CF_WORKER_URL / CF_WORKER_AUTH_TOKEN 时静默跳过（便于未接实时层时仍能跑）。
 */
import { publishPayloadSchema, type PublishPayload } from "./contract";

export async function publishMessage(payload: PublishPayload): Promise<void> {
  const url = process.env.CF_WORKER_URL;
  const token = process.env.CF_WORKER_AUTH_TOKEN;
  if (!url || !token) return;

  const res = await fetch(`${url}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(publishPayloadSchema.parse(payload)),
  });
  if (!res.ok) {
    console.error("推送至 CF Worker 失败:", res.status);
  }
}

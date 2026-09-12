/**
 * 速率限制器 — 基于内存 Map 的滑动窗口限流。
 * 适用于 Server Action 调用频率控制。
 *
 * 注意：在 Serverless 环境（如 Vercel）中，每个实例独立计数。
 * 对于严格限流场景，应改用 Redis 或 CF KV 后端。
 */

const windows = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX = 30;

export function rateLimit(
  key: string,
  max: number = DEFAULT_MAX,
  windowMs: number = DEFAULT_WINDOW_MS,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs;
    windows.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }

  if (entry.count >= max) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { ok: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

/** 清理过期条目（可定期调用以释放内存） */
export function cleanupRateLimit(): void {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now >= entry.resetAt) {
      windows.delete(key);
    }
  }
}

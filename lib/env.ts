/**
 * 环境变量集中校验 — 启动时即失败，避免运行时才发现缺失。
 * 规格要求：BLOB_READ_WRITE_TOKEN 必须被正确读取，此处强制校验。
 */
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL 未配置"),
  BLOB_READ_WRITE_TOKEN: z.string().min(1, "BLOB_READ_WRITE_TOKEN 未配置"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET 未配置"),
  BETTER_AUTH_URL: z
    .string()
    .url()
    .optional()
    .default("http://localhost:3000"),
  CF_WORKER_URL: z.string().url().optional(),
  CF_WORKER_AUTH_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** 在服务端调用，返回经校验的环境变量；首次调用失败会抛出并终止启动 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`环境变量校验失败:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * 仅校验不抛出（用于可选模块判断实时通讯是否已配置）。
 */
export function isRealtimeConfigured(): boolean {
  const e = process.env;
  return Boolean(e.CF_WORKER_URL && e.CF_WORKER_AUTH_TOKEN);
}

/**
 * Drizzle + Neon Serverless 连接层。
 * 使用 neon-http 无状态驱动，适配 Vercel Serverless 冷启动。
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";

const env = getEnv();
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
export { schema };

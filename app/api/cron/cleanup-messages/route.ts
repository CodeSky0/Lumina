/**
 * Cron Job — 清理过期消息
 *
 * Vercel Cron 每天 02:00 (北京时间) 调用此端点，
 * 删除 created_at 超过 5 天的所有消息记录。
 *
 * 鉴权：Vercel 自动在请求头携带 Authorization: Bearer ${CRON_SECRET}。
 */
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { lt, sql } from "drizzle-orm";

const MESSAGE_RETENTION_DAYS = 5;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await db
      .delete(schema.messages)
      .where(lt(schema.messages.createdAt, sql`now() - interval '5 days'`))
      .returning({ id: schema.messages.id });

    return NextResponse.json({
      deleted: deleted.length,
      retentionDays: MESSAGE_RETENTION_DAYS,
      cleanedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 },
    );
  }
}

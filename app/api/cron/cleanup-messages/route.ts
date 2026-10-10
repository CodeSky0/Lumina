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
import { and, inArray, lt, sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { getEnv } from "@/lib/env";
import { timingSafeEqual } from "node:crypto";

const MESSAGE_RETENTION_DAYS = 5;

function safeBearerCompare(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** 从消息 content 中提取 Blob URL（仅 image/file/audio 类型） */
function extractBlobUrl(type: string, content: string): string | null {
  if (type === "image") return content;
  if (type === "file" || type === "audio") {
    try {
      const info = JSON.parse(content) as { url?: string };
      return info.url ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !safeBearerCompare(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. 先查出待删除消息中的 Blob URL，删除 Blob 存储避免泄漏
    const blobMessages = await db
      .select({ type: schema.messages.type, content: schema.messages.content })
      .from(schema.messages)
      .where(
        and(
          lt(schema.messages.createdAt, sql`now() - interval '${sql.raw(String(MESSAGE_RETENTION_DAYS))} days'`),
          inArray(schema.messages.type, ["image", "file", "audio"]),
        ),
      );

    const blobUrls: string[] = [];
    for (const m of blobMessages) {
      const url = extractBlobUrl(m.type, m.content);
      if (url) blobUrls.push(url);
    }

    if (blobUrls.length > 0) {
      try {
        await del(blobUrls, { token: getEnv().BLOB_READ_WRITE_TOKEN });
      } catch {
        // Blob 删除失败不阻塞消息清理
      }
    }

    // 2. 删除过期消息并返回删除数量
    const result = await db.execute(sql`
      WITH deleted AS (
        DELETE FROM messages
        WHERE created_at < now() - interval '${sql.raw(String(MESSAGE_RETENTION_DAYS))} days'
        RETURNING id
      )
      SELECT count(*)::int AS deleted_count FROM deleted
    `);

    const rows = result as unknown as { deleted_count?: number }[];
    return NextResponse.json({
      deleted: rows[0]?.deleted_count ?? 0,
      blobsCleaned: blobUrls.length,
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

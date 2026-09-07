"use server";

/**
 * 图片处理 Server Action — 规格核心流水线：
 *   1. 读取 BLOB_READ_WRITE_TOKEN（经 getEnv 强制校验）
 *   2. 校验大小 ≤5MB、类型 ∈ jpeg/png/webp
 *   3. Sharp 无损 WebP (quality:100, lossless:true) + 自动旋转 + 清理 EXIF
 *   4. 文件名 msg-{uuid}.webp → @vercel/blob.put()
 *   5. 返回 Blob URL（存入 messages.content）
 *
 * 禁止前端压缩或直接存原图。
 */
import { put } from "@vercel/blob";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/env";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type UploadImageResult =
  | { ok: true; url: string; mimeType: string; size: number }
  | { ok: false; error: string };

export async function uploadImage(file: File): Promise<UploadImageResult> {
  if (file.size === 0) {
    return { ok: false, error: "文件为空" };
  }
  if (file.size > MAX_SIZE) {
    return { ok: false, error: "图片超过 5MB 限制" };
  }
  const mime = file.type.toLowerCase();
  if (!ACCEPTED_MIME.has(mime)) {
    return { ok: false, error: "仅接受 jpeg/png/webp 格式" };
  }

  // 1. 确保环境变量（含 BLOB_READ_WRITE_TOKEN）被正确读取
  const env = getEnv();

  // 2. 读取原始字节
  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  // 3. Sharp 无损 WebP 转换：
  //    .rotate() 按 EXIF 方向自动旋转；未调用 .keepExif() 故元数据被清理
  let processed: Buffer;
  try {
    processed = await sharp(sourceBuffer)
      .rotate()
      .webp({ quality: 100, lossless: true })
      .toBuffer();
  } catch {
    return { ok: false, error: "图片解码失败，文件可能已损坏" };
  }

  // 4. 生成唯一文件名并上传至 Vercel Blob
  const filename = `msg-${randomUUID()}.webp`;
  const blob = await put(filename, processed, {
    access: "public",
    contentType: "image/webp",
    token: env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
  });

  // 5. 返回可存入 messages.content 的 URL
  return {
    ok: true,
    url: blob.url,
    mimeType: "image/webp",
    size: processed.length,
  };
}

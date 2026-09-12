/**
 * prebuild 钩子 — 仅在 Vercel 部署构建（VERCEL=1）时自动同步数据库 schema，
 * 本地 `npm run build` 跳过（避免无 DB 连接时失败）。
 * 本地如需同步请手动: npm run db:push
 *
 * 用 push 代替 migrate：直接对比 schema.ts 与数据库实际结构，补齐缺失的表/列，
 * 不会因"对象已存在"失败（比 migrate 更宽容，适合迁移历史不完整的情况）。
 */
import { execSync } from "node:child_process";

if (process.env.VERCEL === "1") {
  console.log("▶ Vercel 构建：自动同步数据库 schema…");
  try {
    execSync("drizzle-kit push", { stdio: "inherit" });
    console.log("✓ 数据库 schema 同步完成");
  } catch {
    console.error(
      "⚠ 数据库 schema 同步失败，继续构建。请手动运行 npm run db:push 检查。",
    );
  }
} else {
  console.log(
    "ℹ 非部署环境，跳过自动同步（手动执行: npm run db:push）",
  );
}

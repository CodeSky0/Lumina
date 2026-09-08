/**
 * prebuild 钩子 — 仅在 Vercel 部署构建（VERCEL=1）时自动执行数据库迁移，
 * 本地 `npm run build` 跳过（避免无 DB 连接时失败）。
 * 本地如需迁移请手动: npm run db:migrate
 */
import { execSync } from "node:child_process";

if (process.env.VERCEL === "1") {
  console.log("▶ Vercel 构建：自动执行数据库迁移…");
  execSync("drizzle-kit migrate", { stdio: "inherit" });
  console.log("✓ 数据库迁移完成");
} else {
  console.log(
    "ℹ 非部署环境，跳过自动迁移（手动执行: npm run db:migrate）",
  );
}

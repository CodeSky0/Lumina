/**
 * prebuild 钩子 — 仅在 Vercel 部署构建（VERCEL=1）时自动执行数据库迁移，
 * 本地 `npm run build` 跳过（避免无 DB 连接时失败）。
 * 本地如需迁移请手动: node scripts/migrate.mjs
 *
 * 用编程式迁移（scripts/migrate.mjs）代替 drizzle-kit push/migrate：
 * 逐语句容错执行，表/列已存在时忽略，不依赖 drizzle-kit 的交互式确认行为。
 */
import { execSync } from "node:child_process";

if (process.env.VERCEL === "1") {
  console.log("▶ Vercel 构建：自动执行数据库迁移…");
  try {
    execSync("node scripts/migrate.mjs", { stdio: "inherit" });
    console.log("✓ 数据库迁移完成");
  } catch {
    console.error(
      "⚠ 数据库迁移失败，继续构建。请手动检查数据库状态。",
    );
  }
} else {
  console.log(
    "ℹ 非部署环境，跳过自动迁移（手动执行: node scripts/migrate.mjs）",
  );
}

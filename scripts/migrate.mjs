/**
 * 编程式数据库迁移 — 逐语句容错执行迁移 SQL。
 * 不依赖 drizzle-kit 的交互式行为，每条 SQL 失败时忽略（表/列已存在等），
 * 确保所有迁移都能"执行"完毕，缺失的表/列被创建，已存在的不报错。
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

neonConfig.webSocketConstructor = WebSocket;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("⚠ DATABASE_URL 未设置，跳过迁移");
  process.exit(0);
}

const pool = new Pool({ connectionString: url, connectionLimit: 1 });

const migrationsDir = join(root, "drizzle", "migrations");
const journalPath = join(migrationsDir, "meta", "_journal.json");

if (!existsSync(journalPath)) {
  console.error("⚠ _journal.json 不存在，跳过迁移");
  await pool.end();
  process.exit(0);
}

const journal = JSON.parse(readFileSync(journalPath, "utf-8"));

let applied = new Set();
try {
  const res = await pool.query("SELECT hash FROM __drizzle_migrations");
  applied = new Set(res.rows.map((r) => r.hash));
} catch {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS __drizzle_migrations (hash text PRIMARY KEY, created_at bigint)",
  );
}

let executed = 0;
for (const entry of journal.entries) {
  if (applied.has(entry.tag)) continue;

  const sqlPath = join(migrationsDir, entry.tag + ".sql");
  if (!existsSync(sqlPath)) {
    console.log(`  ${entry.tag}: SQL 文件不存在，跳过`);
    continue;
  }

  console.log(`▶ 执行迁移: ${entry.tag}`);
  const sql = readFileSync(sqlPath, "utf-8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (e) {
      const msg = String(e.message || e).slice(0, 100);
      console.log(`  语句忽略: ${msg}`);
    }
  }

  try {
    await pool.query(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)",
      [entry.tag, Date.now()],
    );
  } catch {
    /* 已记录 */
  }
  executed++;
}

await pool.end();
console.log(`✓ 迁移完成，新执行 ${executed} 个`);

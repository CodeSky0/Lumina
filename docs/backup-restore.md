# 数据库备份与恢复

## 自动备份（Neon）

Neon 提供自动时间点恢复（PITR），默认保留 7 天历史。

- **查看备份**：Neon Dashboard → 项目 → Branches → main → History
- **恢复到指定时间**：Neon Dashboard → 创建新 Branch → 选择 "Time travel" → 指定时间戳
- **配置保留期**：Neon Dashboard → Settings → PITR（付费计划可延长至 30 天）

## 手动备份（pg_dump）

```bash
# 完整备份（schema + data）
pg_dump "$DATABASE_URL" --format=custom --file=backup-$(date +%Y%m%d).dump

# 仅 schema
pg_dump "$DATABASE_URL" --schema-only --file=schema.sql

# 仅数据
pg_dump "$DATABASE_URL" --data-only --file=data.sql

# 特定表
pg_dump "$DATABASE_URL" --table=users --table=messages --file=partial.sql
```

## 恢复流程

```bash
# 从 custom 格式恢复
pg_restore --dbname="$DATABASE_URL" --clean --if-exists backup-20260101.dump

# 从 SQL 文件恢复
psql "$DATABASE_URL" < backup-20260101.sql
```

## 迁移文件

所有 schema 变更通过 `drizzle/migrations/` 下的 SQL 文件管理，按序号顺序执行：

```
0000 ~ 0011：已发布的迁移
```

部署时 Vercel prebuild 钩子自动执行 `drizzle-kit migrate`。

## 备份策略建议

| 频率 | 方法 | 保留期 |
|------|------|--------|
| 实时 | Neon PITR | 7 天（免费）/ 30 天（付费） |
| 每日 | pg_dump → 对象存储 | 30 天 |
| 每周 | pg_dump → 异地备份 | 90 天 |

## 灾难恢复步骤

1. 在 Neon Dashboard 创建新 Branch（从最近的健康时间点）
2. 获取新 Branch 的连接串
3. 更新 Vercel 环境变量 `DATABASE_URL` 为新连接串
4. 重新部署应用
5. 验证数据完整性
6. 将新 Branch promote 为 main（确认无误后）

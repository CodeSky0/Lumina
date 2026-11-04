# Lumina 内网单机部署与运维

本文对应仓库当前的 `compose.yaml`、两个 Dockerfile、`deploy/nginx.conf` 和 Go/Next.js 实际配置。目标是单台内网 Linux 主机，由 Nginx 提供唯一浏览器入口。

> 本次交付只写入并静态检查部署资产；未声称在编写环境执行 Docker 构建、Compose 启动、迁移或浏览器测试。所有下列 Docker/E2E 命令均需在目标机执行。

## 1. 拓扑与数据边界

```text
浏览器
  │ HTTP :8080（默认）
  ▼
Nginx ── /、静态页面 ──────► Web (Next.js standalone :3000)
  ├──── /api/* ────────────► API (Go :8080) ──► PostgreSQL 16
  ├──── /ws?ticket=... ────► API WebSocket ───► Redis 7 Pub/Sub、限流、在线状态
  └──── /health/live|ready ► API                └─► uploads 持久卷

postgres 健康 → migrate（一次性）→ seed（一次性）→ api 健康 → web → nginx
```

- 只有 Nginx 发布宿主机端口；其他服务仅在 `backend` 网络通信。
- PostgreSQL 是业务事实来源；Redis 持久卷用于缩短重启影响，但不作为消息补偿来源。
- 上传对象保存在 `uploads:/data/uploads`，数据库只保存元数据，因此备份必须同时覆盖两者。
- API/Web 容器以 UID/GID `10001` 非 root 运行，启用只读根文件系统、删除 capabilities 和 `no-new-privileges`。
- Compose 为各服务设置了 CPU、内存和 PID 上限；目标机仍应按实际并发调整。

## 2. 目标机准备

建议：Linux x86_64/arm64、Docker Engine 24+、Compose v2.24+、4 GiB 内存、10 GiB 以上空闲磁盘。保证宿主机 `8080/tcp` 未被占用，或修改 `HTTP_PORT`。

```bash
docker version
docker compose version
cp .env.example .env
chmod 600 .env
```

`.env.example` 没有真实秘密，但示例值也不能用于正式运行。首次启动前至少替换：

| 变量 | 要求 |
| --- | --- |
| `POSTGRES_PASSWORD` | 独立高随机密码；同时更新 `DATABASE_URL` 中的密码 |
| `REDIS_PASSWORD` | 独立高随机密码 |
| `JWT_SECRET` | 至少 32 字节，建议 `openssl rand -hex 32` |
| `SEED_ADMIN_PASSWORD` 等三个密码 | 至少 12 位，首次初始化前设置 |
| `SEED_DEVICE_SECRET` | 至少 32 位独立随机值 |
| `PUBLIC_ORIGIN`、`CORS_ALLOWLIST` | 与地址栏来源完全一致，不带路径和末尾 `/` |

示例：

```bash
openssl rand -hex 32
# 假设教师从 http://192.168.10.20:8080 访问：
# PUBLIC_ORIGIN=http://192.168.10.20:8080
# CORS_ALLOWLIST=http://192.168.10.20:8080
```

`DATABASE_URL` 使用 URL 格式；若用户名或密码含 `@`、`:`、`/`、`%` 等保留字符，必须百分号编码。使用十六进制随机密码可避免编码错误。不要把 `.env` 提交到 Git、复制到镜像或写入文档。

## 3. 构建、启动与初始化

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=200 migrate seed
docker compose logs --tail=100 api web nginx
curl --fail http://127.0.0.1:8080/health/ready
```

首次 `up --build` 会先构建 `lumina-api:local`，再供 `migrate`、`seed` 和 `api` 共用。正常的一次性容器会退出并显示状态码 0。后续 `docker compose up -d` 会按依赖再次执行尚未应用的迁移和幂等 seed。

可分别查看迁移记录与种子数量：

```bash
set -a; . ./.env; set +a
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c 'SELECT version, applied_at FROM schema_migrations ORDER BY version;'
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM channels) AS channels, (SELECT count(*) FROM teaching_assignments) AS assignments;"
```

如初始化失败，先修复配置后重新执行：

```bash
docker compose up -d --build migrate seed
docker compose logs --tail=200 migrate seed
docker compose up -d
```

### 默认账号与密码轮换

示例账号为 `admin`、`teacher001`、`class01`，密码见 `.env.example`。这些值仅供本地演示。

- 三个 `SEED_*_PASSWORD` 必须在**第一次创建数据卷前**修改。
- 当前 `seed.upsertUser` 的 `ON CONFLICT` 不更新 `password_hash`。已有数据卷上仅修改密码变量再运行 seed，**不会修改已有密码**。测试环境若确定要重置全部演示数据，可在备份后执行 `docker compose down -v` 再初始化；这会永久删除数据库、Redis 和上传文件，生产禁止使用。
- 已有正式账号需要密码管理功能或经过审核的数据库密码轮换流程，不能用 `down -v` 代替。
- 修改 `JWT_SECRET` 后重建 API，已有 Access Token 会失效；刷新令牌哈希不落 JWT 密钥，但用户可能仍需重新登录。
- 修改 `SEED_DEVICE_SECRET` 后，下一次 seed 会更新设备码哈希，旧设备码失效；应通过管理员重新分发新码。

## 4. HTTP、HTTPS 与来源校验

当前开箱配置是**受控内网 HTTP 单机模式**：`APP_ENV=development`、`REFRESH_COOKIE_SECURE=false`。这是为了让 HttpOnly 刷新 Cookie 能在 HTTP 下工作，不表示适合公网。请用主机防火墙限制来源网段，不要把端口直接暴露到互联网。

启用 HTTPS 时必须同时：

1. 在 Nginx 配置 443/TLS 证书，并把 HTTP 重定向到 HTTPS；
2. 设置 `APP_ENV=production`、`REFRESH_COOKIE_SECURE=true`；
3. 把 `PUBLIC_ORIGIN`、`CORS_ALLOWLIST` 改为相同的 `https://...` 来源；
4. 重新启动并验证刷新页面、WebSocket `wss://` 和文件下载。

`CORS_ALLOWLIST` 也用于 WebSocket Origin 校验。多来源可用英文逗号分隔，但不能使用 `*`。Nginx 覆盖 `X-Forwarded-For` 为直接客户端地址，API 只信任配置的代理网段。

## 5. Nginx 与上传限制

`deploy/nginx.conf` 提供：

- `/` → Web；`/api/` → API；`/ws` → API WebSocket；
- WebSocket `Upgrade`/`Connection` 头、75 秒读写超时、关闭代理缓冲；
- API 65 秒超时；
- `client_max_body_size 21m`，给 20 MiB 文件及 multipart 开销预留约 1 MiB；
- `/health/live`、`/health/ready` 同源健康检查。

应用层仍独立限制图片 5 MiB、其他文件 20 MiB，并检查扩展名、声明大小、实际大小和 MIME。修改任何一侧限制时都要同步评估另一侧。

```bash
docker compose exec nginx nginx -t
docker compose restart nginx
```

## 6. 备份

备份应包含 PostgreSQL 自定义格式转储和完整上传目录。Redis 不含业务消息，可不作为核心备份；若需保留在线/限流短期状态，可另行备份 AOF，但通常不应恢复过期认证状态。

以下命令在仓库根目录执行。维护窗口内先停止写入入口，以保证数据库与上传目录的一致性：

```bash
set -a; . ./.env; set +a
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker compose stop nginx web api

docker compose exec -T postgres pg_dump \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "backups/lumina-${stamp}.dump"
docker compose run --rm --no-deps --entrypoint tar api \
  -czf - -C /data/uploads . > "backups/uploads-${stamp}.tar.gz"
sha256sum "backups/lumina-${stamp}.dump" "backups/uploads-${stamp}.tar.gz" \
  > "backups/lumina-${stamp}.sha256"

docker compose up -d
```

备份文件含敏感数据，应加密并保存在另一台受控主机，定期做恢复演练。`docker compose down` 不会删除命名卷；`down -v` 会删除，绝非备份命令。

## 7. 恢复

**恢复会覆盖目标数据库和上传目录。先核对备份时间、项目名与数据卷，必要时为当前状态再做一份备份。**

```bash
set -a; . ./.env; set +a
backup='backups/lumina-请替换.dump'
upload_backup='backups/uploads-请替换.tar.gz'
test -s "$backup" && test -s "$upload_backup"

docker compose stop nginx web api
docker compose up -d postgres redis
docker compose exec postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# 数据库连接已随 API 停止而关闭；在 postgres 管理库中重建业务库。
docker compose exec -T postgres dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"
docker compose exec -T postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
docker compose exec -T postgres pg_restore \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner < "$backup"

docker compose run --rm --no-deps --entrypoint sh api -c \
  'rm -f /data/uploads/* && tar -xzf - -C /data/uploads' < "$upload_backup"
docker compose up -d
curl --fail http://127.0.0.1:8080/health/ready
```

恢复后抽查登录、历史消息、未读数和文件下载，再开放 Nginx 给师生。

## 8. 日志、状态与故障定位

```bash
docker compose ps -a
docker compose logs -f --tail=200 api
docker compose logs -f --tail=200 web nginx
docker compose logs --tail=200 migrate seed postgres redis
curl -i http://127.0.0.1:8080/health/live
curl -i http://127.0.0.1:8080/health/ready
```

- `/health/live` 只表示进程存活；`/health/ready` 同时 Ping PostgreSQL 和 Redis。
- API 日志包含请求 ID、方法、路径、状态、耗时和脱敏用户 ID；排障时用响应中的 `request_id` 检索。
- 若 WebSocket 断开，先检查 Nginx `/ws`、Origin 是否与 `CORS_ALLOWLIST` 一致、API/Redis 日志；客户端会自动指数退避重连并从数据库重新同步。
- 若上传返回 413，检查 Nginx 21m 与应用 5/20 MiB 限制；若返回 400，检查 multipart 是否含 `channel_id`、`declared_size` 和 `file`。

停止与升级：

```bash
docker compose stop                 # 保留容器和卷
# 正式升级前先备份
docker compose up -d --build        # 构建新镜像并按顺序执行迁移/seed
docker compose image inspect lumina-api:local lumina-web:local
```

## 9. 验证与 E2E

基础验证（目标机）：

```bash
docker compose config --quiet
docker compose exec nginx nginx -t
curl --fail http://127.0.0.1:8080/health/ready
npm --prefix tests ci
npm --prefix tests exec -- playwright install --with-deps chromium
npm --prefix tests run typecheck
npm --prefix tests test
```

E2E 默认使用 `http://127.0.0.1:8080` 和 `.env.example` 的演示密码。自定义时：

```bash
E2E_BASE_URL=http://192.168.10.20:8080 \
E2E_ADMIN_PASSWORD='实际管理员密码' \
E2E_TEACHER_PASSWORD='实际教师密码' \
E2E_CLASSROOM_PASSWORD='实际教室密码' \
npm --prefix tests test
```

断线用例默认执行 `docker compose stop nginx` 和 `docker compose start nginx`，因此只能在有权操作本机 Compose 项目的测试实例运行。非 Docker 联调环境可通过 `E2E_PROXY_STOP_CMD` 与 `E2E_PROXY_START_CMD` 提供等价的本地代理停止/恢复命令。全部测试单 worker 串行执行；会产生真实数据。后端登录接口每来源每分钟最多 10 次，测试中的 API/UI 登录共用保守节流器，因此完整套件可能需要数分钟，不会绕过或 mock 限流。不要把失败重试或报告中的 trace（可能含会话信息）公开分享。

## 10. 部署注意事项

1. seed 不覆盖既有账号密码，密码轮换注意事项见第 3 节。
2. 宿主机 `next.config.ts` 未声明 `output: "standalone"`；Web Dockerfile 在构建容器副本中启用 standalone，运行镜像使用 `node server.js`，不影响宿主机开发启动。
3. 教师上传与批量通知均调用真实 API；前端会提交 `channel_id` 并展示后端返回的逐通道 `items` 结果。
4. 当前源码提供完整的 Go、Vitest、迁移、seed 和 Playwright 验证命令。Docker 镜像与 Compose 仍须在安装 Docker 的目标机执行第 9 节检查，不能以静态检查替代容器验收。

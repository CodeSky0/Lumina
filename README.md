# Lumina 校园即时通讯 Monorepo

Lumina 面向校内管理员、教师和教室大屏，提供教学通道、实时消息、紧急确认、批量通知、公告与受鉴权保护的文件传输。业务事实保存在 PostgreSQL，Redis 只承担实时分发、在线状态和短期认证状态，浏览器不持久化业务消息。

## 仓库结构

- `apps/api`：Go 1.23、Gin、GORM、SQL 迁移、幂等 seed。
- `apps/web`：Next.js 16 / React 19.2 / Tailwind CSS 4 三端界面。
- `deploy/nginx.conf`：同源 `/`、`/api`、`/ws` 反向代理。
- `compose.yaml`：PostgreSQL 16、Redis 7、迁移、seed、API、Web、Nginx。
- `tests/e2e`：针对真实 API、UI 和 WebSocket 的 Playwright 测试，不 mock 业务。
- `docs/deployment.md`：内网单机部署、备份恢复和运维。
- `docs/api.md`：与当前实现一致的接口契约。

## 在目标机启动（需要 Docker）

**当前源码已通过 Go 单元测试与静态检查、Web 单元测试/类型检查/生产构建，并在真实 PostgreSQL 上完成迁移和两轮幂等 seed。当前环境没有 Docker，因此镜像构建和 Compose 启动仍须在安装 Docker 的目标机验证，不能把这一说明视为容器验收结果。**

前置要求：Docker Engine 24+、Docker Compose v2.24+、可用磁盘 10 GiB 以上，建议内存 4 GiB 以上。

```bash
cp .env.example .env
# 编辑 .env：替换数据库、Redis、JWT、seed 密码和设备密钥；
# 同时把 PUBLIC_ORIGIN、CORS_ALLOWLIST 改成浏览器实际使用的来源。
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 migrate seed
curl --fail http://127.0.0.1:8080/health/ready
```

打开 `http://目标机地址:8080`。如果通过非本机地址访问，必须先同步修改 `.env` 中的 `PUBLIC_ORIGIN` 和 `CORS_ALLOWLIST`，例如都为 `http://192.168.10.20:8080`，再执行 `docker compose up -d`。

启动顺序为：PostgreSQL 健康检查 → `migrate` 执行未应用的 `*.up.sql` → `seed` 幂等初始化 → API 就绪 → Web → Nginx。`migrate` 和 `seed` 正常结束后显示 `Exited (0)`，不是故障。数据库、Redis AOF 和上传文件分别使用 `postgres_data`、`redis_data`、`uploads` 持久卷；PostgreSQL、Redis、API、Web 不直接发布宿主机端口。

## 本地演示账号

以下只适用于 `.env.example` 中的示例配置，不是生产凭据：

| 角色 | 用户名 | 示例密码 | 入口 |
| --- | --- | --- | --- |
| 管理员 | `admin` | `Admin@2026Lumina` | `/admin` |
| 教师 | `teacher001` | `Teacher@2026Lumina` | `/teacher` |
| 教室 | `class01` | `Classroom@2026Lumina` | `/classroom` |

首次初始化前必须修改默认密码和全部密钥。当前 seed 会更新账号资料，但**不会用新的 `SEED_*_PASSWORD` 覆盖已有账号密码**，详见部署文档。默认 HTTP 配置使用 `APP_ENV=development`、`REFRESH_COOKIE_SECURE=false`，否则 Secure 刷新 Cookie 在 HTTP 下无法恢复会话。启用 HTTPS 后必须改为 `production` / `true`。

## 真实 E2E（在已启动 Compose 的目标机运行）

测试会创建真实消息、公告确认和上传文件；断线用例会实际停止再启动 Nginx。请不要对正在服务师生的生产实例直接运行。

```bash
npm --prefix tests ci
npm --prefix tests exec -- playwright install --with-deps chromium
npm --prefix tests run typecheck
npm --prefix tests test
```

若修改了 seed 密码，运行前设置 `E2E_ADMIN_PASSWORD`、`E2E_TEACHER_PASSWORD`、`E2E_CLASSROOM_PASSWORD`。默认地址为 `http://127.0.0.1:8080`，可用 `E2E_BASE_URL` 覆盖。断线测试要求从仓库目录可执行 `docker compose`，并具备操作该 Compose 项目的权限。

覆盖范围：三端登录、前端和服务端越权、管理员自动建通道、两个独立浏览器双向实时消息、教室大屏回复、刷新持久化、全校紧急公告与紧急消息确认、批量通知、未读/已读、真实文件上传与 UI 下载、并发消息排序、Nginx 断线重连。测试单 worker 串行运行，避免共享种子账号之间互相干扰；登录按真实接口限流做保守节流，因此完整套件可能需要数分钟。

## 非容器开发检查

这些命令不需要 Docker，但各自只验证代码，不替代真实 Compose/E2E：

```bash
# API（需要本机 Go 1.23）
cd apps/api
go test ./...

# Web（另一个终端，需要本机 Node.js 22）
cd apps/web
npm ci
npm run typecheck
npm test
npm run build
```

完整部署、TLS、安全、备份恢复、日志、升级和验证步骤见 [docs/deployment.md](docs/deployment.md)；接口细节见 [docs/api.md](docs/api.md)；本次实际验证结果见 [docs/testing.md](docs/testing.md)。

## 实现说明

- `next.config.ts` 源文件未开启 standalone；Web Dockerfile 会在容器构建副本中显式启用，不影响宿主机开发启动。
- 教师上传会提交后端必需的 `channel_id`，批量通知界面会展示 `{data:{items:[...]}}` 中每个目标通道的真实处理结果。
- 普通教学通道只允许所属教师和本班教室写入；管理员只读，广播通道的校园公告通过独立公告接口发布。

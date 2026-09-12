# Lumina 架构文档

## 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel (Next.js 16 主应用)                                  │
│  ├─ /login        统一登录 (Better-Auth)                      │
│  ├─ /dashboard    角色 → 端 中转                              │
│  ├─ /teacher      教师端  ┐                                   │
│  ├─ /parent       家长端  ├─ 共用 ChatLayout + WebSocket       │
│  ├─ /screen       大屏端  ┘                                   │
│  ├─ /admin        管理端 (CRUD + 批量导入)                    │
│  └─ Server Actions (lib/admin, lib/messages, lib/images)     │
│         ├── Drizzle ORM ──→ Neon Serverless Postgres         │
│         ├── @vercel/blob ──→ Vercel Blob (图片, WebP)        │
│         └── publish.ts ────┐                                 │
└─────────────────────────────┼───────────────────────────────┘
                              │ POST /publish
┌─────────────────────────────▼───────────────────────────────┐
│  Cloudflare Worker (cf-worker/, 独立部署)                     │
│  └─ RoomDO (Durable Object, SQLite-backed)                   │
│       每会话一个实例，内存缓存 50 条，支持 backfill            │
└─────────────────────────────────────────────────────────────┘
```

## 三端架构

同一 Next.js 应用，通过路由前缀划分四端，统一登录后按角色中转。

| 端 | 路由 | 角色 | 说明 |
|----|------|------|------|
| 教师端 | `/teacher` | `teacher` | 班级群聊 + 家长私信 + 紧急消息 |
| 家长端 | `/parent` | `parent` | 班级群聊 + 教师私信 |
| 大屏端 | `/screen` | `classroom` | 仅绑定班级群聊 |
| 管理端 | `/admin` | `admin` | 用户/班级/绑定 CRUD + 批量导入 |

三端共用 `ChatLayout` 组件，通过 `userRole` 与 `allowUrgent` props 差异化。

## 认证

- **方案**：Better-Auth + username/password plugin
- **语义**：username = 登录 ID（如 `T-A3X9K2`），password = Token
- **角色**：`users.role` 枚举字段（parent/teacher/classroom/admin）
- **会话**：JWT Cookie，Edge proxy 校验 Cookie 存在性，Server Component/Action 查 DB 校验角色

## 权限（三层 RBAC）

1. **Edge Proxy** (`proxy.ts`)：Cookie 存在性校验，不查 DB
2. **Server Component**：角色校验 + 重定向
3. **Server Action** (`lib/rbac.ts`)：资源级权限断言（查 DB 校验绑定关系）

## 实时通信

```
Client (WS) ←→ CF Durable Object ←→ Next.js (HTTP POST /publish) ←→ Server Action (写 DB)
```

- **房间命名**：群聊 `class-{classId}`，私信 `dm-{sortedUserAId}-{sortedUserBId}`
- **Durable Object**：每会话一个实例，Hibernatable WebSocket API，内存缓存 50 条
- **断线恢复**：客户端自动重连 + backfill 补发
- **降级**：未配置 CF_WORKER_URL 时静默降级为纯 DB 模式

## 数据库

PostgreSQL (Neon Serverless) + Drizzle ORM，9 张表：

- `users` — 用户（含 role 字段，复用为 Better-Auth user 表）
- `accounts` / `sessions` / `verifications` — Better-Auth 认证表
- `classes` — 班级（含 screenId 大屏绑定）
- `conversations` — 会话（group/direct）
- `teacher_classes` — 教师↔班级多对多
- `parent_students` — 家长↔班级（含学生姓名）
- `messages` — 消息（text/image/urgent）

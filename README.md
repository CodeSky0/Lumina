# Lumina 流光

> 极简实时家校沟通平台 — 让教师、家长、教室大屏三端在同一空间里实时对话。
>
> "流光"取意于消息在屏幕之间流转如光，轻、快、不打扰。

Lumina 是一个面向 K12 场景的**极简实时家校沟通平台**。它把教师端、家长端、教室大屏端统一在一个 Next.js 应用里，通过 Cloudflare Durable Objects 推送实时消息，以会话（conversation）为核心组织消息流，提供班级群聊与一对一私信两种形态，并配备一个隐藏入口的管理端用于批量开通账号与维护绑定关系。

---

## 目录

- [特性一览](#特性一览)
- [技术栈](#技术栈)
- [架构总览](#架构总览)
- [四端设计](#四端设计)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [数据库](#数据库)
- [认证与权限](#认证与权限)
- [实时通信](#实时通信)
- [图片处理](#图片处理)
- [管理端](#管理端)
- [设计系统](#设计系统)
- [测试](#测试)
- [部署](#部署)
- [开发命令](#开发命令)
- [约定与注意事项](#约定与注意事项)
- [许可证](#许可证)

---

## 特性一览

- **三端实时沟通**：教师、家长、教室大屏同处一个聊天室范式（联系人列表 + 聊天窗口 + 消息流），大屏不仅是接收方，也可主动发言。
- **班级群聊 + 家长私信**：以会话（conversation）为核心，群聊按班级，私信按教师↔家长一对一。
- **紧急消息**：教师与大屏可发送 `urgent` 类型消息，红色高亮入流。
- **图片消息**：上传 jpeg/png/webp，服务端 Sharp 无损转 WebP、自动旋转、清理 EXIF，存入 Vercel Blob。
- **未读计数**：基于 `message_reads` 表记录每用户×会话的已读位置，列表实时显示未读数。
- **断线恢复**：客户端 WebSocket 自动重连 + 向 Durable Object 请求 `backfill` 补发离线期间消息。
- **降级运行**：未配置 Cloudflare Worker 时静默降级为纯数据库模式，功能不中断。
- **隐藏管理端**：管理员入口 `/admin/login` 不在 UI 暴露，首次访问且库中无 admin 时显示注册表单，之后恢复为登录。
- **批量导入**：CSV 粘贴或上传，批量创建教师/学生（含家长账号），同名家长自动合并为一个账号绑定多个孩子。
- **ID + Token 登录**：摒弃邮箱注册，管理员签发 `T-A3X9K2` 形式的短码 ID 与一次性 Token，师生零配置上手。
- **三层 RBAC**：Edge Proxy 校验 Cookie → Server Component 校验角色 → Server Action 校验资源绑定关系。
- **Yohaku Design System**：全站统一设计令牌，支持暗色模式（纯灰反转）与大屏独立色阶。

---

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端框架 | Next.js (App Router) | 16.3.4 |
| UI 库 | React | 19.2.8 |
| 样式 | Tailwind CSS | 4.3.3 |
| 设计系统 | Yohaku Design System | 0.0.2 |
| 动画 | Motion (Framer Motion) | 13.2.0 |
| 后端 | Next.js Server Actions + API Routes | — |
| 数据库 | PostgreSQL (Neon Serverless) + Drizzle ORM | 0.45.2 |
| 认证 | Better-Auth + username/password plugin | 1.7.3 |
| 实时通信 | Cloudflare Durable Objects (WebSocket) | — |
| 文件存储 | Vercel Blob + Sharp | 0.35.4 |
| 校验 | Zod | 4.5.4 |
| CSV 解析 | PapaParse | 5.7.0 |
| 测试 | Vitest | 4.1.11 |
| 类型 | TypeScript | 7.0.2 |
| Lint | ESLint + eslint-config-next | 9.x |

---

## 架构总览

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

- **主应用**部署在 Vercel，承担认证、业务逻辑、数据库读写、图片处理、消息持久化。
- **实时层**是独立部署的 Cloudflare Worker，仅负责 WebSocket 广播与短期内存缓存，不持久化业务数据。
- 两者通过 HTTP `POST /publish` 单向通信（主应用 → Worker），客户端与 Worker 之间走 WebSocket。

更详细的架构说明见 [docs/architecture.md](docs/architecture.md)。

---

## 四端设计

同一 Next.js 应用，通过路由前缀划分四端，统一登录后按角色中转。

| 端 | 路由 | 角色 | 能力 |
|----|------|------|------|
| 教师端 | `/teacher` | `teacher` | 班级群聊 + 家长私信 + 紧急消息 |
| 家长端 | `/parent` | `parent` | 班级群聊 + 教师私信 |
| 大屏端 | `/screen` | `classroom` | 绑定班级群聊，可收可发 |
| 管理端 | `/admin` | `admin` | 用户/班级/绑定 CRUD + 批量导入 + Token 管理 |

三端（教师/家长/大屏）共用 `ChatLayout` 组件，通过 `userRole` 与 `allowUrgent` 等 props 差异化。登录后 `/dashboard` 按 `role` 重定向至对应端。

---

## 项目结构

```
lumina/
├── app/                    Next.js App Router
│   ├── login/              统一登录页
│   ├── dashboard/          登录后按角色中转
│   ├── teacher/            教师端
│   ├── parent/             家长端
│   ├── screen/             教室大屏端
│   ├── admin/              管理端（含 tabs/ 与 components/）
│   ├── api/auth/[...all]/  Better-Auth API handler
│   ├── layout.tsx          根布局
│   └── globals.css         Tailwind + Yohaku tokens
├── components/
│   ├── chat/               聊天域组件（ChatLayout/ContactSidebar/ChatWindow/MessageBubble/MessageInput/ChatHeader）
│   └── ui/                 基础原子组件（Button/Input/Select/Card/Badge/Dialog/Toast）
├── lib/
│   ├── auth/               Better-Auth 服务端/客户端/会话辅助
│   ├── db/                 Drizzle 连接 + schema
│   ├── admin/actions.ts    管理端 Server Actions
│   ├── messages/actions.ts 消息 Server Actions（会话/发送/查询/已读）
│   ├── realtime/           实时通讯契约 + publish + WS hooks
│   ├── images/upload.ts    图片上传 Server Action
│   ├── rbac.ts             服务端权限断言
│   └── env.ts              环境变量集中校验
├── cf-worker/              Cloudflare Worker 子项目（实时通讯层）
│   ├── src/index.ts        RoomDO + Worker 入口
│   └── wrangler.toml       DO 绑定 + 迁移配置
├── drizzle/migrations/     数据库迁移
├── tests/unit/             Vitest 单元测试
├── docs/                   架构文档与优化计划
├── scripts/prebuild.mjs    Vercel 构建时自动迁移钩子
├── proxy.ts                Next.js 16 Edge 路由保护代理
├── drizzle.config.ts       Drizzle Kit 配置
└── vitest.config.ts        Vitest 配置
```

---

## 快速开始

### 前置条件

- Node.js ≥ 20
- npm（或 pnpm，仓库附带 `pnpm-lock.yaml`）
- 一个 Neon Postgres 数据库（免费档即可）
- 一个 Vercel Blob Store
- （可选）Cloudflare 账号用于部署实时通讯层

### 步骤

```bash
# 1. 克隆仓库
git clone <repo-url> lumina
cd lumina

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，至少填入：
#   DATABASE_URL          — Neon 连接串
#   BLOB_READ_WRITE_TOKEN — Vercel Blob 读写凭证
#   BETTER_AUTH_SECRET    — JWT 签名密钥（可用 openssl rand -base64 32 生成）

# 4. 推送数据库 schema
npm run db:push

# 5. 启动开发服务器
npm run dev
```

访问 `http://localhost:3000` 会自动跳转到 `/login`。

**首次创建管理员**：直接访问 `http://localhost:3000/admin/login`，此时数据库无 admin，页面显示注册表单，创建后即恢复为登录态。后续访问该地址均为登录表单。

> 实时通讯层是可选的。未配置 `CF_WORKER_URL` 时，应用会静默降级为纯数据库模式（通过 5 秒间隔的轮询兜底拉取新消息）。要启用实时推送，请按 [部署 → 实时通讯层](#部署) 部署 `cf-worker` 并填入两个环境变量。

---

## 环境变量

| 变量 | 必需 | 作用 |
|------|------|------|
| `DATABASE_URL` | 是 | Neon Serverless Postgres 连接串，形如 `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require` |
| `BLOB_READ_WRITE_TOKEN` | 是 | Vercel Blob 读写凭证，从 Vercel Dashboard 创建 Blob Store 后获取 |
| `BETTER_AUTH_SECRET` | 是 | JWT 签名密钥，随机长字符串，可用 `openssl rand -base64 32` 生成 |
| `BETTER_AUTH_URL` | 否 | 应用部署地址，本地默认 `http://localhost:3000` |
| `CF_WORKER_URL` | 否 | CF Worker URL，形如 `https://lumina-realtime.<account>.workers.dev`。缺失则降级为纯 DB 模式 |
| `CF_WORKER_AUTH_TOKEN` | 否 | Next.js 调用 CF Worker 时携带的共享密钥，需与 cf-worker 的 `LUMINA_API_TOKEN` 一致 |
| `NEXT_PUBLIC_CF_WORKER_URL` | 否 | 客户端 WebSocket 连接地址（通常与 `CF_WORKER_URL` 相同，但需以 `NEXT_PUBLIC_` 前缀暴露给浏览器） |

环境变量在 `lib/env.ts` 中通过 Zod schema 集中校验，缺失必需变量会在首次服务端调用时抛出并终止启动，避免运行时才发现问题。

---

## 数据库

PostgreSQL（Neon Serverless）+ Drizzle ORM，使用 `neon-http` 无状态驱动以适配 Vercel Serverless 冷启动。共 9 张表：

| 表 | 作用 |
|----|------|
| `users` | 用户，含 `role` 与 `username` 字段，复用为 Better-Auth 的 user 表 |
| `accounts` | Better-Auth account 表（存密码哈希） |
| `sessions` | Better-Auth session 表 |
| `verifications` | Better-Auth verification 表 |
| `classes` | 班级，含 `screen_id` 大屏 1:1 绑定 |
| `conversations` | 会话，`type` ∈ `group`/`direct`；群聊关联 `class_id`，私信关联 `participant_a_id`/`participant_b_id` |
| `teacher_classes` | 教师 ↔ 班级 多对多 |
| `parent_students` | 家长 ↔ 班级（含 `student_name`），同一家长可绑定多个孩子 |
| `messages` | 消息，`type` ∈ `text`/`image`/`urgent`，`status` ∈ `pending`/`delivered`/`displayed` |
| `message_reads` | 用户 × 会话 的已读位置（`last_read_at`），支持未读计数 |

**关系图**：

```
users ─┬─ teacher_classes ─── classes
       ├─ parent_students  ─── classes (含 student_name)
       ├─ classes.screen_id (大屏 1:1 绑定班级)
       └─ messages.sender_id
classes ─── conversations.class_id (群聊)
users   ─── conversations.participant_a/b_id (私信)
conversations ─── messages.conversation_id
users × conversations ─── message_reads
```

**常用命令**：

```bash
npm run db:generate   # 根据 schema 变更生成迁移文件
npm run db:migrate    # 执行迁移
npm run db:push       # 直接推送 schema 到数据库（开发期便捷）
npm run db:studio     # 打开 Drizzle Studio 可视化查看数据
```

---

## 认证与权限

### 认证方案

采用 **Better-Auth + username/password plugin**，但语义重新定义：

- `username` = 登录 ID，由管理端签发的短码，格式为「角色前缀 + 6 位字符」，如 `T-A3X9K2`（教师）、`P-B7M3NP`（家长）、`C-D8K2XR`（大屏）、`A-E9P4QT`（管理员）。字符集 `ABCDEFGHJKMNPQRSTUVWXYZ23456789`（去除易混淆的 0/O/1/I/L）。
- `password` = 一次性 Token，由管理端签发，仅在创建/重置时返回明文一次。
- `users` 表复用为 Better-Auth 的 user 表（`usePlural` 映射），`role` 与 `tokenHash` 作为 `additionalFields`（`input: false`，由服务端逻辑写入）。
- 会话以 JWT Cookie 存储。

### 三层 RBAC

| 层 | 位置 | 校验内容 | 性能特征 |
|----|------|----------|----------|
| Edge Proxy | `proxy.ts` | 会话 Cookie 存在性 | 不查 DB，Edge 低延迟 |
| Server Component | 各 `page.tsx` | 角色匹配，否则重定向 | 查 DB 取 session |
| Server Action | `lib/rbac.ts` | 资源级权限（如家长是否绑定该班级） | 查 DB 校验绑定关系 |

**资源级权限约束**（在 Server Action 中强制）：

- 家长仅能向 `parent_students` 中自己关联的 `class_id` 发消息
- 教师仅能向 `teacher_classes` 中自己关联的 `class_id` 发消息
- 大屏仅订阅 `class-{own_class_id}` WebSocket 房间
- 私信仅当事人双方可访问

违规抛出 `ForbiddenError`（映射为 403），前端仅做 UI 禁用，服务端才是权威。

---

## 实时通信

```
Client (WS) ←→ CF Durable Object ←→ Next.js (HTTP POST /publish) ←→ Server Action (写 DB)
```

### 数据流

1. 用户在客户端发送消息 → Server Action `sendMessage`
2. Server Action 写入 `messages` 表
3. Server Action 调用 `publishMessage` → `POST {CF_WORKER_URL}/publish`（携带 `Bearer CF_WORKER_AUTH_TOKEN`）
4. Worker 将消息转发给对应房间的 `RoomDO` Durable Object
5. RoomDO 广播给该房间所有已连接的 WebSocket 客户端
6. 客户端收到消息帧，合并进本地消息列表

### 房间命名

- 班级群聊：`class-{classId}`
- 私信：`dm-{sortedUserAId}-{sortedUserBId}`（两个 userId 排序后拼接，保证双向一致）

### Durable Object

- 每个会话一个 `RoomDO` 实例（SQLite-backed，符合 Cloudflare 免费计划要求）
- 使用 Hibernatable WebSocket API，连接由平台自动管理
- 内存缓存最近 50 条消息，支持断线补发（`backfill`）
- 客户端重连后发送 `{ kind: "backfill", since: <lastCreatedAt> }`，DO 返回离线期间的消息

### 帧协议

**Worker → 客户端（WebSocket）**：

- `{ kind: "message", messageId, senderName, senderId, senderRole, type, content, mimeType, createdAt }` — 新消息
- `{ kind: "backfill", messages: [...] }` — 补发离线消息
- `{ kind: "heartbeat", serverTime }` — 心跳

**客户端 → Worker（WebSocket）**：

- `{ kind: "backfill", since }` — 请求补发
- `{ kind: "ping" }` — 心跳探测

所有帧在 `lib/realtime/contract.ts` 中以 Zod schema 定义，前后端共用类型。

### 降级

未配置 `CF_WORKER_URL` 或 `CF_WORKER_AUTH_TOKEN` 时，`publishMessage` 静默跳过，客户端 `ChatLayout` 检测到未连接 WebSocket 时启用 5 秒间隔的轮询兜底拉取新消息（页面不可见时暂停）。

---

## 图片处理

图片上传走 `lib/images/upload.ts` Server Action，流水线如下：

1. **环境校验**：通过 `getEnv()` 强制读取 `BLOB_READ_WRITE_TOKEN`
2. **大小校验**：≤ 5MB
3. **类型校验**：仅接受 `image/jpeg`、`image/png`、`image/webp`
4. **Sharp 转换**：`.rotate()`（按 EXIF 方向自动旋转）→ `.webp({ quality: 100, lossless: true })`（无损 WebP）→ `.toBuffer()`。未调用 `.keepExif()`，元数据被清理。
5. **上传**：文件名 `msg-{uuid}.webp` → `@vercel/blob.put()`（`addRandomSuffix: false`）
6. **入库**：返回的 Blob URL 存入 `messages.content`，`mimeType` 记为 `image/webp`

禁止前端压缩或直接存原图。`next.config.ts` 中配置了 `images.formats: ["image/webp"]` 与 Vercel Blob 域名的 `remotePatterns`，便于 `next/image` 优化。

---

## 管理端

管理端位于 `/admin`，入口 `/admin/login` **不在 UI 中暴露**，需手动输入 URL 访问。

### 首次初始化

首次访问时若数据库无 admin 用户，页面显示**注册表单**（创建首个管理员）；之后恢复为正常登录。

### 功能

- **用户管理**：创建教师/家长/大屏/管理员，自动生成短码 ID + 一次性 Token（仅此次返回明文）；重置 Token；删除用户（不能删除自己）。
- **班级管理**：创建/重命名/删除班级。
- **绑定管理**：教师 ↔ 班级（多对多）、家长 ↔ 班级（含学生姓名）、大屏 ↔ 班级（1:1，UNIQUE 约束保证一班一屏）。
- **批量导入**：
  - **教师**：CSV 格式 `姓名,班级名`，可选绑定班级
  - **学生/家长**：CSV 格式 `学生姓名,家长姓名,班级名`，同一家长姓名只创建一个账号，多个孩子绑定到同一账号
  - 支持粘贴文本或上传 CSV 文件，使用 PapaParse 解析
  - 单次最多 500 条

所有管理端 Server Actions 在 `lib/admin/actions.ts`，首行调用 `requireUser("admin")` 强制校验角色。

---

## 设计系统

全站采用 [Yohaku Design System](https://github.com/Innei)（`@yohaku/design-system`）作为统一设计系统，通过 `globals.css` 中的 `@import "@yohaku/design-system/tokens.css"` 引入令牌。

### 核心约束

- **色彩**：三档中性灰 `neutral-1~10`（表面/边框/文字），主色 `accent`（梅色 `#c56473`），语义色 `error`/`success`
- **字体**：serif 标题 + sans 正文；**禁止 `font-bold`，改用 `font-medium`**（CJK 字体禁止合成粗体）；使用 type scale token（`text-copy-14/13`、`text-title-28/20`、`text-label-12`）替代硬编码字号
- **表面**：**禁止硬阴影**，用 `bg-neutral-2 + ring-1 ring-border` 替代 `border + shadow`；`rounded-md/lg/xl` 分层圆角
- **交互**：`bg-accent` 主 CTA，`hover:opacity-90` 轻柔反馈，`focus:ring-2 focus:ring-accent` 聚焦环
- **暗色模式**：纯灰反转（R=G=B），`--surface-paper` 暖灰夜色
- **动画**：CSS 过渡统一 `0.2s ease`；进场用 `ease-out`（`cubic-bezier(0.16, 1, 0.3, 1)`），退场用 `ease-in`；**仅用 `transform` 和 `opacity`** 保证性能；进出场动画使用 Motion 库 + `AnimatePresence`

### 组件分层

- `components/ui/` — 基础原子组件（Button、Input、Select、Card、Badge、Dialog、Toast）
- `components/chat/` — 聊天域组件（ChatLayout、ContactSidebar、ChatHeader、ChatWindow、MessageBubble、MessageInput）

---

## 测试

使用 **Vitest** 作为单元测试框架，测试文件位于 `tests/unit/`。

```bash
npm test              # 运行单元测试
npm run test:watch    # 监听模式
npm run test:coverage # 覆盖率
```

已覆盖的模块：

- `tests/unit/rbac.test.ts` — 权限断言
- `tests/unit/realtime-contract.test.ts` — 实时通讯契约（Zod schema 校验）
- `tests/unit/env.test.ts` — 环境变量校验

测试配置见 `vitest.config.ts`，使用 `@vitejs/plugin-react` 与 `@` 路径别名，`environment: "node"`。

---

## 部署

### 主应用（Vercel）

```bash
npm run build
# 或直接推送到 Vercel 连接的 Git 仓库
```

`package.json` 的 `prebuild` 钩子（`scripts/prebuild.mjs`）会在 Vercel 构建时（`VERCEL=1`）自动执行 `drizzle-kit migrate`，无需手动迁移。本地 `npm run build` 跳过自动迁移以避免无 DB 连接时失败。

在 Vercel 项目设置中配置环境变量（见 [环境变量](#环境变量)）。

### 实时通讯层（Cloudflare Worker）

```bash
cd cf-worker
npm install
npx wrangler deploy

# 设置共享密钥（需与主应用的 CF_WORKER_AUTH_TOKEN 一致）
npx wrangler secret put LUMINA_API_TOKEN
```

部署后得到 Worker URL（形如 `https://lumina-realtime.<account>.workers.dev`），将其填入主应用的 `CF_WORKER_URL`、`CF_WORKER_AUTH_TOKEN` 与 `NEXT_PUBLIC_CF_WORKER_URL`。

`cf-worker/` 是独立子项目，有自己的 `package.json` 与 `tsconfig.json`，使用 Durable Objects（SQLite-backed，符合免费计划要求）。每会话一个 `RoomDO` 实例。

### CI/CD

GitHub Actions 工作流 `.github/workflows/ci.yml` 在 PR 与 push 到 main/master 时执行：

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

pre-commit 钩子（`.husky/pre-commit` + lint-staged）对暂存的 `.ts`/`.tsx` 文件执行 `eslint --fix` 与 `prettier --write`。

---

## 开发命令

```bash
# 开发
npm run dev              # 启动开发服务器（http://localhost:3000）

# 质量保障
npm run lint             # ESLint
npm run typecheck        # TypeScript 类型检查（tsc --noEmit）
npm test                 # 运行单元测试
npm run test:watch       # 测试监听模式
npm run test:coverage    # 测试覆盖率

# 构建
npm run build            # 生产构建
npm run start            # 启动生产服务器

# 数据库
npm run db:generate      # 根据 schema 变更生成迁移文件
npm run db:migrate       # 执行迁移
npm run db:push          # 直接推送 schema 到数据库（开发期）
npm run db:studio        # Drizzle Studio 可视化

# 实时通讯层（在 cf-worker/ 目录下）
cd cf-worker && npm run dev      # 本地开发 Worker
cd cf-worker && npx wrangler deploy  # 部署
```

---

## 约定与注意事项

- **设计系统**：全面使用 Yohaku Design System tokens，不硬编码颜色/字号。禁止 `font-bold`（CJK 合成粗体禁令）、禁止硬阴影（改用 ring）。
- **组件分层**：`components/ui/` 为基础原子组件，`components/chat/` 为聊天域组件。
- **路径别名**：`@/*` → 项目根目录（在 `tsconfig.json` 与 `vitest.config.ts` 中配置）。
- **Server Actions**：业务逻辑全部用 `"use server"` 标注的 Server Actions，不使用 REST API（Better-Auth 的 `/api/auth/*` 是唯一例外）。
- **校验**：所有 Server Action 输入用 Zod schema 校验。
- **权限**：所有 Server Action 调用 `requireUser(role)` 或 `assertCanAccessConversation` 校验权限。
- **测试**：纯逻辑函数测试在 `tests/unit/`，DB 依赖函数需 mock 或用测试事务。
- **cf-worker 独立**：`cf-worker/` 是独立子项目，有自己的 `package.json` 和 `tsconfig.json`，被主项目 `tsconfig.json` 的 `exclude` 排除。
- **Tailwind CSS v4**：无配置文件，通过 `@import` 和 `@theme` 在 `globals.css` 配置。
- **TypeScript 7.0 + ESLint**：可能有兼容性误报，需区分真实问题与误报。
- **Server Actions body 大小**：`next.config.ts` 中配置 `serverActions.bodySizeLimit: "8mb"` 以支持图片上传。

---

## 许可证

[MIT](LICENSE) © 2026 Code Sky

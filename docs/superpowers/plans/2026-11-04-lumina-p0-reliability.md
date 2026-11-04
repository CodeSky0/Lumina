# Lumina P0 实时通讯可靠性实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留现有 REST/PostgreSQL/Redis 架构的前提下，实现消息幂等、事务 Outbox、逐条状态、断线恢复、优雅关闭和全局紧急通知。

**Architecture:** PostgreSQL 继续作为唯一事实源，业务事务同时写消息与 Outbox；多实例 relay 以租约方式向 Redis 至少投递一次。浏览器使用每通道内存 FIFO、100ms 合并更新和数据库游标同步，未发送业务消息不写入浏览器持久存储。

**Tech Stack:** Go 1.23、Gin、GORM、Gorilla WebSocket、PostgreSQL、Redis、Next.js 16、React 19、TypeScript、TanStack Query、Zustand、Vitest、Playwright。

## Global Constraints

- 服务端消息顺序只使用数据库自增 ID，不用时间戳排序，不使用 OFFSET。
- 心跳为 25 秒，60 秒未收到 Pong 后清理连接；重连基数为 1、2、4、8、16、30 秒并封顶。
- 同一通道严格 FIFO；每个逻辑消息只使用一个 `client_msg_id`，重试复用附件 `file_id`。
- Outbox 不设置静默丢弃次数，事件至少投递一次，客户端按 `event_id` 去重。
- 浏览器队列仅保存在内存中；存在未确认发送结果时必须注册 `beforeunload` 提醒。
- 100ms 内的事件和本地队列变化合并为一次 UI 更新。
- 不引入新的重量级依赖；React 继续以纯文本显示消息，日志不记录正文、密码、Token 或 Outbox 载荷。
- 每个模块先写失败测试，再做最小实现，通过该模块测试后才进入下一模块。

---

### Task 1: 现有行为基线

**Files:**
- 不修改文件；记录终端结果供最终 `docs/testing.md` 对比。

- [ ] **Step 1: 运行 Go 基线**

Run: `gofmt -l . && go vet ./... && go test ./... && go test -race ./... && go build ./cmd/...`，工作目录为 `apps/api`。
Expected: 全部通过，`gofmt` 无输出；若已有失败，先记录并区分历史问题与后续回归。

- [ ] **Step 2: 安装并运行 Web 基线**

Run: `npm ci && npm run typecheck && npm test && npm run build`，工作目录为 `apps/web`。
Expected: 依赖按 lockfile 安装，现有 48 个 Vitest 用例和生产构建通过。

- [ ] **Step 3: 检查真实 E2E 环境**

Run: `docker compose config --quiet`、`node --version`、`pnpm --version` 和 `npm --prefix tests exec -- playwright --version`。
Expected: 明确 Docker、pnpm、Chromium 是否可用；不可用项记入最终验证报告，不伪造通过结论。

### Task 2: 消息幂等与批量目标

**Files:**
- Create: `apps/api/migrations/000003_message_reliability.up.sql`
- Create: `apps/api/migrations/000003_message_reliability.down.sql`
- Modify: `apps/api/internal/models/models.go:155-180`
- Modify: `apps/api/internal/services/message.go:26-193,334-363`
- Modify: `apps/api/internal/httpapi/message.go:123-140`
- Test: `apps/api/internal/services/message_test.go`
- Test: `apps/api/internal/services/message_integration_test.go`

**Interfaces:**
- Produces: `SendMessageInput.ClientMsgID string`、`MessageDTO.ClientMsgID *string`、`BatchTarget{ChannelID models.ID, ClientMsgID string}`。
- Produces: `Batch(ctx, teacherID, targets []BatchTarget, content, messageType)`；保留 `BatchLegacy` 包装旧 `channel_ids` 请求。
- Consumes: 现有 `Membership.RequireWrite`、消息附件约束和字符串 ID 序列化。

- [ ] **Step 1: 写迁移与失败测试**

迁移核心 SQL：

```sql
ALTER TABLE messages ADD COLUMN client_msg_id UUID;
CREATE UNIQUE INDEX uq_messages_sender_client_msg
  ON messages(sender_id, client_msg_id) WHERE client_msg_id IS NOT NULL;
CREATE TABLE message_deliveries (
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(message_id, user_id)
);
CREATE TABLE realtime_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE,
  event_type VARCHAR(64) NOT NULL,
  channel_id BIGINT REFERENCES channels(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(100)
);
CREATE INDEX idx_outbox_pending ON realtime_outbox(id)
  WHERE published_at IS NULL;
```

测试必须覆盖：同键同载荷返回原 ID、同键不同正文返回 409、不同发送者可使用同 UUID、旧空键仍可用、100 个并发同键请求只产生一条消息。集成测试从 `LUMINA_TEST_DATABASE_URL` 建立真实 PostgreSQL 连接，未设置时明确 `t.Skip`。

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./internal/services -run 'TestMessageIdempotency|TestBatchTargets' -v`。
Expected: 因字段、辅助函数或迁移尚不存在而编译失败，不能先写实现再补一个天然通过的测试。

- [ ] **Step 3: 实现事务内幂等**

在事务开始处按发送者和 UUID 查询既有消息；`sameMessageRequest` 比较通道、类型、正文、规范化 JSON metadata 和回复目标。重复请求返回 `(dto, false, nil)`，新消息返回 `(dto, true, nil)`，只有新建分支关联附件和发布事件。唯一索引冲突后重新读取已提交记录。

发送者已读位置统一使用：

```go
DoUpdates: clause.Assignments(map[string]any{
  "last_read_message_id": gorm.Expr("GREATEST(COALESCE(channel_reads.last_read_message_id, 0), excluded.last_read_message_id)"),
  "updated_at": now,
})
```

HTTP 批量请求新增 `targets`，旧 `channel_ids` 映射为 `ClientMsgID == ""` 的兼容目标。新前端只调用 `targets`。

- [ ] **Step 4: 验证并提交**

Run: `go test ./internal/services ./internal/httpapi && go test -race ./internal/services`。
Expected: 新旧测试全部通过。

Commit: `feat(api): make message sending idempotent`

### Task 3: 事务 Outbox 与多实例 Relay

**Files:**
- Create: `apps/api/internal/realtime/outbox.go`
- Create: `apps/api/internal/realtime/outbox_test.go`
- Create: `apps/api/internal/realtime/outbox_integration_test.go`
- Create: `apps/api/internal/services/events.go`
- Modify: `apps/api/internal/services/message.go`
- Modify: `apps/api/internal/services/announcement.go`
- Modify: `apps/api/cmd/api/main.go`
- Test: `apps/api/internal/services/announcement_test.go`

**Interfaces:**
- Produces: `EventRecorder.Record(tx *gorm.DB, event realtime.Event) error`。
- Produces: `OutboxStore.Record`、`OutboxRelay.Run(ctx)`、`OutboxRelay.PublishBatch(ctx)` 和 `outboxBackoff(attempt int) time.Duration`。
- Consumes: Task 2 的 `realtime_outbox` 表和现有 `realtime.Publisher`。

- [ ] **Step 1: 写 relay 失败测试**

覆盖 1、2、4、8、16、30 秒封顶退避；发布失败保留待处理记录；发布成功设置 `published_at`；两个 relay 不重复认领同一租约；过期租约可重认领；同一记录重复发布保持相同 `event_id`。

```go
func TestOutboxBackoff(t *testing.T) {
  want := []time.Duration{time.Second, 2 * time.Second, 4 * time.Second, 8 * time.Second, 16 * time.Second, 30 * time.Second, 30 * time.Second}
  for attempt, expected := range want {
    if got := outboxBackoff(attempt); got != expected { t.Fatalf("attempt=%d got=%s want=%s", attempt, got, expected) }
  }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `go test ./internal/realtime -run 'TestOutbox' -v`。
Expected: `OutboxStore`/`OutboxRelay` 尚未定义。

- [ ] **Step 3: 实现 Record 和 Relay**

`Record` 将完整 `realtime.Event` 拆为信封字段与 data JSON，在同一 GORM 事务插入。认领使用 `FOR UPDATE SKIP LOCKED`，只处理 `published_at IS NULL`、`available_at <= now` 且租约为空或过期的记录。Redis 调用发生在认领事务外；成功和失败分别更新完成状态或下次可执行时间。

`MessageService` 与 `AnnouncementService` 依赖 `EventRecorder`，消息新建/编辑/撤回/已读/确认和公告创建/确认均把事件写入对应业务事务。短暂 typing/presence 继续使用原 publisher。生产构造不允许 recorder 为 nil。

- [ ] **Step 4: 启动 Relay 并验证关闭顺序**

`main` 创建一个 relay 和独立生命周期 context；收到退出信号后依次停止 HTTP、Hub、relay，再关闭 Redis 和数据库。日志只包含事件 ID、类型、实例 ID 和脱敏错误。

Run: `go test ./internal/realtime ./internal/services && go test -race ./internal/realtime`。
Expected: 单元与可用集成测试通过。

Commit: `feat(api): add transactional realtime outbox`

### Task 4: 增量同步、Delivery ACK 与状态计数

**Files:**
- Modify: `apps/api/internal/services/message.go`
- Modify: `apps/api/internal/realtime/event.go`
- Modify: `apps/api/internal/httpapi/message.go`
- Modify: `apps/api/internal/httpapi/router.go:63-75`
- Test: `apps/api/internal/services/message_test.go`
- Test: `apps/api/internal/services/message_integration_test.go`

**Interfaces:**
- Produces: `Sync(ctx,userID,channelID,afterID,limit) (*SyncResult,error)`，结果为升序 `items`、`next_after_id`、`has_more`。
- Produces: `AcknowledgeDeliveries(ctx,userID,messageIDs []models.ID) error`。
- Routes: `GET /api/v1/channels/:id/messages/sync`、`POST /api/v1/messages/delivery-ack`。
- DTO: `delivery_count` 和非发送者 `read_count`。

- [ ] **Step 1: 写失败测试**

验证 `after_id` 只返回更大 ID 且升序；`after_id=0` 从 `channel_reads.last_read_message_id` 开始；越权通道返回 403；批量 ACK 上限 100、空数组拒绝、发送者 ACK 不计数、重复 ACK 不增加计数。

- [ ] **Step 2: 实现最小查询和回执**

同步使用 `WHERE channel_id = ? AND id > ? ORDER BY id ASC LIMIT limit+1`，不使用 OFFSET。ACK 先按 ID 加载消息并逐个检查权限，再用以下原子写入：

```sql
INSERT INTO message_deliveries(message_id,user_id,delivered_at)
VALUES (?,?,?)
ON CONFLICT(message_id,user_id) DO NOTHING;
```

hydrate 聚合 delivery/read 时添加 `message_reads.user_id <> messages.sender_id` 和对应的 delivery 条件，避免发送者自己的动作触发 delivered/read。

- [ ] **Step 3: 验证并提交**

Run: `go test ./internal/services ./internal/httpapi && go test -race ./internal/services`。
Expected: 权限、游标和回执测试通过。

Commit: `feat(api): add incremental sync and delivery receipts`

### Task 5: WebSocket 心跳与优雅关闭

**Files:**
- Modify: `apps/api/internal/realtime/event.go`
- Modify: `apps/api/internal/realtime/client.go`
- Modify: `apps/api/internal/realtime/hub.go`
- Modify: `apps/api/internal/httpapi/websocket.go:44-52`
- Modify: `apps/api/cmd/api/main.go`
- Test: `apps/api/internal/realtime/hub_test.go`
- Create: `apps/api/internal/realtime/client_test.go`

**Interfaces:**
- Produces: `EventServerShutdown = "server_shutdown"`、`Hub.Shutdown(ctx) error`、`Client.Run()`。
- Consumes: 现有 Conn 接口、ReadPump/WritePump 和 Hub 注册表。

- [ ] **Step 1: 调整失败测试**

把心跳断言改为 25 秒；用 fake Conn 验证 Run 生命周期、收到 shutdown 后先写 `server_shutdown` JSON，再写 Close 控制帧；验证 Shutdown 后新连接不能注册、所有已注册连接最终退出、context 超时可返回错误。

- [ ] **Step 2: 实现单写者关闭流程**

所有 socket 写仍只由 WritePump 执行。`Client.Run` 启动 WritePump 并执行 ReadPump；`Hub.Shutdown` 设置 closing、逐连接发送 graceful 请求并等待注册 WaitGroup。WritePump 接到请求后写维护事件、非阻塞 drain 已排队事件、写 Close 帧并返回；强制慢连接剔除仍可直接关闭。

- [ ] **Step 3: 验证并提交**

Run: `go test ./internal/realtime -v && go test -race ./internal/realtime && go build ./cmd/...`。
Expected: 无死锁、无 goroutine 泄漏、所有已有 Hub 测试通过。

Commit: `feat(api): gracefully drain websocket connections`

### Task 6: 前端 FIFO、增量恢复、状态与 100ms 合并

**Files:**
- Create: `apps/web/lib/message-send-queue.ts`
- Create: `apps/web/lib/message-send-queue.test.ts`
- Create: `apps/web/lib/message-sender.tsx`
- Create: `apps/web/lib/message-sync.ts`
- Create: `apps/web/lib/message-sync.test.ts`
- Create: `apps/web/lib/realtime-batch.ts`
- Create: `apps/web/components/ui/connection-banner.tsx`
- Modify: `apps/web/components/ui/connection-indicator.tsx`
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/lib/messages.ts`
- Modify: `apps/web/lib/websocket.ts`
- Modify: `apps/web/lib/realtime.tsx`
- Modify: `apps/web/stores/realtime.ts`
- Modify: `apps/web/components/providers.tsx`
- Modify: `apps/web/components/teacher/composer.tsx`
- Modify: `apps/web/components/teacher/chat-window.tsx`
- Modify: `apps/web/components/classroom/classroom-chat.tsx`
- Modify: `apps/web/components/teacher/message-item.tsx`
- Modify: `apps/web/components/teacher/batch-notice-dialog.tsx`
- Test: `apps/web/lib/websocket.test.ts`
- Test: `apps/web/lib/realtime.test.tsx`
- Test: `apps/web/components/teacher/composer.test.tsx`

**Interfaces:**
- Produces: `MessageSendQueue.enqueue(channelId,input)`、`retry(clientMsgId)`、`setPaused(bool)` 和 `subscribe(listener)`。
- Produces: `useMessageSender()`、`syncChannelMessages(queryClient,channelId)`、`RealtimeBatch.push(event)`。
- Store: `status` 增加 `maintenance`，增加 `syncVersion`、`activeChannelId`、`requestedChannelId` 及对应 setter。
- Message: `client_msg_id?`、`delivery_count`、`delivery_state?: "sending"|"failed"`，本地 ID 使用 `local-${client_msg_id}`。

- [ ] **Step 1: 写队列与重连失败测试**

队列测试注入 fake sender，验证同通道顺序、不同通道可并行、响应丢失后同 UUID 重试、4xx 不自动重试、暂停期间不调用 API。WebSocket 测试用 fake timers 验证退避、`server_shutdown` 维护状态及停止后无定时器。

- [ ] **Step 2: 实现独立 FIFO 和 Provider**

Queue 不依赖 React；`MessageSendProvider` 持有 Map 和 100ms 通知调度，在 `status === "connected"` 且 `syncVersion` 已推进后恢复。REST 成功先 `prependMessageToPages`，再移除本地项并使 channels/messages 失效；失败保留本地项。Provider 在有未确认项时注册 `beforeunload`。

Composer 上传成功后或文本校验通过后立即 enqueue 并清空编辑器，不再禁用整个表单等待单条 REST。聊天窗口把本地项放在服务端消息之后，MessageItem 对 sent/delivered/read/failed 显示对应图标和重试按钮。

- [ ] **Step 3: 实现增量同步和事件合帧**

每次 onOpen 先活动通道再其他通道调用 sync，完成后推进 `syncVersion`，队列此时才恢复。`RealtimeBatch` 每 100ms 按事件 ID 去重并刷新缓存；处理非本人 `new_message` 后调用 delivery ACK。新增 `delivery_ack` 与 `server_shutdown` 事件类型，非活动通道触发未读刷新和应用内提示。

批量通知改为：

```ts
const targets = Array.from(selected, (channel_id) => ({ channel_id, client_msg_id: crypto.randomUUID() }));
mutation.mutate({ targets, content: content.trim(), type });
```

- [ ] **Step 4: 验证并提交**

Run: `npm run typecheck && npm test && npm run build`，工作目录 `apps/web`。
Expected: 新旧测试、类型检查和生产构建通过。

Commit: `feat(web): make realtime sending resilient`

### Task 7: 全局紧急通知与确认进度

**Files:**
- Create: `apps/web/components/urgent/global-urgent-dialog.tsx`
- Create: `apps/web/components/urgent/teacher-urgent-dialog.tsx`
- Create: `apps/web/components/urgent/confirmation-status.tsx`
- Modify: `apps/web/components/classroom/urgent-dialog.tsx`
- Modify: `apps/web/components/ui/dialog.tsx`
- Modify: `apps/web/components/providers.tsx`
- Modify: `apps/web/components/classroom/classroom-client.tsx`
- Modify: `apps/web/components/teacher/teacher-client.tsx`
- Modify: `apps/web/components/admin/announcement-manager.tsx`
- Modify: `apps/api/internal/services/message.go`
- Modify: `apps/api/internal/services/announcement.go`
- Modify: `apps/api/internal/httpapi/announcement.go`
- Modify: `apps/api/internal/httpapi/message.go`
- Modify: `apps/api/internal/httpapi/router.go`
- Test: `apps/web/components/classroom/urgent-dialog.test.tsx`
- Test: `apps/web/components/urgent/global-urgent-dialog.test.tsx`
- Test: `apps/api/internal/services/announcement_test.go`

**Interfaces:**
- Routes: `GET /api/v1/teacher/urgent-pending`、`GET /api/v1/messages/:id/confirmations`、`GET /api/v1/announcements/:id/confirmations`。
- DTO: `ConfirmationStatusItem{user_id,class_id,class_name,confirmed,confirmed_at}`。
- Event: `urgent_confirmed`，携带 kind、资源 ID、用户 ID 和确认时间，不包含正文。
- UI: `Dialog.fullscreen`、`GlobalUrgentDialog`、`ConfirmationStatus(kind,id)`。

- [ ] **Step 1: 写权限和 UI 失败测试**

后端验证只有教室可确认、消息发送者/公告发布者和管理员可读明细、无关教师 403。前端 fake timers 验证 30 秒加强、按钮至少 `min-h-16`、班级名、确认失败不关闭、教师弹窗请求通道跳转、管理员显示已确认/未确认。

- [ ] **Step 2: 实现全局宿主与后端明细**

Providers 在 RealtimeProvider 内挂全局紧急组件，教室页删除旧局部实例。教室 fullscreen Dialog 保留阻断与循环音频；教师关闭只在内存记录 dismissed ID，不写确认表。确认接口同时写 Outbox 事件，使其他标签页和进度查询失效。

明细以目标教室用户为基准 LEFT JOIN confirmation，保证未确认班级也出现在结果中；不通过“只查询已有确认记录”计算名单。

- [ ] **Step 3: 验证并提交**

Run: `go test ./internal/services ./internal/httpapi && npm --prefix apps/web run typecheck && npm --prefix apps/web test`，工作目录仓库根。
Expected: 全部通过。

Commit: `feat: deliver urgent alerts globally`

### Task 8: 真实场景、回归与交付

**Files:**
- Create: `tests/e2e/reliability.spec.ts`
- Modify: `tests/e2e/reconnect.spec.ts`
- Modify: `tests/e2e/concurrency.spec.ts`
- Modify: `tests/e2e/urgent.spec.ts`
- Modify: `docs/testing.md`
- Modify: `docs/api.md`

- [ ] **Step 1: 写真实场景**

使用已有 helpers 创建独立用户/通道，验证断网期间排队 10 条后恢复、响应丢失同 UUID 重试、100 条并发按 ID 到达、10 用户无重复丢失、Redis 停止后 REST 成功且恢复后补发、紧急消息在非聊天页面全屏确认、教师 A 无法读取教师 B 回执或确认明细。

- [ ] **Step 2: 启动真实依赖并执行**

Run: `docker compose up -d --build postgres redis migrate api web nginx`，随后等待 `/health/ready`，再执行 `npm --prefix tests ci`、`npm --prefix tests exec -- playwright install chromium` 和 `npm --prefix tests test`。
Expected: 所有已有和新增 Playwright 场景通过；测试后停止用于故障注入的容器并恢复环境。

- [ ] **Step 3: 完整静态与竞态回归**

Run: `gofmt -l . && go vet ./... && go test ./... && go test -race ./... && go build ./cmd/...`；Web 执行 typecheck、Vitest、build，并额外执行 `pnpm --dir apps/web build`（pnpm 可用时）。
Expected: 全部通过，无格式/类型错误。

- [ ] **Step 4: 更新验证记录并最终提交**

`docs/testing.md` 记录实际命令、通过数量、基线差异和任何环境阻塞；`docs/api.md` 记录幂等键、同步、delivery ACK、确认明细和 `server_shutdown`。最终提交使用 `test: verify P0 realtime reliability` 或包含文档修正的 `docs: record P0 reliability verification`。

- [ ] **Step 5: 推送前核验**

先通过 GitHub API 重新读取 `main` HEAD；若与基线 `3ac326e73717f068dfcdb5141e76f9a2ad45a0f8` 不同，停止覆盖并基于新 HEAD 重新应用最终树。推送以新远端 HEAD 为父提交，不 force push，不包含访问令牌、构建产物或测试报告。

# Lumina 验证记录

日期：2026-10-31

## 验证环境

- Linux arm64，Go 1.23.4，Node.js 22。
- 全链路 E2E 使用 Next.js 15.5.7；交付前已升级到 15.5.28 并重新通过单元测试、类型检查与生产构建。
- 后续升级到 Next.js 16.4.3 / React 19.2.9 / Tailwind CSS 4.3.3，已重新通过单元测试（48 项）、类型检查与生产构建。
- 真实 PostgreSQL 16.4、真实 Redis 7.2.5、Playwright Chromium 141。
- 当前环境没有 Docker，因此未执行镜像构建、Compose 启动或容器内 Nginx 验证；这些目标机步骤保留在部署文档中。

## 已通过检查

| 检查 | 实际结果 |
| --- | --- |
| Go 格式 | `gofmt -l .` 无输出 |
| Go 单元测试 | `go test ./...` 全部通过 |
| Go 静态检查 | `go vet ./...` 通过 |
| Go 竞态检测 | `go test -race ./...` 全部通过 |
| Web 单元测试 | 19 个测试文件、48 项测试全部通过 |
| Web 类型检查 | `tsc --noEmit` 通过 |
| Web 生产构建 | 16 个 App Router 路由全部构建成功 |
| E2E 类型与加载 | TypeScript 通过，15 个真实用例可发现 |
| Compose 静态语法 | YAML 解析通过 |
| PostgreSQL 迁移 | 从头执行成功 |
| seed 幂等 | 连续两轮成功，数量保持一致 |

两轮 seed 后均为：1 名管理员、20 个班级、20 个教室账号、50 名教师、10 个科目、300 个教学任务、300 个教学通道。每个班级只有一个启用的大屏账号；50 名教师各固定一个科目，并覆盖 6 个不同班级。

## 真实浏览器验收

最终串行执行结果：**15/15 通过，总耗时 8.4 分钟**。测试使用真实 API、PostgreSQL、Redis、两个独立浏览器上下文和 WebSocket，不 mock 业务数据。

1. 管理员创建班级、教师并分配任务，新教师立即可见自动生成的唯一通道。
2. 两个教室已连接时发布全校紧急公告，双方实时阻断并分别确认。
3. 管理员、教师、教室统一登录和角色跳转。
4. 教师前端角色守卫阻止进入管理端。
5. 服务端拒绝跨角色管理接口和跨班消息读取。
6. 教师 UI 批量通知真实写入两个目标通道并展示逐项结果。
7. 教室大屏回复后教师实时收到，数据库可查询发送者。
8. 同通道 12 条并发消息全部持久化，ID 唯一且严格排序。
9. 真实 multipart 上传、鉴权下载和教室 UI 下载内容一致，跨班下载返回 403。
10. 教室阅读后未读数正确变化，教师端生成已读回执。
11. 两个独立浏览器实时收发，刷新后从 PostgreSQL 恢复消息。
12. 强制终止本地同源代理后浏览器收到 WebSocket 关闭事件，指数退避重连并继续发送。
13. 紧急消息不能通过 Escape 或关闭按钮绕过，确认后刷新不再弹出。

断线用例默认在目标机停止/启动 Compose Nginx；本次使用测试提供的 `E2E_PROXY_STOP_CMD`、`E2E_PROXY_START_CMD` 钩子强制停止并恢复本地 Next 同源代理，验证了真实断线与重连行为。容器内 Nginx 配置仍需目标机验证。

## 目标机复验

```bash
cp .env.example .env
# 替换全部示例密码、密钥和实际来源地址
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:8080/health/ready
npm --prefix tests ci
npm --prefix tests exec -- playwright install --with-deps chromium
npm --prefix tests run typecheck
npm --prefix tests test
```

请勿对正在服务师生的生产实例直接运行会创建数据并停止代理的 E2E 套件。

## 2026-11-04 P0 实时可靠性改造

本次提交仅覆盖 P0，不把 P1–P3 的虚拟滚动、CSV、Wake Lock、通知设置和部署扩展标记为已完成。

### 实现范围

- 消息 UUID 幂等、数据库唯一约束、冲突重放、每通道内存 FIFO、失败手动重试和网络恢复自动重试。
- 消息与事务 Outbox 同库提交，后台 relay 至少投递一次并退避恢复；修复 GORM 默认表名与迁移表名不一致问题。
- `id > after_id` 增量同步、批量 delivery ACK、逐条 sent/delivered/read/failed 状态及 100ms UI 合批。
- 25 秒协议心跳、60 秒 Pong 超时、指数退避、`server_shutdown` 维护态和 WebSocket 有界优雅关闭。
- 教室全屏紧急通知、循环提示音、30 秒加强提醒、班级确认状态；教师全局查看弹窗和确认明细权限隔离。

### 实际工具结果

| 检查 | 结果 |
| --- | --- |
| Go 单元/SQL mock 测试 | `go test ./...` 全部通过 |
| Go 竞态检测 | `go test -race ./...` 全部通过 |
| Go 构建 | `go build ./cmd/...` 成功 |
| Web 测试 | 27 个测试文件、68 项测试全部通过 |
| Web 生产构建 | `next build` 成功，类型检查通过 |
| Go 全仓语句覆盖率 | 23.2%；`realtime` 包 58.2%，`services` 包 19.7% |
| Web 全仓语句覆盖率 | 56.16%；发送队列 91.91%、发送 Provider 96.29%、WebSocket 93.26%、确认组件 100% |

覆盖率由 `go tool cover` 和 Vitest V8 实际生成，未将核心模块覆盖率冒充全仓 80% 达标；全仓历史模块仍需要后续补测。SQL mock 验证了 GORM 事务、查询和权限调用，不等同于真实 PostgreSQL 集成验收。

### 环境限制与目标机复验

当前环境没有 Docker 和 pnpm，因此本次未执行 Compose、真实 PostgreSQL 迁移/seed、容器内 Nginx、真实浏览器 E2E 或 `pnpm build`。上面的历史 15/15 E2E 记录不属于本次改动。目标机必须先执行 `docker compose up -d --build postgres redis migrate seed api web nginx`，再运行完整 Playwright 套件，并额外验证断网 5 秒、100 条并发、10 用户、Redis 故障恢复和跨页面紧急确认。

## 2026-11-07 校园组织模型加固

本次改动把校园实际组织关系固化到数据库与服务层，而不是只依赖前端提示：

- 新增迁移 `000005_campus_teaching_model`：每个班级最多一个启用的大屏账号；教师拥有唯一 `subject_id`；同一教师最多一个科目的活跃教学任务，且同一教师在同一班级只能有一个活跃任务。
- 教师创建/更新支持 `subject_id`；已有活跃任务时禁止更换或清空科目，必须先停用任务。
- 教学任务不再要求前端选择科目：服务端按教师档案派生科目；显式传入的 `subject_id` 必须与教师科目一致。
- 班级列表返回大屏账号；停用班级联动停用账号，重新启用班级恢复原账号；seed 会在重复数据存在时保留每班一个启用账号。
- 普通文本与普通通知不再使用额外徽标或强调色；只有紧急消息、紧急公告保留红色层级和教室确认。
- 修复三个既有前端测试对 `AbortSignal` 参数与挂起 Promise 的脆弱断言，使测试结果与实现契约一致。

### 本次实际结果

| 检查 | 结果 |
| --- | --- |
| Go 单元测试 | `go test ./...` 全部通过 |
| Go 竞态检测 | `go test -race ./...` 全部通过 |
| Go 静态检查 | `go vet ./...` 通过 |
| Go 格式 | `gofmt -l .` 无输出 |
| Web 单元测试 | 30 个测试文件、88 项测试全部通过 |
| Web 类型检查 | `tsc --noEmit` 通过 |
| Web 生产构建 | `next build` 成功，15 个路由生成成功 |
| E2E 类型检查 | `npm --prefix tests run typecheck` 通过 |

### 未执行项

当前环境没有 Docker 与 PostgreSQL 服务，因此未在本机执行迁移、seed、Compose 启动和真实浏览器 E2E。迁移 SQL 已按 PostgreSQL 语法审查，但必须在目标机通过真实迁移和两轮 seed 验收；部署文档已补充组织约束的校验查询。

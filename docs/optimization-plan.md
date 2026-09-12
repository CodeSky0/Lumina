# Lumina 流光 — 成熟应用完整优化计划

## 现状诊断

| 维度 | 状态 | 关键证据 |
|------|------|----------|
| 聊天室重构 | 已落地 | `0002_chatroom_refactor.sql` + `ChatLayout` |
| 私信实时推送 | 断裂 | `chat-layout.tsx:50` WS 房间名 `dm-placeholder` 占位；`actions.ts:491` 仅群聊 publish |
| 3 秒轮询 | 生产隐患 | `chat-layout.tsx:66` 每 3s 轮询，对 Neon Serverless 造成压力 |
| 未读计数 | 占位 | `actions.ts` 5 处 `unreadCount: 0` 硬编码 |
| 消息状态流转 | 停滞 | 始终 `status:"pending"`，无 delivered/displayed 更新 |
| 错误/加载边界 | 缺失 | 无 `error.tsx`/`loading.tsx`/`not-found.tsx` |
| 测试 | 零覆盖 | 无 Vitest/Playwright，无 CI |
| 暗色模式 | 半成品 | CSS 变量已备，无切换 UI |
| 文档 | 缺失 | README 仅 1 行 |
| 管理端 | 完整 | CRUD + 批量导入 + Token 管理 |
| Yohaku 对齐 | 已落地 | commit `07d172c` |

## 7 个阶段

### 阶段 1：质量基线

为后续所有重构建立安全网。

- **1.1 错误/加载边界**：`app/error.tsx` + `app/loading.tsx` + `app/not-found.tsx`
- **1.2 测试框架**：Vitest 单元测试（RBAC、contract、schema 校验）+ Playwright E2E（登录→发消息→收消息）
- **1.3 CI/CD**：GitHub Actions（lint→typecheck→test→build）+ husky pre-commit
- **1.4 文档骨架**：README.md + docs/architecture.md + AGENTS.md

### 阶段 2：沟通核心修复（最高业务优先级）

- **2.1 私信实时推送**：修复 `dm-placeholder` → `roomNameForDirect`；`sendMessage` 私信也调用 `publishMessage`
- **2.2 轮询策略优化**：WS 正常时移除轮询；断线时启动兜底；页面不可见时暂停
- **2.3 未读消息计数**：新增 `message_reads` 表；`getMyConversations` 计算未读；`markConversationRead` Action
- **2.4 消息状态流转**：写入后 delivered；客户端渲染后回发 displayed

### 阶段 3：消息能力增强

- **3.1 消息撤回与编辑**：`messages` 新增 `deletedAt`/`editedAt`；2 分钟内可撤回
- **3.2 @提及**：群聊输入 `@` 弹成员列表；`messages` 新增 `mentions text[]`
- **3.3 消息搜索**：`searchMessages(query)` — Postgres ILIKE 或 tsvector
- **3.4 会话置顶与免打扰**：`conversation_preferences` 表
- **3.5 文件消息**：`messageTypeEnum` 扩展 `"file"`；`uploadFile` 泛化
- **3.6 语音消息**：客户端 MediaRecorder → WebM/Opus → Vercel Blob
- **3.7 历史消息分页**：游标分页 `(conversationId, beforeCursor?, limit=50)`
- **3.8 在线状态**：DO 维护 presence Map，广播 join/leave

### 阶段 4：通知与公告

- **4.1 通知中心**：`notifications` 表 + 顶栏铃铛 + 下拉列表
- **4.2 浏览器 Web Push**：`web-push` + VAPID + Next.js Server Action 直推
- **4.3 班级公告**：教师可发公告（置顶 + 全员通知 + 不可回复）

### 阶段 5：体验适配

- **5.1 暗色模式**：`next-themes` + 切换 UI + `prefers-color-scheme` 默认
- **5.2 PWA**：manifest + service worker + 离线缓存 + 推送
- **5.3 移动端响应式**：单栏切换布局（会话列表 ↔ 聊天窗口）
- **5.4 大屏端优化**：全屏 + 防息屏 + 紧急弹幕 + 公告轮播
- **5.5 会话列表搜索/筛选**：搜索框 + 未读/置顶 tab

### 阶段 6：管理端增强

- **6.1 统计概览仪表盘**：用户/班级/消息/活跃指标 + 趋势图
- **6.2 操作审计日志**：`audit_logs` 表 + 所有写操作记录
- **6.3 数据导出**：用户/绑定/消息 CSV 导出

### 阶段 7：安全与运维

- **7.1 安全加固**：Rate Limit + 输入消毒 + CSRF + 文件上传安全 + 登录锁定
- **7.2 监控告警**：Sentry + Vercel Analytics + CF Worker 健康检查
- **7.3 性能优化**：索引优化 + N+1 检查 + 缓存 + 图片懒加载 + Bundle 分析
- **7.4 数据库备份**：Neon 自动备份 + pg_dump + 恢复流程文档

## 依赖关系

```
阶段1 → 阶段2 → 阶段3 → 阶段4
                 ↓
阶段5（可并行）  阶段6（可并行）
                 ↓
              阶段7
```

## 技术选型确认

- 语音消息：客户端 MediaRecorder → WebM/Opus → Vercel Blob
- Web Push：Next.js Server Action 直推（web-push 库 + VAPID）
- 暗色模式：next-themes
- 移动端：PWA + 响应式（无原生应用）
- 国际化：延后（当前聚焦中文用户）

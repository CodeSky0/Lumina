# Lumina API 与实时协议

本文按当前 Go 路由、处理器和模型整理，部署默认通过 Nginx 同源访问。所有 ID 在 JSON 中均为字符串，避免 JavaScript 大整数精度丢失。

## 1. 通用约定

- REST 前缀：`/api/v1`。
- 成功响应：`{"data": ...}`；创建资源通常返回 HTTP 201。
- 失败响应：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "中文错误信息",
    "request_id": "请求标识"
  }
}
```

- 除登录、设备登录、刷新、退出和健康检查外，接口需要 `Authorization: Bearer <access_token>`。
- 登录成功同时返回 24 小时 Access Token，并设置 Path 为 `/api/v1/auth` 的 HttpOnly `lumina_refresh` Cookie；Refresh Token 有效期 7 天并旋转。
- 默认内网 HTTP 配置下 Cookie 非 Secure；HTTPS/生产模式必须启用 `REFRESH_COOKIE_SECURE=true`。

## 2. 健康检查

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health/live` | 进程存活，不检查依赖 |
| GET | `/health/ready` | Ping PostgreSQL 和 Redis；异常返回 503 |

```bash
curl --fail http://127.0.0.1:8080/health/ready
# {"data":{"postgresql":"up","redis":"up","status":"ok"}}
```

## 3. 认证

### `POST /api/v1/auth/login`

```json
{"username":"teacher001","password":"实际密码"}
```

成功：

```json
{
  "data": {
    "access_token": "JWT",
    "expires_at": "RFC3339 时间",
    "user": {
      "id": "2",
      "username": "teacher001",
      "display_name": "教师001",
      "role": "teacher"
    }
  }
}
```

角色为 `admin`、`teacher` 或 `classroom`。登录失败按账号与来源地址计数，连续失败会触发临时锁定；接口还有按来源的限流。

### 其他认证接口

| 方法 | 路径 | 请求/说明 |
| --- | --- | --- |
| POST | `/api/v1/auth/device` | `{"code":"设备绑定码"}`，返回同样的会话 |
| POST | `/api/v1/auth/refresh` | 使用 HttpOnly Cookie，旋转 Refresh Token |
| POST | `/api/v1/auth/logout` | 注销当前刷新会话并清除 Cookie |
| GET | `/api/v1/auth/me` | 返回当前有效用户 |
| POST | `/api/v1/auth/ws-ticket` | 返回一次性短期 `ticket` 和 `expires_at` |

WebSocket 使用 `GET /ws?ticket=<一次性ticket>` 升级，不是长期 Access Token 查询参数。Nginx 已配置 Upgrade 和 75 秒超时；服务端每 25 秒发送协议 Ping，60 秒未收到 Pong 后清理连接，前端断线后指数退避并先做数据库增量同步。服务关闭时发送 `server_shutdown`，客户端显示维护状态并继续重连。

## 4. 通道与消息

### 通道

`GET /api/v1/channels` 返回当前用户可访问的通道数组。教学通道类型为 `normal`，广播通道为 `broadcast`；服务端按教学任务、班级和管理员权限计算成员关系，不能由客户端指定角色绕过。

```json
{
  "data": [
    {
      "id": "1",
      "name": "高一（01）班 · 语文",
      "type": "normal",
      "class_id": "1",
      "subject_id": "1",
      "teacher_id": "2",
      "class_name": "高一（01）班",
      "grade": 1,
      "subject_name": "语文",
      "teacher_name": "教师001",
      "unread_count": 0,
      "online": true
    }
  ]
}
```

### 历史与搜索

`GET /api/v1/channels/:id/messages?before_id=&limit=&q=`

- `before_id`：可选游标，只返回更小 ID；`limit` 默认 50，最大 100。
- `q`：可选，仅搜索当前有权通道，最长 200 字。
- 返回 `{"data":{"items":[],"next_before_id":"...","has_more":false}}`。

### 发送

`POST /api/v1/channels/:id/messages`

```json
{
  "type": "text",
  "content": "消息正文",
  "metadata": {},
  "reply_to_id": "可选回复消息ID"
}
```

类型为 `text`、`notice`、`urgent`、`image`、`file`。非附件正文最长 2000 字；只有通道所属教师可发通知和紧急消息，本班教室账号可在本班教学通道发送允许的消息。管理员对教学通道只读，广播通道不开放消息写入，校园公告使用独立公告接口。图片/文件的 `metadata.file_id` 必须属于当前发送者、当前通道且尚未使用。

### 消息操作

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| PATCH | `/api/v1/messages/:id` | `{"content":"新正文"}`，仅本人可编辑 |
| DELETE | `/api/v1/messages/:id` | 仅发送者可在服务端时间两分钟内撤回 |
| POST | `/api/v1/messages/:id/read` | 幂等已读，更新通道已读位置并发布回执 |
| POST | `/api/v1/messages/:id/confirm` | 仅紧急消息，写入确认并同时标记已读 |

### 教师批量通知

`POST /api/v1/teacher/batch-notices`，仅教师角色。每次 1–50 个不重复通道，类型只能是 `notice` 或 `urgent`。

```json
{"channel_ids":["1","2"],"content":"通知内容","type":"notice"}
```

实际返回结构为：

```json
{
  "data": {
    "items": [
      {"channel_id":"1","success":true,"message":{"id":"10"}},
      {"channel_id":"2","success":false,"code":"CHANNEL_FORBIDDEN","error":"失败原因"}
    ]
  }
}
```

服务端逐通道返回真实结果；Web 组件识别 `items` 并展示每个目标通道的成功或失败状态。

## 5. 公告与紧急确认

| 方法 | 路径 | 角色/说明 |
| --- | --- | --- |
| GET | `/api/v1/announcements?page=&size=` | 当前用户可见公告，返回 `items,total,page,size,total_pages` |
| POST | `/api/v1/announcements` | 仅管理员，创建公告并发布实时事件 |
| POST | `/api/v1/announcements/:id/confirm` | 确认紧急公告，幂等 |
| GET | `/api/v1/classroom/urgent-pending` | 仅教室，返回未确认 `messages` 和 `announcements` |

教室 UI 只有确认接口成功并重新查询后才关闭阻断对话框；刷新和重连仍以该服务端结果为准。

## 6. 上传与下载

### `POST /api/v1/uploads`

需要 Bearer Token 和通道成员权限，Content-Type 为 multipart/form-data：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `channel_id` | 是 | 目标通道 ID |
| `declared_size` | 建议显式传 | 必须与文件实际字节数一致；缺省时后端使用 multipart 大小 |
| `file` | 是 | 文件字段名必须恰好为 `file` |

- 图片：jpg/jpeg/png/gif/webp，最大 5 MiB。
- 文件：pdf/txt/doc/docx/xls/xlsx/ppt/pptx/zip，最大 20 MiB。
- 后端检查声明/实际大小、扩展名、声明 MIME 与内容检测 MIME，使用随机存储名。
- Nginx 限制整个请求为 21m。

`curl` 示例（先取得通道 ID 和 Token）：

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F 'channel_id=1' -F "declared_size=$(stat -c %s ./资料.txt)" \
  -F 'file=@./资料.txt;type=text/plain' \
  http://127.0.0.1:8080/api/v1/uploads
```

上传响应对象使用 `original_name`、`mime`、`size`、`kind` 等字段。随后以 `image` 或 `file` 类型发送消息，并在 metadata 中关联 `file_id`。

`GET /api/v1/files/:id` 重新校验当前用户对该文件通道的权限，返回 `Content-Disposition: attachment`、`X-Content-Type-Options: nosniff` 和 `Cache-Control: private, no-store`。

## 7. 管理接口

以下均要求 `admin` 角色：

| 资源 | 路径前缀 | 支持操作 |
| --- | --- | --- |
| 仪表盘 | `/api/v1/admin/dashboard` | GET |
| 审计日志 | `/api/v1/admin/audit-logs` | GET |
| 系统设置 | `/api/v1/admin/settings` | GET、PUT、PATCH |
| 班级 | `/api/v1/admin/classes` | GET、POST；`/:id` PATCH、DELETE；`/:id/device-code` POST |
| 教师 | `/api/v1/admin/teachers` | GET、POST；`/:id` PATCH、DELETE |
| 科目 | `/api/v1/admin/subjects` | GET、POST；`/:id` PATCH、DELETE |
| 通道 | `/api/v1/admin/channels` | GET、POST；`/:id` PATCH、DELETE |
| 教学任务 | `/api/v1/admin/assignments` | GET、POST；`/:id` PATCH、DELETE |

创建教学任务与生成教学通道位于同一数据库事务。每位教师固定一个 `subject_id`：创建任务时可省略 `subject_id`，服务端自动使用教师科目；如果显式传入，则必须与教师科目一致。每个班级只允许一个启用的大屏账号，班级停用会联动停用账号，重新启用时恢复原账号。前端隐藏管理入口不是安全边界，服务端仍逐请求验证用户状态、角色和成员关系。

## 8. 实时事件

事件信封：

```json
{
  "event_id": "uuid",
  "type": "new_message",
  "channel_id": "1",
  "occurred_at": "RFC3339 时间",
  "data": {"message": {"id":"10"}}
}
```

类型：`new_message`、`message_edited`、`message_deleted`、`announcement`、`announcement_invalidated`、`typing`、`presence`、`read_ack`、`delivery_ack`、`urgent_confirmed`、`server_shutdown`。客户端按 `event_id` 去重并按消息 ID 排序。消息与 Outbox 在同一 PostgreSQL 事务提交，后台 relay 再向 Redis 至少投递一次；Redis Pub/Sub 只负责实时提醒，发布失败会退避重试，断线期间的补偿来自重连后的数据库查询。

## 9. P0 可靠性扩展

### 客户端幂等键

发送消息可携带 `client_msg_id`（UUID）。同一发送者重复提交相同键且载荷一致时返回首次消息；通道、正文、类型、附件、回复目标或 metadata 不一致时返回 `409 IDEMPOTENCY_CONFLICT`。数据库对非空 `(sender_id, client_msg_id)` 建部分唯一索引，并发首次写入也只保留一条。旧客户端可省略该字段，但不获得客户端级去重保证。

批量通知推荐使用独立目标键；旧 `channel_ids` 仍兼容：

```json
{
  "targets": [
    {"channel_id":"1","client_msg_id":"550e8400-e29b-41d4-a716-446655440000"},
    {"channel_id":"2","client_msg_id":"660e8400-e29b-41d4-a716-446655440000"}
  ],
  "content":"通知内容",
  "type":"notice"
}
```

### 增量同步与投递回执

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/channels/:id/messages/sync?after_id=&limit=` | 重新校验通道权限，按 `id > after_id` 升序返回，最多 100 条；返回 `next_after_id` 和 `has_more` |
| POST | `/api/v1/messages/delivery-ack` | `{"message_ids":["1","2"]}`，每批 1–100 个 ID，逐通道鉴权，`ON CONFLICT DO NOTHING` |
| GET | `/api/v1/messages/:id/confirmations` | 消息发送者或管理员查看各班确认状态 |
| GET | `/api/v1/teacher/urgent-pending` | 教师查看全局紧急消息和公告，不写确认记录 |
| GET | `/api/v1/announcements/:id/confirmations` | 公告发布者或管理员查看各班确认状态 |

消息 DTO 新增 `client_msg_id`、`delivery_count`，紧急待办可携带 `channel_name`。`sent/delivered/read` 由服务端持久化及非发送者回执推导；发送者自己的回执不计数。只有 `classroom` 角色可以调用紧急消息或公告确认接口，教师和管理员的查看行为不会生成教室确认。

浏览器发送队列仅保存在内存中，同一通道严格 FIFO；断线或同步期间暂停，恢复后复用原 UUID 重试。实时事件和队列更新均使用 100ms 合批窗口。

# Lumina 验证记录

日期：2026-10-31

## 验证环境

- Linux arm64，Go 1.23.4，Node.js 22。
- 全链路 E2E 使用 Next.js 15.5.7；交付前已升级到 15.5.28 并重新通过单元测试、类型检查与生产构建。
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

两轮 seed 后均为：1 名管理员、20 个班级、20 个教室账号、50 名教师、10 个科目、300 个教学任务、300 个普通通道。普通通道覆盖全部 20 个班级，50 名教师各有 6 个不同班级的任务。

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

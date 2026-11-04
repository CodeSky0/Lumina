# Lumina API Codebase 文档

> 📁 本文档为 Go 后端服务的项目总览。

## 1. 技术栈

- **语言**：Go 1.23（来自 `go.mod` 的 `go` 指令）
- **运行时镜像**：Go 1.23.6 / Alpine 3.21（来自 `Dockerfile`）
- **HTTP 框架**：Gin 1.10.0（来自 `go.mod`）
- **数据库**：PostgreSQL，GORM 1.30.0 与 postgres driver 1.5.11（来自 `go.mod`）
- **缓存 / 实时状态**：Redis go-redis 9.7.0（来自 `go.mod`）
- **认证**：golang-jwt/jwt 5.2.1（来自 `go.mod`）
- **WebSocket**：gorilla/websocket 1.5.3（来自 `go.mod`）
- **测试**：Go 标准测试体系；Redis 测试依赖 miniredis 2.33.0（来自 `go.mod`）

## 2. 项目目录结构

```
api/                                # Lumina 后端 API 单模块
├── cmd/                            # 可执行程序入口
│   ├── api/                        # HTTP 与 WebSocket 服务入口
│   ├── migrate/                    # 数据库迁移入口
│   └── seed/                       # 演示数据初始化入口
├── internal/                       # 服务内部业务实现
│   ├── apperror/                   # 统一应用错误
│   ├── auth/                       # 认证、令牌与凭据处理
│   ├── config/                     # 服务配置加载
│   ├── database/                   # 数据库连接与迁移支持
│   ├── httpapi/                    # HTTP 路由与请求处理
│   ├── middleware/                 # HTTP 横切中间件
│   ├── models/                     # 持久化领域模型
│   ├── realtime/                   # WebSocket 连接与实时投递
│   ├── seed/                       # 演示数据生成逻辑
│   └── services/                   # 领域业务服务
├── migrations/                     # PostgreSQL SQL 迁移脚本（不展开脚本内容）
├── Dockerfile                      # 构建与运行镜像定义
├── go.mod                          # Go 模块与依赖版本
└── go.sum                          # Go 依赖校验和
```

## 3. 开发命令（核心）

### 构建命令

```bash
# 构建三个服务入口（来源：Dockerfile > build stage）
GOTOOLCHAIN=local go build -trimpath -ldflags="-s -w" -o /out/lumina-api ./cmd/api
GOTOOLCHAIN=local go build -trimpath -ldflags="-s -w" -o /out/lumina-migrate ./cmd/migrate
GOTOOLCHAIN=local go build -trimpath -ldflags="-s -w" -o /out/lumina-seed ./cmd/seed
```

### 测试命令

```bash
# 项目文档中未提供；任务要求的本地验证命令为：
GOTOOLCHAIN=local go test ./...
```

### 运行 / 启动命令

```bash
# 容器默认启动 API（来源：Dockerfile > ENTRYPOINT）
/usr/local/bin/lumina-api
```

## 4. 开发环境（简要）

### 前置要求

- Go 1.23 兼容工具链，并设置 `GOTOOLCHAIN=local`（来自 `go.mod` 与 `Dockerfile`）
- PostgreSQL 与 Redis（来自持久化及实时状态依赖；具体连接配置需由部署环境提供）

### 配置说明

- `API_ADDRESS`：API 监听地址，镜像默认 `:8080`。
- `UPLOAD_DIR`：上传文件目录，镜像默认 `/data/uploads`。

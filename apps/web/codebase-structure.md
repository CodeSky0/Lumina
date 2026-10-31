# Lumina Web Codebase 文档

## 1. 技术栈

- **Node.js**：项目文件未声明具体版本
- **语言**：TypeScript 5.9.3（来自 package.json `devDependencies`）
- **运行时 / 框架**：Next.js 15.5.7、React 19.1.1
- **包管理器**：npm（来自 package-lock.json；具体版本未声明）
- **Monorepo 工具**：项目目录内未发现编排配置
- **测试**：Vitest 3.2.4、Testing Library
- **Lint / 格式化**：项目文件未声明独立命令

## 2. 项目目录结构

```
web/
├── app/                                # Next.js App Router 页面与全局样式
│   ├── admin/                          # 管理端布局、仪表盘及各资源管理页面
│   │   ├── announcements/              # 公告管理路由
│   │   ├── assignments/                # 任务分配管理路由
│   │   ├── audit-logs/                 # 审计日志路由
│   │   ├── channels/                   # 通道管理路由
│   │   ├── classes/                    # 班级管理路由
│   │   ├── settings/                   # 系统设置路由
│   │   ├── subjects/                   # 科目管理路由
│   │   └── teachers/                   # 教师管理路由
│   ├── classroom/                      # 教室端消息与紧急公告路由
│   ├── login/                          # 登录路由
│   └── teacher/                        # 教师端消息协作路由
├── components/                         # 业务组件与通用 UI 组件
│   ├── admin/                          # 管理资源表单、列表、仪表盘及查询逻辑
│   ├── auth/                           # 登录与路由鉴权组件
│   ├── classroom/                      # 教室端聊天、紧急公告与科目展示组件
│   ├── teacher/                        # 教师端消息编辑、附件与通道组件
│   └── ui/                             # 对话框、表单控件、状态展示等通用组件
├── lib/                                # API DTO、认证、实时同步、格式化与查询工具
└── stores/                             # 会话及实时连接的全局状态
```

## 3. 开发命令（核心）

### 构建命令
```bash
# 构建（来源：package.json > scripts.build）
npm run build
```

### 测试命令
```bash
# 单元与组件回归测试（来源：package.json > scripts.test；框架见 vitest.config.ts）
npm test

# 类型检查（来源：package.json > scripts.typecheck）
npm run typecheck
```

### 运行 / 启动命令
```bash
# 开发服务器（来源：package.json > scripts.dev）
npm run dev

# 生产服务器（来源：package.json > scripts.start）
npm start
```

## 4. 开发环境（简要）

### 前置要求

- Node.js：具体版本未在项目文件中声明
- npm：具体版本未在项目文件中声明

### 配置说明（选填）

- `.env.example`：前端 API 地址等运行环境配置示例。
- `next.config.ts`：Next.js 配置及 `/api`、`/ws` 到后端服务的重写规则。

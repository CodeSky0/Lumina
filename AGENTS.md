# AGENTS.md — Lumina 项目约定

## 开发命令

```bash
npm run dev          # 开发服务器
npm run lint         # ESLint
npm run typecheck    # TypeScript 类型检查
npm test             # 单元测试
npm run build        # 构建
npm run db:generate  # 生成数据库迁移
npm run db:push      # 推送 schema 到数据库
```

## 代码约定

- **设计系统**：全面使用 Yohaku Design System tokens，不硬编码颜色/字号
- **组件**：`components/ui/` 为基础原子组件，`components/chat/` 为聊天域组件
- **路径别名**：`@/*` → 项目根目录
- **Server Actions**：业务逻辑全部用 `"use server"` 标注的 Server Actions，不使用 REST API
- **校验**：所有 Server Action 输入用 Zod schema 校验
- **权限**：所有 Server Action 调用 `requireUser(role)` 或 `assertCanAccessConversation` 校验权限
- **测试**：纯逻辑函数测试在 `tests/unit/`，DB 依赖函数需 mock 或用测试事务

## 部署

- **主应用**：Vercel（自动迁移在 prebuild 钩子）
- **实时层**：`cd cf-worker && npx wrangler deploy`
- **环境变量**：见 `.env.example`

## 注意事项

- TypeScript 7.0 + ESLint 可能有兼容性误报，区分真实问题与误报
- `cf-worker/` 是独立子项目，有自己的 package.json 和 tsconfig
- Tailwind CSS v4 无配置文件，通过 `@import` 和 `@theme` 在 globals.css 配置

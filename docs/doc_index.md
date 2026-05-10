# 文档索引（渐进式披露）

协作与编码时**从这里开始**：先扫本页决策「该打开哪篇文档」，再按需深入；避免在未建立上下文时大范围改动。仓库根 [`AGENTS.md`](../AGENTS.md) 仅保留极简入口与代码指路。

## Agent 建议顺序

1. 读本索引（任务分流 + 下方文档条目）。
2. 打开与当前任务匹配的一篇实践文档，读到够用为止。
3. 需要接口细节、环境变量或具体行号时，再跟随该文档内的章节与代码引用跳转。

## 任务分流（何时读哪篇）

| 你在做什么 | 打开 |
|------------|------|
| 后端 API、AI Prompt、方舟调用、SSE、密钥、`ARK_*`、Express / Vercel 双运行时、部署与路由 | [backend-best-practices.md](./backend-best-practices.md) |
| 前端页面与组件、React/Vite/Tailwind、Firebase 客户端、同源 SSE 消费、Firestore | [frontend-best-practices.md](./frontend-best-practices.md) |
| 仅需要仓库一句话定位 | [`AGENTS.md`](../AGENTS.md) |

## 文档条目

### [backend-best-practices.md](./backend-best-practices.md)

后端落地指南：**双运行时**（本地 `server.ts` / Vercel `api/*`）与 [`server/ark-api.ts`](../server/ark-api.ts) 共享业务，SSE 流式、密钥与观测性、**Vercel 按文件路径映射路由**等 Do/Don't，附代码引用。

### [frontend-best-practices.md](./frontend-best-practices.md)

前端落地指南：React / Vite / Tailwind v4 / Firebase、`@/` 别名；**新页面与新功能优先 shadcn/ui**（§3）；环境变量与 `define`、SSE 客户端与 Firestore 降级等，附代码引用与反例。

## 速查指针（不重复长表）

以下为「去哪一节查」的索引；正文以后端/前端文档为准。

| 主题 | 位置 |
|------|------|
| 环境变量（`ARK_API_KEY`、`ARK_BASE_URL`、`ARK_MODEL` 等） | [backend-best-practices.md §7](./backend-best-practices.md#7-环境变量与密钥) |
| `POST /api/interpret`、`/api/chat` 及共享实现位置 | [backend-best-practices.md](./backend-best-practices.md)（§1 架构、§2 双运行时） |
| Vercel `api/foo/bar.ts` → `/api/foo/bar` 路由约定 | [backend-best-practices.md §3](./backend-best-practices.md#3-vercel-文件路由约定) |
| 客户端 Firebase、Vite 与流式请求 | [frontend-best-practices.md](./frontend-best-practices.md) |
| shadcn/ui、新页面 UI 约定、`components.json` | [frontend-best-practices.md §3](./frontend-best-practices.md#3-shadcnui新页面与新功能) |

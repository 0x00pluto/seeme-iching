# AGENTS.md — 仓库协作入口（极简）

面向在本仓库协助开发的 AI 编码助手与人类协作者。**细则与落地指南不在此展开**，见 [`docs/`](docs/) 与下文阅读顺序。

## 阅读顺序（Agent）

开始执行任务前，**先读** [`docs/doc_index.md`](docs/doc_index.md)，按其中的文档地图与任务类型**渐进展开**，再改代码。仓库级编辑器与协作约定以 **`.cursor/rules`**、`package.json` 为准。

## 产品一句话

**镜微 · 易经 AI 内省**（`seeme-iching`）：基于六十四卦意象的 AI 心理内省；原则：**不预言命运，只映照叙事**。云端档案依赖 Firebase（认证 + Firestore）。

## 技术画像（极简）

- **栈**：React、TypeScript、Vite、Tailwind；本地 **Express**（`server.ts`）与 **Vercel** `api/*` 共用 [`server/ark-api.ts`](server/ark-api.ts)；AI 为火山方舟 OpenAI 兼容端；客户端 Firebase。
- **包管理**：**pnpm**（以 `pnpm-lock.yaml` 为准）。

## 常用命令

- `pnpm run dev` — 开发（Express + Vite HMR），默认 `http://localhost:3000`
- `pnpm run build` — 前端构建产出 `dist/`
- `pnpm run lint` — `tsc --noEmit`

## 代码入口指路

| 方向 | 入口 |
|------|------|
| AI 行为、interpret/chat、密钥侧逻辑 | [`server/ark-api.ts`](server/ark-api.ts) |
| 本地 HTTP 与静态资源 | [`server.ts`](server.ts) |
| 托管平台无服务器路由 | [`api/`](api/) |
| 前端主流程与登录/历史 | [`src/pages/Home.tsx`](src/pages/Home.tsx) |
| 卦象与算法 | [`src/lib/iching.ts`](src/lib/iching.ts) |
| 业务 UI 组件 | [`src/components/IChing/`](src/components/IChing/) |

## 许可

项目 README 声明 MIT — 镜微团队。

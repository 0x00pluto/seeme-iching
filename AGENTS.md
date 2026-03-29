# AGENTS.md — AI 助手与本仓库协作指南

本文档面向在本仓库中协助开发的 AI 编码助手与人类协作者，概括架构、约定与常用操作，便于快速上手且少踩坑。

## 项目是什么

**镜微 · 易经 AI 内省**（`seeme-iching`）：基于六十四卦意象的 AI 心理内省应用。产品原则：**不预言命运，只映照叙事**；结合四面卦象（本/互/错/综）生成观心报告，并提供最多 8 轮的深度对话。云端档案依赖 Firebase（认证 + Firestore）。

## 技术栈（以 `package.json` 为准）

| 层级 | 选型 |
|------|------|
| 前端 | React 19、TypeScript、Vite 6 |
| 样式 | Tailwind CSS 4（`@tailwindcss/vite`）、`src/index.css` 中 `@theme` 与字体 |
| 动效 / UI | Framer Motion、Lucide React、Sonner（Toast）、React Markdown、Recharts（若使用图表） |
| 服务端 | Node.js，`server.ts` 内 **Express** + 开发态 **Vite middleware**（同源 3000 端口） |
| AI | `openai` SDK 指向火山方舟 **Coding Plan** OpenAI 兼容端（默认 `.../api/coding/v3` + `ark-code-latest`）；常规在线推理可改 `ARK_BASE_URL=.../api/v3` 且 `ARK_MODEL=ep-...`） |
| 数据与登录 | Firebase（`firebase-applet-config.json` 于仓库根目录） |

说明：依赖里包含 `wouter`，当前源码未使用；路由由 `Home` 内状态机（`landing` / `divination` / `interpretation` / `history`）驱动。

## 目录结构（核心）

```text
/
├── server.ts                 # Express 入口：/api/* 与 Vite 中间件或生产静态资源
├── vite.config.ts            # React + Tailwind 插件；别名 @ → ./src；define APP_URL
├── firebase-applet-config.json   # Firebase 前端配置（被 src/lib/firebase.ts 引用）
├── firebase-blueprint.json       # 蓝图/参考（按需）
├── index.html
└── src/
    ├── main.tsx              # 入口，引入 index.css
    ├── App.tsx               # ErrorBoundary、Toaster、Home
    ├── index.css             # Tailwind 4 + 主题变量
    ├── pages/Home.tsx        # 主流程、登录与历史同步
    ├── lib/
    │   ├── iching.ts         # 六十四卦数据与起卦逻辑
    │   ├── firebase.ts       # Auth / Firestore 封装
    │   └── utils.ts          # 如 cn() 类名合并
    └── components/
        ├── ErrorBoundary.tsx
        └── IChing/           # Divination、Hexagram、Interpretation、DeepDialogue、History 等
```

路径别名：`@/*` → `src/*`（见 `tsconfig.json` 与 `vite.config.ts`）。

## 常用命令

| 命令 | 作用 |
|------|------|
| `pnpm run dev` | `tsx server.ts`：开发服务器（Express + Vite HMR），默认 **http://localhost:3000** |
| `pnpm run build` | 前端 `vite build` 产出 `dist/` |
| `pnpm run start` | `node server.ts`：`NODE_ENV=production` 时需提供已构建的 `dist` |
| `pnpm run preview` | 仅预览 Vite 构建结果（与全栈 `start` 不同） |
| `pnpm run lint` | `tsc --noEmit` 类型检查 |

包管理：仓库以 **pnpm** 与 `pnpm-lock.yaml` 为准。

## 环境变量

| 变量 | 用途 |
|------|------|
| `ARK_API_KEY` | 服务端调用方舟 **必需**（控制台 API Key） |
| `ARK_BASE_URL` | 可选；默认 **Coding Plan** `https://ark.cn-beijing.volces.com/api/coding/v3`；勿与通用 `/api/v3` 混用以免额外计费（见官方 [Coding 快速开始](https://www.volcengine.com/docs/82379/1928261)） |
| `ARK_MODEL` | 可选；默认 `ark-code-latest`；常规推理接入点则填 `ep-` 开头并配合 `.../api/v3` |
| `APP_URL` | Vite 注入 `process.env.APP_URL`（如分享链接）；未设时前端可用 `window.location.origin` |
| `NODE_ENV` | `production` 时 `server.ts` 走静态 `dist`，否则走 Vite 中间件 |
| `DISABLE_HMR` | 设为 `true` 时关闭 HMR（注释说明用于 AI Studio 等场景避免频繁刷新） |

`.env` 由 `dotenv` 在 `server.ts` 加载；**勿将含密钥的 `.env` 提交仓库**。

## HTTP API（仅服务端）

- `POST /api/interpret`：请求体含 `question`、`benGua`、`huGua`、`cuoGua`、`zongGua` 等，返回 `{ text }`。
- `POST /api/chat`：请求体含 `messages`、`question`、`interpretation`、`round`、`input`，返回 `{ text }`。

密钥只存在于服务端环境变量，不在浏览器暴露。

## 给 AI 助手的实现提示

1. **改 AI 行为**：改 `server.ts` 内 prompt 与 `systemInstruction`（方舟 OpenAI 兼容 API），与产品「只问不判、心理觉察」一致。
2. **改卦象与算法**：集中在 `src/lib/iching.ts`。
3. **改 UI 流程**：`src/pages/Home.tsx` 与各 `src/components/IChing/*` 组件。
4. **Firebase**：配置在根目录 `firebase-applet-config.json`；Firestore 集合如 `history` 与 `uid` 字段见 `Home.tsx` 查询逻辑。
5. **类型与质量**：提交前可跑 `pnpm run lint`；避免无关文件的大范围格式化。
6. **与 README 不一致时**：以代码为准（例如 README 写 React 18，实际为 React 19；Firebase 配置文件路径为根目录 `firebase-applet-config.json`）。

## 许可

项目 README 声明 MIT — 镜微团队；协作时遵循仓库许可证与团队约定。

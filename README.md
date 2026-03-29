# 镜微 · 易经 AI 内省

> **以卦为镜，观心自省。** 易经不预言命运，而是照见内心的模式。

镜微是一款基于易经六十四卦的 AI 心理内省应用。它的核心哲学只有一句话：**AI 永远不预言，只映照**。六十四卦不是算命工具，而是六十四种人类心理困境的原型——每一卦都是一面镜子，照见的是提问者自己的叙事模式。

---

## 产品理念

传统易经占卜的问题在于，它把人的注意力引向「外部答案」，而不是「内部洞见」。镜微反其道而行之：AI 不给解读，不给建议，不预测吉凶。它只做一件事——用卦象的故事和意象，引出一个让你重新审视自己的问题。

这套方法论来自心理学中的**叙事疗法**与**苏格拉底式提问**：人的困境往往不是因为缺乏答案，而是因为被困在某一个固定的叙事框架里。当你被问到「你说的『总是』，是每一次都这样吗？」的时候，你开始看见自己的叙事模式——这才是真正的改变起点。

---

## 核心功能 (实际开发特性)

### 1. 沉浸式占卦系统
应用支持两种起卦方式：
- **时间起卦**：以当前时刻的宇宙时间切片推算卦象。
- **铜钱起卦**：模拟传统的掷筊过程，通过随机算法生成六爻。
卦象以 SVG 六爻图形优雅展示，结合 Framer Motion 提供流畅的视觉反馈。

### 2. 四镜解读 (AI 观心报告)
每次起卦后，系统会推演出四面“镜子”，并由 AI 结合用户的问题生成深度内省报告：
- **现状之镜 (本卦)**：代表当前事态的外部表现与现状。
- **内心之镜 (互卦)**：代表事态内部隐藏的动机、用户的真实内心状态。
- **阴影之镜 (错卦)**：代表被忽视的对立面、潜意识中的恐惧或盲点。
- **视角之镜 (综卦)**：代表换位思考后的客观环境或事态的另一面。

### 3. 深度对话系统 (Deep Dialogue)
提供一个限定 **8 轮** 的深度对话空间。AI 化身心理引导者：
- **映照与深挖**：用卦象故事引出问题，帮助用户看见自己的叙事框架，挑战绝对化表述。
- **克制与悬置**：AI 只问问题，不给答案，不做评价。在第 8 轮时进行总结并给出充满希望的结语，引导用户自我觉察。

### 4. 认知档案 (云端同步)
- 基于 Firebase 构建的用户系统与云端数据库。
- 用户的每一次占卜记录、自我觉察笔记以及深度对话历史，都会被安全地保存在云端，随时可以回顾。

---

## 技术架构

前端由 Vite 构建；AI 请求通过同源 **`/api/interpret`**、**`/api/chat`** 调用，密钥仅在后端环境变量中，不进入浏览器。

### 技术栈

| 模块 | 技术选型 |
|---|---|
| **前端框架** | React 19 + TypeScript + Vite 6 |
| **样式系统** | Tailwind CSS 4 + Framer Motion |
| **UI 组件** | Lucide React（图标）+ React Markdown + Sonner（Toast） |
| **本地后端** | Node.js + Express（[`server.ts`](server.ts)：开发态挂载 Vite 中间件，生产态托管 `dist`） |
| **线上 API（如 Vercel）** | 根目录 [`api/`](api/) 无服务器函数，与 Express **共用** [`server/ark-api.ts`](server/ark-api.ts) 中的方舟调用逻辑 |
| **数据库与认证** | Firebase（Firestore + Google Auth） |
| **AI 大模型** | 火山方舟 **Coding Plan**（OpenAI 兼容 SDK，默认 `api/coding/v3` + `ark-code-latest`；见 [`.env.example`](.env.example)） |

### 核心项目结构

```text
/
├── server.ts                 # Express 入口：挂载 /api/*、Vite 或静态 dist
├── server/
│   └── ark-api.ts            # 方舟 interpret/chat 共用逻辑（prompt、OpenAI 调用）
├── api/
│   ├── interpret.ts          # Vercel 等：POST /api/interpret
│   └── chat.ts               # Vercel 等：POST /api/chat
├── vercel.json               # 可选：SPA 回退、函数 maxDuration 等（部署于 Vercel 时使用）
├── public/
│   └── favicon.svg           # 站点图标（镜字圆标）
├── firebase-applet-config.json   # Firebase 前端配置（被 src/lib/firebase.ts 引用）
├── index.html
├── src/
│   ├── components/
│   │   ├── ErrorBoundary.tsx
│   │   └── IChing/           # Divination、Hexagram、Interpretation、DeepDialogue、History
│   ├── lib/
│   │   ├── iching.ts         # 六十四卦数据与起卦/变卦逻辑
│   │   ├── firebase.ts       # Firebase 初始化与封装
│   │   └── utils.ts          # 工具函数（如 cn）
│   ├── pages/Home.tsx        # 主流程状态机（landing / divination / interpretation / history）
│   ├── App.tsx               # ErrorBoundary、Toaster、Home
│   └── main.tsx
├── .env                      # 本地环境变量（勿提交）
└── package.json
```

路径别名：`@/*` → `src/*`。

### 安全设计
- **API 密钥**：`ARK_API_KEY` 仅配置在服务端（本机 `.env` 或托管平台环境变量），前端只请求同源 `/api/*`。
- **Firestore**：建议配置安全规则，确保用户只能读写自己的 `history` 等数据。

---

## 本地开发指南

### 环境要求
- Node.js 18+
- [pnpm](https://pnpm.io/)（推荐；仓库以 `pnpm-lock.yaml` 为准）
- Firebase 项目（需开启 Firestore 和 Google Auth）
- 火山方舟 API Key（`ARK_API_KEY`，可选覆盖 `ARK_BASE_URL` / `ARK_MODEL`，见 `.env.example`）

### 快速启动

1. **克隆项目并安装依赖**
   ```bash
   pnpm install
   ```

2. **配置环境变量**  
   在根目录创建 `.env`，至少填写 `ARK_API_KEY`（参见 `.env.example`）。

3. **配置 Firebase**  
   将控制台配置写入仓库根目录的 **`firebase-applet-config.json`**（与 `src/lib/firebase.ts` 中的引用路径一致）。

4. **启动全栈开发服务器**
   ```bash
   pnpm run dev
   ```
   会启动 Express（`/api/*`）与 Vite 前端热更新，默认 **http://localhost:3000**。

5. **访问应用**  
   浏览器打开 `http://localhost:3000`。

---

## 生产部署

### 自建 Node（Express）
```bash
pnpm run build    # 产出 dist/
pnpm run start    # NODE_ENV=production 时 Express 托管 dist 并提供 /api/*
```
运行前需设置与本地一致的服务端环境变量（含 `ARK_API_KEY`）。若直接 `node server.ts` 无法解析 TypeScript，请使用与开发一致的运行方式（例如通过 `tsx` 或先编译为 JS），以你方运维约定为准。

### 部署到 Vercel（静态前端 + Serverless API）
- 构建仍为 `pnpm run build`，静态资源来自 `dist/`；**`/api/interpret`**、**`/api/chat`** 由根目录 [`api/`](api/) 下函数提供，逻辑与 [`server/ark-api.ts`](server/ark-api.ts) 一致。
- 在 Vercel 项目 **Environment Variables** 中配置 **`ARK_API_KEY`**（及按需 `ARK_BASE_URL`、`ARK_MODEL`），**不要**把密钥写进前端代码或公开仓库。
- 详见仓库根目录 [`vercel.json`](vercel.json)（SPA 回退、`maxDuration` 等）。

---

## License

MIT © 镜微团队

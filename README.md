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

### 4. 认知档案 (本地)
- 占卦记录保存在浏览器 **localStorage**（键前缀 `iching_*`），同一浏览器内可回顾；清除站点数据或换设备不会同步。

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
| **线上 API（如 Vercel）** | 根目录 [`api/`](api/) 无服务器函数，与 Express **共用** [`server/ark-api.ts`](server/ark-api.ts)（[`server/llm/registry.ts`](server/llm/registry.ts) 在方舟与 Kimi 间切换） |
| **客户端持久化** | `localStorage`（档案与深度对话会话） |
| **AI 大模型** | **火山方舟** 或 **Kimi Moonshot**（OpenAI 兼容 SDK；`SEEME_AI_PROVIDER` 切换，见 [`.env.example`](.env.example)） |

### 核心项目结构

```text
/
├── server.ts                 # Express 入口：挂载 /api/*、Vite 或静态 dist
├── server/
│   ├── ark-api.ts            # interpret/chat 共用逻辑（prompt、按提供商调 OpenAI）
│   ├── llm-provider.ts       # 兼容：re-export resolveAiProvider / AiProvider
│   └── llm/                  # LlmBackend、registry、resolve、providers/ark|kimi
├── api/
│   ├── interpret.ts          # Vercel 等：POST /api/interpret
│   └── chat.ts               # Vercel 等：POST /api/chat
├── vercel.json               # 可选：SPA 回退、函数 maxDuration 等（部署于 Vercel 时使用）
├── public/
│   └── favicon.svg           # 站点图标（镜字圆标）
├── index.html
├── src/
│   ├── components/
│   │   ├── ErrorBoundary.tsx
│   │   └── IChing/           # Divination、Hexagram、Interpretation、DeepDialogue、History
│   ├── lib/
│   │   ├── iching.ts         # 六十四卦数据与起卦/变卦逻辑
│   │   └── utils.ts          # 工具函数（如 cn）
│   ├── pages/Home.tsx        # 主流程状态机（landing / divination / interpretation / history）
│   ├── App.tsx               # ErrorBoundary、Toaster、Home
│   └── main.tsx
├── .env                      # 本地环境变量（勿提交）
└── package.json
```

路径别名：`@/*` → `src/*`。

### 安全设计
- **API 密钥**：使用 **同源流式代理**，`ARK_API_KEY` 或 `MOONSHOT_API_KEY` 仅存在于服务端（本机 `.env` 或托管平台环境变量），由 `SEEME_AI_PROVIDER` 决定使用哪套。前端不直连大模型域名，避免 CORS 与浏览器暴露 key。
  - 前端使用：`POST /api/interpret/stream`、`POST /api/chat/stream`（SSE 流式返回）。
  - 注意：若把该代理部署在 Vercel 等 serverless 上，仍可能受 `maxDuration`（当前配置为 300s）限制，连接可能被掐断。
- **本地档案**：`localStorage` 仅在用户本机可见；共用设备时注意隐私与清除浏览器数据的影响。

---

## 本地开发指南

### 环境要求
- Node.js 18+
- [pnpm](https://pnpm.io/)（推荐；仓库以 `pnpm-lock.yaml` 为准）
- LLM 配置（见 `.env.example`）：`SEEME_AI_PROVIDER`（`ark` 默认 / `kimi`）；方舟侧 `ARK_*`；Kimi 侧 `MOONSHOT_API_KEY`、`MOONSHOT_BASE_URL`、`KIMI_MODEL`、可选 `KIMI_THINKING_ENABLED`

### 快速启动

1. **克隆项目并安装依赖**
   ```bash
   pnpm install
   ```

2. **配置环境变量**  
   在根目录创建 `.env`：默认方舟需 `ARK_API_KEY`；若 `SEEME_AI_PROVIDER=kimi` 则填 `MOONSHOT_API_KEY`（参见 `.env.example`）。

3. **启动全栈开发服务器**
   ```bash
   pnpm run dev
   ```
   会启动 Express（`/api/*`）与 Vite 前端热更新，默认 **http://localhost:3000**。

4. **访问应用**  
   浏览器打开 `http://localhost:3000`。

---

## 生产部署

### 自建 Node（Express）
```bash
pnpm run build    # 产出 dist/
pnpm run start    # NODE_ENV=production 时 Express 托管 dist 并提供 /api/*
```
运行前需设置与本地一致的服务端环境变量（含当前提供商所需的 `ARK_*` 或 `MOONSHOT_API_KEY` 等）。若直接 `node server.ts` 无法解析 TypeScript，请使用与开发一致的运行方式（例如通过 `tsx` 或先编译为 JS），以你方运维约定为准。

### 部署到 Vercel（静态前端 + Serverless API）
- 构建仍为 `pnpm run build`，静态资源来自 `dist/`；**`/api/interpret`**、**`/api/chat`** 由根目录 [`api/`](api/) 下函数提供，逻辑与 [`server/ark-api.ts`](server/ark-api.ts) 一致。
- 在 Vercel 项目 **Environment Variables** 中配置 **`SEEME_AI_PROVIDER`** 及对应 **`ARK_*` 或 `MOONSHOT_*` / `KIMI_MODEL`**，**不要**把密钥写进前端代码或公开仓库。
- 详见仓库根目录 [`vercel.json`](vercel.json)（SPA 回退、`maxDuration` 等）。

---

## License

MIT © 镜微团队

# AGENTS.md — 仓库协作入口（极简）

面向在本仓库协助开发的 AI 编码助手与人类协作者。**细则与落地指南不在此展开**，见 [`docs/`](docs/) 与下文阅读顺序。

## 阅读顺序（Agent）

开始执行任务前，**先读** [`docs/doc_index.md`](docs/doc_index.md)，按其中的文档地图与任务类型**渐进展开**，再改代码。撰写或验收 PRD 时另读 [`docs/product-brief.md`](docs/product-brief.md)。仓库级编辑器与协作约定以 **`.cursor/rules`**、`package.json` 为准。

## 产品一句话

**镜微 · 易经 AI 内省**（`seeme-iching`）：基于六十四卦意象的 AI 心理内省；原则：**不预言命运，只映照叙事**。登录为手机号六位镜证（`POST /api/auth/send-otp`、`verify-otp`）；观心报告解读结束后**自动保存**至 Supabase（`/api/archives`，免费 7 天 / 有效会员 180 天保留）；**镜脉续照**（明日之约 + autosave 后异步 **seed** 预写 + 打开日选档拼装三段式续照，`GET /api/mirror-thread/today`，不扣解读额度）；**镜脉回笔**（续照可选短回应，`PUT /api/mirror-thread/reply`，次日位移 verbatim 照见用户原话）；深度对话草稿仍用浏览器 `localStorage`。

## 技术画像（极简）

- **栈**：React、TypeScript、Vite、Tailwind；本地 **Express**（`server.ts`）与 **Vercel** `api/*` 共用 [`server/ark-api.ts`](server/ark-api.ts)（[`server/llm/registry.ts`](server/llm/registry.ts) 在 **火山方舟** 与 **Kimi Moonshot** OpenAI 兼容端之间切换；解析见 [`server/llm/resolve.ts`](server/llm/resolve.ts)）。
- **包管理**：**pnpm**（以 `pnpm-lock.yaml` 为准）。

## 常用命令

- `pnpm run dev` — 开发（Express + Vite HMR），默认 `http://localhost:3000`
- `pnpm run build` — 前端构建产出 `dist/`
- `pnpm run lint` — `tsc --noEmit`
- `pnpm run db:migration:new -- <name>` — 在 `supabase/migrations/` 生成空 SQL；文件名前缀 `YYYYMMDDHHMMSS` 由 [`scripts/db-migration-new.mjs`](scripts/db-migration-new.mjs) 按**本机时区墙钟**（`Date` 本地分量）生成。若希望时间戳按 UTC 墙钟，可在命令前加 `TZ=UTC`（可选）。`db:migrate` / `list` 前需已 `supabase link`。
- `pnpm run db:migration:list` — 查看迁移状态
- `pnpm run db:migrate` — `supabase db push` 推送到已 link 的远端库

## 团队命令（Cursor）

安装于 [`.cursor/commands/team/`](.cursor/commands/team/)（母版维护于 Obsidian `Vibecoding团队/团队成员/`）：

| 命令 | 用途 |
|------|------|
| `/team:product-manager` | 撰写 PRD → 落盘 [`specs/prds/`](specs/prds/) |
| `/team:prd-accept` | 对照代码验收并回写 PRD「工程验收状态」 |
| `/team:test-enginer` | 真实环境端到端 / UI / 接口验收，派发 subagent 取证，产出判定（不改代码） |

重装或变量说明见 [`docs/team-commands-install.md`](docs/team-commands-install.md)。

## 代码入口指路

| 方向 | 入口 |
|------|------|
| AI 行为、interpret/chat、密钥侧逻辑 | [`server/ark-api.ts`](server/ark-api.ts)、[`server/llm/`](server/llm/)（`registry.ts`、`providers/*`）、[`server/llm-provider.ts`](server/llm-provider.ts)（兼容 re-export） |
| Supabase（服务端客户端、迁移、健康检查） | [`server/supabase-client.ts`](server/supabase-client.ts)、[`supabase/migrations/`](supabase/migrations/)、[`api/health/supabase.ts`](api/health/supabase.ts) |
| 本地 HTTP 与静态资源 | [`server.ts`](server.ts) |
| 托管平台无服务器路由 | [`api/`](api/) |
| 前端主流程与本地档案 | [`src/pages/Home.tsx`](src/pages/Home.tsx) |
| 卦象与算法 | [`src/lib/iching.ts`](src/lib/iching.ts) |
| 镜脉 seed / today | [`server/mirror-thread-seed.ts`](server/mirror-thread-seed.ts)、[`server/mirror-thread-handlers.ts`](server/mirror-thread-handlers.ts) |
| 业务 UI 组件 | [`src/components/IChing/`](src/components/IChing/) |

## 许可

项目 README 声明 MIT — 镜微团队。

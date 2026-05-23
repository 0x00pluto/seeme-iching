# 后端开发最佳实践

面向 `seeme-iching` 仓库中协作的开发者与 AI 助手。协作入口见 [`docs/doc_index.md`](./doc_index.md)；本文档不重复其中的分流说明，只补落地细节、Do / Don't 与可观测性、限流等前瞻实践。每条都尽量给本仓库的真实代码引用与反例。

> 本仓库后端的定位极简：**AI 转发 + SSE 流式**；占卦档案等在前端 **localStorage**，不经由本后端持久化。  
> 双运行时：本地 / 自托管走 Express（[`server.ts`](../server.ts)），Vercel 部署走 Serverless Functions（[`api/`](../api/)），共享 [`server/ark-api.ts`](../server/ark-api.ts) 业务逻辑；具体 LLM 端点由 [`server/llm/resolve.ts`](../server/llm/resolve.ts) 的 `resolveAiProvider()` 与 [`server/llm/registry.ts`](../server/llm/registry.ts) 的 `getActiveLlmBackend()` 解析为 **火山方舟** 或 **Kimi Moonshot**。

---

## 1. 架构总览

```
src (浏览器)
  │
  └─ POST /api/{interpret,interpret/deep-inquiry,chat}{,/stream}
       │
       ├─ 本地  -> server.ts (Express)
       │              └─ runInterpretApi / runDeepInquiryApi / runChatApi / runInterpretStream / runChatStream
       │
       └─ Vercel -> api/interpret.ts | api/interpret/deep-inquiry.ts | api/chat.ts | api/{interpret,chat}/stream.ts
                       └─ 调同一组 server/ark-api.ts 函数
                                │
                                ├─ SEEME_AI_PROVIDER=ark（默认）
                                │     └─ 火山方舟（OpenAI 兼容）https://ark.cn-beijing.volces.com/api/coding/v3
                                │
                                └─ SEEME_AI_PROVIDER=kimi
                                      └─ Kimi Moonshot（OpenAI 兼容）https://api.moonshot.cn/v1（默认，可 MOONSHOT_BASE_URL 覆盖）
```

**核心设计原则**：

- **业务逻辑只能写在 [`server/ark-api.ts`](../server/ark-api.ts)**。Express 与 Vercel Functions 都是"传输层适配器"，不能在两边各写一遍 Prompt 或错误处理。
- **服务端密钥不出服务端**：`ARK_API_KEY` / `MOONSHOT_API_KEY` 只在 Node 进程读（由 `SEEME_AI_PROVIDER` 决定用哪套），永远不能进 bundle、不能写日志、不能回前端。
- **流式优先**：AI 解读普遍 5–30s，必须走 SSE 让用户看到"逐字生成"，而不是同步等结果。

---

## 2. 双运行时与共享逻辑

### 2.1 共享模块沉淀

[`server/ark-api.ts`](../server/ark-api.ts) 暴露的 4 个核心函数被 2 个运行时共用：

```ts
runInterpretApi(body)       // 同步 JSON：观心报告
runDeepInquiryApi(body)     // 同步 JSON：基于报告的三条深入问句
runChatApi(body)            // 同步 JSON
runInterpretStream(body)    // AsyncGenerator，逐 token yield
runChatStream(body)         // AsyncGenerator，逐 token yield
```

Express 端的接入：[`server.ts`](../server.ts)（含 `/api/interpret/deep-inquiry`）；Vercel Functions 端的接入：[`api/interpret.ts`](../api/interpret.ts)、[`api/interpret/deep-inquiry.ts`](../api/interpret/deep-inquiry.ts)、[`api/chat.ts`](../api/chat.ts)。

**Do**: LLM 调用编排、流式解析与 JSON 校验改 [`server/ark-api.ts`](../server/ark-api.ts)；**提供商解析**改 [`server/llm/resolve.ts`](../server/llm/resolve.ts)；**注册表与 `LlmBackend` 接口**改 [`server/llm/registry.ts`](../server/llm/registry.ts)、[`server/llm/types.ts`](../server/llm/types.ts)；**各供应商实现**改 [`server/llm/providers/`](../server/llm/providers/)（`ark.ts`、`kimi.ts`）；**可维护的长 Prompt 模板**改 [`server/prompts/`](../server/prompts/)，由 `ark-api` 引用。**两个运行时自动同步**。

**Don't**: 在 [`api/chat.ts:18`](../api/chat.ts) 里加私货逻辑（"只在 Vercel 多做一步 X"）。两套代码很快会漂移，长期一定踩坑。

### 2.2 Express 还是 Vercel Functions？

| 场景 | 用什么 |
|------|--------|
| 本地开发 | `pnpm run dev` 走 Express + Vite middleware（[`server.ts:75-87`](../server.ts)） |
| Vercel 部署 | `api/*.ts` Serverless Functions |
| 自托管（VPS / Docker） | `NODE_ENV=production node server.ts`，[`server.ts:81-87`](../server.ts) 会切换到静态 `dist/` |
| 长任务（>5 分钟）/ WebSocket / 后台 cron | **不要塞进 Vercel Functions**，单独起 Express 或 Node 服务部署到 Railway / Fly.io |

**Do**: 保留 Express 路径作为"未来可托底"的退路。一旦遇到 Vercel 限制（见 §11），可以快速把部分路由切到自托管。

**Don't**: 删掉 `server.ts` 只留 `api/*`。这等于砍掉了演进空间，需要再写就要从头来。

### 2.3 邮箱镜证登录（Auth OTP）

- 发码 / 验码逻辑在 [`server/auth-handlers.ts`](../server/auth-handlers.ts)；`signInWithOtp` **不传** `emailRedirectTo`；验码用 `verifyOtp` + 本站 HttpOnly Cookie（`USER_SESSION_SECRET`）。
- 同邮箱 **60s** 重发冷却由 [`server/auth-otp-cooldown.ts`](../server/auth-otp-cooldown.ts) 进程内 `Map` 实现；响应体带 `resendAvailableAt`（ISO8601），前端倒计时须以此为准。
- **多实例限制**：Vercel 水平扩展时各实例 Map 不共享，60s 为尽力而为；与 Supabase 侧限流取较严。强一致需外置 KV，见 [§10](#10-限流与配额前瞻实践)。
- `POST /api/auth/session` 已废弃（**410**）；新登录走 `POST /api/auth/verify-otp`。
- 运维：Supabase 邮件模板须含 `{{ .Token }}`；Email OTP Expiration 建议 **1800** 秒。

---

## 3. Vercel 文件路由约定

Vercel 把 `api/*` 下的 ts 文件按**路径**映射成 HTTP 端点：

| 文件路径 | 实际 URL |
|----------|----------|
| `api/foo.ts` | `/api/foo` |
| `api/foo/bar.ts` | `/api/foo/bar` |
| `api/foo-bar.ts` | `/api/foo-bar`（不是 `/api/foo/bar`） |

本仓库目前的端点：

- [`api/interpret.ts`](../api/interpret.ts) → `POST /api/interpret`
- [`api/chat.ts`](../api/chat.ts) → `POST /api/chat`
- [`api/interpret/stream.ts`](../api/interpret/stream.ts) → `POST /api/interpret/stream`
- [`api/interpret/deep-inquiry.ts`](../api/interpret/deep-inquiry.ts) → `POST /api/interpret/deep-inquiry`
- [`api/chat/stream.ts`](../api/chat/stream.ts) → `POST /api/chat/stream`
- [`api/health/supabase.ts`](../api/health/supabase.ts) → `GET /api/health/supabase`（Supabase 连通性；需 `SUPABASE_*` 环境变量）
- [`api/auth/send-otp.ts`](../api/auth/send-otp.ts) → `POST /api/auth/send-otp`
- [`api/auth/verify-otp.ts`](../api/auth/verify-otp.ts) → `POST /api/auth/verify-otp`

**Do**: 需要加 `/api/foo/bar` 时，**一定**新建 `api/foo/bar.ts`。

**Don't**: 写成 `api/foo-bar.ts` 然后试图通过 `vercel.json` 重写映射——404 是必然，且这种 bug 在重构时会反复出现（参见本文 [§3](#3-vercel-文件路由约定)；索引见 [`docs/doc_index.md`](./doc_index.md)）。

---

## 4. Serverless Function 编写规范

每个 `api/*.ts` 应当像 [`api/chat.ts`](../api/chat.ts) 一样保持极简：

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runChatApi } from "../server/ark-api.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 300,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }
    const { status, json } = await runChatApi(req.body);
    res.status(status).json(json);
  } catch (e) {
    console.error("api/chat handler:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}
```

要点：

### 4.1 `export const config` 声明运行时与时长

[`api/chat.ts:7-10`](../api/chat.ts)、[`api/interpret.ts:8-12`](../api/interpret.ts) 都用了 `export const config = { runtime, maxDuration }`。

**Do**: 时长写在代码里（`config.maxDuration`），不要只依赖 `vercel.json` —— 那只是"全局兜底"，函数级 config 优先级更高且 IDE 可见。

**Don't**: 在 `api/*.ts` 里读 `process.env.RUNTIME` 之类做动态判断。Vercel 在编译期就需要确定 runtime，不能运行时切换。

### 4.2 显式校验 HTTP method

[`api/chat.ts:14-17`](../api/chat.ts) 明确返回 405：

```ts
if (req.method !== "POST") {
  res.status(405).json({ error: "Method Not Allowed" });
  return;
}
```

**Do**: 即便只支持 POST，也写一遍 405 兜底——爬虫和误用 GET 测试很常见，要给清晰反馈。

### 4.3 try/catch 兜底，未发头时再 500

[`api/chat.ts:20-26`](../api/chat.ts) 的 catch 里：

```ts
if (!res.headersSent) {
  res.status(500).json({ error: "服务器内部错误", detail: message });
}
```

**Do**: **流式响应**的异常路径要先判 `res.headersSent`，已经发过 SSE header 就不能再 `res.status` 改 code，必须发 `data: {error}` + `data: [DONE]` 后 `res.end()`（详见 §6）。

**Don't**: 在 catch 里 `throw e`。Vercel 的 Function Logs 会记下，但前端会拿到一个不结构化的 500，detail 也没有。

### 4.4 引用 `.js` 后缀

[`api/chat.ts:5`](../api/chat.ts)：

```ts
import { runChatApi } from "../server/ark-api.js";
```

注意是 `.js` 而不是 `.ts`。这是 ESM + TypeScript 在 Node 下编译产物的引用规则；`@vercel/node` 工具链会做正确的解析。

**Don't**: 改成 `../server/ark-api`（无后缀）或 `../server/ark-api.ts`，本地或 Vercel 的某种环境会出现 404。

---

## 5. AI 调用规范

### 5.1 客户端工厂集中

当前提供商由 [`server/llm/resolve.ts`](../server/llm/resolve.ts) 的 `resolveAiProvider()` 决定（默认 `ark`），活动后端由 [`server/llm/registry.ts`](../server/llm/registry.ts) 的 `getActiveLlmBackend()` 返回，实现位于 [`server/llm/providers/ark.ts`](../server/llm/providers/ark.ts) 与 [`server/llm/providers/kimi.ts`](../server/llm/providers/kimi.ts)。

**方舟**侧常量与 `getArkClient()` 仍在 [`server/llm/providers/ark.ts`](../server/llm/providers/ark.ts)（并由 [`server/ark-api.ts`](../server/ark-api.ts) re-export 以保持历史 import 路径可用）：

```ts
export function getArkClient() {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.ARK_BASE_URL?.trim() || ARK_BASE_URL_DEFAULT,
  });
}

export function getArkModelId(): string {
  return process.env.ARK_MODEL?.trim() || ARK_MODEL_DEFAULT;
}
```

**Kimi** 侧：`kimiBackend` 与 `formatKimiFailure()` 等在 [`server/llm/providers/kimi.ts`](../server/llm/providers/kimi.ts)。

**Do**: 业务与 handler 通过 `getActiveLlmBackend()` 获取 `LlmBackend`，**不要**在 `api/*.ts` 里直接读 `MOONSHOT_API_KEY` 或绕过 `server/llm/`。

**Don't**: 在分散的 handler 或 util 里直接读 `ARK_API_KEY` / `MOONSHOT_API_KEY`，绕过 `getArkClient()` / `LlmBackend.getOpenAI()` 与统一缺 key 文案。

### 5.2 默认值与配置文档化

[`server/llm/providers/ark.ts`](../server/llm/providers/ark.ts) 方舟默认常量：

```ts
export const ARK_BASE_URL_DEFAULT = "https://ark.cn-beijing.volces.com/api/coding/v3";
export const ARK_MODEL_DEFAULT = "ark-code-latest";
```

Kimi 默认见 [`server/llm/providers/kimi.ts`](../server/llm/providers/kimi.ts)（`MOONSHOT_BASE_URL_DEFAULT`、`KIMI_MODEL_DEFAULT`）。

**Do**: 默认值跟本文 [§7](#7-环境变量与密钥) 及仓库 [`docs/doc_index.md`](./doc_index.md) 中的环境变量指针保持一致。改默认值时**必须**同步改文档。

**Don't**: 把基地址改成通用 `/api/v3` 但没改文档——勿与通用 `/api/v3` 混用以免额外计费（见 §7 表格说明），参见火山方舟 [Coding Plan 文档](https://www.volcengine.com/docs/82379/1928261)。

### 5.3 Prompt 集中

观心报告、深入三问、深度对话的 **用户/ system 文案** 已拆到 [`server/prompts/`](../server/prompts/)，由 [`server/ark-api.ts`](../server/ark-api.ts) 引用：

- [`server/prompts/interpret-report.ts`](../server/prompts/interpret-report.ts) — `buildInterpretReportUserPrompt(...)`
- [`server/prompts/deep-inquiry.ts`](../server/prompts/deep-inquiry.ts) — `buildDeepInquiryUserPrompt(...)`（JSON 契约说明同文件）
- [`server/prompts/chat-dialogue.ts`](../server/prompts/chat-dialogue.ts) — `buildChatSystemInstruction(question, interpretation, round, direction?)`

**Do**: 迭代 Pro prompt 优先改 `server/prompts/*`；`ark-api.ts` 只负责组装请求与解析响应。前端只传业务字段，不能拼任何 prompt 文本。

**Don't**: 把"礼貌用语 / 格式要求 / 不得算命"这种规则散到 [`api/chat.ts`](../api/chat.ts) 或前端。一旦散落，A/B 实验、风格调优都失控。

---

## 6. 流式（SSE）规范

[`server.ts:25-73`](../server.ts) 是 SSE 标准实现，[`api/interpret/stream.ts`](../api/interpret/stream.ts) / [`api/chat/stream.ts`](../api/chat/stream.ts) 走同样的契约。

### 6.1 Header 三件套

[`server.ts:27-29`](../server.ts)：

```ts
res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
res.setHeader("Cache-Control", "no-cache, no-transform");
res.setHeader("Connection", "keep-alive");
```

**Do**: 三个都不能省：

- `text/event-stream`：浏览器与代理才会按流处理。
- `no-cache, no-transform`：防止 CDN / 代理压缩或缓存（特别是 `no-transform` 防 gzip 缓冲整段才返回）。
- `keep-alive`：防止 HTTP/1.1 客户端在第一个 chunk 后断开。

**Don't**: 加 `Content-Length` —— 流式不知道总长度，写了反而会触发"等满才返回"。

### 6.2 事件 payload 与终止符

[`server.ts:32-46`](../server.ts) 是 OpenAI SSE 兼容格式：

```ts
res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: evt.delta } }] })}\n\n`);
// ... 错误路径
res.write(`data: ${JSON.stringify({ error: evt.error, detail: evt.detail ?? "" })}\n\n`);
res.write("data: [DONE]\n\n");
res.end();
```

**Do**:

- 每条事件以 `\n\n` 结尾（这是 SSE 标准的事件分隔符）。
- 结束**必须**发 `data: [DONE]\n\n` —— 前端 [`src/lib/ark-client.ts:147-150`](../src/lib/ark-client.ts) 依赖这个 token 来 resolve。
- 异常路径**先发错误事件再发 `[DONE]`**，否则前端会等到超时。

**Don't**: 用 `event: error\ndata: {...}` 的命名事件——前端的解析器只认 `data:` 前缀（[`src/lib/ark-client.ts:75-82`](../src/lib/ark-client.ts)）。这是项目的私有契约，不要改。

### 6.3 与 OpenAI SDK 的衔接

[`server/ark-api.ts:215-219, 261-265`](../server/ark-api.ts) 调 `client.chat.completions.create({ stream: true })`，再用 `for await (const chunk of stream)` 逐 token yield。

**Do**: 把 OpenAI 的 chunk 解开（`chunk.choices?.[0]?.delta?.content`）后只 yield 实际文本。这样后端契约稳定，**未来换模型供应商不影响前端**。

**Don't**: 把整个 chunk 直接转发到前端——会和 `ark-client.ts` 的解析约定耦合，以后换 SDK 就要前端跟着改。

### 6.4 Runtime 选择：当前用 Node

[`api/interpret.ts:8-12`](../api/interpret.ts) 的注释明确写了：

```ts
/** 显式 Node 运行时：OpenAI SDK 依赖 Node API，勿用 Edge。 */
export const config = {
  runtime: "nodejs",
  maxDuration: 300,
};
```

**Do**: 维持 `runtime: "nodejs"`，理由：

1. OpenAI SDK 依赖 Node 流（`Readable`）和 `globalThis` 的某些行为；
2. Vercel 2025-06 引入 Fluid Compute 后，Node Runtime 的限制已经大幅放宽（详见 §11），不再是"为了限制更宽必须切 Edge"；
3. 切 Edge 需要回归测试整条流式链路（错误处理、AbortController、stream backpressure），不应在没明确收益时切换。

**Don't**: 不要看到 "Edge 更快" 就把 runtime 改成 `"edge"`。如果未来想切，先在分支跑端到端 SSE 测试，确认 token 顺序、断流恢复、错误事件都正常。

### 6.5 流式异常处理

[`server.ts:34-38`](../server.ts) 的错误分支：

```ts
} else if (evt.type === "error") {
  res.write(`data: ${JSON.stringify({ error: evt.error, detail: evt.detail ?? "" })}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
  return;
}
```

**Do**: 错误后**必须** `[DONE]` + `res.end()` + `return`，否则连接挂起到超时。`runInterpretStream` / `runChatStream`（[`server/ark-api.ts:198-277`](../server/ark-api.ts)）的 `try/catch` 会把异常归一化成 `{ type: "error", ... }`，传输层只负责按格式输出。

**Don't**: 在流式 handler 里 `throw` —— header 已发，再抛只会让框架尝试再次写头报错，日志一团乱。

---

## 7. 环境变量与密钥

数据库 **DDL、RLS、`supabase/migrations/`** 与 `pnpm run db:*` 流程见 [supabase-migration-practices.md](./supabase-migration-practices.md)。

### 7.1 服务端独占变量

| 变量 | 用途 | 在哪配 |
|------|------|--------|
| `SEEME_AI_PROVIDER` | `ark`（默认）或 `kimi`；也可用 `AI_PROVIDER` 作后备 | 本地 `.env`、Vercel |
| `ARK_API_KEY` | 火山方舟 API Key（provider 为 **ark** 时必填） | 同上 |
| `ARK_BASE_URL` | 默认 Coding Plan，常规推理改 `.../api/v3` | 同上 |
| `ARK_MODEL` | 默认 `ark-code-latest`，常规推理填 `ep-` 接入点 ID | 同上 |
| `MOONSHOT_API_KEY` | Kimi API Key（provider 为 **kimi** 时必填） | 同上 |
| `MOONSHOT_BASE_URL` | 默认 `https://api.moonshot.cn/v1`，可按账号改为 `.ai` 域 | 同上 |
| `KIMI_MODEL` | 默认 `kimi-k2.6` | 同上 |
| `KIMI_THINKING_ENABLED` | 不设=关闭 Kimi K2 `thinking`；`1`/`true`/`yes`/`on`=开启（仅服务端自测；响应仍只暴露正文 `content`） | 同上 |
| `SUPABASE_URL` | Supabase 项目 URL（`createServerSupabase`） | 本地 `.env`、Vercel（**勿**加 `VITE_`） |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端特权 key（**勿**进前端包） | 同上 |
| `NODE_ENV` | `production` 时 [`server.ts`](../server.ts) 走静态 `dist/` | 部署平台 |
| `DISABLE_HMR` | 关 Vite HMR（AI Studio 等场景） | 本地 |

**Do**:

- 本地用 [dotenv](https://www.npmjs.com/package/dotenv)（[`server.ts:7`](../server.ts) 的 `dotenv.config()`），`.env` 文件**不**提交。
- Vercel 用控制台 Project → Settings → Environment Variables 配置；区分 Production / Preview / Development。

**Don't**:

- **永远不要**给后端变量加 `VITE_` 前缀。一旦加了，Vite 会把它打进客户端 bundle 永久泄露。
- **永远不要**把 `.env` 提交进仓库，即便文件里只有 base url。

### 7.2 不在日志里打印密钥

`server/ark-api.ts` 全文不在日志中打印 `ARK_API_KEY` / `MOONSHOT_API_KEY` 明文；Express 的 `console.error` 只打 error 对象。

**Don't**: 加调试日志 `console.log("client:", client)` —— OpenAI SDK 实例的某些字段可能包含部分 key。

---

## 8. 入参校验与防御性写法

### 8.1 用 `unknown` + 局部断言

[`server/ark-api.ts:130-143`](../server/ark-api.ts) 的模式：

```ts
export async function runInterpretApi(body: unknown): Promise<{ status: number; json: ArkJsonResponse }> {
  try {
    const b = body as {
      question?: unknown;
      benGua?: unknown;
      huGua?: unknown;
      cuoGua?: unknown;
      zongGua?: unknown;
    };
    // ... 用 b.question 等再断言或 String(...)
  }
}
```

**Do**: 函数签名收 `unknown`，内部断言到一个**字段全部可选**的窄类型；用值时 `String(...)` / `Number(...)` 强转。

**Don't**: 直接 `body as RequestBody`（含必选字段）—— 一旦客户端漏传，TypeScript 会让你以为字段一定存在，运行时炸。

### 8.2 数组防御性处理

[`server/ark-api.ts:173-178`](../server/ark-api.ts)：

```ts
const history = Array.isArray(b.messages)
  ? b.messages.map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m.content ?? ""),
    }))
  : [];
```

**Do**: 对外部传入的数组用 `Array.isArray()` 判一次；对每个元素的字段都 `String(... ?? "")` 兜底。

**Don't**: 直接 `b.messages.map(...)` —— 如果客户端传了对象或字符串，会抛 `TypeError`，但栈不一定指向这一行（被 SDK 吞掉再抛）。

### 8.3 角色字段白名单

注意 [`server/ark-api.ts:175`](../server/ark-api.ts) 把 role **强制归一化**为 `"user"` 或 `"assistant"`。**Don't**: 让客户端可以自由传 `role: "system"` —— 那等于让前端能注入 system prompt，是一个 prompt injection 漏洞。

---

## 9. 错误归一化与可观测性

### 9.1 各供应商 `formatFailure` 为统一出口

[`server/ark-api.ts`](../server/ark-api.ts) 在 `catch` 中调用当前 `LlmBackend` 的 `formatFailure`（方舟实现为 `formatArkFailure`，Kimi 为 [`server/llm/providers/kimi.ts`](../server/llm/providers/kimi.ts) 的 `formatKimiFailure`），把 OpenAI SDK 错误归类成「人话 + detail」：

- 401 / unauthorized → API Key 无效或未授权（文案随供应商指向对应控制台）
- endpoint / not found / invalid model → 模型或接入点不可用
- insufficient / balance / quota → 余额或额度不足
- 其它 → 默认提示（含建议检查的 env 名）

**Do**: 与 LLM 交互的代码路径都通过活动后端的 `formatFailure` 输出。前端的 toast / 错误页可以直接展示 `error` 字段，detail 在折叠区或调试态展示。

**Don't**: 把 SDK 的 error 直接 `JSON.stringify` 回前端。错误对象可能含 stack、请求体、临时 token，泄露面太大。

### 9.2 日志规范

各处的 `console.error` 都加了模块前缀：

- [`server/ark-api.ts`](../server/ark-api.ts) `"Interpret API Error:"`、`"Deep Inquiry API Error:"`、`"Chat API Error:"`、`"Interpret Stream Error:"`、`"Chat Stream Error:"`
- [`api/chat.ts:21`](../api/chat.ts) `"api/chat handler:"`

**Do**: 在 Vercel Runtime Logs 通过前缀过滤问题。前缀格式 `<module> <event>:` 既可读又便于 grep。

**Don't**:

- 不要 `console.log(req.body)` —— 用户问题、卦象都属于隐私，只能打 `length` 或哈希。
- 不要 `console.log(JSON.stringify(error))` —— OpenAI 错误对象嵌套很深，单行输出会让日志难看且包含敏感字段。

### 9.3 推荐补充：requestId

未实现，但作为最佳实践写出来：在 handler 入口生成 `requestId = crypto.randomUUID()`，所有日志都带，response header 也回写 `x-request-id`。一旦用户截图报错，只要把 requestId 给到运维就能精准定位单次调用。

---

## 10. 限流与配额（前瞻实践）

**当前未接入**，但所有 AI 路由都应当具备"接 KV 限流的位点"。AI 调用按 token 计费，被刷一次损失就是真金白银。

### 10.1 推荐方案：Upstash Redis（或 Vercel KV）

```
npm 包：@upstash/ratelimit  + @upstash/redis
依赖关系：通过 HTTPS REST 调，不需要常驻连接，与 Serverless 天然兼容。
```

### 10.2 限流维度

| 优先级 | 维度 | 触发场景 |
|--------|------|----------|
| 高 | 已登录 UID（`request.auth.uid`，从前端传 ID Token，Admin SDK 校验） | 防止单账号薅羊毛 |
| 中 | 客户端 IP（`req.headers['x-forwarded-for']` 取首位） | 防止匿名扫接口 |
| 低 | 全局 QPS | 防止异常流量打爆配额 |

### 10.3 插入点

应当在 `runChatApi` / `runInterpretApi` 入口前、`runChatStream` / `runInterpretStream` 入口前各做一次。伪代码：

```ts
// server/ark-api.ts （建议未来扩展）
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 次 / 分钟
});

export async function runChatApi(body: unknown, ctx: { uid?: string; ip?: string }) {
  const key = ctx.uid ?? ctx.ip ?? "anonymous";
  const { success, remaining } = await ratelimit.limit(key);
  if (!success) {
    return { status: 429, json: { error: "请求过于频繁，请稍后再试" } };
  }
  // ... 原逻辑
}
```

### 10.4 何时该做

- DAU > 500，或单日 AI 调用 > 5000 次：**一定要做**。
- 上线公开分享页（无需登录就能触发 AI）：**一定要做**。
- 出现疑似刷接口的 4xx 大量增长：**立刻做**。

---

## 11. Vercel Functions 平台限制要点

> 数据基于 Vercel 2025-06 引入的 Fluid Compute；具体上限请以 [Vercel 官方文档](https://vercel.com/docs/functions/limitations) 为准。

| 维度 | Hobby | Pro | Enterprise |
|------|-------|-----|------------|
| `maxDuration` 默认 / 上限 | 300s / 300s | 300s / 800s | 300s / 800s |
| 实例规格（Standard） | 1 vCPU / 2 GB | 1 vCPU / 2 GB | 1 vCPU / 2 GB |
| 请求体上限 | 4.5 MB | 4.5 MB | 4.5 MB |
| 响应体（非流式） | 4.5 MB | 4.5 MB | 4.5 MB |
| 函数代码体积 | 250 MB（解压后） | 250 MB | 250 MB |
| 月度 GB-Hours | 限额内免费 | 1000 含税，超出按量 | 自定义 |
| 持久连接 / WebSocket | ❌ | ❌ | ❌ |
| 进程内缓存跨调用共享 | ❌ | ❌ | ❌ |

本仓库的影响：

- [`vercel.json`](../vercel.json) 中 `functions["api/**/*.ts"]` 与 [`api/*.ts`](../api/) 内 `export const config` 均设 `maxDuration: 300`，与 Hobby 下 Fluid Compute 的常见上限对齐。若仍有超长生成需求，可在 Pro 上将单函数上限调至更高（最高 800s）或改为分段生成等非 serverless 方案。
- 4.5 MB 的请求/响应上限对本项目影响小：用户问题 + 卦象 JSON 通常 < 10KB，AI 长文本响应 < 50KB。不要"未来感"地加大输入字段（如附件上传）—— 一旦超 4.5 MB 就要走前端直传 OSS / 预签名 URL。
- **进程内缓存不可信**：Serverless 实例可能被销毁、可能并行多实例，任何 `const cache = new Map()` 都不能跨调用共享。需要共享必须 Redis / KV。

---

## 12. 本地开发与部署

### 12.1 本地

```bash
pnpm install            # 仓库以 pnpm-lock.yaml 为准
pnpm run dev            # tsx server.ts，Express + Vite middleware，端口 3000
```

[`server.ts:75-87`](../server.ts) 在 `NODE_ENV !== "production"` 时挂 Vite middleware，热更新即时生效；同时挂 `/api/*`，本地与线上行为一致。

**Do**: 本地调试时直接 `console.log`，但**提交前清理**或改用 `console.debug`。

**Don't**: 在本地用 `vercel dev`。本仓库的设计就是 `pnpm run dev` 一站式，引入 `vercel dev` 反而会两套环境交叉调试。

### 12.2 部署 Vercel

```bash
pnpm run build          # vite build → dist/
# vercel CLI 或 git push 触发 Vercel 自动构建
```

关键文件：

- [`vercel.json`](../vercel.json) —— `buildCommand` / `outputDirectory` / SPA `rewrites` / 函数 `maxDuration`。
- [`api/`](../api/) —— Vercel 自动识别成 Serverless Functions。

**Do**: 上线前先在 Preview Deploy 跑一遍，重点测：

1. `/api/interpret` 同步路径在长对话下是否超时；
2. `/api/interpret/stream` 是否正常逐字返回；
3. 错误路径（删掉环境变量）前端能否拿到结构化提示。

**Don't**:

- 不要在 `vercel.json` 写 `routes`（旧版语法），Vercel 已经废弃，**只用 `rewrites` / `headers` / `redirects`**。
- 不要把 `.env` 进 git；遇到"线上能跑本地不行"先排查环境变量。

### 12.3 自托管 Express

```bash
pnpm run build
NODE_ENV=production node server.ts
```

[`server.ts:81-87`](../server.ts) 切到静态目录模式：

```ts
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});
```

**Do**: 自托管时把当前提供商所需的密钥（`ARK_API_KEY` 或 `MOONSHOT_API_KEY`）及 `SEEME_AI_PROVIDER` 注入进程环境（systemd / Docker env / pm2 ecosystem），别再依赖 `.env` 文件——容器重建可能丢。

**Don't**: 把 Express 部到 Vercel —— 会被识别为 Build Output，但失去 Serverless 自动扩缩容的优势，得不偿失。Express 应该部到 Railway / Fly.io / 阿里云 ECS 这类常驻进程平台。

---

## 13. 常见反模式速查

| 反模式 | 正确做法 |
|--------|----------|
| 在 `api/foo-bar.ts` 想匹配 `/api/foo/bar` | 新建 `api/foo/bar.ts` |
| `ARK_API_KEY` / `MOONSHOT_API_KEY` 加 `VITE_` 前缀 | 永远只在 Node 环境读 |
| 在 `api/*.ts` 里直接读 `process.env.ARK_API_KEY` 或 `MOONSHOT_API_KEY` | 通过 `server/llm/registry.ts` 的 `getActiveLlmBackend()` |
| Prompt 写在前端或 handler 里 | 集中在 `server/ark-api.ts` + `server/prompts/` |
| 流式 handler 里 `throw` | 发 `data: {error}` + `[DONE]` 后 `res.end()` |
| 错误对象 `JSON.stringify` 直接回前端 | 用活动后端 `formatFailure` 归一化 |
| `console.log(req.body)` | 只打 length / hash |
| `body.messages.map(...)` 不判数组 | `Array.isArray(b.messages) ? ... : []` |
| 让前端能传 `role: "system"` | 白名单到 user / assistant |
| 进程内 `Map` 做限流 | Upstash Redis / Vercel KV |
| `vercel.json` 里写 `routes` | 用 `rewrites` |

---

## 14. 想深入了解

- [Vercel Functions 限制（官方）](https://vercel.com/docs/functions/limitations)
- [Vercel Fluid Compute（2025-06 升级公告）](https://vercel.com/changelog/higher-defaults-and-limits-for-vercel-functions-running-fluid-compute)
- [火山方舟 Coding Plan 文档](https://www.volcengine.com/docs/82379/1928261)
- [Kimi K2.6 快速开始（OpenAI 兼容）](https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md)
- [OpenAI Node SDK 流式响应](https://github.com/openai/openai-node)
- [Upstash Ratelimit](https://github.com/upstash/ratelimit-js)
- [`docs/doc_index.md`](./doc_index.md) —— 渐进披露入口；环境变量与 Vercel 路由见上文 §7、§3
- 仓库根 [`AGENTS.md`](../AGENTS.md) —— 极简入口与代码指路
- [前端最佳实践](./frontend-best-practices.md) —— shadcn（§3）、SSE、ErrorBoundary、Tailwind v4

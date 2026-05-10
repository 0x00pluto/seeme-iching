# 前端开发最佳实践

面向在 `seeme-iching` 仓库中协作的开发者与 AI 助手。协作入口见 [`docs/doc_index.md`](./doc_index.md)；本文档不重复其中的分流说明，只补充落地到代码的细则与 Do / Don't。每条实践都尽量给出本仓库的真实代码引用与反例。

> 本仓库技术栈：React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Framer Motion + Sonner + Firebase Web SDK。**新增页面与独立新功能**的 UI 优先采用 **shadcn/ui**（见 [§3](#3-shadcnui新页面与新功能)）。AI 流式响应走同源 SSE 代理，状态在 Firestore 与 `localStorage` 之间降级。

---

## 1. 总体原则

- **新页面 / 新功能 UI**：优先 **shadcn/ui** primitive（详见 [§3](#3-shadcnui新页面与新功能)），与易经既有页面共存，逐步统一即可。
- **KISS / YAGNI**：先用 `useState` + 状态机，超过 4 个独立页面再上 [`wouter`](../package.json)（已装未用）。
- **DRY**：跨多处的逻辑抽到 `src/lib/*`；UI 中重复 3 次以上的结构抽组件；prompt、SSE 解析这种业务逻辑务必沉淀。
- **单一职责**：`src/pages/Home.tsx` 是顶层状态机与登录/历史同步；`src/components/IChing/*` 只关心 UI；`src/lib/*` 只关心数据与协议。任何反向依赖（lib 引用 components）都视为代码异味。
- **显式优于隐式**：组件 props、函数返回值都用 TypeScript 标注；不要靠 `any` / `as` 蒙混。
- **代码即文档**：注释只写"为什么"，不写"是什么"；变量与函数名要能自解释。

---

## 2. 目录结构与命名

| 目录 | 职责 | 反例 |
|------|------|------|
| [`src/pages/`](../src/pages/) | 顶层页面 / 状态机入口 | 不放纯展示组件 |
| [`src/components/IChing/`](../src/components/IChing/) | 业务组件，按领域分组 | 不放与领域无关的通用 UI |
| [`src/components/`](../src/components/) | 跨领域通用组件（如 [`ErrorBoundary`](../src/components/ErrorBoundary.tsx)） | 不直接耦合业务模型 |
| [`src/lib/`](../src/lib/) | 协议 / 数据 / 工具：iching、firebase、ark-client、utils | 不依赖任何 React 组件 |

**Do**: 用路径别名 `@/*`，由 [`vite.config.ts`](../vite.config.ts) 与 `tsconfig.json` 同步声明，参见 [`vite.config.ts:13-17`](../vite.config.ts)。

```ts
import { cn } from "@/lib/utils";
import { Hexagram } from "@/components/IChing/Hexagram";
```

**Don't**: 写 `../../../lib/utils`。一旦移动文件就要全量改。

---

## 3. shadcn/ui（新页面与新功能）

本仓库为 **Vite 6 + React 19 + Tailwind CSS v4**（`@import "tailwindcss"` + [`src/index.css`](../src/index.css) 中 `@theme`）。**后续新增的页面、独立新功能模块**，交互控件（按钮、表单、对话框、下拉、Tabs 等）**优先使用 shadcn/ui**（Radix UI + 可复制源码 + Tailwind），与官方「Vite + React」工作流对齐，避免再堆一套自定义 primitive。

### 3.1 适用范围与现有代码的关系

| 场景 | 做法 |
|------|------|
| **新路由视图 / 新功能页 / 新流程** | 优先 `pnpm dlx shadcn@latest add <component>` 生成 primitive，再在本业务目录组装 |
| **既有 `src/components/IChing/*`** | 无重构需求时可维持现状；**局部改版或新增子模块**时，新 UI 优先接 shadcn，逐步统一即可，不要求一次性重写 |

### 3.2 初始化与 CLI（首次接入）

- 在**仓库根目录**执行官方 CLI（版本以 [shadcn/ui 文档](https://ui.shadcn.com/docs/installation/vite) 为准）。常用：`pnpm dlx shadcn@latest init`（或 `npx shadcn@latest init`），框架选 **Vite**。
- 确保 **`components.json`** 中的路径别名、样式入口与本仓库一致：`@/*` → `src/*`，全局样式入口为 [`src/index.css`](../src/index.css)。
- **依赖安装**遵循仓库约定：由维护者在本地执行 `pnpm add …`，勿手工编造 lockfile。

### 3.3 主题与 Tailwind v4（本项目约束）

- 设计 token 以 [`src/index.css`](../src/index.css) 的 **`@theme`** 为单一事实源（如 `--color-bg`、`--color-accent`）。若 shadcn 默认变量名与当前命名不一致，**在 `@theme` / `:root` 侧对齐语义色**，避免组件内硬编码十六进制。
- 本项目 **不设** 传统 `tailwind.config.js` 作为主配置；若 CLI 生成冲突片段，以「**CSS-first v4 + @theme**」为准合并，不维护两套主题。
- 类名合并统一使用 [`src/lib/utils.ts`](../src/lib/utils.ts) 的 **`cn()`**（已为 `clsx` + `tailwind-merge`），与 shadcn 文档一致。

### 3.4 组件放置与引用约定

- CLI 默认将通用 primitive 放在 **`src/components/ui/`**（若 `components.json` 另有约定则从其约定）。业务页面放在 [`src/pages/`](../src/pages/) 或 [`src/components/IChing/`](../src/components/IChing/)，**从 `@/components/ui/...` 引用**，勿复制一份 primitive 到业务文件夹。
- **定制样式**：优先改该组件文件内的 **`className` + `cva` variant**，避免用全局 CSS 覆盖 Radix 内部结构。
- **图标**：继续 **Lucide React**（与 shadcn 默认一致；[`package.json`](../package.json) 已依赖）。

### 3.5 与 Framer Motion、Sonner 的配合

- 动效：可在 shadcn 组件**外层**包 `motion.div` 等，**避免**随意改动 Radix `Primitive` 子节点顺序（破坏无障碍）。
- Toast：全站已用 **Sonner**（[`App.tsx`](../src/App.tsx)）。新功能优先 `toast.*`，不与 shadcn 自带 toast 混用两套入口。

### 3.6 不要这样做

- **不要**为解决样式问题再引入第二套 UI 库（MUI、Antd 等）堆叠在同一功能上。
- **不要**把需复用的交互组件只写在页面文件里；应 `add` 或抽取到 `components/ui` / 业务组件。
- **不要**在 `src/lib/*` 引用 `components/ui`（lib 保持无 React UI 依赖）。

---

## 4. Vite 6 配置实践

当前配置见 [`vite.config.ts`](../vite.config.ts)，几条要点：

### 4.1 `defineConfig` 用函数形式 + `loadEnv`

已采用，见 [`vite.config.ts:6-7`](../vite.config.ts)：

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return { /* ... */ };
});
```

`loadEnv` 第三个参数 `''` 表示加载所有变量（含没有前缀的）。注意：**`loadEnv` 只是给 Vite 自身用的**，不会自动暴露到浏览器。

### 4.2 客户端环境变量的正确做法

Vite 的官方约定：**只有 `VITE_` 前缀的变量才会被注入 `import.meta.env`**，其它变量在前端代码里读到的是 `undefined`。

**Do**（推荐写法）：

```bash
# .env
VITE_APP_URL=https://seeme.example.com
```

```ts
const url = import.meta.env.VITE_APP_URL;
```

**当前历史写法**（[`vite.config.ts:10-12`](../vite.config.ts)）：

```ts
define: {
  'process.env.APP_URL': JSON.stringify(env.APP_URL || process.env.APP_URL || ""),
}
```

通过 `define` 把无前缀变量"伪装"成 `process.env.X` 注入。**能用，但不是 Vite 6 的推荐写法**。新增变量时优先用 `VITE_` 前缀，避免给后续维护者制造心智负担。

**Don't**: 把后端密钥（`ARK_API_KEY` 等）误加 `VITE_` 前缀。一旦构建就会被打进客户端 bundle 永久泄露。

### 4.3 HMR 与 `DISABLE_HMR`

[`vite.config.ts:18-22`](../vite.config.ts) 提供了关闭 HMR 的开关：

```ts
server: {
  hmr: process.env.DISABLE_HMR !== 'true',
}
```

注释明确指出"AI Studio 等在频繁文件改动场景下用此开关防闪烁"。**不要随便删掉这个开关**，跟基建有约定。

### 4.4 静态资源策略

| 用法 | 适用 | 例子 |
|------|------|------|
| `public/*` | 不参与构建、URL 固定的资源 | `public/favicon.svg` |
| `src/assets/*` + `import` | 参与构建、需要 hash 缓存的资源 | 业务用图标、背景图 |

**Do**: 大于 4KB 的图片走 `import`，让 Vite 加 hash；小图标 inline 或放 `public/`。

**Don't**: 把 `firebase-applet-config.json` 之类的"看似配置"放 `public/`——它已经在仓库根目录被 [`src/lib/firebase.ts:4`](../src/lib/firebase.ts) 直接 import，无需暴露给浏览器二次拉取。

### 4.5 构建产物与部署

- 输出目录：`dist/`，由 [`vercel.json:4`](../vercel.json) 与 [`server.ts:82`](../server.ts) 共同感知。
- SPA 回退：[`vercel.json:5-9`](../vercel.json) 的 `rewrites` 把非 `/api/*` 的所有请求改写到 `index.html`，本地 Express 在 [`server.ts:84-86`](../server.ts) 用 `app.get("*", ...)` 实现等价效果。
- 不要手动改 `dist/`，由 `pnpm run build` 生成。

---

## 5. React 19 + TypeScript 实践

### 5.1 函数组件 + Hook 优先

全仓库唯一的 class 组件是 [`ErrorBoundary`](../src/components/ErrorBoundary.tsx)（React 至今只有 Error Boundary 必须用 class 实现）。其余一律函数组件。

**Don't**: 为了"对称感"把已有函数组件改成 class，或者新写 class 组件。

### 5.2 `useEffect` 必须返回清理函数

凡是订阅 / 计时器 / 流式连接 / 事件监听，**必须**在清理函数里取消，否则组件卸载或依赖变化时会内存泄漏并触发 `setState on unmounted` 警告。

**Do**：参考 [`src/components/IChing/Interpretation.tsx:94-148`](../src/components/IChing/Interpretation.tsx) 的完整闭环：

- 入口处 `abortRef.current?.abort()` 取消上一次请求；
- 新建 `AbortController` 并存到 `ref`；
- 在 `catch` 里跳过 `AbortError`（[L129](../src/components/IChing/Interpretation.tsx)）；
- 单独再写一个 useEffect，仅在卸载时统一 `abort`（[L144-148](../src/components/IChing/Interpretation.tsx)）。

定时器示例见 [`src/components/IChing/Divination.tsx:16-37`](../src/components/IChing/Divination.tsx)：用 `useRef<NodeJS.Timeout | null>(null)` 持有 handle，并在停止 / 完成 / 卸载路径上 `clearInterval`。

**Don't（隐患示例）**：在 `useEffect` 的回调里再嵌套一次订阅，把内层的取消函数从外层回调直接 `return`，那个 return 不会被 React 当作 cleanup 调用。本仓库 [`src/pages/Home.tsx:25-62`](../src/pages/Home.tsx) 的 `onAuthStateChanged → onSnapshot` 嵌套就属于这种结构——`return () => unsubHistory()` 看似清理，实际上只在某个分支返回，外层 useEffect 卸载时只会调用 `onAuthStateChanged` 自己的 unsubscribe。这种写法当前可工作，但需要改账号或多次切换登录态时会留下隐患，未来改造的方向是：**把 user 状态单独 useEffect 监听，把 history 订阅放到另一个依赖 user 的 useEffect**。

### 5.3 状态管理策略

- 当前所有页面状态都用 [`useState`](../src/pages/Home.tsx) + `AppState` 联合类型驱动（landing / divination / interpretation / history），**不引入** Redux / Zustand。
- 跨组件透传不超过 2 层时直接 props；超过则拉到上层 Hook 或下沉到 `lib/`。
- 何时该考虑全局状态库：**真正的跨页面共享、且 props drilling 超过 3 层** —— 当前没有这种场景，**保持现状**。

### 5.4 错误边界

[`src/App.tsx:5-11`](../src/App.tsx) 已用 `ErrorBoundary` 包住整棵树，配合 Sonner Toaster：

```tsx
<ErrorBoundary>
  <Toaster position="top-center" expand={false} richColors />
  <Home />
</ErrorBoundary>
```

**Do**: 渲染期错误（如 ReactMarkdown 解析异常）依赖 ErrorBoundary 兜底；网络与业务错误用本地 `error` state + Sonner toast，不要让它们冒泡到 ErrorBoundary。

**Don't**: 在组件渲染函数里写 `try/catch` 包 JSX。React Compiler 会直接报错（"Avoid constructing JSX within try/catch"）。

### 5.5 React 19 新能力的克制使用

- `use(promise)` / `useActionState` / `useOptimistic` 是 React 19 新增 hook。本项目目前**没用，不强求引入**。AI 流式由 `streamInterpret` 内部 `setState` 驱动 UI，已经够用。
- 如果未来要做"提交反思 → 乐观插入 → 服务端确认"这种交互，可以考虑 `useOptimistic`。
- React Compiler 已可用，但本仓库未启用编译器优化插件，**不要私自加**——会和现有 `useMemo` / `useCallback` 形成混合维护成本。

---

## 6. Tailwind CSS v4 实践

### 6.1 CSS-first 配置

v4 的核心变化：**没有 `tailwind.config.js`**，所有 token 用 `@theme` 在 CSS 里声明。本仓库已经按官方推荐组织（[`src/index.css:1-10`](../src/index.css)）：

```css
@import url('https://fonts.googleapis.com/css2?...');
@import "tailwindcss";

@theme {
  --font-serif: "Noto Serif SC", serif;
  --font-garamond: "EB Garamond", serif;
  --color-bg: #fdfcf9;
  --color-ink: #1a1a1a;
  --color-accent: #8b0000;
}
```

声明的 CSS 变量会自动生成对应工具类：`bg-bg` / `text-ink` / `text-accent` / `font-serif`。

**Do**: 新增主题色 / 字号 / 圆角 / 动效曲线时，先看 `@theme` 里有没有；没有就在 `@theme` 加，不要在组件里写裸十六进制色。

**Don't**:

- 不要再新建 `tailwind.config.js` —— v4 不需要，会被忽略并造成误导。
- 不要在 `@theme` 外随手 `:root { --color-x: ... }` —— 那个变量不会变成工具类，破坏一致性。

### 6.2 用 `cn()` 合并类名

[`src/lib/utils.ts`](../src/lib/utils.ts) 是经典的 `clsx + tailwind-merge` 组合：

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Do**: 凡是 className 里有条件、覆盖或拼接，都用 `cn(...)`：

```tsx
className={cn(
  "px-4 py-2 rounded-lg",
  isActive && "bg-accent text-bg",
  className,
)}
```

`twMerge` 会自动消除冲突类（例如 `px-4 px-6` 只保留后者）。

**Don't**: 用模板字符串拼 className（`\`px-4 ${isActive ? 'bg-accent' : ''}\``）。冲突时不会合并，调试痛苦。

### 6.3 不要滥用 `@apply`

v4 仍支持 `@apply`，但不是好实践。组件复用应当抽 React 组件，不是把样式藏到 CSS 里再 `@apply`。

**Don't**:

```css
.btn-primary { @apply px-4 py-2 bg-accent text-bg rounded-lg; }
```

**Do**: 新页面与新功能优先用 **shadcn/ui** 的 `Button` 等（见 [§3](#3-shadcnui新页面与新功能)），再用 `cn()` / `cva` 做变体；若确有定制需求，再封装自有 `<Button variant="primary">`，配色与尺寸仍受 `@theme` 约束。

---

## 7. AI 流式调用规范

后端流式契约见 [后端最佳实践](./backend-best-practices.md)。前端要点：

### 7.1 永远走同源代理

[`src/lib/ark-client.ts:15-16`](../src/lib/ark-client.ts) 的注释是铁律：

> 当前实现：前端只走同源流式代理，不在浏览器直连方舟（避免 CORS / key 暴露）。

**Don't**: 在浏览器里直接 `fetch('https://ark.cn-beijing.volces.com/...')`。即便配了 CORS，`ARK_API_KEY` 也会经浏览器暴露。**任何"AI 调用"都必须走 `/api/*/stream`。**

### 7.2 SSE 解析的标准实现

参考 [`src/lib/ark-client.ts:69-178`](../src/lib/ark-client.ts)，标准流程：

1. `fetch(path, { signal })` 拿到 `res.body`，检查 `res.ok && res.body`。
2. `res.body.getReader()` + `TextDecoder('utf-8', { stream: true })` 持续读取。
3. 用 `\n\n` 切事件、用 `data:` 取 payload（[L69-82](../src/lib/ark-client.ts)）。
4. 收到 `data: [DONE]` 调 `onDone` 并 return。
5. payload 里若有 `error` 字段，抛 `Error` 让上层 toast。

**Do**: 复用 `streamViaProxy`，新接口只增 `streamXxx` 包装函数（[L84-115](../src/lib/ark-client.ts)）。

**Don't**:

- 不要直接 `await res.text()` 然后整段渲染——那会丢掉流式体验，且 60s 套餐下大概率超时。
- 不要在客户端拼 prompt——所有 prompt 集中在 [`server/ark-api.ts`](../server/ark-api.ts)，前端只传业务字段（`question`、`benGua`、`huGua`、`cuoGua`、`zongGua`）。

### 7.3 流式渲染的边界处理

流式输出的 Markdown 表格在 token 边界会断行，参考 [`src/components/IChing/Interpretation.tsx:17-65`](../src/components/IChing/Interpretation.tsx) 的 `normalizeMarkdownTables` 工具：将多行合并、补全分隔行、清理空行。

**Do**: 用 `useMemo` 把昂贵的 normalize / 解析包起来（[L156](../src/components/IChing/Interpretation.tsx)）：

```tsx
const normalizedInterpretation = useMemo(
  () => normalizeMarkdownTables(interpretation),
  [interpretation]
);
```

**Don't**: 不要在每次 render 都 normalize 一次。流式场景下 setState 频率很高，无 memo 会把 CPU 吃掉。

### 7.4 取消请求

页面跳转、组件卸载、用户重新起卦，都必须 `abort` 当前流。[`src/components/IChing/Interpretation.tsx`](../src/components/IChing/Interpretation.tsx) 同时演示了两种入口：

- 依赖变化时（[L96-98](../src/components/IChing/Interpretation.tsx)）：先 `abortRef.current?.abort()`，再 new。
- 卸载时（[L144-148](../src/components/IChing/Interpretation.tsx)）：单独 useEffect，依赖 `[]`。

**Don't**: 把 `AbortController` 放 `useState`（每次 setState 会重建 controller，反而失控）。**应该用 `useRef`。**

---

## 8. Firebase 客户端 SDK 边界

### 8.1 配置不是密钥，安全靠 Rules

[`firebase-applet-config.json`](../firebase-applet-config.json) 是公开 ID（`apiKey` 字段是 Firebase 路由用的，不是鉴权密钥），可以提交仓库。**真正的安全靠 Firestore Security Rules**。任何前端直连方案都必须配 rules：

- `history/{docId}` 只允许 `request.auth.uid == resource.data.uid` 读写。
- 未登录用户不能读他人记录，也不能批量列出。

**Do**: 在仓库 `firestore.rules`（如有）里维护规则；上线前用 Firebase 模拟器跑一遍。

**Don't**: 把 `firebase-applet-config.json` 改名 `.env`、加 `.gitignore`——它本来就不是机密。这种"伪保密"反而会让协作者误以为安全已经做好。

### 8.2 实时订阅的清理

`onSnapshot` 返回 unsubscribe 函数，必须在适当时机调用。当前 [`src/pages/Home.tsx:38-47`](../src/pages/Home.tsx) 的写法见 §5.2 "隐患示例"。建议演进方向：

```tsx
useEffect(() => {
  const unsub = onAuthStateChanged(auth, setUser);
  return unsub;
}, []);

useEffect(() => {
  if (!user) return;
  const q = query(/* ... */);
  const unsub = onSnapshot(q, (snap) => setHistory(/* ... */));
  return unsub;
}, [user]);
```

**Don't**: 在登录态切换时不解绑前一个订阅。Firestore 计费按"活跃监听 × 时长"算，泄漏会直接体现在账单上。

### 8.3 离线降级

未登录时把数据存 `localStorage`（[`src/pages/Home.tsx:49-58, 75-79`](../src/pages/Home.tsx)）。**Do**: 把 key 命名加前缀 `iching_*`，避免与其他应用冲突。**Don't**: 写超过几 MB 的内容到 `localStorage`，配额很紧；大数据用 IndexedDB。

---

## 9. 错误处理与用户反馈

### 9.1 三层错误防线

| 层级 | 工具 | 何时用 |
|------|------|------|
| 渲染期 | [`ErrorBoundary`](../src/components/ErrorBoundary.tsx) | 组件抛出（罕见，多为 Bug） |
| 业务 / 网络 | 局部 `error` state + Sonner toast | 接口失败、参数错误 |
| Firestore | [`handleFirestoreError`](../src/lib/firebase.ts) | 写库失败的统一上报 |

### 9.2 SSE 错误显示

后端会发结构化错误（[`server/ark-api.ts:12-59`](../server/ark-api.ts) 的 `formatArkFailure`），前端必须把 `err.message` 与 `err.detail` 拼起来展示，不要只显示 "请求失败"。本仓库 [`src/lib/ark-client.ts:157-161`](../src/lib/ark-client.ts) 已经做对了这件事：

```ts
if (typeof err === "string" && err) {
  const detail = (json as { detail?: string } | undefined)?.detail ?? "";
  throw new Error(detail ? `${err}\n\n${detail}` : err);
}
```

**Do**: UI 用 `whitespace-pre-wrap` 渲染（保留换行），让 detail 单独成段，参见 [`src/components/IChing/Interpretation.tsx:226-229`](../src/components/IChing/Interpretation.tsx)。

**Don't**: 把后端的 stack trace 贴到 toast 里——detail 字段已经是脱敏过的人话，stack trace 不应出现在前端。

### 9.3 用户反馈：用 Sonner，不用 alert

[`src/App.tsx:8`](../src/App.tsx) 全局挂 `<Toaster />`。所有"操作成功 / 已保存 / 已删除"用 `toast.info(...) / toast.success(...) / toast.error(...)`。

**Don't**: 用 `window.alert` 或 `confirm`——会阻塞主线程、移动端体验差、且不可定制样式。

---

## 10. 性能与体积

### 10.1 路由级懒加载

当独立"页面"超过 3 个时，对重组件用 `React.lazy + Suspense`：

```tsx
const History = React.lazy(() => import("@/components/IChing/History"));

<Suspense fallback={<div>...</div>}>
  <History items={items} />
</Suspense>
```

本仓库目前所有组件都是同步引入，规模允许。**当 `dist/` 主 chunk > 500KB 时是触发拆分的信号**。

### 10.2 重型库按需引入

- `framer-motion`：用具名 import（`import { motion } from 'framer-motion'`），不要 `import * as`。
- `recharts`：把图表组件抽到独立文件 + lazy。Recharts 单独打包约 100KB+ gzipped。
- `lucide-react`：已经是 tree-shake 友好，按图标名 import 即可。

**Don't**: `import _ from 'lodash'`。需要单个工具用 `import debounce from 'lodash/debounce'` 或直接抄代码到 `src/lib/utils.ts`。

### 10.3 字体加载

[`src/index.css:1`](../src/index.css) 已经用 Google Fonts 的 `display=swap`，避免 FOIT（不可见文字闪烁）。**Don't**: 把字体 `@import` 改成同步加载（去掉 `display=swap`）——首屏会出现长达数百毫秒的空白。

### 10.4 图片

- favicon / logo 等 < 4KB 资源用 SVG，放 `public/`（[`public/favicon.svg`](../public/favicon.svg)）。
- 大图 import 进组件，让 Vite 加 hash + 走 CDN 缓存。
- `<img>` 加 `loading="lazy"` + `decoding="async"`（除首屏关键图）。

---

## 11. 代码质量与提交

- **类型检查**：提交前一定 `pnpm run lint`（即 `tsc --noEmit`，见 [`package.json:13`](../package.json)）。
- **路径别名**：所有 src 内部引用走 `@/*`，禁止 `../../../`。
- **不写多余注释**：注释解释"为什么"，不解释"是什么"。命名足够好就不需要注释（协作总则见仓库根 [`AGENTS.md`](../AGENTS.md)）。
- **不留 `console.log`**：调试用 `console.debug`，发版前清理；保留 `console.error` 用于真错误。
- **不引入未使用依赖**：依赖更新走 `pnpm add` / `pnpm remove`，不要直接改 `package.json` 字段（见 `.cursor/rules` 与本仓库协作约定）。

---

## 12. 常见反模式速查

| 反模式 | 正确做法 |
|--------|----------|
| 在组件里 `fetch('https://ark.cn-beijing.volces.com/...')` | 走 `/api/*/stream` 同源代理 |
| 把 `ARK_API_KEY` 用 `VITE_` 暴露 | 永远只在服务端读 |
| `useState(new AbortController())` | `useRef<AbortController \| null>(null)` |
| 在 useEffect 里嵌套订阅并从内层 return | 拆成两个 useEffect，按依赖分层 |
| 模板字符串拼 className | `cn('a', cond && 'b')` |
| 新建 `tailwind.config.js` | 在 `@theme` 加 token |
| 渲染函数里 `try/catch` 包 JSX | 用 `ErrorBoundary` |
| `window.alert(...)` | `toast.info(...)` |
| `await res.text()` 读 SSE | `res.body.getReader()` 流式读 |

---

## 13. 想深入了解

- [shadcn/ui：Vite 安装](https://ui.shadcn.com/docs/installation/vite) —— 与仓库 [§3](#3-shadcnui新页面与新功能) 配套
- [Vite 6 官方文档：Env and Mode](https://v6.vite.dev/guide/env-and-mode)
- [React 19 升级指南](https://react.dev/blog/2024/12/05/react-19)
- [Tailwind CSS v4 升级指南](https://tailwindcss.com/docs/upgrade-guide)
- [`docs/doc_index.md`](./doc_index.md) —— 渐进披露与任务分流
- 仓库根 [`AGENTS.md`](../AGENTS.md) —— 极简协作入口与代码指路
- [后端最佳实践](./backend-best-practices.md) —— 流式 / 限流 / 部署细节

# Document index

## Index

- [docs/backend-best-practices.md](./backend-best-practices.md): 后端落地指南——双运行时（本地 Express + Vercel `api/*`）共用 `server/ark-api.ts`、SSE 流式、密钥与环境变量、Vercel 文件路由映射。
- [docs/frontend-best-practices.md](./frontend-best-practices.md): 前端落地指南——React 19 + Vite 6 + Tailwind v4、`@/` 别名、新页面与新功能默认 shadcn/ui、同源 SSE 客户端与 localStorage。
- [docs/supabase-migration-practices.md](./supabase-migration-practices.md): 数据库 schema 生命周期——`supabase/migrations/` 单一事实源、`pnpm run db:*`、RLS 与 `connectivity_check` 范例、PR 自检清单。
- [docs/supabase-tables.md](./supabase-tables.md): Supabase `public` 表与 RPC 说明——`connectivity_check`、会员与日解读额度、函数契约与访问模型。
- [docs/faqs/how-to-fix-vercel-sse-connection-closed.md](./faqs/how-to-fix-vercel-sse-connection-closed.md): 排查线上 Vercel 同源 SSE 断连（`ERR_CONNECTION_CLOSED`）——空 delta 心跳策略与 `SSE_PERIODIC_PING_MS` 调优。
- [docs/faqs/how-to-fix-typescript-discriminated-union-narrowing.md](./faqs/how-to-fix-typescript-discriminated-union-narrowing.md): 为什么本仓库 `tsconfig.json` 必须开 `strict`——关闭后可辨识联合 `if (!x.ok)` 收窄失效、`TS2339`；含最小复现与正反配置示例。

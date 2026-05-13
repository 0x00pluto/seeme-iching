# Supabase Migration 开发实践（seeme-iching）

面向在本仓库改 **数据库结构**（DDL、RLS、policy、索引等）的开发者与 AI 助手。协作总入口见 [`docs/doc_index.md`](./doc_index.md)。

> **与 [`backend-best-practices.md`](./backend-best-practices.md) 的分工**：后者讲 Express / Vercel、`ARK_*`、路由与流式；**本文只讲 schema 生命周期**（`supabase/migrations/`、CLI、`link`、RLS 习惯）。应用侧如何调 Supabase 见 [`server/supabase-client.ts`](../server/supabase-client.ts) 与后端文档 §7。

---

## 1. 单一事实源与目录

| 路径 | 职责 |
|------|------|
| [`supabase/migrations/`](../supabase/migrations/) | **唯一**可重复执行的 DDL 来源；合并进主线的 SQL 视为团队契约。 |
| [`supabase/seed.sql`](../supabase/seed.sql) | 本地 `supabase db reset` 后的可选种子数据；**不**替代 migration 做结构变更。 |
| [`supabase/config.toml`](../supabase/config.toml) | CLI 本地栈与 `[db.seed]` 等配置；结构变更仍以 `migrations/` 为准。 |

**Do**：所有建表、改表、RLS、policy、触发器、索引变更都进 **migration 文件**。

**Don't**：只在 Supabase Dashboard 里点完表结构却**不**在仓库补 migration——会造成「生产有、仓库无」或同事环境无法复现（不可追溯）。

---

## 2. 本仓库 CLI 与脚本

开发机需安装依赖（含 dev 依赖 `supabase`），并已执行：

1. `supabase login`
2. `supabase link --project-ref <你的项目 ref>`（连错环境是高频事故，执行 `db:migrate` 前务必确认）

[`package.json`](../package.json) 已封装常用命令：

| 命令 | 作用 |
|------|------|
| `pnpm run db:migration:new -- <snake_name>` | 在 `supabase/migrations/` 生成带时间戳的新文件（名称跟在 `--` 后）。 |
| `pnpm run db:migration:list` | 查看远端/本地迁移应用情况（等价 `supabase migration list`）。 |
| `pnpm run db:migrate` | 将未应用的 migration 推送到 **当前 link 指向的库**（`supabase db push`）。 |

**Don't**：在未确认 `supabase link` 目标前执行 `db:migrate`，避免把实验 DDL 推到生产。

---

## 3. 推荐工作流（四步）

1. **新建**：`pnpm run db:migration:new -- <意图简述>`，在生成文件中写 SQL。
2. **验证**：在已 link 的**非生产**库执行 `pnpm run db:migrate`（或团队约定的 staging 流程），确认无报错、应用可测。
3. **文档**：若引入新业务表或权限模型，在 PR 描述或数据字典中写清「谁读写、是否依赖 `auth.uid()`」。
4. **合并**：合并后各环境用**同一套** migration 文件顺序应用；禁止各环境各跑一段私有 SQL。

---

## 4. 文件职责、命名与依赖顺序

### 4.1 一条 migration 里放什么

- **优先**「一次 PR / 一个业务意图」对应 **一条** migration（或强依赖、必须同批次成功的少量文件）。
- **纯 DDL** 与 **大批量 `UPDATE` / 数据清洗`**分开**；后者单独 migration 或维护窗口执行，并仍保留可审计 SQL。
- **禁止**在 migration 中写密钥、token、环境专属主机名；只提交可进 Git 的 SQL。

### 4.2 命名与顺序

- 文件名由 CLI 生成：`YYYYMMDDHHMMSS_description.sql`，**禁止手抄**旧时间戳与他人冲突。
- 合并前拉取最新 `main`，若你的新文件时间戳早于远端已有文件，**重命名或删除后重建**，保证执行顺序全局单调。
- **依赖顺序**：被引用表先于外键表；枚举/函数先于依赖它们的 policy。

### 4.3 SQL 习惯（降低「本地过、线上炸」）

- 新建对象在语义允许时可用 `create table if not exists`、`create index if not exists`；**改表**不能靠「假装不存在」糊弄，要对齐当前基线。
- 扩展如 `uuid-ossp` 等集中在早期 migration，使用 `if not exists` 避免重复执行报错。
- **RLS 顺序**：`create table` → `alter table … enable row level security` → `create policy`；policy 名在库内唯一，建议带表名前缀（如 `profiles_select_own`）。

### 4.4 事务与索引

- Supabase 对每个 migration 文件通常按**单事务**执行；单文件内 SQL 应能整体提交或整体失败。
- **`create index concurrently` 不能放在普通事务 migration 里**；大表索引需查官方当前建议（维护窗口、拆分策略等），勿默认塞进标准 migration。

---

## 5. RLS 与访问模型（与本项目一致）

当前应用以 **服务端** [`createServerSupabase()`](../server/supabase-client.ts)（`SUPABASE_SERVICE_ROLE_KEY`）访问 PostgREST 为主；**不**把 `service_role` 放进浏览器。

- **面向 anon / 已登录用户的表**：默认应 **RLS on**；**无 policy 即不可访问**——这是防误暴露的底线。
- **仅服务端探测或内部表**：可启用 RLS 且**不配任何 policy**，则 anon 无法读；service_role 仍绕过 RLS（见下节示例）。

**Don't**：把 `service_role` 写入 `VITE_*` 或任何前端 bundle。

---

## 6. 本仓库示例：`connectivity_check`

[`supabase/migrations/20260513153000_connectivity_check.sql`](../supabase/migrations/20260513153000_connectivity_check.sql) 展示「最小探测表」模式：

- 单列表 `id`，主键；`insert … on conflict do nothing` 保证存在探测行。
- `enable row level security` 且无 policy：**匿名/业务 JWT 路径不可读**；服务端用 service_role 做 [`probeSupabaseConnectivity()`](../server/supabase-client.ts) 与健康路由 `GET /api/health/supabase`。

新增业务表时不要照搬「无 policy」——仅用于**非敏感**探测或明确仅服务端访问的场景；用户数据表应写清 policy。

---

## 7. 有损变更与大表

- **删列 / 收紧类型 / 加 CHECK**：先确认应用与报表不再依赖；必要时「停写 → 部署 → 再删列」分两阶段。
- **重命名**：评估 BI/外部消费者；可提供兼容视图 `create view …` 过渡期。
- **大表 `NOT NULL` + `DEFAULT` 同时上**：优先可空列上线 → 回填 → 再 `set not null`，减少锁表与 rewrite 风险。

---

## 8. 事故预防（简版）

- **禁止**修改已合并到共享环境且已应用的 migration 文件内容；修复用**新文件**。
- **禁止**在远端已有 `schema_migrations` 记录时删除旧 migration 再推——会造成历史对不齐。
- 若本地与远端结构漂移：先用 `db:migration:list` 与 Dashboard 对齐认知，再写**纠偏 migration**，避免每人对生产执行私有 SQL。
- 失败排查顺序：读完整报错 → 对照真实库结构 → 看 list 最后成功版本 → **用新 migration 修**，勿反复 push 半套手工 SQL。

---

## 9. PR 自检清单（Migration）

从团队泛化规范裁剪，提交前自查：

**Migration**

- [ ] DDL 已全部落在 `supabase/migrations/`；文件名时间戳晚于远端（或主线）已有最新一条。
- [ ] 未改写已发布过的历史 migration；修复用新文件。
- [ ] 未在生产手工执行未入库 SQL；`db:migrate` 前已确认 `link` 指向目标环境。
- [ ] 外键 / policy / 函数依赖顺序正确；大表变更已评估锁与 `CONCURRENTLY` 限制。
- [ ] 有损变更（删列、收紧 CHECK、`NOT NULL`）已按分步或两阶段发布计划执行。

**安全**

- [ ] 涉及 RLS / policy 的变更已自测 anon 路径（若未来开放浏览器直连）。
- [ ] `service_role` 未进入前端或 `VITE_*` 变量。

**验证**

- [ ] `pnpm run db:migration:list`（或等价）与 `pnpm run lint` 已通过；必要时本地/预发打通过 `GET /api/health/supabase`。

---

## 10. 延伸阅读

- [Supabase：Database migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)（官方 CLI 与迁移流程）。
- 环境变量命名与 Vercel 配置见 [`.env.example`](../.env.example) 与 [backend-best-practices §7](./backend-best-practices.md#7-环境变量与密钥)。

团队内部更完整的泛化清单（与具体业务表无关）可维护在自建知识库（例如 Obsidian《Supabase-工程最佳实践》）；**仓库以本文 + `migrations/` 为执行准绳**，避免双源长篇复制。

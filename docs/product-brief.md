# 镜微 · 产品现状简报（As-built）

面向产品经理 Agent 与人类协作者。**以本文与代码为准**；根目录 [README.md](../README.md) 与 [backend-best-practices.md](./backend-best-practices.md) 开篇若仍写「档案仅 localStorage」，属文档滞后，勿写入新 PRD。

## 1. 产品原则与非目标

- **定位**：基于易经六十四卦意象的 AI **心理内省**（叙事疗法 + 苏格拉底式提问），非占卜算命。
- **核心承诺**：**不预言命运，只映照叙事**——AI 不给吉凶、不给行动清单式「答案」，以卦象意象引出问题，帮助用户看见自己的叙事模式。
- **非目标（默认不做）**：命运预测、投资建议、医疗/心理诊断替代、社交 Feed、公开用户 UGC 广场。

## 2. 用户与角色

| 角色 | 说明 | 典型能力 |
|------|------|----------|
| 访客 | 未登录 | 可浏览落地页；**起卦需登录**（见 Home `startDivination`） |
| 免费注册用户 | `user_membership.tier=free` 或 standard 已过期 | 主解读日额度默认 **3 次/东八区自然日**；档案云端保存（Supabase 已配置时） |
| 有效 standard 会员 | `tier=standard` 且 `expires_at > now()` | 日额度默认 **100 次**；**深入追问 / 镜下对话**（`canUseDeepFollowUp`） |
| 分享链接访客 | 持有 `/s/:token` | 只读查看脱敏观心报告，无需登录 |

会员与额度细节见 [supabase-tables.md](./supabase-tables.md)；运营开通 SQL 示例在同文档。

## 3. As-built 功能矩阵

| 能力 | 状态 | 入口 / 证据 |
|------|------|-------------|
| 时间起卦 / 铜钱起卦 | 已上线 | [`Divination.tsx`](../src/components/IChing/Divination.tsx)、[`iching.ts`](../src/lib/iching.ts) |
| 四镜解读（本/互/错/综） | 已上线 | [`Interpretation.tsx`](../src/components/IChing/Interpretation.tsx) |
| 观心报告 SSE 流式 | 已上线 | `POST /api/interpret/stream` → [`server/ark-api.ts`](../server/ark-api.ts) |
| 解读日额度扣减 | 已上线 | RPC `consume_interpret_quota`；超额 **429** `INTERPRET_DAILY_QUOTA` |
| 三条深入问句（deep-inquiry） | 已上线 | `POST /api/interpret/deep-inquiry`；会员档门槛见 Home |
| 8 轮深度对话（Deep Dialogue） | 已上线 | [`DeepDialogue.tsx`](../src/components/IChing/DeepDialogue.tsx)；会话草稿 **localStorage** `iching_deep_dialogue_*` |
| 邮箱六位镜证登录 | 已上线 | [`LoginDialog.tsx`](../src/components/auth/LoginDialog.tsx)、`POST /api/auth/send-otp`、`POST /api/auth/verify-otp` |
| 观心档案（云端） | 已上线（需 Supabase + 登录） | `interpret_saved_report`；解读成功后**自动保存**；免费 **7 天** / 有效 standard **180 天**（跟人走，`expires_at`）；`GET/POST/PATCH/DELETE /api/archives*` |
| 分享链接创建/撤销 | 已上线 | `POST/DELETE /api/archives/:id/share`；公开 `GET /api/share/:token` |
| 分享只读页 | 已上线 | [`SharedReportView.tsx`](../src/pages/SharedReportView.tsx)、路由 `/s/:token` |
| 档案列表与搜索 | 已上线 | Home `history` 态、[`History.tsx`](../src/components/IChing/History.tsx) |
| 未登录本地档案列表 | **已弱化** | 起卦需登录；历史以登录后云端列表为主 |

## 4. 核心旅程与前端状态机

主应用状态（[`Home.tsx`](../src/pages/Home.tsx)）：

```text
landing → divination → interpretation → history
         ↑__________________|（从档案进入 interpretation 时注入 archivePayload）
```

| 步骤 | 用户动作 | 系统行为 |
|------|----------|----------|
| landing | 输入困惑、登录 | 校验 `question`；未登录点起卦会 toast 并打开登录框 |
| divination | 选时间/铜钱起卦 | 生成六爻 → `handleComplete` → 生成 `interpretClientSessionId` |
| interpretation | 观看 SSE 报告、追问、觉察、分享 | 扣额度；流结束自动 `postArchive`（upsert）；追问/觉察 `PATCH`；分享须已有档案 id |
| history | 浏览/搜索档案 | `fetchArchives`；点条目回到 interpretation（带已保存正文） |

独立路由（[`App.tsx`](../src/App.tsx)）：

- `/auth/callback` — 旧魔法链接书签提示（新登录走弹窗镜证）
- `/s/:token` — 公开分享页

## 5. 数据与 API 速查

- **表与 RPC**：[supabase-tables.md](./supabase-tables.md)（`user_membership`、`interpret_usage_daily`、`interpret_saved_report`、`interpret_share_link`、`app_config_kv`）
- **HTTP 与双运行时**：[backend-best-practices.md](./backend-best-practices.md)（Express `server.ts` + Vercel `api/*` 共用 `server/ark-api.ts`）
- **迁移流程**：[supabase-migration-practices.md](./supabase-migration-practices.md)；`pnpm run db:migrate` 需已 `supabase link`

主要 API（摘要）：

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/auth/send-otp` | 寄送邮箱六位镜证（60s 重发冷却） |
| POST | `/api/auth/verify-otp` | 验码并建立会话 Cookie |
| POST | `/api/auth/session` | **已废弃（410）**；原 Magic Link 换 Cookie |
| GET | `/api/auth/me` | 用户 + `entitlements` |
| POST | `/api/interpret/stream` | 观心报告 SSE |
| POST | `/api/interpret/deep-inquiry` | 三条深入问句 |
| POST | `/api/chat/stream` | 深度对话 SSE |
| GET/POST/DELETE | `/api/archives` | 档案列表（默认未过期）/ 自动保存 upsert / 清空 |
| PATCH | `/api/archives/:id` | 更新解读正文或深入追问 |
| DELETE | `/api/archives/:id` | 删除单条 |
| POST/DELETE | `/api/archives/:id/share` | 创建/撤销分享 |
| GET | `/api/share/:token` | 公开只读报告 |

## 6. 已知文档漂移（写 PRD 时勿照搬）

| 文档位置 | 过时表述 | 应以何为准 |
|----------|----------|------------|
| README § 认知档案 | 仅 localStorage | 登录 + Supabase 云端档案；deep dialogue 仍用 localStorage 草稿 |
| README § 核心功能 | 未列登录/会员/分享 | 本文 §3、§5 |
| backend-best-practices §1 | 「档案不经后端持久化」 | 已持久化至 `interpret_saved_report`（AI 转发逻辑仍在 ark-api） |
| AGENTS.md 产品一句 | 仅 localStorage | 已改为云端自动保存 + 分层保留；PRD 以本文为准 |

## 7. 开放产品议题（供头脑风暴，非承诺）

- 会员 **自助购买/续费** 链路（当前多为运营 SQL 开通 `standard`）
- 运营/管理后台（会员、额度配置 `app_config_kv`、内容审核）
- 未登录体验策略（是否恢复纯本地试用、与额度关系）
- 多语言、无障碍、导出 PDF
- 深度对话是否云端同步、跨设备续聊
- 分享页 SEO、访问统计（报告过期与 pg_cron 物理删除见 PRD-00002）

## 8. PRD 协作约定

1. 使用 `/team:product-manager <feature-slug>` 产出 `prds/prd-NNNNN-<slug>.md`。
2. 落盘后更新 [prds/prd-wiki-index.md](../prds/prd-wiki-index.md)。
3. 实现完成后 `/team:prd-accept <prd-ref>` 回写「工程验收状态」。

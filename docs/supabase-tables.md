# Supabase 表结构（seeme-iching）

`public` 下业务表；均已开启 **RLS**，且**未配置 policy** 时 `anon` / `authenticated` 无法通过 PostgREST 访问。应用侧由 Express / Vercel 使用 [`server/supabase-client.ts`](../server/supabase-client.ts) 的 **`service_role`** 客户端读写（绕过 RLS）。

Schema 变更的唯一来源：[`supabase/migrations/`](../supabase/migrations/)。流程见 [`docs/supabase-migration-practices.md`](./supabase-migration-practices.md)。

### 表命名约定（`public`）

- 一律 **`snake_case`**，多个单词用下划线连接。
- **域前缀**（新表优先对齐其一，便于按业务浏览与联表）：
  - **`interpret_*`**：与主解读流、额度、已保存解读等同一产品域（例如 `interpret_usage_daily`、`interpret_saved_report`）。
  - **`user_*`**：与用户强绑定、常作配置或 1:1 维度的表（例如 `user_membership`）。
  - **`app_*`** 或**无前缀但语义稳定**：极少数跨域/运维类表（历史存量如 `connectivity_check` 可保留原名，避免无收益重命名迁移）。
- 后缀尽量表达**实体或用途**（如 `_daily` 表按日分桶、`_report` 表单条业务记录），避免缩写晦涩。

---

## `app_config_kv`

服务端可调参数：**一行一键**，`config_value` 为 **jsonb**；与业务事实表分离，便于运营 / 管理后台改数而不改代码。

| 字段 | 类型 | 说明 |
|------|------|------|
| `config_key` | `text` | 主键；**点分命名空间**，全小写（例：`interpret.daily_quota`） |
| `config_value` | `jsonb` | 该键负载；**结构由 key 约定**（见下表） |
| `updated_at` | `timestamptz` | 默认 `now()` |

**RLS**：已开启，**无 policy**；仅 [`server/supabase-client.ts`](../server/supabase-client.ts) **`service_role`** 读写。

### 已约定 `config_key` 与 JSON 形态

| `config_key` | `config_value` schema | 消费方 |
|--------------|----------------------|--------|
| `interpret.daily_quota` | `{"free_daily_limit": number, "standard_daily_limit": number}`；缺键或非数字字符串时 RPC 回退 **3 / 100** | `consume_interpret_quota`、`get_interpret_entitlements_snapshot` |
| `archive.retention_days` | `{"free_days": number, "standard_days": number}`；缺键或非数字时回退 **7 / 180** | `resolve_archive_retention_days_for_user`、`refresh_archive_expires_for_user`、档案 insert |

**种子**：migration 写入 `interpret.daily_quota` 默认 `3` / `100`（与历史硬编码一致）。

**扩展**：新增可调项时优先 **新 `config_key` + 新 JSON**（例如 `membership.standard_default_duration_days`）；多 SKU / 订单等关系型数据再单独建表。

---

## `connectivity_check`

双运行时（本地 + 托管）健康探测用；无用户 PII。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `text` | 主键；种子数据为 `'singleton'` |

**访问**：`GET /api/health/supabase` 通过 `service_role` 查询该行。

---

## `user_membership`

与 **`auth.users` 1:1**：每个注册用户**必有且仅有一行**，便于运营 / 管理后台 **`JOIN`**，无需在 Auth 与 `public` 两头对账。

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `uuid` | 主键；外键 → `auth.users(id)`，`ON DELETE CASCADE` |
| `activated_at` | `timestamptz` | 建档/开通相关时间；新用户触发器写入 `coalesce(auth.users.created_at, now())` |
| `expires_at` | `timestamptz` | **可空**。免费档为 **`NULL`**；付费有效为到期时刻（`NOT NULL` 且 `> now()`） |
| `tier` | `text` | 默认 **`free`**；付费档当前为 **`standard`**（有效时日上限见 **`app_config_kv`** `interpret.daily_quota`） |
| `updated_at` | `timestamptz` | 默认 `now()` |

**状态约定**：

| 状态 | `tier` | `expires_at` | 主解读日限额 |
|------|--------|----------------|--------------|
| 免费（默认） | `free` | `NULL` | `interpret.daily_quota` → `free_daily_limit`（默认 **3**） |
| 付费有效 | `standard` | `NOT NULL` 且 `> now()` | 同上 → `standard_daily_limit`（默认 **100**） |
| 付费已过期 | 可仍为 `standard` | `<= now()` | 同免费档（库内可保留 `standard` 便于审计；API 对外 `tierCode` 视为 `free`） |

**新用户**：`AFTER INSERT ON auth.users` 触发器 `public.handle_auth_user_membership()` 自动插入一行 `tier='free'`, `expires_at=NULL`（`ON CONFLICT DO NOTHING`）。

**存量用户**：migration 中自 `auth.users` **回填**缺失行（同上默认值）。

**运营开通会员示例**：

```sql
update public.user_membership
set
  tier = 'standard',
  activated_at = now(),
  expires_at = now() + interval '30 days',
  updated_at = now()
where user_id = '<uuid>';
```

**管理后台联表示例**：

```sql
select u.id, u.email, u.created_at, m.tier, m.expires_at, m.activated_at
from auth.users u
join public.user_membership m on m.user_id = u.id;
```

---

## `interpret_usage_daily`

主解读流式接口（`POST /api/interpret/stream`）的**按日计数**；与东八区自然日对齐。

| 字段 | 类型 | 说明 |
|------|------|------|
| `user_id` | `uuid` | 外键 → `auth.users(id)`，`ON DELETE CASCADE` |
| `day_bucket` | `timestamptz` | **东八区**该日历日 **00:00:00** 对应的绝对时刻（`Asia/Shanghai` 午夜） |
| `request_count` | `int` | 当日已成功扣减次数，默认 `0` |

**主键**：`(user_id, day_bucket)`。

**计日规则**：跨东八区午夜后 `day_bucket` 变化，自动落到新行，无需定时任务清零历史行。

---

## `interpret_saved_report`

解读 SSE 成功后由前端**自动保存**的**观心解读全文**（含可选「自我觉察」Markdown 与三条深入追问）；与 `interpret_*` 域其它表一致，由服务端 `service_role` 访问。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `uuid` | 主键；默认 `gen_random_uuid()` |
| `user_id` | `uuid` | 外键 → `auth.users(id)`，`ON DELETE CASCADE` |
| `client_session_id` | `text` | 客户端生成的幂等键（单次照见会话）；与 `user_id` 组成唯一约束 |
| `question` | `text` | 起卦时的困惑/意念 |
| `lines` | `jsonb` | 六爻 `LineType[]` 序列化 |
| `interpretation` | `text` | 完整解读 Markdown |
| `deep_inquiry_questions` | `jsonb` | 可空；非空时为长度 3 的字符串数组 |
| `saved_at` | `timestamptz` | 保存时间，默认 `now()`；upsert/PATCH **不**刷新 |
| `expires_at` | `timestamptz` | 报告失效时刻；insert 时 `saved_at + 当前档位保留天数`；`user_membership` 变更时批量刷新 |

**唯一约束**：`(user_id, client_session_id)`，保证同一会话至多一条已保存记录。

**索引**：`(user_id, saved_at desc)`；`(expires_at)`、`(user_id, expires_at)` 供列表过滤与清理。

**HTTP**：`GET/POST /api/archives`（GET 默认 `expires_at > now()`）、`PATCH /api/archives/:id`、`DELETE /api/archives`（清空）、`DELETE /api/archives/:id`（单条）；同源 Cookie 会话，服务端 `service_role` 读写本表。

**定时清理（pg_cron）**：job `interpret-saved-report-purge`（默认 UTC 03:00）调用 `purge_expired_interpret_saved_reports()`，物理删除 `expires_at <= now()` 的行；`interpret_share_link` 随 FK **CASCADE**。

---

## `interpret_mirror_thread_daily`

镜脉 **今日续照**：东八区自然日 `(user_id, insight_date)` 幂等一条；用户当日首次访问时从 **seed 选档** 拼装写入（打开日零 LLM），**不**扣解读额度。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `uuid` | 主键；默认 `gen_random_uuid()` |
| `user_id` | `uuid` | 外键 → `auth.users(id)`，`ON DELETE CASCADE` |
| `insight_date` | `date` | 东八区自然日 |
| `source_report_id` | `uuid` | 外键 → `interpret_saved_report(id)`，`ON DELETE CASCADE`；主素材为 `saved_at` 最新且未过期档案 |
| `echo_text` | `text` | 回响段（打开日快照，来自 seed 或降级规则） |
| `shift_text` | `text` | 位移段（按 `daysSinceSaved` 从 seed 选档快照） |
| `optional_prompt` | `text` | 可空；若有余力追问 |
| `created_at` | `timestamptz` | 生成时刻；对应 API `generatedAt` |

**唯一约束**：`(user_id, insight_date)`。

**索引**：`(user_id, insight_date desc)`。

**HTTP**：`GET /api/mirror-thread/today`（需登录）；无未过期档案 → **204**；`POST /api/mirror-thread/read` 上报阅读时长（内部日志，不写表）。

---

## `interpret_mirror_thread_reply`

镜脉 **回笔**：用户对当日续照的可选短回应；东八区自然日 `(user_id, insight_date)` 与 `interpret_mirror_thread_daily` **1:1**；**不**扣解读额度。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `uuid` | 主键；默认 `gen_random_uuid()` |
| `user_id` | `uuid` | 外键 → `auth.users(id)`，`ON DELETE CASCADE` |
| `insight_date` | `date` | 东八区自然日，与 daily 对齐 |
| `daily_id` | `uuid` | 外键 → `interpret_mirror_thread_daily(id)`，`ON DELETE CASCADE` |
| `reply_text` | `text` | 用户回笔，≤120 字 |
| `created_at` | `timestamptz` | 首次创建 |
| `updated_at` | `timestamptz` | 最后更新 |

**唯一约束**：`(user_id, insight_date)`。

**索引**：`(user_id, insight_date desc)`。

**HTTP**：`PUT/PATCH /api/mirror-thread/reply`（当日可写；空串删除）；`GET /api/mirror-thread/reply?insightDate=`；`GET /api/mirror-thread/replies?limit=`。打开日拼装 daily 时若前日有非空回笔，位移段使用规则模板 verbatim 引用（零 LLM）。

---

## `interpret_mirror_thread_seed`

镜脉 **续照 Seed**：autosave 成功后异步预写；**1 档案 : 1 seed**（`report_id` 主键）。打开日 `GET /api/mirror-thread/today` 读 seed 按 `daysSinceSaved` 选档拼装 daily，**不**扣解读额度。

| 字段 | 类型 | 说明 |
|------|------|------|
| `report_id` | `uuid` | 主键；外键 → `interpret_saved_report(id)`，`ON DELETE CASCADE` |
| `user_id` | `uuid` | 外键 → `auth.users(id)`，`ON DELETE CASCADE` |
| `echo_text` | `text` | LLM 智能选的报告原句（`ready` 时非空） |
| `shift_by_day_offset` | `jsonb` | 键 `"1"`…`"7"` + `"default"`；各档 80–120 字位移短文 |
| `optional_prompt` | `text` | 可空；若有余力追问 |
| `status` | `text` | `pending` \| `ready` \| `failed` |
| `model_id` | `text` | 可空；生成所用模型 |
| `error_detail` | `text` | 可空；失败原因摘要 |
| `created_at` | `timestamptz` | 创建时刻 |
| `updated_at` | `timestamptz` | 更新时刻 |

**索引**：`(user_id, updated_at desc)`。

**补跑策略**（[`server/mirror-thread-seed.ts`](../server/mirror-thread-seed.ts)）：

- **主路径**：`POST /api/archives` 201/200 后 fire-and-forget 异步 LLM（约 12s 超时，不阻塞 HTTP）。
- **补跑**：`GET /today` 无 seed / `failed` / `pending` 超时 → 同步补跑（3s 超时）。
- **降级**：补跑仍非 `ready` → 规则 echo + §0.1 兜底 shift → HTTP 200。

**HTTP**：无独立公开端点；`GET /api/auth/me` → `mirrorThreadToday.seedStatus` 只读摘要（当日尚无 daily 时）。

---

## `interpret_share_link`

将 **`interpret_saved_report`** 中一条已保存报告映射为 **不可猜测的 `token`**，供访客通过 `GET /api/share/:token` 读取**脱敏快照**（不含 `user_id` / `client_session_id`）；**不能**替代登录后的观心档案列表权限。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `uuid` | 主键；默认 `gen_random_uuid()` |
| `report_id` | `uuid` | 外键 → `interpret_saved_report(id)`，`ON DELETE CASCADE` |
| `token` | `text` | 公开路径段；长度 **16–128**；全局唯一 |
| `created_at` | `timestamptz` | 创建时间，默认 `now()` |
| `revoked_at` | `timestamptz` | 可空；非空表示已撤销，公开接口不再返回正文 |

**唯一约束**：

- 全表 **`token`** 唯一。
- **部分唯一**：`(report_id)` **且** `revoked_at IS NULL` —— 每条报告至多一条**未撤销**分享；撤销后可再插入新行以生成新链接。

**HTTP**：

- `POST /api/archives/:id/share`（需登录）：创建或返回该档案当前有效 `token`。
- `DELETE /api/archives/:id/share`（需登录）：将该档案下未撤销行全部 **`revoked_at = now()`**。
- `GET /api/share/:token`（**无需登录**）：返回 `question`、`lines`、`interpretation`；报告已过期 → **410** `链接已过期`。

---

## 数据库函数（RPC）

仅授予 **`service_role`** 执行（见 migration 中 `GRANT EXECUTE`）。前端不直连；由 [`server/membership-quota.ts`](../server/membership-quota.ts) 调用。

### `handle_auth_user_membership() → trigger`

`SECURITY DEFINER`，在 **`auth.users` INSERT 之后** 写入 `public.user_membership`（免费默认行）。

### `consume_interpret_quota(p_user_id uuid) → jsonb`

在**未超日限额**时原子递增当日 `request_count`；用于解读流**开始前**扣次。

**日限额**：读取 **`app_config_kv`** 中 `config_key = 'interpret.daily_quota'` 的 `config_value`（字段 `free_daily_limit` / `standard_daily_limit`）；键缺失或非法时回退 **3 / 100**。

- `tier = 'standard'` **且** `expires_at IS NOT NULL` **且** `expires_at > now()` → `standard_daily_limit`；
- 若 `user_membership` 行缺失（不应发生）或上述不满足 → `free_daily_limit`。

**返回字段（JSON）**：

| 字段 | 说明 |
|------|------|
| `ok` | `true` 表示扣减成功 |
| `limit` | 当日上限 |
| `used` | 扣减后（或已达上限时）的已用次数 |
| `resets_at` | 下一东八区自然日 0 点（JSON 内为时间戳序列化形式） |

成功与失败均返回上述结构；`ok = false` 时 API 映射为 HTTP **429**，`code: INTERPRET_DAILY_QUOTA`。

### `get_interpret_entitlements_snapshot(p_user_id uuid) → jsonb`

只读快照，**不消耗额度**；供 `GET /api/auth/me` 组装 `entitlements`。

**返回顶层**：

- `interpret`：`period`（`day`）、`timezone` / `calendar`（`Asia/Shanghai`）、`limit`、`used`、`resetsAt`。
- `membership`：`isActive`（仅 **有效 standard** 为 `true`）、`tierCode`（对外过期或非付费为 `free`）、`activatedAt`、`expiresAt`（未激活时为 JSON null）。

HTTP 层可将 `tierCode` 映射为展示名（见 `membership-quota.ts`）；并附带 `archiveRetentionDays`（当前档位保留上限天数，7 或 180）。

### `resolve_archive_retention_days_for_user(p_user_id uuid) → int`

只读；返回该用户**当前**档案保留天数（有效 standard → `standard_days`，否则 `free_days`）。

### `refresh_archive_expires_for_user(p_user_id uuid) → void`

对该用户全部 `interpret_saved_report` 行重算 `expires_at = saved_at + 保留天数`；在 `user_membership` **INSERT/UPDATE** 触发器中调用。

### `purge_expired_interpret_saved_reports() → bigint`

删除 `expires_at <= now()` 的报告行，返回删除行数；由 **pg_cron** job `interpret-saved-report-purge` 每日调度；可手工 `SELECT` 联调。

---

## 与 `auth.users` 的关系

- `user_membership.user_id`、`interpret_usage_daily.user_id`、`interpret_saved_report.user_id` 均引用 **`auth.users`**。
- 会话 Cookie 中的 `sub` 与 **`auth.users.id`** 一致；`user_membership` 与之一一对应。

# Supabase 表结构（seeme-iching）

`public` 下业务表；均已开启 **RLS**，且**未配置 policy** 时 `anon` / `authenticated` 无法通过 PostgREST 访问。应用侧由 Express / Vercel 使用 [`server/supabase-client.ts`](../server/supabase-client.ts) 的 **`service_role`** 客户端读写（绕过 RLS）。

Schema 变更的唯一来源：[`supabase/migrations/`](../supabase/migrations/)。流程见 [`docs/supabase-migration-practices.md`](./supabase-migration-practices.md)。

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
| `tier` | `text` | 默认 **`free`**；付费档当前为 **`standard`**（与 RPC 中日限额 100 对齐） |
| `updated_at` | `timestamptz` | 默认 `now()` |

**状态约定**：

| 状态 | `tier` | `expires_at` | 主解读日限额 |
|------|--------|----------------|--------------|
| 免费（默认） | `free` | `NULL` | 3 |
| 付费有效 | `standard` | `NOT NULL` 且 `> now()` | 100 |
| 付费已过期 | 可仍为 `standard` | `<= now()` | 3（库内可保留 `standard` 便于审计；API 对外 `tierCode` 视为 `free`） |

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

## 数据库函数（RPC）

仅授予 **`service_role`** 执行（见 migration 中 `GRANT EXECUTE`）。前端不直连；由 [`server/membership-quota.ts`](../server/membership-quota.ts) 调用。

### `handle_auth_user_membership() → trigger`

`SECURITY DEFINER`，在 **`auth.users` INSERT 之后** 写入 `public.user_membership`（免费默认行）。

### `consume_interpret_quota(p_user_id uuid) → jsonb`

在**未超日限额**时原子递增当日 `request_count`；用于解读流**开始前**扣次。

**日限额**：

- `tier = 'standard'` **且** `expires_at IS NOT NULL` **且** `expires_at > now()` → **100** 次 / 东八区日；
- 若 `user_membership` 行缺失（不应发生）或上述不满足 → **3** 次 / 东八区日。

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

HTTP 层可将 `tierCode` 映射为展示名（见 `membership-quota.ts`）。

---

## 与 `auth.users` 的关系

- `user_membership.user_id`、`interpret_usage_daily.user_id` 均引用 **`auth.users`**。
- 会话 Cookie 中的 `sub` 与 **`auth.users.id`** 一致；`user_membership` 与之一一对应。

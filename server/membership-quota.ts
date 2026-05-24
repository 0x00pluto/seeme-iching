import { createServerSupabase } from "./supabase-client.js";
import { resolveRetentionDaysForUser } from "./archive-retention.js";

const TIER_DISPLAY: Record<string, string> = {
  free: "免费",
  standard: "会员",
};

export function isQuotaBackendConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && key);
}

function tierDisplayName(code: string): string {
  return TIER_DISPLAY[code] ?? code;
}

type RpcConsumeRow = {
  ok?: boolean;
  limit?: number;
  used?: number;
  resets_at?: string;
};

export type QuotaBlockedBody = {
  error: string;
  code: "INTERPRET_DAILY_QUOTA";
  period: "day";
  timezone: "Asia/Shanghai";
  limit: number;
  used: number;
  resetsAt: string;
};

/** 消费成功返回 true；额度用尽返回 false 且带上 429 体；配置或 RPC 异常抛错 */
export async function consumeInterpretQuota(userId: string): Promise<
  { allowed: true } | { allowed: false; body: QuotaBlockedBody }
> {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("consume_interpret_quota", { p_user_id: userId });
  if (error) {
    throw new Error(error.message);
  }
  const row = data as RpcConsumeRow | null;
  if (row?.ok === true) {
    return { allowed: true };
  }
  const limit = typeof row?.limit === "number" ? row.limit : 3;
  const used = typeof row?.used === "number" ? row.used : limit;
  const resetsAt =
    typeof row?.resets_at === "string"
      ? row.resets_at
      : new Date().toISOString();
  return {
    allowed: false,
    body: {
      error: "本日解读次数已用完",
      code: "INTERPRET_DAILY_QUOTA",
      period: "day",
      timezone: "Asia/Shanghai",
      limit,
      used,
      resetsAt,
    },
  };
}

type SnapshotRow = {
  interpret?: {
    period?: string;
    timezone?: string;
    calendar?: string;
    limit?: number;
    used?: number;
    resetsAt?: string;
  };
  membership?: {
    isActive?: boolean;
    tierCode?: string;
    activatedAt?: string | null;
    expiresAt?: string | null;
  };
};

/** 与 GET /api/auth/me 的 entitlements 字段对齐 */
export async function fetchEntitlementsPayload(userId: string): Promise<Record<string, unknown>> {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("get_interpret_entitlements_snapshot", {
    p_user_id: userId,
  });
  if (error) {
    throw new Error(error.message);
  }
  const snap = data as SnapshotRow | null;
  const m = snap?.membership;
  const tierCode = typeof m?.tierCode === "string" ? m.tierCode : "free";
  const interpret = snap?.interpret ?? {};

  const archiveRetentionDays = await resolveRetentionDaysForUser(userId);

  return {
    interpret: {
      period: interpret.period ?? "day",
      timezone: interpret.timezone ?? "Asia/Shanghai",
      calendar: interpret.calendar ?? "Asia/Shanghai",
      limit: typeof interpret.limit === "number" ? interpret.limit : 3,
      used: typeof interpret.used === "number" ? interpret.used : 0,
      resetsAt: typeof interpret.resetsAt === "string" ? interpret.resetsAt : "",
    },
    membership: {
      isActive: Boolean(m?.isActive),
      tier: {
        code: tierCode,
        displayName: tierDisplayName(tierCode),
      },
      activatedAt: m?.activatedAt ?? null,
      expiresAt: m?.expiresAt ?? null,
    },
    archiveRetentionDays,
  };
}

/** 与 `/api/chat*` 403 响应体对齐，供客户端识别 */
export type DeepChatMembershipDeniedBody = {
  error: string;
  code: "DEEP_CHAT_MEMBERSHIP_REQUIRED";
};

/**
 * 镜下对话（/api/chat、/api/chat/stream）：需可读会员快照；`tier.code === "free"` 拒绝。
 * 与前端 `canUseDeepFollowUp` 一致，防止绕过 UI 直接调接口。
 */
export async function ensureDeepChatMembershipAllowed(userId: string): Promise<
  { allowed: true } | { allowed: false; status: 403 | 503; body: Record<string, unknown> }
> {
  if (!isQuotaBackendConfigured()) {
    return {
      allowed: false,
      status: 503,
      body: {
        error: "权益服务未配置",
        detail: "缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
      },
    };
  }
  try {
    const payload = await fetchEntitlementsPayload(userId);
    const membership = payload.membership as { tier?: { code?: string } } | undefined;
    const tierCode =
      typeof membership?.tier?.code === "string" ? membership.tier.code : "free";
    if (tierCode === "free") {
      return {
        allowed: false,
        status: 403,
        body: {
          error: "深入追问与镜下对话为会员功能，请升级后使用",
          code: "DEEP_CHAT_MEMBERSHIP_REQUIRED",
        },
      };
    }
    return { allowed: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      allowed: false,
      status: 503,
      body: { error: "会员权益校验失败", detail: message },
    };
  }
}

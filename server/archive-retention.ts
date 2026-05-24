import { createServerSupabase } from "./supabase-client.js";

export type ArchiveRetentionConfig = {
  freeDays: number;
  standardDays: number;
};

const DEFAULT_RETENTION: ArchiveRetentionConfig = {
  freeDays: 7,
  standardDays: 180,
};

function parsePositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  if (typeof raw === "string" && /^[0-9]+$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    if (n > 0) return n;
  }
  return fallback;
}

/** Read archive.retention_days from app_config_kv; fall back to 7 / 180. */
export async function loadArchiveRetentionConfig(): Promise<ArchiveRetentionConfig> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("app_config_kv")
    .select("config_value")
    .eq("config_key", "archive.retention_days")
    .maybeSingle();

  if (error || !data?.config_value || typeof data.config_value !== "object") {
    return { ...DEFAULT_RETENTION };
  }

  const v = data.config_value as Record<string, unknown>;
  return {
    freeDays: parsePositiveInt(v.free_days, DEFAULT_RETENTION.freeDays),
    standardDays: parsePositiveInt(v.standard_days, DEFAULT_RETENTION.standardDays),
  };
}

/** Effective standard: tier standard + membership expires_at > now (aligned with quota RPC). */
export async function resolveRetentionDaysForUser(userId: string): Promise<number> {
  const sb = createServerSupabase();
  const { data, error } = await sb.rpc("resolve_archive_retention_days_for_user", {
    p_user_id: userId,
  });

  if (error) {
    const config = await loadArchiveRetentionConfig();
    const { data: membership, error: memErr } = await sb
      .from("user_membership")
      .select("tier, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr || !membership) return config.freeDays;

    const tier = membership.tier as string | undefined;
    const expiresAt = membership.expires_at as string | null | undefined;
    if (
      tier === "standard" &&
      typeof expiresAt === "string" &&
      new Date(expiresAt).getTime() > Date.now()
    ) {
      return config.standardDays;
    }
    return config.freeDays;
  }

  const days = typeof data === "number" ? data : Number(data);
  if (Number.isFinite(days) && days > 0) return Math.floor(days);
  return DEFAULT_RETENTION.freeDays;
}

export function computeExpiresAt(savedAt: Date, days: number): string {
  const ms = savedAt.getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export async function refreshArchiveExpiresForUser(userId: string): Promise<void> {
  const sb = createServerSupabase();
  const { error } = await sb.rpc("refresh_archive_expires_for_user", {
    p_user_id: userId,
  });
  if (error) {
    throw new Error(error.message);
  }
}

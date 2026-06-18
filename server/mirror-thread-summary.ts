import { createServerSupabase } from "./supabase-client.js";
import { getInsightDateShanghai, isMirrorThreadEligible } from "./mirror-thread-date.js";
import type { MirrorThreadSeedStatus } from "./mirror-thread-seed.js";

export type MirrorThreadTodaySummary = {
  enabled: boolean;
  insightDate?: string;
  sourceReportExpiresAt?: string;
  seedStatus?: MirrorThreadSeedStatus;
};

/** auth/me 只读摘要：不触发 LLM、不懒生成 daily */
export async function fetchMirrorThreadTodaySummary(
  userId: string,
): Promise<MirrorThreadTodaySummary> {
  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();
  const insightDate = getInsightDateShanghai();

  const { data: source, error: sourceErr } = await sb
    .from("interpret_saved_report")
    .select("id, expires_at, saved_at")
    .eq("user_id", userId)
    .gt("expires_at", nowIso)
    .order("saved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sourceErr) {
    throw new Error(sourceErr.message);
  }

  if (!source) {
    return { enabled: false };
  }

  if (!isMirrorThreadEligible(String(source.saved_at), insightDate)) {
    return { enabled: false };
  }

  const summary: MirrorThreadTodaySummary = {
    enabled: true,
    sourceReportExpiresAt: String(source.expires_at),
  };

  const { data: daily, error: dailyErr } = await sb
    .from("interpret_mirror_thread_daily")
    .select("insight_date")
    .eq("user_id", userId)
    .eq("insight_date", insightDate)
    .maybeSingle();

  if (dailyErr) {
    throw new Error(dailyErr.message);
  }

  if (daily?.insight_date) {
    summary.insightDate = String(daily.insight_date);
    return summary;
  }

  const { data: seed, error: seedErr } = await sb
    .from("interpret_mirror_thread_seed")
    .select("status")
    .eq("report_id", source.id)
    .maybeSingle();

  if (seedErr) {
    throw new Error(seedErr.message);
  }

  if (seed?.status === "pending" || seed?.status === "ready" || seed?.status === "failed") {
    summary.seedStatus = seed.status as MirrorThreadSeedStatus;
  }

  return summary;
}

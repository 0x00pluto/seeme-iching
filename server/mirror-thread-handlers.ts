import { getSessionFromRequest } from "./auth-handlers.js";
import { isQuotaBackendConfigured } from "./membership-quota.js";
import { createServerSupabase } from "./supabase-client.js";
import {
  daysSinceSavedShanghai,
  getInsightDateShanghai,
  isMirrorThreadEligible,
} from "./mirror-thread-date.js";
import {
  assembleDailyFallback,
  assembleDailyFromSeed,
  fetchSeedByReportId,
  generateMirrorThreadSeed,
  SYNC_BACKFILL_TIMEOUT_MS,
  waitForSeedReady,
  type MirrorThreadSeedRow,
} from "./mirror-thread-seed.js";

type SourceReportRow = {
  id: string;
  question: string;
  interpretation: string;
  saved_at: string;
  expires_at: string;
};

type DailyRow = {
  id: string;
  user_id: string;
  insight_date: string;
  source_report_id: string;
  echo_text: string;
  shift_text: string;
  optional_prompt: string | null;
  created_at: string;
};

export type MirrorThreadTodayJson = {
  sourceReportId: string;
  echoText: string;
  shiftText: string;
  optionalPrompt: string | null;
  insightDate: string;
  generatedAt: string;
  sourceReportExpiresAt: string;
  sourceQuestion: string;
};

const SEED_WAIT_MS = 3_000;

function unauthorized(): { status: number; json: Record<string, unknown> } {
  return { status: 401, json: { error: "未登录" } };
}

function notConfigured(): { status: number; json: Record<string, unknown> } {
  return {
    status: 503,
    json: { error: "观心档案服务未配置", detail: "缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY" },
  };
}

function logTodayEvent(event: string, fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event, ...fields, recordedAt: new Date().toISOString() }));
}

function rowToJson(
  row: DailyRow,
  sourceExpiresAt: string,
  sourceQuestion: string,
): MirrorThreadTodayJson {
  return {
    sourceReportId: row.source_report_id,
    echoText: row.echo_text,
    shiftText: row.shift_text,
    optionalPrompt: row.optional_prompt,
    insightDate: row.insight_date,
    generatedAt: row.created_at,
    sourceReportExpiresAt: sourceExpiresAt,
    sourceQuestion,
  };
}

async function fetchSourceReportMeta(
  reportId: string,
): Promise<{ expiresAt: string; question: string }> {
  const sb = createServerSupabase();
  const { data } = await sb
    .from("interpret_saved_report")
    .select("expires_at, question")
    .eq("id", reportId)
    .maybeSingle();
  return {
    expiresAt: data?.expires_at ? String(data.expires_at) : new Date().toISOString(),
    question: data?.question ? String(data.question) : "",
  };
}

async function fetchLatestSourceReport(userId: string): Promise<SourceReportRow | null> {
  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("interpret_saved_report")
    .select("id, question, interpretation, saved_at, expires_at")
    .eq("user_id", userId)
    .gt("expires_at", nowIso)
    .order("saved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as SourceReportRow | null) ?? null;
}

async function fetchExistingDaily(userId: string, insightDate: string): Promise<DailyRow | null> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("interpret_mirror_thread_daily")
    .select("*")
    .eq("user_id", userId)
    .eq("insight_date", insightDate)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as DailyRow | null) ?? null;
}

async function insertDailyRow(row: {
  userId: string;
  insightDate: string;
  sourceReportId: string;
  echoText: string;
  shiftText: string;
  optionalPrompt: string;
}): Promise<DailyRow> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("interpret_mirror_thread_daily")
    .insert({
      user_id: row.userId,
      insight_date: row.insightDate,
      source_report_id: row.sourceReportId,
      echo_text: row.echoText,
      shift_text: row.shiftText,
      optional_prompt: row.optionalPrompt,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await fetchExistingDaily(row.userId, row.insightDate);
      if (existing) return existing;
    }
    throw new Error(error.message);
  }
  return data as DailyRow;
}

async function resolveDailyContent(params: {
  source: SourceReportRow;
  daysSinceSaved: number;
  userId: string;
}): Promise<{
  echoText: string;
  shiftText: string;
  optionalPrompt: string;
  source: "seed" | "fallback";
  degraded?: string;
}> {
  const { source, daysSinceSaved, userId } = params;
  let seed: MirrorThreadSeedRow | null = await fetchSeedByReportId(source.id);

  if (seed?.status === "pending") {
    seed = await waitForSeedReady(source.id, SEED_WAIT_MS);
  }

  if (seed?.status === "ready") {
    const assembled = assembleDailyFromSeed(seed, daysSinceSaved);
    logTodayEvent("mirror_thread_today_assembled", {
      reportId: source.id,
      userId,
      source: "seed",
      daysSinceSaved,
    });
    return { ...assembled, source: "seed" };
  }

  if (!seed || seed.status === "failed" || seed.status === "pending") {
    const reason =
      seed?.status === "pending" ? "seed_pending_timeout" : seed?.status === "failed" ? "seed_failed" : "no_seed";
    const backfilled = await generateMirrorThreadSeed(
      {
        reportId: source.id,
        userId,
        question: source.question,
        interpretation: source.interpretation,
      },
      { syncTimeoutMs: SYNC_BACKFILL_TIMEOUT_MS },
    );

    if (backfilled?.status === "ready") {
      const assembled = assembleDailyFromSeed(backfilled, daysSinceSaved);
      logTodayEvent("mirror_thread_today_assembled", {
        reportId: source.id,
        userId,
        source: "seed",
        daysSinceSaved,
        backfill: true,
      });
      return { ...assembled, source: "seed" };
    }

    logTodayEvent("mirror_thread_today_degraded", {
      reportId: source.id,
      userId,
      reason,
    });
    const fallback = assembleDailyFallback(source, daysSinceSaved);
    logTodayEvent("mirror_thread_today_assembled", {
      reportId: source.id,
      userId,
      source: "fallback",
      daysSinceSaved,
    });
    return { ...fallback, source: "fallback", degraded: reason };
  }

  const assembled = assembleDailyFromSeed(seed, daysSinceSaved);
  return { ...assembled, source: "seed" };
}

export async function handleMirrorThreadToday(cookieHeader: string | undefined): Promise<{
  status: number;
  json?: Record<string, unknown>;
}> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const insightDate = getInsightDateShanghai();

  try {
    const source = await fetchLatestSourceReport(session.sub);
    if (!source) {
      return { status: 204 };
    }

    if (!isMirrorThreadEligible(source.saved_at, insightDate)) {
      return { status: 204 };
    }

    const daysSinceSaved = daysSinceSavedShanghai(source.saved_at, insightDate);

    const existing = await fetchExistingDaily(session.sub, insightDate);
    if (existing) {
      const meta = await fetchSourceReportMeta(existing.source_report_id);
      return {
        status: 200,
        json: rowToJson(existing, meta.expiresAt, meta.question),
      };
    }

    const content = await resolveDailyContent({
      source,
      daysSinceSaved,
      userId: session.sub,
    });

    const inserted = await insertDailyRow({
      userId: session.sub,
      insightDate,
      sourceReportId: source.id,
      echoText: content.echoText,
      shiftText: content.shiftText,
      optionalPrompt: content.optionalPrompt,
    });

    return {
      status: 200,
      json: rowToJson(inserted, source.expires_at, source.question),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "续照生成失败", detail: msg } };
  }
}

export async function handleMirrorThreadRead(
  cookieHeader: string | undefined,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();

  const b = body as {
    insightDate?: unknown;
    insightReadDurationMs?: unknown;
    generatedAt?: unknown;
  };

  const insightDate = String(b.insightDate ?? "").trim();
  const generatedAt = String(b.generatedAt ?? "").trim();
  const durationMs = Number(b.insightReadDurationMs);

  if (!insightDate || !/^\d{4}-\d{2}-\d{2}$/.test(insightDate)) {
    return { status: 400, json: { error: "insightDate 无效" } };
  }
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return { status: 400, json: { error: "insightReadDurationMs 无效" } };
  }

  console.info(
    JSON.stringify({
      event: "mirror_thread_read",
      userId: session.sub,
      insightDate,
      insightReadDurationMs: Math.round(durationMs),
      generatedAt: generatedAt || null,
      recordedAt: new Date().toISOString(),
    }),
  );

  return { status: 204, json: {} };
}

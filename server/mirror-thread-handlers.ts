import { getSessionFromRequest } from "./auth-handlers.js";
import { isQuotaBackendConfigured } from "./membership-quota.js";
import { createServerSupabase } from "./supabase-client.js";
import {
  daysSinceSavedShanghai,
  getInsightDateShanghai,
  isMirrorThreadEligible,
  previousInsightDate,
} from "./mirror-thread-date.js";
import { buildReplyAwareShiftFallback } from "./prompts/mirror-thread-shift.js";
import {
  assembleDailyFallback,
  assembleDailyFromSeed,
  fetchSeedByReportId,
  generateMirrorThreadSeed,
  refreshSeedShiftForReply,
  SYNC_BACKFILL_TIMEOUT_MS,
  waitForSeedReady,
  type MirrorThreadSeedRow,
} from "./mirror-thread-seed.js";
import { hexagramNameFromLines } from "./hexagram-from-lines.js";

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

type ReplyRow = {
  id: string;
  user_id: string;
  insight_date: string;
  daily_id: string;
  reply_text: string;
  created_at: string;
  updated_at: string;
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
  userReply: string | null;
};

export type MirrorThreadReplyJson = {
  insightDate: string;
  replyText: string;
  updatedAt: string;
};

export type MirrorThreadReplyListItem = {
  insightDate: string;
  replyText: string;
  updatedAt: string;
};

const SEED_WAIT_MS = 3_000;
const MAX_REPLY_LENGTH = 120;
const DEFAULT_RECENT_REPLIES_LIMIT = 7;
/** 打开面卦脉摘要：最近 N 条未过期档案（prd-00007） */
const SURFACE_ARCHIVE_LIMIT = 5;
const SURFACE_QUESTION_PREVIEW_MAX = 40;

export type MirrorThreadSurfaceItem = {
  archiveId: string;
  hexagramName: string;
  questionPreview: string | null;
  createdAt: string;
};

export type MirrorSurfaceKind = "insight" | "summary" | "empty";

function truncateQuestionPreview(question: string, maxLen = SURFACE_QUESTION_PREVIEW_MAX): string | null {
  const s = question.replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

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
  userReply: string | null,
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
    userReply,
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

async function fetchReplyByDate(
  userId: string,
  insightDate: string,
): Promise<ReplyRow | null> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("interpret_mirror_thread_reply")
    .select("*")
    .eq("user_id", userId)
    .eq("insight_date", insightDate)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as ReplyRow | null) ?? null;
}

async function fetchPreviousDayReplyText(
  userId: string,
  insightDate: string,
): Promise<string | null> {
  const prevDate = previousInsightDate(insightDate);
  const row = await fetchReplyByDate(userId, prevDate);
  const text = row?.reply_text?.trim() ?? "";
  return text.length > 0 ? text : null;
}

async function fetchRecentReplies(
  userId: string,
  limit: number,
): Promise<MirrorThreadReplyListItem[]> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("interpret_mirror_thread_reply")
    .select("insight_date, reply_text, updated_at")
    .eq("user_id", userId)
    .order("insight_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    insightDate: String(row.insight_date),
    replyText: String(row.reply_text),
    updatedAt: String(row.updated_at),
  }));
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

function applyPreviousDayReplyShift(
  shiftText: string,
  prevReplyText: string | null,
): string {
  if (!prevReplyText) return shiftText;
  return buildReplyAwareShiftFallback(prevReplyText);
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
    const prevReplyText = await fetchPreviousDayReplyText(session.sub, insightDate);

    const existing = await fetchExistingDaily(session.sub, insightDate);
    if (existing) {
      const meta = await fetchSourceReportMeta(existing.source_report_id);
      const reply = await fetchReplyByDate(session.sub, insightDate);
      return {
        status: 200,
        json: rowToJson(
          existing,
          meta.expiresAt,
          meta.question,
          reply?.reply_text?.trim() || null,
        ),
      };
    }

    const content = await resolveDailyContent({
      source,
      daysSinceSaved,
      userId: session.sub,
    });

    const shiftText = applyPreviousDayReplyShift(content.shiftText, prevReplyText);

    const inserted = await insertDailyRow({
      userId: session.sub,
      insightDate,
      sourceReportId: source.id,
      echoText: content.echoText,
      shiftText,
      optionalPrompt: content.optionalPrompt,
    });

    const reply = await fetchReplyByDate(session.sub, insightDate);

    return {
      status: 200,
      json: rowToJson(
        inserted,
        source.expires_at,
        source.question,
        reply?.reply_text?.trim() || null,
      ),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "续照生成失败", detail: msg } };
  }
}

export async function handleMirrorThreadReply(
  cookieHeader: string | undefined,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const b = body as { replyText?: unknown; insightDate?: unknown };
  const today = getInsightDateShanghai();
  const insightDate = String(b.insightDate ?? today).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(insightDate)) {
    return { status: 400, json: { error: "insightDate 无效" } };
  }
  if (insightDate !== today) {
    return { status: 403, json: { error: "仅可编辑当日回笔" } };
  }

  const replyText = String(b.replyText ?? "");
  const trimmed = replyText.trim();

  if (trimmed.length > MAX_REPLY_LENGTH) {
    return { status: 422, json: { error: "回笔超过 120 字" } };
  }

  try {
    const daily = await fetchExistingDaily(session.sub, insightDate);
    if (!daily) {
      return { status: 409, json: { error: "续照尚未生成" } };
    }

    const sb = createServerSupabase();
    const now = new Date().toISOString();

    if (trimmed.length === 0) {
      await sb
        .from("interpret_mirror_thread_reply")
        .delete()
        .eq("user_id", session.sub)
        .eq("insight_date", insightDate);

      return {
        status: 200,
        json: { insightDate, replyText: "", updatedAt: now },
      };
    }

    const { data, error } = await sb
      .from("interpret_mirror_thread_reply")
      .upsert(
        {
          user_id: session.sub,
          insight_date: insightDate,
          daily_id: daily.id,
          reply_text: trimmed,
          updated_at: now,
        },
        { onConflict: "user_id,insight_date" },
      )
      .select("insight_date, reply_text, updated_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    void refreshSeedShiftForReply(daily.source_report_id, trimmed).catch((e) => {
      console.warn(
        "mirror-thread seed reply refresh error:",
        e instanceof Error ? e.message : e,
        daily.source_report_id,
      );
    });

    return {
      status: 200,
      json: {
        insightDate: String(data.insight_date),
        replyText: String(data.reply_text),
        updatedAt: String(data.updated_at),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "回笔保存失败", detail: msg } };
  }
}

export async function handleMirrorThreadGetReply(
  cookieHeader: string | undefined,
  insightDateParam: string | undefined,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const insightDate = String(insightDateParam ?? "").trim();
  if (!insightDate || !/^\d{4}-\d{2}-\d{2}$/.test(insightDate)) {
    return { status: 400, json: { error: "insightDate 无效" } };
  }

  try {
    const row = await fetchReplyByDate(session.sub, insightDate);
    if (!row) {
      return { status: 200, json: { insightDate, replyText: null, updatedAt: null } };
    }
    return {
      status: 200,
      json: {
        insightDate: row.insight_date,
        replyText: row.reply_text,
        updatedAt: row.updated_at,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "回笔读取失败", detail: msg } };
  }
}

export async function handleMirrorThreadGetReplies(
  cookieHeader: string | undefined,
  limitParam: string | undefined,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const parsed = Number(limitParam ?? DEFAULT_RECENT_REPLIES_LIMIT);
  const limit = Number.isFinite(parsed)
    ? Math.min(Math.max(1, Math.floor(parsed)), 30)
    : DEFAULT_RECENT_REPLIES_LIMIT;

  try {
    const items = await fetchRecentReplies(session.sub, limit);
    return { status: 200, json: { items } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "回笔列表读取失败", detail: msg } };
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

/**
 * GET /api/mirror-thread/surface — 打开面卦脉摘要（规则聚合，零 LLM，不扣额度）
 */
export async function handleMirrorThreadSurface(
  cookieHeader: string | undefined,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  try {
    const nowIso = new Date().toISOString();
    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("interpret_saved_report")
      .select("id, question, lines, saved_at")
      .eq("user_id", session.sub)
      .gt("expires_at", nowIso)
      .order("saved_at", { ascending: false })
      .limit(SURFACE_ARCHIVE_LIMIT);

    if (error) {
      return { status: 500, json: { error: "读取卦脉摘要失败", detail: error.message } };
    }

    const rows = (data ?? []) as Array<{
      id: string;
      question: string | null;
      lines: unknown;
      saved_at: string;
    }>;

    const items: MirrorThreadSurfaceItem[] = rows.map((row) => ({
      archiveId: row.id,
      hexagramName: hexagramNameFromLines(row.lines),
      questionPreview: truncateQuestionPreview(row.question ?? ""),
      createdAt: row.saved_at,
    }));

    return {
      status: 200,
      json: {
        items,
        empty: items.length === 0,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "读取卦脉摘要失败", detail: msg } };
  }
}

/**
 * POST /api/mirror-thread/surface-open — 打开面会话埋点（仅日志，不写表）
 */
export async function handleMirrorThreadSurfaceOpen(
  cookieHeader: string | undefined,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();

  const b = body as {
    surface?: unknown;
    escalatedToInterpret?: unknown;
  };

  const surface = String(b.surface ?? "").trim();
  if (surface !== "insight" && surface !== "summary" && surface !== "empty") {
    return { status: 400, json: { error: "surface 无效" } };
  }

  const escalatedToInterpret = Boolean(b.escalatedToInterpret);

  console.info(
    JSON.stringify({
      event: "mirror_surface_open",
      userId: session.sub,
      surface,
      escalatedToInterpret,
      recordedAt: new Date().toISOString(),
    }),
  );

  return { status: 204, json: {} };
}

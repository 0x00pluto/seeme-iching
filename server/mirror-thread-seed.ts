/**
 * 镜脉续照 · Seed 预写（PRD-00004）
 *
 * 补跑策略：
 * - 主路径：POST /archives 201/200 后 fire-and-forget（ASYNC_TIMEOUT_MS，不阻塞 HTTP）
 * - 补跑：GET /today 无 seed / failed / pending 超时 → 同步 generateMirrorThreadSeed（SYNC_BACKFILL_TIMEOUT_MS）
 * - 降级：补跑仍非 ready → 规则 echo + §0.1 shift 模板 → HTTP 200
 *
 * 不调用 consume_interpret_quota。
 */
import OpenAI from "openai";
import { getActiveLlmBackend } from "./llm/registry.js";
import { extractEchoText } from "./mirror-thread-echo.js";
import { createServerSupabase } from "./supabase-client.js";
import {
  buildAbsenceShiftFallback,
  buildOptionalPromptRule,
  buildOvernightShiftFallback,
  buildReplyAwareShiftFallback,
} from "./prompts/mirror-thread-shift.js";
import {
  buildMirrorThreadSeedUserPrompt,
  parseMirrorThreadSeedJson,
  type MirrorThreadSeedLlmOutput,
} from "./prompts/mirror-thread-seed.js";

export type MirrorThreadSeedStatus = "pending" | "ready" | "failed";

export type MirrorThreadSeedRow = {
  report_id: string;
  user_id: string;
  echo_text: string | null;
  shift_by_day_offset: Record<string, string> | null;
  optional_prompt: string | null;
  status: MirrorThreadSeedStatus;
  model_id: string | null;
  error_detail: string | null;
  created_at: string;
  updated_at: string;
};

export type MirrorThreadSeedPayload = {
  reportId: string;
  userId: string;
  question: string;
  interpretation: string;
  deepInquiryQuestions?: string[] | null;
  lines?: number[] | null;
};

export type SourceReportForFallback = {
  id: string;
  question: string;
  interpretation: string;
  saved_at: string;
  expires_at: string;
};

const ASYNC_TIMEOUT_MS = 12_000;
const SYNC_BACKFILL_TIMEOUT_MS = 3_000;
const SEED_POLL_INTERVAL_MS = 200;

function chatContentOnly(
  message: { content?: string | null; reasoning_content?: unknown } | null | undefined,
): string {
  if (!message || typeof message !== "object") return "";
  return message.content ?? "";
}

function logSeedEvent(event: string, fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event, ...fields, recordedAt: new Date().toISOString() }));
}

export function pickShiftKey(daysSinceSaved: number): string {
  if (daysSinceSaved <= 1) return "1";
  if (daysSinceSaved >= 8) return "default";
  return String(daysSinceSaved);
}

export function resolveShiftFromSeed(
  seed: MirrorThreadSeedRow,
  daysSinceSaved: number,
): string {
  const shifts = seed.shift_by_day_offset ?? {};
  const key = pickShiftKey(daysSinceSaved);
  return shifts[key] ?? shifts.default ?? buildOvernightShiftFallback(seed.echo_text ?? "");
}

export function assembleDailyFromSeed(
  seed: MirrorThreadSeedRow,
  daysSinceSaved: number,
): { echoText: string; shiftText: string; optionalPrompt: string } {
  const echoText = seed.echo_text?.trim() || "照见尚未写下痕迹，但叙事线仍在此处等候。";
  const shiftText = resolveShiftFromSeed(seed, daysSinceSaved);
  const optionalPrompt =
    seed.optional_prompt?.trim() || buildOptionalPromptRule(echoText);
  return { echoText, shiftText, optionalPrompt };
}

export function assembleDailyFallback(
  source: SourceReportForFallback,
  daysSinceSaved: number,
): { echoText: string; shiftText: string; optionalPrompt: string } {
  const echoText = extractEchoText(source.interpretation);
  const shiftText =
    daysSinceSaved > 1
      ? buildAbsenceShiftFallback(daysSinceSaved)
      : buildOvernightShiftFallback(echoText);
  const optionalPrompt = buildOptionalPromptRule(echoText);
  return { echoText, shiftText, optionalPrompt };
}

export async function fetchSeedByReportId(reportId: string): Promise<MirrorThreadSeedRow | null> {
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("interpret_mirror_thread_seed")
    .select("*")
    .eq("report_id", reportId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as MirrorThreadSeedRow | null) ?? null;
}

async function upsertSeedPending(payload: MirrorThreadSeedPayload): Promise<void> {
  const sb = createServerSupabase();
  const now = new Date().toISOString();
  const { error } = await sb.from("interpret_mirror_thread_seed").upsert(
    {
      report_id: payload.reportId,
      user_id: payload.userId,
      status: "pending",
      echo_text: null,
      shift_by_day_offset: null,
      optional_prompt: null,
      model_id: null,
      error_detail: null,
      updated_at: now,
    },
    { onConflict: "report_id", ignoreDuplicates: false },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function markSeedFailed(reportId: string, reason: string): Promise<void> {
  const sb = createServerSupabase();
  const { error } = await sb
    .from("interpret_mirror_thread_seed")
    .update({
      status: "failed",
      error_detail: reason.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("report_id", reportId);

  if (error) {
    console.warn("mirror-thread seed mark failed error:", error.message);
  }
}

async function markSeedReady(
  reportId: string,
  data: MirrorThreadSeedLlmOutput,
  modelId: string,
): Promise<void> {
  const sb = createServerSupabase();
  const { error } = await sb
    .from("interpret_mirror_thread_seed")
    .update({
      status: "ready",
      echo_text: data.echoText,
      shift_by_day_offset: data.shiftByDayOffset,
      optional_prompt: data.optionalPrompt,
      model_id: modelId,
      error_detail: null,
      updated_at: new Date().toISOString(),
    })
    .eq("report_id", reportId);

  if (error) {
    throw new Error(error.message);
  }
}

async function callSeedLlm(
  payload: MirrorThreadSeedPayload,
  timeoutMs: number,
): Promise<{ ok: true; data: MirrorThreadSeedLlmOutput; modelId: string } | { ok: false; reason: string }> {
  const llm = getActiveLlmBackend();
  const client = llm.getOpenAI();
  const modelId = llm.getModelId();

  if (!client) {
    return { ok: false, reason: llm.errNoKey ?? "LLM 未配置" };
  }

  const userContent = buildMirrorThreadSeedUserPrompt({
    question: payload.question,
    interpretation: payload.interpretation,
    deepInquiryQuestions: payload.deepInquiryQuestions,
    lines: payload.lines,
  });

  try {
    const completionPromise = client.chat.completions.create(
      llm.patchCompletionParams({
        model: modelId,
        messages: [{ role: "user", content: userContent }],
        stream: false,
        response_format: { type: "json_object" },
      }),
    ) as Promise<OpenAI.Chat.ChatCompletion>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("mirror_thread_seed_timeout")), timeoutMs);
    });

    const completion = await Promise.race([completionPromise, timeoutPromise]);
    const text = chatContentOnly(
      completion.choices[0]?.message as { content?: string | null; reasoning_content?: unknown },
    ).trim();

    if (!text) {
      return { ok: false, reason: "LLM 返回空内容" };
    }

    const parsed = parseMirrorThreadSeedJson(text, payload.interpretation);
    if (!parsed.ok) {
      return { ok: false, reason: parsed.reason };
    }

    return { ok: true, data: parsed.data, modelId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg };
  }
}

export async function generateMirrorThreadSeed(
  payload: MirrorThreadSeedPayload,
  opts?: { syncTimeoutMs?: number; allowRetry?: boolean },
): Promise<MirrorThreadSeedRow | null> {
  const timeoutMs = opts?.syncTimeoutMs ?? SYNC_BACKFILL_TIMEOUT_MS;
  const allowRetry = opts?.allowRetry ?? true;
  const startedAt = Date.now();

  const existing = await fetchSeedByReportId(payload.reportId);
  if (existing?.status === "ready") {
    logSeedEvent("mirror_thread_seed_skipped", {
      reportId: payload.reportId,
      reason: "already_ready",
    });
    return existing;
  }

  await upsertSeedPending(payload);
  logSeedEvent("mirror_thread_seed_started", {
    reportId: payload.reportId,
    userId: payload.userId,
  });

  let result = await callSeedLlm(payload, timeoutMs);

  if (!result.ok && allowRetry && result.reason.includes("子串")) {
    result = await callSeedLlm(payload, timeoutMs);
  }

  if (!result.ok) {
    await markSeedFailed(payload.reportId, result.reason);
    logSeedEvent("mirror_thread_seed_failed", {
      reportId: payload.reportId,
      reason: result.reason,
      durationMs: Date.now() - startedAt,
    });
    return fetchSeedByReportId(payload.reportId);
  }

  await markSeedReady(payload.reportId, result.data, result.modelId);
  logSeedEvent("mirror_thread_seed_ready", {
    reportId: payload.reportId,
    modelId: result.modelId,
    durationMs: Date.now() - startedAt,
  });

  return fetchSeedByReportId(payload.reportId);
}

export function enqueueMirrorThreadSeed(payload: MirrorThreadSeedPayload): void {
  void generateMirrorThreadSeed(payload, {
    syncTimeoutMs: ASYNC_TIMEOUT_MS,
    allowRetry: true,
  }).catch((e) => {
    console.warn(
      "mirror-thread seed async error:",
      e instanceof Error ? e.message : e,
      payload.reportId,
    );
  });
}

export async function waitForSeedReady(
  reportId: string,
  maxMs = 3_000,
): Promise<MirrorThreadSeedRow | null> {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const seed = await fetchSeedByReportId(reportId);
    if (seed?.status === "ready") return seed;
    if (seed?.status === "failed") return seed;
    await new Promise((r) => setTimeout(r, SEED_POLL_INTERVAL_MS));
  }

  return fetchSeedByReportId(reportId);
}

/** 回笔保存后异步刷新 seed 次日位移档（fire-and-forget；不调用 LLM） */
export async function refreshSeedShiftForReply(
  reportId: string,
  replyText: string,
): Promise<void> {
  const seed = await fetchSeedByReportId(reportId);
  if (!seed || seed.status !== "ready") return;

  const shifts = { ...(seed.shift_by_day_offset ?? {}) };
  shifts["1"] = buildReplyAwareShiftFallback(replyText);

  const sb = createServerSupabase();
  const { error } = await sb
    .from("interpret_mirror_thread_seed")
    .update({
      shift_by_day_offset: shifts,
      updated_at: new Date().toISOString(),
    })
    .eq("report_id", reportId);

  if (error) {
    throw new Error(error.message);
  }
}

export { ASYNC_TIMEOUT_MS, SYNC_BACKFILL_TIMEOUT_MS };

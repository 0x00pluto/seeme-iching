import { createServerSupabase } from "./supabase-client.js";
import { getSessionFromRequest } from "./auth-handlers.js";
import { isQuotaBackendConfigured } from "./membership-quota.js";
import {
  computeExpiresAt,
  resolveRetentionDaysForUser,
} from "./archive-retention.js";

/** 观心档案接口：依赖 Cookie 会话；无 session 时各 handler 返回 401（与 Express/Vercel 外层 `requireAuth` 双保险）。 */

/** 与前端 `HistoryItem` 对齐的 JSON 形态 */
export type ArchiveHistoryItemJson = {
  id: string;
  timestamp: number;
  question: string;
  lines: unknown;
  interpretation: string;
  deepInquiryQuestions?: string[];
  /** 是否存在未撤销的公开分享链接 */
  share_active?: boolean;
  /** 报告失效时刻（毫秒时间戳） */
  expiresAt?: number;
};

type DbRow = {
  id: string;
  user_id: string;
  client_session_id: string;
  question: string;
  lines: unknown;
  interpretation: string;
  deep_inquiry_questions: unknown | null;
  saved_at: string;
  expires_at: string;
};

const LINE_VALUES = new Set([6, 7, 8, 9]);

function isValidLinesJson(lines: unknown): lines is number[] {
  if (!Array.isArray(lines) || lines.length !== 6) return false;
  return lines.every((x) => typeof x === "number" && LINE_VALUES.has(x));
}

function isValidDeepQuestions(q: unknown): q is string[] {
  if (q === null || q === undefined) return true;
  if (!Array.isArray(q) || q.length !== 3) return false;
  return q.every((s) => typeof s === "string" && s.trim().length > 0);
}

function rowToItem(row: DbRow): ArchiveHistoryItemJson {
  const lines = row.lines as ArchiveHistoryItemJson["lines"];
  const deep = row.deep_inquiry_questions;
  const base: ArchiveHistoryItemJson = {
    id: row.id,
    timestamp: new Date(row.saved_at).getTime(),
    question: row.question ?? "",
    lines,
    interpretation: row.interpretation,
    expiresAt: new Date(row.expires_at).getTime(),
  };
  if (isValidDeepQuestions(deep)) {
    base.deepInquiryQuestions = deep;
  }
  return base;
}

async function attachShareActive(
  sb: ReturnType<typeof createServerSupabase>,
  item: ArchiveHistoryItemJson,
): Promise<ArchiveHistoryItemJson> {
  const { data: activeLink } = await sb
    .from("interpret_share_link")
    .select("id")
    .eq("report_id", item.id)
    .is("revoked_at", null)
    .maybeSingle();
  return { ...item, share_active: Boolean(activeLink) };
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

function archiveExpired(): { status: number; json: Record<string, unknown> } {
  return { status: 410, json: { error: "观心报告已过期" } };
}

export async function handleArchivesGet(cookieHeader: string | undefined): Promise<{
  status: number;
  json: Record<string, unknown>;
}> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const nowIso = new Date().toISOString();
  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("interpret_saved_report")
    .select("*")
    .eq("user_id", session.sub)
    .gt("expires_at", nowIso)
    .order("saved_at", { ascending: false });

  if (error) {
    return { status: 500, json: { error: "读取档案失败", detail: error.message } };
  }
  const rows = (data ?? []) as DbRow[];
  const ids = rows.map((r) => r.id);
  const activeByReport = new Set<string>();
  if (ids.length > 0) {
    const { data: linkRows, error: linkErr } = await sb
      .from("interpret_share_link")
      .select("report_id")
      .in("report_id", ids)
      .is("revoked_at", null);
    if (!linkErr && linkRows) {
      for (const row of linkRows as { report_id: string }[]) {
        if (typeof row.report_id === "string") activeByReport.add(row.report_id);
      }
    }
  }
  const items = rows.map((row) => {
    const item = rowToItem(row);
    return { ...item, share_active: activeByReport.has(row.id) };
  });
  return { status: 200, json: { items } };
}

export async function handleArchivesPost(
  cookieHeader: string | undefined,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const b = body as Record<string, unknown>;
  const clientSessionId = typeof b.client_session_id === "string" ? b.client_session_id.trim() : "";
  const question = typeof b.question === "string" ? b.question : "";
  const interpretation = typeof b.interpretation === "string" ? b.interpretation : "";
  const lines = b.lines;
  const deepInquiryQuestions = b.deep_inquiry_questions;

  if (!clientSessionId || clientSessionId.length > 128) {
    return { status: 400, json: { error: "client_session_id 无效" } };
  }
  if (!interpretation.trim()) {
    return { status: 400, json: { error: "interpretation 不能为空" } };
  }
  if (!isValidLinesJson(lines)) {
    return { status: 400, json: { error: "lines 须为长度 6 的爻值数组（6/7/8/9）" } };
  }
  if (deepInquiryQuestions !== undefined && !isValidDeepQuestions(deepInquiryQuestions)) {
    return { status: 400, json: { error: "deep_inquiry_questions 须为长度 3 的非空字符串数组或省略" } };
  }

  const sb = createServerSupabase();
  const retentionDays = await resolveRetentionDaysForUser(session.sub);
  const savedAt = new Date();
  const expiresAt = computeExpiresAt(savedAt, retentionDays);

  const insertRow = {
    user_id: session.sub,
    client_session_id: clientSessionId,
    question,
    lines,
    interpretation,
    deep_inquiry_questions:
      deepInquiryQuestions !== undefined && Array.isArray(deepInquiryQuestions)
        ? deepInquiryQuestions
        : null,
    expires_at: expiresAt,
  };

  const { data, error } = await sb.from("interpret_saved_report").insert(insertRow).select("*").single();

  if (error) {
    if (error.code === "23505") {
      const updatePayload: Record<string, unknown> = { interpretation };
      if (deepInquiryQuestions !== undefined && Array.isArray(deepInquiryQuestions)) {
        updatePayload.deep_inquiry_questions = deepInquiryQuestions;
      }

      const { data: updated, error: updErr } = await sb
        .from("interpret_saved_report")
        .update(updatePayload)
        .eq("user_id", session.sub)
        .eq("client_session_id", clientSessionId)
        .gt("expires_at", new Date().toISOString())
        .select("*")
        .maybeSingle();

      if (updErr) {
        return { status: 500, json: { error: "更新档案失败", detail: updErr.message } };
      }
      if (!updated) {
        const { data: existing } = await sb
          .from("interpret_saved_report")
          .select("*")
          .eq("user_id", session.sub)
          .eq("client_session_id", clientSessionId)
          .maybeSingle();
        if (existing && new Date((existing as DbRow).expires_at).getTime() <= Date.now()) {
          return archiveExpired();
        }
        return { status: 404, json: { error: "记录不存在" } };
      }

      const item = await attachShareActive(sb, rowToItem(updated as DbRow));
      return { status: 200, json: { item } };
    }
    return { status: 500, json: { error: "保存失败", detail: error.message } };
  }

  const item = await attachShareActive(sb, { ...rowToItem(data as DbRow), share_active: false });
  return { status: 201, json: { item } };
}

export async function handleArchivesPatch(
  cookieHeader: string | undefined,
  id: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const uuid = typeof id === "string" ? id.trim() : "";
  if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return { status: 400, json: { error: "无效的 id" } };
  }

  const b = body as Record<string, unknown>;
  const interpretation = b.interpretation;
  const deepInquiryQuestions = b.deep_inquiry_questions;

  if (interpretation !== undefined && typeof interpretation !== "string") {
    return { status: 400, json: { error: "interpretation 须为字符串" } };
  }
  if (typeof interpretation === "string" && !interpretation.trim()) {
    return { status: 400, json: { error: "interpretation 不能为空" } };
  }
  if (deepInquiryQuestions !== undefined && !isValidDeepQuestions(deepInquiryQuestions)) {
    return { status: 400, json: { error: "deep_inquiry_questions 须为长度 3 的非空字符串数组或省略" } };
  }
  if (interpretation === undefined && deepInquiryQuestions === undefined) {
    return { status: 400, json: { error: "请提供 interpretation 或 deep_inquiry_questions" } };
  }

  const sb = createServerSupabase();
  const { data: existing, error: selErr } = await sb
    .from("interpret_saved_report")
    .select("*")
    .eq("user_id", session.sub)
    .eq("id", uuid)
    .maybeSingle();

  if (selErr) {
    return { status: 500, json: { error: "读取档案失败", detail: selErr.message } };
  }
  if (!existing) {
    return { status: 404, json: { error: "记录不存在" } };
  }
  const row = existing as DbRow;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return archiveExpired();
  }

  const updatePayload: Record<string, unknown> = {};
  if (typeof interpretation === "string") {
    updatePayload.interpretation = interpretation;
  }
  if (deepInquiryQuestions !== undefined && Array.isArray(deepInquiryQuestions)) {
    updatePayload.deep_inquiry_questions = deepInquiryQuestions;
  }

  const { data: updated, error: updErr } = await sb
    .from("interpret_saved_report")
    .update(updatePayload)
    .eq("user_id", session.sub)
    .eq("id", uuid)
    .select("*")
    .single();

  if (updErr) {
    return { status: 500, json: { error: "更新档案失败", detail: updErr.message } };
  }

  const item = await attachShareActive(sb, rowToItem(updated as DbRow));
  return { status: 200, json: { item } };
}

export async function handleArchivesDeleteAll(cookieHeader: string | undefined): Promise<{
  status: number;
  json: Record<string, unknown>;
}> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const sb = createServerSupabase();
  const { error } = await sb.from("interpret_saved_report").delete().eq("user_id", session.sub);
  if (error) {
    return { status: 500, json: { error: "清空档案失败", detail: error.message } };
  }
  return { status: 200, json: { ok: true } };
}

export async function handleArchivesDeleteOne(
  cookieHeader: string | undefined,
  id: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const uuid = typeof id === "string" ? id.trim() : "";
  if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
    return { status: 400, json: { error: "无效的 id" } };
  }

  const sb = createServerSupabase();
  const { data: existing, error: selErr } = await sb
    .from("interpret_saved_report")
    .select("id")
    .eq("user_id", session.sub)
    .eq("id", uuid)
    .maybeSingle();
  if (selErr) {
    return { status: 500, json: { error: "删除失败", detail: selErr.message } };
  }
  if (!existing) {
    return { status: 404, json: { error: "记录不存在" } };
  }
  const { error } = await sb.from("interpret_saved_report").delete().eq("user_id", session.sub).eq("id", uuid);
  if (error) {
    return { status: 500, json: { error: "删除失败", detail: error.message } };
  }
  return { status: 200, json: { ok: true } };
}

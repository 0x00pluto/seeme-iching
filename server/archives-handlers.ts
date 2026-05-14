import { createServerSupabase } from "./supabase-client";
import { getSessionFromRequest } from "./auth-handlers";
import { isQuotaBackendConfigured } from "./membership-quota";

/** 观心档案接口：依赖 Cookie 会话；无 session 时各 handler 返回 401（与 Express/Vercel 外层 `requireAuth` 双保险）。 */

/** 与前端 `HistoryItem` 对齐的 JSON 形态 */
export type ArchiveHistoryItemJson = {
  id: string;
  timestamp: number;
  question: string;
  lines: unknown;
  interpretation: string;
  deepInquiryQuestions?: string[];
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
  };
  if (isValidDeepQuestions(deep)) {
    base.deepInquiryQuestions = deep;
  }
  return base;
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

export async function handleArchivesGet(cookieHeader: string | undefined): Promise<{
  status: number;
  json: Record<string, unknown>;
}> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const sb = createServerSupabase();
  const { data, error } = await sb
    .from("interpret_saved_report")
    .select("*")
    .eq("user_id", session.sub)
    .order("saved_at", { ascending: false });

  if (error) {
    return { status: 500, json: { error: "读取档案失败", detail: error.message } };
  }
  const rows = (data ?? []) as DbRow[];
  return { status: 200, json: { items: rows.map(rowToItem) } };
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
  };

  const sb = createServerSupabase();
  const { data, error } = await sb.from("interpret_saved_report").insert(insertRow).select("*").single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: selErr } = await sb
        .from("interpret_saved_report")
        .select("*")
        .eq("user_id", session.sub)
        .eq("client_session_id", clientSessionId)
        .maybeSingle();
      if (selErr || !existing) {
        return {
          status: 409,
          json: { code: "ARCHIVE_ALREADY_SAVED", error: "该次照见已保存过" },
        };
      }
      const item = rowToItem(existing as DbRow);
      return {
        status: 409,
        json: { code: "ARCHIVE_ALREADY_SAVED", error: "该次照见已保存过", id: item.id, item },
      };
    }
    return { status: 500, json: { error: "保存失败", detail: error.message } };
  }

  const item = rowToItem(data as DbRow);
  return { status: 201, json: { item } };
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

import { randomBytes } from "node:crypto";
import { createServerSupabase } from "./supabase-client.js";
import { getSessionFromRequest } from "./auth-handlers.js";
import { isQuotaBackendConfigured } from "./membership-quota.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** url-safe base64url 片段；与 migration check 一致 */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

type ShareLinkRow = {
  id: string;
  report_id: string;
  token: string;
  created_at: string;
  revoked_at: string | null;
};

function unauthorized(): { status: number; json: Record<string, unknown> } {
  return { status: 401, json: { error: "未登录" } };
}

function notConfigured(): { status: number; json: Record<string, unknown> } {
  return {
    status: 503,
    json: { error: "观心档案服务未配置", detail: "缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY" },
  };
}

function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/** 登录用户为已归属档案创建或复用未撤销的分享 token */
export async function handleArchiveSharePost(
  cookieHeader: string | undefined,
  reportIdRaw: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const reportId = reportIdRaw.trim();
  if (!isUuid(reportId)) {
    return { status: 400, json: { error: "无效的 id" } };
  }

  const sb = createServerSupabase();
  const { data: report, error: repErr } = await sb
    .from("interpret_saved_report")
    .select("id, expires_at")
    .eq("id", reportId)
    .eq("user_id", session.sub)
    .maybeSingle();
  if (repErr) {
    return { status: 500, json: { error: "校验档案失败", detail: repErr.message } };
  }
  if (!report) {
    return { status: 404, json: { error: "记录不存在" } };
  }
  const reportExpires = (report as { expires_at?: string }).expires_at;
  if (typeof reportExpires === "string" && new Date(reportExpires).getTime() <= Date.now()) {
    return {
      status: 403,
      json: { error: "观心报告已过期，无法分享" },
    };
  }

  const { data: active, error: selErr } = await sb
    .from("interpret_share_link")
    .select("token")
    .eq("report_id", reportId)
    .is("revoked_at", null)
    .maybeSingle();
  if (selErr) {
    return { status: 500, json: { error: "读取分享状态失败", detail: selErr.message } };
  }
  if (active && typeof (active as ShareLinkRow).token === "string") {
    const token = (active as ShareLinkRow).token;
    return { status: 200, json: { token, path: `/s/${token}` } };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const token = newShareToken();
    const { data: inserted, error: insErr } = await sb
      .from("interpret_share_link")
      .insert({ report_id: reportId, token })
      .select("token")
      .single();
    if (!insErr && inserted && typeof (inserted as { token: string }).token === "string") {
      const t = (inserted as { token: string }).token;
      return { status: 201, json: { token: t, path: `/s/${t}` } };
    }
    if (insErr?.code === "23505") {
      const { data: raced, error: raceErr } = await sb
        .from("interpret_share_link")
        .select("token")
        .eq("report_id", reportId)
        .is("revoked_at", null)
        .maybeSingle();
      if (!raceErr && raced && typeof (raced as { token: string }).token === "string") {
        const t = (raced as { token: string }).token;
        return { status: 200, json: { token: t, path: `/s/${t}` } };
      }
      continue;
    }
    return {
      status: 500,
      json: { error: "创建分享失败", detail: insErr?.message ?? "unknown" },
    };
  }
  return { status: 500, json: { error: "创建分享失败", detail: "token 冲突重试耗尽" } };
}

/** 撤销该档案下全部未撤销分享 */
export async function handleArchiveShareDelete(
  cookieHeader: string | undefined,
  reportIdRaw: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const session = getSessionFromRequest(cookieHeader);
  if (!session) return unauthorized();
  if (!isQuotaBackendConfigured()) return notConfigured();

  const reportId = reportIdRaw.trim();
  if (!isUuid(reportId)) {
    return { status: 400, json: { error: "无效的 id" } };
  }

  const sb = createServerSupabase();
  const { data: report, error: repErr } = await sb
    .from("interpret_saved_report")
    .select("id")
    .eq("id", reportId)
    .eq("user_id", session.sub)
    .maybeSingle();
  if (repErr) {
    return { status: 500, json: { error: "校验档案失败", detail: repErr.message } };
  }
  if (!report) {
    return { status: 404, json: { error: "记录不存在" } };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await sb
    .from("interpret_share_link")
    .update({ revoked_at: now })
    .eq("report_id", reportId)
    .is("revoked_at", null)
    .select("id");
  if (updErr) {
    return { status: 500, json: { error: "撤销分享失败", detail: updErr.message } };
  }
  const n = Array.isArray(updated) ? updated.length : 0;
  return { status: 200, json: { ok: true, revoked: n } };
}

export type PublicSharedReportJson = {
  question: string;
  lines: unknown;
  interpretation: string;
};

/** 访客凭 token 读取脱敏快照（不含 user_id / client_session_id） */
export async function handleShareGet(tokenRaw: string): Promise<{
  status: number;
  json: Record<string, unknown>;
  cacheControl?: string;
}> {
  const token = tokenRaw.trim();
  if (!TOKEN_RE.test(token)) {
    return { status: 404, json: { error: "链接无效" }, cacheControl: "no-store" };
  }
  if (!isQuotaBackendConfigured()) {
    return {
      status: 503,
      json: { error: "服务未配置", detail: "缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY" },
      cacheControl: "no-store",
    };
  }

  let sb: ReturnType<typeof createServerSupabase>;
  try {
    sb = createServerSupabase();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: 503, json: { error: "服务未配置", detail: message }, cacheControl: "no-store" };
  }

  const { data: linkRow, error: linkErr } = await sb
    .from("interpret_share_link")
    .select("report_id, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (linkErr) {
    return {
      status: 500,
      json: { error: "读取失败", detail: linkErr.message },
      cacheControl: "no-store",
    };
  }
  if (!linkRow || typeof (linkRow as { report_id?: string }).report_id !== "string") {
    return { status: 404, json: { error: "链接不存在或已失效" }, cacheControl: "no-store" };
  }
  const revoked = (linkRow as { revoked_at: string | null }).revoked_at;
  if (revoked) {
    return { status: 410, json: { error: "分享已停止" }, cacheControl: "no-store" };
  }

  const reportId = (linkRow as { report_id: string }).report_id;
  const { data: report, error: repErr } = await sb
    .from("interpret_saved_report")
    .select("question, lines, interpretation, expires_at")
    .eq("id", reportId)
    .maybeSingle();

  if (repErr) {
    return {
      status: 500,
      json: { error: "读取失败", detail: repErr.message },
      cacheControl: "no-store",
    };
  }
  if (!report) {
    return { status: 404, json: { error: "链接不存在或已失效" }, cacheControl: "no-store" };
  }

  const reportExpires = (report as { expires_at?: string }).expires_at;
  if (typeof reportExpires === "string" && new Date(reportExpires).getTime() <= Date.now()) {
    return { status: 410, json: { error: "链接已过期" }, cacheControl: "no-store" };
  }

  const r = report as { question?: string; lines?: unknown; interpretation?: string };
  const body: PublicSharedReportJson = {
    question: typeof r.question === "string" ? r.question : "",
    lines: r.lines,
    interpretation: typeof r.interpretation === "string" ? r.interpretation : "",
  };
  return { status: 200, json: body, cacheControl: "no-store" };
}

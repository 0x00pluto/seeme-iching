import { fetchEntitlementsPayload, isQuotaBackendConfigured } from "./membership-quota.js";
import { getSupabaseAuthClient } from "./supabase-auth-client.js";
import {
  encodeUserSessionToken,
  getSessionTtlSeconds,
  parseUserSessionToken,
  readCookieValue,
  USER_SESSION_COOKIE_NAME,
  type UserSessionPayload,
} from "./user-session-cookie.js";

function normalizeEmail(email: unknown): string {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function authDepsReady(): boolean {
  return Boolean(
    process.env.USER_SESSION_SECRET?.trim() &&
      process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_ANON_KEY?.trim(),
  );
}

export function getSessionFromRequest(cookieHeader: string | undefined): UserSessionPayload | null {
  const raw = readCookieValue(cookieHeader ?? null, USER_SESSION_COOKIE_NAME);
  return parseUserSessionToken(raw);
}

/** 邮箱魔法链接：服务端发信并指定回调 URL（emailRedirectTo） */
export async function handleSendMagicLink(
  body: unknown,
  emailRedirectTo: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!authDepsReady()) {
    return {
      status: 503,
      json: { error: "登录服务未配置：请设置 USER_SESSION_SECRET、SUPABASE_URL、SUPABASE_ANON_KEY" },
    };
  }

  const email = normalizeEmail((body as { email?: string })?.email);
  if (!email || !isValidEmail(email)) {
    return { status: 400, json: { error: "请输入有效的邮箱地址" } };
  }

  try {
    const sb = getSupabaseAuthClient();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo,
      },
    });
    if (error) {
      return { status: 400, json: { error: error.message || "发送登录邮件失败" } };
    }
    return { status: 200, json: { ok: true } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "发送登录邮件失败", detail: msg } };
  }
}

/** 浏览器从魔法链接带回的 access_token，换本站签名 Cookie */
export async function handleExchangeSession(
  body: unknown,
  setCookie: (token: string, maxAgeSeconds: number) => void,
): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!authDepsReady()) {
    return {
      status: 503,
      json: { error: "登录服务未配置：请设置 USER_SESSION_SECRET、SUPABASE_URL、SUPABASE_ANON_KEY" },
    };
  }

  const accessToken = String((body as { accessToken?: string })?.accessToken ?? "").trim();
  if (!accessToken) {
    return { status: 400, json: { error: "缺少 accessToken" } };
  }

  try {
    const sb = getSupabaseAuthClient();
    const { data, error } = await sb.auth.getUser(accessToken);
    if (error || !data.user?.id || !data.user.email) {
      return {
        status: 401,
        json: { error: error?.message ?? "令牌无效或已过期" },
      };
    }

    const ttl = getSessionTtlSeconds();
    const payload: UserSessionPayload = {
      sub: data.user.id,
      email: normalizeEmail(data.user.email),
      exp: Math.floor(Date.now() / 1000) + ttl,
    };
    const sessionToken = encodeUserSessionToken(payload);
    setCookie(sessionToken, ttl);
    return {
      status: 200,
      json: { ok: true, user: { id: payload.sub, email: payload.email } },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "会话建立失败", detail: msg } };
  }
}

export function handleLogout(): { status: number; json: Record<string, unknown> } {
  return { status: 200, json: { ok: true } };
}

export async function handleMe(cookieHeader: string | undefined): Promise<{
  status: number;
  json: Record<string, unknown>;
}> {
  if (!process.env.USER_SESSION_SECRET?.trim()) {
    return { status: 200, json: { user: null } };
  }
  const session = getSessionFromRequest(cookieHeader);
  if (!session) {
    return { status: 200, json: { user: null } };
  }
  const base = { user: { id: session.sub, email: session.email } };
  if (!isQuotaBackendConfigured()) {
    return {
      status: 200,
      json: {
        ...base,
        entitlements: null,
        quotaBackendConfigured: false,
      },
    };
  }
  try {
    const entitlements = await fetchEntitlementsPayload(session.sub);
    return {
      status: 200,
      json: { ...base, entitlements, quotaBackendConfigured: true },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: 503,
      json: {
        error: "权益信息暂不可用",
        detail: msg,
        user: base.user,
        quotaBackendConfigured: true,
      },
    };
  }
}

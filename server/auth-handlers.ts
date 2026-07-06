import {
  checkSendCooldown,
  recordSend,
} from "./auth-otp-cooldown.js";
import { fetchEntitlementsPayload, isQuotaBackendConfigured } from "./membership-quota.js";
import { fetchMirrorThreadTodaySummary } from "./mirror-thread-summary.js";
import { maskChinaMobile, parseChinaMobileToE164 } from "./phone.js";
import { getSupabaseAuthClient } from "./supabase-auth-client.js";
import {
  encodeUserSessionToken,
  getSessionTtlSeconds,
  parseUserSessionToken,
  readCookieValue,
  USER_SESSION_COOKIE_NAME,
  type UserSessionPayload,
} from "./user-session-cookie.js";

export type AuthOtpErrorCode =
  | "OTP_COOLDOWN"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_RATE_LIMIT"
  | "SESSION_EXCHANGE_DEPRECATED";

function isSixDigitToken(token: string): boolean {
  return /^\d{6}$/.test(token);
}

function rejectEmailBody(body: unknown): { status: number; json: Record<string, unknown> } | null {
  if (body && typeof body === "object" && "email" in body && (body as { email?: unknown }).email != null) {
    return { status: 400, json: { error: "请使用手机号登录" } };
  }
  return null;
}

function parsePhoneFromBody(body: unknown): string | null {
  const raw = (body as { phone?: string })?.phone;
  if (raw == null || String(raw).trim() === "") {
    return null;
  }
  return parseChinaMobileToE164(String(raw));
}

/**
 * Vercel 对 serverless 单独跑 tsc 时，`createClient(..., { persistSession: false }).auth`
 * 可能被收窄为不含 `signInWithOtp` / `verifyOtp` / `getUser` 的变体；运行时 API 仍存在。
 */
type AuthForOtpHandlers = {
  signInWithOtp(credentials: {
    phone: string;
    options?: { shouldCreateUser?: boolean };
  }): Promise<{ error: { message: string } | null }>;
  verifyOtp(credentials: {
    phone: string;
    token: string;
    type: "sms";
  }): Promise<{
    data: { session: { access_token: string } | null };
    error: { message: string } | null;
  }>;
  getUser(jwt: string): Promise<{
    data: { user: { id: string; phone?: string | null } | null };
    error: { message?: string } | null;
  }>;
};

function authDepsReady(): boolean {
  return Boolean(
    process.env.USER_SESSION_SECRET?.trim() &&
      process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_ANON_KEY?.trim(),
  );
}

export function classifySupabaseAuthError(message: string): AuthOtpErrorCode {
  const m = message.toLowerCase();
  if (m.includes("expired") || m.includes("expire")) {
    return "OTP_EXPIRED";
  }
  if (m.includes("rate") || m.includes("too many") || m.includes("limit")) {
    return "OTP_RATE_LIMIT";
  }
  if (m.includes("invalid")) {
    return "OTP_INVALID";
  }
  return "OTP_INVALID";
}

function otpErrorMessage(code: AuthOtpErrorCode): string {
  switch (code) {
    case "OTP_COOLDOWN":
    case "OTP_RATE_LIMIT":
      return "请稍后再寄送镜证";
    case "OTP_EXPIRED":
      return "镜证已逾十分钟，请重新寄送";
    case "OTP_INVALID":
      return "镜证有误或已失效，请再照见一次";
    default:
      return "镜证有误或已失效，请再照见一次";
  }
}

function establishSessionFromSupabaseUser(
  user: { id: string; phone: string },
  setCookie: (token: string, maxAgeSeconds: number) => void,
): { ok: true; user: { id: string; phone: string } } {
  const ttl = getSessionTtlSeconds();
  const payload: UserSessionPayload = {
    sub: user.id,
    phone: user.phone,
    exp: Math.floor(Date.now() / 1000) + ttl,
  };
  const sessionToken = encodeUserSessionToken(payload);
  setCookie(sessionToken, ttl);
  return { ok: true, user: { id: payload.sub, phone: payload.phone } };
}

export function getSessionFromRequest(cookieHeader: string | undefined): UserSessionPayload | null {
  const raw = readCookieValue(cookieHeader ?? null, USER_SESSION_COOKIE_NAME);
  return parseUserSessionToken(raw);
}

/** 手机号六位镜证：signInWithOtp({ phone }) */
export async function handleSendLoginOtp(
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!authDepsReady()) {
    return {
      status: 503,
      json: { error: "登录服务未配置：请设置 USER_SESSION_SECRET、SUPABASE_URL、SUPABASE_ANON_KEY" },
    };
  }

  const emailReject = rejectEmailBody(body);
  if (emailReject) return emailReject;

  const phone = parsePhoneFromBody(body);
  if (!phone) {
    return { status: 400, json: { error: "请输入有效的手机号" } };
  }

  const cooldown = checkSendCooldown(phone);
  if (!cooldown.allowed) {
    return {
      status: 429,
      json: {
        error: "请稍后再寄送镜证",
        code: "OTP_COOLDOWN",
        resendAvailableAt: cooldown.resendAvailableAt,
      },
    };
  }

  try {
    const auth = getSupabaseAuthClient().auth as AuthForOtpHandlers;
    const { error } = await auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: true },
    });
    if (error) {
      const code = classifySupabaseAuthError(error.message);
      const status = code === "OTP_RATE_LIMIT" ? 429 : 400;
      return {
        status,
        json: { error: otpErrorMessage(code), code, detail: error.message },
      };
    }
    const resendAvailableAt = recordSend(phone);
    return { status: 200, json: { ok: true, resendAvailableAt } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "寄送镜证失败", detail: msg } };
  }
}

/** @deprecated 使用 handleSendLoginOtp；保留签名供 diff */
export async function handleSendMagicLink(
  body: unknown,
  _emailRedirectTo: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  return handleSendLoginOtp(body);
}

/** 验码成功后写入应用会话 Cookie */
export async function handleVerifyLoginOtp(
  body: unknown,
  setCookie: (token: string, maxAgeSeconds: number) => void,
): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!authDepsReady()) {
    return {
      status: 503,
      json: { error: "登录服务未配置：请设置 USER_SESSION_SECRET、SUPABASE_URL、SUPABASE_ANON_KEY" },
    };
  }

  const emailReject = rejectEmailBody(body);
  if (emailReject) return emailReject;

  const phone = parsePhoneFromBody(body);
  const token = String((body as { token?: string })?.token ?? "").trim();

  if (!phone) {
    return { status: 400, json: { error: "请输入有效的手机号" } };
  }
  if (!isSixDigitToken(token)) {
    return {
      status: 400,
      json: { error: "镜证有误或已失效，请再照见一次", code: "OTP_INVALID" },
    };
  }

  try {
    const auth = getSupabaseAuthClient().auth as AuthForOtpHandlers;
    const { data, error } = await auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });

    if (error) {
      const code = classifySupabaseAuthError(error.message);
      return {
        status: 401,
        json: { error: otpErrorMessage(code), code, detail: error.message },
      };
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return {
        status: 401,
        json: { error: otpErrorMessage("OTP_INVALID"), code: "OTP_INVALID" },
      };
    }

    const { data: userData, error: userError } = await auth.getUser(accessToken);
    if (userError || !userData.user?.id || !userData.user.phone) {
      const code = userError?.message
        ? classifySupabaseAuthError(userError.message)
        : "OTP_INVALID";
      return {
        status: 401,
        json: {
          error: otpErrorMessage(code),
          code,
          detail: userError?.message,
        },
      };
    }

    const session = establishSessionFromSupabaseUser(
      { id: userData.user.id, phone: userData.user.phone },
      setCookie,
    );
    return { status: 200, json: { ok: true, user: session.user } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: 500, json: { error: "验码失败", detail: msg } };
  }
}

/** 魔法链接会话交换已废弃；新登录请用 verify-otp */
export async function handleExchangeSession(
  _body: unknown,
  _setCookie: (token: string, maxAgeSeconds: number) => void,
): Promise<{ status: number; json: Record<string, unknown> }> {
  return {
    status: 410,
    json: {
      error: "魔法链接登录已停用，请使用手机号六位镜证登录",
      code: "SESSION_EXCHANGE_DEPRECATED",
    },
  };
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
  const phoneMasked = maskChinaMobile(session.phone);
  const base = { user: { id: session.sub, phone: session.phone, phoneMasked } };
  if (!isQuotaBackendConfigured()) {
    return {
      status: 200,
      json: {
        ...base,
        entitlements: null,
        quotaBackendConfigured: false,
        archivesBackendConfigured: false,
      },
    };
  }
  try {
    const [entitlements, mirrorThreadToday] = await Promise.all([
      fetchEntitlementsPayload(session.sub),
      fetchMirrorThreadTodaySummary(session.sub),
    ]);
    return {
      status: 200,
      json: {
        ...base,
        entitlements,
        quotaBackendConfigured: true,
        archivesBackendConfigured: true,
        mirrorThreadToday,
      },
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
        archivesBackendConfigured: true,
      },
    };
  }
}

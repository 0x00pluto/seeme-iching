export type AuthUser = {
  id: string;
  email: string;
};

export type EntitlementsInterpret = {
  period: "day";
  timezone: string;
  calendar: string;
  limit: number;
  used: number;
  resetsAt: string;
};

export type EntitlementsMembership = {
  isActive: boolean;
  tier: { code: string; displayName: string };
  activatedAt: string | null;
  expiresAt: string | null;
};

export type Entitlements = {
  interpret: EntitlementsInterpret;
  membership: EntitlementsMembership;
  /** 当前账号档位对应的观心档案保留上限天数（7 或 180） */
  archiveRetentionDays: number;
};

export type MirrorThreadTodaySummary = {
  enabled: boolean;
  insightDate?: string;
  sourceReportExpiresAt?: string;
};

export type AuthMeResponse = {
  user: AuthUser | null;
  entitlements?: Entitlements | null;
  /** false：服务端未配置 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY，不做额度 RPC */
  quotaBackendConfigured?: boolean;
  /** 与额度同源：service_role 可写 `interpret_saved_report`；缺省时可用 quotaBackendConfigured */
  archivesBackendConfigured?: boolean;
  /** R1：镜脉续照摘要，减少无档案用户的无效 GET */
  mirrorThreadToday?: MirrorThreadTodaySummary;
  error?: string;
  detail?: string;
};

export type AuthMeResult = AuthMeResponse & { ok: boolean };

export type AuthOtpErrorCode =
  | "OTP_COOLDOWN"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_RATE_LIMIT"
  | "SESSION_EXCHANGE_DEPRECATED";

export type SendOtpResult = { ok: true; resendAvailableAt: string };

export type VerifyOtpResult = { ok: true; user: AuthUser };

type AuthErrorBody = {
  error?: string;
  code?: AuthOtpErrorCode;
  resendAvailableAt?: string;
};

export class AuthApiError extends Error {
  readonly code?: AuthOtpErrorCode;
  readonly resendAvailableAt?: string;

  constructor(message: string, options?: { code?: AuthOtpErrorCode; resendAvailableAt?: string }) {
    super(message);
    this.name = "AuthApiError";
    this.code = options?.code;
    this.resendAvailableAt = options?.resendAvailableAt;
  }
}

const jsonHeaders = { "Content-Type": "application/json" };

export function messageForAuthOtpCode(code?: AuthOtpErrorCode, fallback?: string): string {
  switch (code) {
    case "OTP_COOLDOWN":
    case "OTP_RATE_LIMIT":
      return "请稍后再寄送镜证";
    case "OTP_EXPIRED":
      return "镜证已逾三十分钟，请重新寄送";
    case "OTP_INVALID":
      return "镜证有误或已失效，请再照见一次";
    default:
      return fallback ?? "操作失败，请稍后再试";
  }
}

async function parseAuthJson<T extends Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function throwFromAuthResponse(res: Response, data: AuthErrorBody): never {
  const message = data.code
    ? messageForAuthOtpCode(data.code, data.error)
    : (data.error ?? "请求失败");
  throw new AuthApiError(message, {
    code: data.code,
    resendAvailableAt: data.resendAvailableAt,
  });
}

export async function fetchAuthMe(): Promise<AuthMeResult> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  const data = (await res.json()) as AuthMeResponse;
  if (res.ok) {
    return { ...data, ok: true };
  }
  if (data.user) {
    return {
      ...data,
      user: data.user,
      entitlements: null,
      ok: false,
    };
  }
  throw new Error(data.error ?? "无法获取登录状态");
}

/** 寄送邮箱六位镜证 */
export async function postSendLoginEmail(email: string): Promise<SendOtpResult> {
  const res = await fetch("/api/auth/send-otp", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ email }),
  });
  const data = await parseAuthJson<AuthErrorBody & SendOtpResult>(res);
  if (!res.ok) {
    throwFromAuthResponse(res, data);
  }
  if (!data.resendAvailableAt) {
    throw new AuthApiError("寄送镜证失败");
  }
  return { ok: true, resendAvailableAt: data.resendAvailableAt };
}

/** 校验六位镜证并建立会话 */
export async function postVerifyLoginOtp(email: string, token: string): Promise<VerifyOtpResult> {
  const res = await fetch("/api/auth/verify-otp", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ email, token }),
  });
  const data = await parseAuthJson<AuthErrorBody & VerifyOtpResult>(res);
  if (!res.ok) {
    throwFromAuthResponse(res, data);
  }
  if (!data.user) {
    throw new AuthApiError("验码失败");
  }
  return { ok: true, user: data.user };
}

export async function postLogout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

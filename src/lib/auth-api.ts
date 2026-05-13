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
};

export type AuthMeResponse = {
  user: AuthUser | null;
  entitlements?: Entitlements | null;
  /** false：服务端未配置 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY，不做额度 RPC */
  quotaBackendConfigured?: boolean;
  error?: string;
  detail?: string;
};

export type AuthMeResult = AuthMeResponse & { ok: boolean };

const jsonHeaders = { "Content-Type": "application/json" };

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

/** 发送邮箱魔法链接（服务端设置 emailRedirectTo → /auth/callback） */
export async function postSendLoginEmail(email: string): Promise<void> {
  const res = await fetch("/api/auth/send-otp", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ email }),
  });
  const data = (await res.json()) as { error?: string; ok?: boolean };
  if (!res.ok) {
    throw new Error(data.error ?? "发送登录邮件失败");
  }
}

export async function postLogout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

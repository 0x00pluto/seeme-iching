export type AuthUser = {
  id: string;
  email: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

export async function fetchAuthMe(): Promise<{ user: AuthUser | null }> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) {
    throw new Error("无法获取登录状态");
  }
  return res.json() as Promise<{ user: AuthUser | null }>;
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

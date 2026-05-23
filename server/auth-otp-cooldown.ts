/**
 * 邮箱发码冷却（进程内 Map）。
 * Vercel 多实例 / 水平扩展时，各实例 Map 不共享，60s 限制为尽力而为；
 * 强一致需外置 KV（见 docs/backend-best-practices.md §10）。
 */
export const RESEND_COOLDOWN_MS = 60_000;

const lastSentAtByEmail = new Map<string, number>();

export function checkSendCooldown(email: string): {
  allowed: boolean;
  resendAvailableAt?: string;
} {
  const last = lastSentAtByEmail.get(email);
  if (last == null) {
    return { allowed: true };
  }
  const availableAt = last + RESEND_COOLDOWN_MS;
  if (Date.now() >= availableAt) {
    return { allowed: true };
  }
  return { allowed: false, resendAvailableAt: new Date(availableAt).toISOString() };
}

/** Supabase 发码成功后记录；返回下次可重发的 ISO 时间 */
export function recordSend(email: string): string {
  const now = Date.now();
  lastSentAtByEmail.set(email, now);
  return new Date(now + RESEND_COOLDOWN_MS).toISOString();
}

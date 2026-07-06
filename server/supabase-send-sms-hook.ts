import { Webhook } from "standardwebhooks";

export type SendSmsHookPayload = {
  user: { phone?: string };
  sms: { otp?: string };
};

function normalizeHookSecret(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("v1,whsec_")) {
    return trimmed.slice("v1,whsec_".length);
  }
  if (trimmed.startsWith("whsec_")) {
    return trimmed.slice("whsec_".length);
  }
  return trimmed;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) return undefined;
  const value = headers[key];
  return Array.isArray(value) ? value[0] : value;
}

/** 验签并解析 Supabase Send SMS Hook 载荷 */
export function verifySendSmsHook(
  rawBody: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
): SendSmsHookPayload {
  const secretRaw = process.env.SEND_SMS_HOOK_SECRET?.trim();
  if (!secretRaw) {
    throw new Error("Missing SEND_SMS_HOOK_SECRET");
  }

  const wh = new Webhook(normalizeHookSecret(secretRaw));
  const payload = wh.verify(rawBody, {
    "webhook-id": headerValue(headers, "webhook-id") ?? "",
    "webhook-timestamp": headerValue(headers, "webhook-timestamp") ?? "",
    "webhook-signature": headerValue(headers, "webhook-signature") ?? "",
  }) as SendSmsHookPayload;

  return payload;
}

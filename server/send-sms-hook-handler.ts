import { sendSupabaseOtpSms } from "./aliyun-sms.js";
import { verifySendSmsHook } from "./supabase-send-sms-hook.js";

export async function handleSendSmsHook(
  rawBody: string | Buffer,
  headers: Record<string, string | string[] | undefined>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  try {
    const payload = verifySendSmsHook(rawBody, headers);
    const phone = payload.user?.phone?.trim();
    const otp = payload.sms?.otp?.trim();

    if (!phone || !otp) {
      return { status: 400, json: { error: "Invalid hook payload" } };
    }

    await sendSupabaseOtpSms({ phone, code: otp });
    return { status: 200, json: {} };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Missing SEND_SMS_HOOK_SECRET")) {
      return { status: 500, json: { error: "Hook secret not configured" } };
    }
    if (
      msg.toLowerCase().includes("signature") ||
      msg.toLowerCase().includes("timestamp") ||
      msg.toLowerCase().includes("webhook")
    ) {
      return { status: 403, json: { error: "Invalid hook signature" } };
    }
    console.error("handleSendSmsHook:", e);
    return { status: 500, json: { error: "Failed to send SMS", detail: msg } };
  }
}

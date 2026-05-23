/**
 * Vercel Serverless：POST /api/auth/verify-otp
 * 校验邮箱六位镜证并写入本站 HttpOnly 会话 Cookie。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleVerifyLoginOtp } from "../../server/auth-handlers.js";
import { appendSessionCookie } from "../../server/user-session-cookie.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }
    const result = await handleVerifyLoginOtp(req.body, (token, maxAge) => {
      appendSessionCookie(res, token, maxAge);
    });
    res.status(result.status).json(result.json);
  } catch (e) {
    console.error("api/auth/verify-otp:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

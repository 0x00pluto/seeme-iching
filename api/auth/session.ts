/**
 * Vercel Serverless：POST /api/auth/session
 * 用魔法链接回调中的 access_token 换取本站签名 Cookie。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleExchangeSession } from "../../server/auth-handlers";
import { appendSessionCookie } from "../../server/user-session-cookie";

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
    const result = await handleExchangeSession(req.body, (token, maxAge) => {
      appendSessionCookie(res, token, maxAge);
    });
    res.status(result.status).json(result.json);
  } catch (e) {
    console.error("api/auth/session:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

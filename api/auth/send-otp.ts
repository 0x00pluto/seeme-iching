/**
 * Vercel Serverless：POST /api/auth/send-otp（发送邮箱魔法链接）
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleSendMagicLink } from "../../server/auth-handlers.js";
import { buildAuthCallbackUrl, resolvePublicOrigin } from "../../server/public-origin.js";

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
    const origin = resolvePublicOrigin(req);
    const redirectTo = buildAuthCallbackUrl(origin);
    const result = await handleSendMagicLink(req.body, redirectTo);
    res.status(result.status).json(result.json);
  } catch (e) {
    console.error("api/auth/send-otp:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

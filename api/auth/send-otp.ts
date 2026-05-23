/**
 * Vercel Serverless：POST /api/auth/send-otp（发送邮箱六位镜证）
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleSendLoginOtp } from "../../server/auth-handlers.js";

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
    const result = await handleSendLoginOtp(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    console.error("api/auth/send-otp:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

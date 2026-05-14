/**
 * Vercel Serverless：POST /api/auth/logout
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleLogout } from "../../server/auth-handlers";
import { appendClearSessionCookie } from "../../server/user-session-cookie";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }
    appendClearSessionCookie(res);
    const result = handleLogout();
    res.status(result.status).json(result.json);
  } catch (e) {
    console.error("api/auth/logout:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

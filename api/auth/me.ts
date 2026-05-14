/**
 * Vercel Serverless：GET /api/auth/me
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleMe } from "../../server/auth-handlers.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }
    const cookieHeader =
      typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
    const result = await handleMe(cookieHeader);
    res.status(result.status).json(result.json);
  } catch (e) {
    console.error("api/auth/me:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

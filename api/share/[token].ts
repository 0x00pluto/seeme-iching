/**
 * Vercel Serverless：GET /api/share/:token（无需登录）
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleShareGet } from "../../server/share-handlers.js";

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
    const raw = req.query.token;
    const token = Array.isArray(raw) ? raw[0] : raw;
    const result = await handleShareGet(token ?? "");
    if (result.cacheControl) {
      res.setHeader("Cache-Control", result.cacheControl);
    }
    res.status(result.status).json(result.json);
  } catch (e) {
    console.error("api/share/[token]:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

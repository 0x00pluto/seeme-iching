/**
 * Vercel Serverless：POST /api/chat
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runChatApi } from "../server/ark-api.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 300,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }
    const { status, json } = await runChatApi(req.body);
    res.status(status).json(json);
  } catch (e) {
    console.error("api/chat handler:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

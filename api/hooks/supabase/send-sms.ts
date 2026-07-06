/**
 * Vercel Serverless：POST /api/hooks/supabase/send-sms（Supabase Send SMS Hook）
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleSendSmsHook } from "../../../server/send-sms-hook-handler.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    const rawBody = await readRawBody(req);
    const result = await handleSendSmsHook(rawBody, req.headers);
    res.status(result.status).json(result.json);
  } catch (e) {
    console.error("api/hooks/supabase/send-sms:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

/**
 * Vercel Serverless：GET/PUT/PATCH /api/mirror-thread/reply
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  handleMirrorThreadGetReply,
  handleMirrorThreadReply,
} from "../../server/mirror-thread-handlers.js";
import { requireAuth, UNAUTHORIZED_RESPONSE } from "../../server/require-auth.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const cookieHeader =
      typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;

    if (!requireAuth(cookieHeader)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }

    if (req.method === "GET") {
      const insightDate =
        typeof req.query.insightDate === "string" ? req.query.insightDate : undefined;
      const result = await handleMirrorThreadGetReply(cookieHeader, insightDate);
      res.status(result.status).json(result.json);
      return;
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      const result = await handleMirrorThreadReply(cookieHeader, req.body);
      res.status(result.status).json(result.json);
      return;
    }

    res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("api/mirror-thread/reply:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

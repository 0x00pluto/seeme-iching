/**
 * Vercel Serverless：PATCH /api/archives/:id、DELETE /api/archives/:id
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  handleArchivesDeleteOne,
  handleArchivesPatch,
} from "../../server/archives-handlers.js";
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

    const rawId = req.query.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    if (req.method === "PATCH") {
      const result = await handleArchivesPatch(cookieHeader, id ?? "", req.body);
      res.status(result.status).json(result.json);
      return;
    }
    if (req.method === "DELETE") {
      const result = await handleArchivesDeleteOne(cookieHeader, id ?? "");
      res.status(result.status).json(result.json);
      return;
    }
    res.status(405).json({ error: "Method Not Allowed" });
  } catch (e) {
    console.error("api/archives/[id]:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

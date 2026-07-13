/**
 * Vercel Serverless：POST /api/mirror-thread/surface-open
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleMirrorThreadSurfaceOpen } from "../../server/mirror-thread-handlers.js";
import { requireAuth, UNAUTHORIZED_RESPONSE } from "../../server/require-auth.js";

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

    const cookieHeader =
      typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;

    if (!requireAuth(cookieHeader)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }

    const result = await handleMirrorThreadSurfaceOpen(cookieHeader, req.body);
    if (result.status === 204) {
      res.status(204).end();
      return;
    }
    res.status(result.status).json(result.json);
  } catch (e) {
    console.error("api/mirror-thread/surface-open:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

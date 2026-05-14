/**
 * Vercel Serverless：POST /api/interpret/deep-inquiry
 * 基于已完成的观心报告生成三条深入问句（JSON）；与本地 Express 共用 `server/ark-api.ts`；按 `SEEME_AI_PROVIDER` 经 `server/llm/registry` 选择 ARK_* 或 MOONSHOT_*。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runDeepInquiryApi } from "../../server/ark-api";
import { requireAuth, UNAUTHORIZED_RESPONSE } from "../../server/require-auth";

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
    const cookieHeader =
      typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
    if (!requireAuth(cookieHeader)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const { status, json } = await runDeepInquiryApi(req.body);
    res.status(status).json(json);
  } catch (e) {
    console.error("api/interpret/deep-inquiry handler:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

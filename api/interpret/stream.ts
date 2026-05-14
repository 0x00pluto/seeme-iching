/**
 * Vercel Serverless：POST /api/interpret/stream
 * 与本地 Express 共用 `server/ark-api.ts`；按 `SEEME_AI_PROVIDER` 经 `server/llm/registry` 选择 ARK_* 或 MOONSHOT_*。
 * 注意：在 Vercel 上仍会受 maxDuration 限制（当前 300s），SSE 到点会被掐断。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runInterpretStream } from "../../server/ark-api.js";
import { consumeInterpretQuota, isQuotaBackendConfigured } from "../../server/membership-quota.js";
import { pipeArkStreamToSse } from "../../server/pipe-ark-sse.js";
import { requireAuth, UNAUTHORIZED_RESPONSE } from "../../server/require-auth.js";
import { flushHeadersAndInitialSsePing } from "../../server/sse-warmup.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 300,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const cookieHeader =
    typeof req.headers.cookie === "string" ? req.headers.cookie : undefined;
  const session = requireAuth(cookieHeader);
  if (!session) {
    res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
    return;
  }

  if (!isQuotaBackendConfigured()) {
    res.status(503).json({
      error: "解读额度服务未配置",
      detail: "缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
    });
    return;
  }

  try {
    const quota = await consumeInterpretQuota(session.sub);
    if (!quota.allowed) {
      res.status(429).json(quota.body);
      return;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(503).json({ error: "解读额度校验失败", detail: message });
    return;
  }

  try {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    flushHeadersAndInitialSsePing(res);

    await pipeArkStreamToSse(res, runInterpretStream(req.body));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ error: "服务器内部错误", detail: message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch {
        // ignore
      }
    }
  }
}

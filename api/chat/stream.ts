/**
 * Vercel Serverless：POST /api/chat/stream
 * 与本地 Express 共用 `server/ark-api.ts`；按 `SEEME_AI_PROVIDER` 经 `server/llm/registry` 选择 ARK_* 或 MOONSHOT_*。
 * 注意：在 Vercel 上仍会受 maxDuration 限制（当前 300s），SSE 到点会被掐断。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runChatStream } from "../../server/ark-api.js";
import { pipeArkStreamToSse } from "../../server/pipe-ark-sse.js";
import { flushHeadersAndInitialSsePing } from "../../server/sse-warmup.js";
import { requireAuth, UNAUTHORIZED_RESPONSE } from "../../server/require-auth.js";

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
  if (!requireAuth(cookieHeader)) {
    res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
    return;
  }

  try {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    flushHeadersAndInitialSsePing(res);

    await pipeArkStreamToSse(res, runChatStream(req.body));
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

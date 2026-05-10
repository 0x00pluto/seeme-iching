/**
 * Vercel Serverless：POST /api/chat/stream
 * 注意：在 Vercel 上仍会受 maxDuration 限制（当前 300s），SSE 到点会被掐断。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runChatStream } from "../../server/ark-api.js";
import { pipeArkStreamToSse } from "../../server/pipe-ark-sse.js";
import { chatStreamMeta, createSseStreamLog } from "../../server/sse-stream-log.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 300,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const log = createSseStreamLog("POST /api/chat/stream", chatStreamMeta(req.body));
  req.on("close", () => {
    log.clientDisconnected("incoming_message_close");
  });

  try {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    log.sseHeadersSet();

    await pipeArkStreamToSse(res, runChatStream(req.body), log);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      log.streamEnd("handler_exception_before_headers", { detail: message });
      res.status(500).json({ error: "服务器内部错误", detail: message });
    } else {
      log.streamEnd("handler_exception_after_headers", { detail: message });
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

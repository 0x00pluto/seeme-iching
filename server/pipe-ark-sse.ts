import type { ArkStreamDelta } from "./ark-api";
import { getSsePeriodicPingMs, sseEmptyModelDeltaHeartbeat } from "./sse-warmup";

/**
 * 将 `ark-api` 产出的 AsyncGenerator（经 `LlmBackend` 上游）按现有契约写入 HTTP SSE。
 * Express 与 Vercel 共用：首包 model token 前可能长时间无真实文本，定时下发空 `data:` delta 保活（与 handler 首包一致）。
 */
export async function pipeArkStreamToSse(
  res: { write(chunk: string): boolean; end(cb?: () => void): unknown },
  stream: AsyncIterable<ArkStreamDelta>
): Promise<void> {
  const periodicPingMs = getSsePeriodicPingMs();
  const heartbeatLine = sseEmptyModelDeltaHeartbeat();
  const keepaliveTimer = setInterval(() => {
    try {
      res.write(heartbeatLine);
    } catch {
      clearInterval(keepaliveTimer);
    }
  }, periodicPingMs);

  try {
    for await (const evt of stream) {
      if (evt.type === "delta") {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: evt.delta } }] })}\n\n`);
      } else if (evt.type === "error") {
        try {
          res.write(`data: ${JSON.stringify({ error: evt.error, detail: evt.detail ?? "" })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        } catch {
          // ignore
        }
        return;
      } else if (evt.type === "done") {
        try {
          res.write("data: [DONE]\n\n");
          res.end();
        } catch {
          // ignore
        }
        return;
      }
    }

    try {
      res.write("data: [DONE]\n\n");
      res.end();
    } catch {
      // ignore
    }
  } finally {
    clearInterval(keepaliveTimer);
  }
}

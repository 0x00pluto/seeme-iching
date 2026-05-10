import type { ArkStreamDelta } from "./ark-api.js";
import type { SseStreamLog } from "./sse-stream-log.js";
import { getSsePeriodicPingMs } from "./sse-warmup.js";

/**
 * 将 ark-api 的 AsyncGenerator 按现有契约写入 HTTP SSE，并打点日志。
 * Express 与 Vercel 共用。
 * 在首包 model token 前可能长时间无 data 行，故用定时 SSE 注释保活（与 handler 内首包 ping 配合）。
 */
export async function pipeArkStreamToSse(
  res: { write(chunk: string): boolean; end(cb?: () => void): unknown },
  stream: AsyncIterable<ArkStreamDelta>,
  log: SseStreamLog
): Promise<void> {
  const periodicPingMs = getSsePeriodicPingMs();
  const keepaliveTimer = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepaliveTimer);
    }
  }, periodicPingMs);

  try {
    for await (const evt of stream) {
      if (evt.type === "delta") {
        try {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: evt.delta } }] })}\n\n`);
          log.afterDeltaWrite();
        } catch (err) {
          log.resWriteError(err);
          log.streamEnd("res_write_throw", { phase: "delta" });
          throw err;
        }
      } else if (evt.type === "error") {
        try {
          res.write(`data: ${JSON.stringify({ error: evt.error, detail: evt.detail ?? "" })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        } catch (err) {
          log.resWriteError(err);
        }
        log.streamEnd("ark_error");
        return;
      } else if (evt.type === "done") {
        try {
          res.write("data: [DONE]\n\n");
          res.end();
        } catch (err) {
          log.resWriteError(err);
        }
        log.streamEnd("ark_done");
        return;
      }
    }

    try {
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      log.resWriteError(err);
    }
    log.streamEnd("loop_finished_without_done_event");
  } finally {
    clearInterval(keepaliveTimer);
  }
}

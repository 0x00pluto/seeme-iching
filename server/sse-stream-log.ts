/**
 * SSE 诊断日志：统一前缀 `[sse_stream]`，便于在 Vercel Runtime Logs 里 grep。
 * 不记录 question / input 原文，仅长度与字段名，避免泄露用户输入。
 */

export function interpretStreamMeta(body: unknown): Record<string, unknown> {
  const b = body as { question?: unknown } | null | undefined;
  const q = typeof b?.question === "string" ? b.question : "";
  const keys = body && typeof body === "object" ? Object.keys(body as object).sort() : [];
  return { questionLen: q.length, bodyKeys: keys };
}

export function chatStreamMeta(body: unknown): Record<string, unknown> {
  const b = body as {
    messages?: unknown;
    round?: unknown;
    input?: unknown;
  } | null | undefined;
  const n = Array.isArray(b?.messages) ? b.messages.length : 0;
  const inputLen = typeof b?.input === "string" ? b.input.length : 0;
  return { messagesCount: n, inputLen, round: b?.round };
}

export type SseStreamLog = ReturnType<typeof createSseStreamLog>;

/** 进度：每 N 个 delta 或至少每隔 intervalMs 打一条，避免刷屏 */
export function createSseStreamLog(route: string, meta: Record<string, unknown>) {
  const t0 = Date.now();
  let deltaChunks = 0;
  let lastProgressAt = t0;
  const PROGRESS_EVERY_N = 40;
  const PROGRESS_INTERVAL_MS = 10_000;

  const elapsed = () => Date.now() - t0;

  console.log(`[sse_stream] ${route} request_start`, {
    wallClock: new Date().toISOString(),
    ms: elapsed(),
    ...meta,
  });

  return {
    sseHeadersSet() {
      console.log(`[sse_stream] ${route} sse_headers_set`, { ms: elapsed() });
    },

    /** IncomingMessage close：常见于浏览器/代理掐断连接 */
    clientDisconnected(reason: string) {
      console.log(`[sse_stream] ${route} client_disconnect`, { ms: elapsed(), reason });
    },

    afterDeltaWrite() {
      deltaChunks++;
      const now = Date.now();
      if (deltaChunks === 1) {
        console.log(`[sse_stream] ${route} first_delta_written`, { ms: elapsed(), deltaChunks });
      }
      const intervalElapsed = now - lastProgressAt >= PROGRESS_INTERVAL_MS;
      const hitChunkMod = deltaChunks > 1 && deltaChunks % PROGRESS_EVERY_N === 0;
      if (intervalElapsed || hitChunkMod) {
        console.log(`[sse_stream] ${route} stream_progress`, {
          ms: elapsed(),
          deltaChunks,
        });
        lastProgressAt = now;
      }
    },

    resWriteError(err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`[sse_stream] ${route} res_write_error`, { ms: elapsed(), message });
    },

    streamEnd(reason: string, extra?: Record<string, unknown>) {
      console.log(`[sse_stream] ${route} stream_end`, {
        ms: elapsed(),
        reason,
        deltaChunks,
        ...extra,
      });
    },
  };
}

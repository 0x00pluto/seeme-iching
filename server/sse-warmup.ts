/**
 * SSE 首包与保活：下发 OpenAI 兼容的 `data:` 空 delta（`content:""`）。
 * 部分中间层不把 SSE 注释 `: ping` 当作下行字节，仍可能在 ~60s 掐空闲连接；
 * 前端 `ark-client` 对空字符串不调 `onDelta`。
 */

/** 未设置或非法时使用；数字字面量中的 `_` 仅为可读性（12_000 === 12000） */
const DEFAULT_SSE_PERIODIC_PING_MS = 12_000;
const MIN_SSE_PERIODIC_PING_MS = 3_000;
const MAX_SSE_PERIODIC_PING_MS = 120_000;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * `SSE_PERIODIC_PING_MS`：空 delta 心跳间隔（毫秒），仅 Node/Vercel Functions 读取。
 * 建议小于常见空闲超时（约 60s）；默认 12000。
 */
export function getSsePeriodicPingMs(): number {
  const raw = process.env.SSE_PERIODIC_PING_MS?.trim();
  if (!raw) return DEFAULT_SSE_PERIODIC_PING_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SSE_PERIODIC_PING_MS;
  return clamp(parsed, MIN_SSE_PERIODIC_PING_MS, MAX_SSE_PERIODIC_PING_MS);
}

/** OpenAI 兼容空片段，与真实 delta 同行格式，便于穿透只识别 `data:` 的中间层 */
export function sseEmptyModelDeltaHeartbeat(): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: "" } }] })}\n\n`;
}

/** 在已 setHeader 完 SSE 三件套 + X-Accel-Buffering 后调用 */
export function flushHeadersAndInitialSsePing(res: {
  flushHeaders?: () => void;
  write(chunk: string): boolean;
}): void {
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
  res.write(sseEmptyModelDeltaHeartbeat());
}

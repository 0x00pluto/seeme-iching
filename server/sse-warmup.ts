/**
 * SSE 首包与保活：注释行不触发业务解析（前端只认 `data:`），用于避免
 *「已 200 但长期无 body」被中间层/浏览器当空闲连接掐断。
 */

/** 未设置或非法时使用；数字字面量中的 `_` 仅为可读性（12_000 === 12000） */
const DEFAULT_SSE_PERIODIC_PING_MS = 12_000;
const MIN_SSE_PERIODIC_PING_MS = 3_000;
const MAX_SSE_PERIODIC_PING_MS = 120_000;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * `SSE_PERIODIC_PING_MS`：服务端 SSE 注释保活间隔（毫秒），仅 Node/Vercel Functions 读取。
 * 建议小于常见中间层空闲超时（约 15～30s）；默认 12000。
 */
export function getSsePeriodicPingMs(): number {
  const raw = process.env.SSE_PERIODIC_PING_MS?.trim();
  if (!raw) return DEFAULT_SSE_PERIODIC_PING_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SSE_PERIODIC_PING_MS;
  return clamp(parsed, MIN_SSE_PERIODIC_PING_MS, MAX_SSE_PERIODIC_PING_MS);
}

/** 在已 setHeader 完 SSE 三件套 + X-Accel-Buffering 后调用 */
export function flushHeadersAndInitialSsePing(res: {
  flushHeaders?: () => void;
  write(chunk: string): boolean;
}): void {
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
  res.write(": ping\n\n");
}

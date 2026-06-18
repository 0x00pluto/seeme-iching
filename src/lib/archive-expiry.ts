/** 距 expiresAt（毫秒）剩余完整自然日数，至少 0 */
export function daysUntilExpiry(expiresAtMs: number): number {
  const msLeft = expiresAtMs - Date.now();
  return Math.max(0, Math.ceil(msLeft / 86_400_000));
}

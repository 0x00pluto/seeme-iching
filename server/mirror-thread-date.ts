const SHANGHAI_TZ = "Asia/Shanghai";

/** 东八区当前自然日 YYYY-MM-DD，与 interpret_usage_daily day_bucket 对齐 */
export function getInsightDateShanghai(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 将 ISO 时刻转为东八区日历日 YYYY-MM-DD */
export function toShanghaiDateString(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return getInsightDateShanghai(d);
}

/** 两东八区日历日之间的整天差（to - from） */
export function daysBetweenShanghaiDates(fromYmd: string, toYmd: string): number {
  const parse = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toYmd) - parse(fromYmd)) / 86_400_000);
}

/** 主素材 saved_at 相对 insight 日的整天差（东八区日历日） */
export function daysSinceSavedShanghai(
  savedAtIso: string | Date,
  insightDateYmd?: string,
): number {
  const insight = insightDateYmd ?? getInsightDateShanghai();
  return daysBetweenShanghaiDates(toShanghaiDateString(savedAtIso), insight);
}

/** 续照仅跨日展示：autosave 当日只展示明日之约，次日及以后才 eligible */
export function isMirrorThreadEligible(savedAtIso: string | Date, insightDateYmd?: string): boolean {
  return daysSinceSavedShanghai(savedAtIso, insightDateYmd) >= 1;
}

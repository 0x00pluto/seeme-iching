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

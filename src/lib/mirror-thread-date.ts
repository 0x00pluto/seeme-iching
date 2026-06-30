const SHANGHAI_TZ = "Asia/Shanghai";

/** 东八区当前自然日 YYYY-MM-DD（浏览器端，与 server mirror-thread-date 对齐） */
export function getInsightDateShanghaiClient(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type MirrorThreadToday = {
  sourceReportId: string;
  echoText: string;
  shiftText: string;
  optionalPrompt: string | null;
  insightDate: string;
  generatedAt: string;
  sourceReportExpiresAt: string;
  sourceQuestion: string;
};

export type MirrorThreadReadBeacon = {
  insightDate: string;
  insightReadDurationMs: number;
  generatedAt: string;
};

export async function fetchMirrorThreadToday(): Promise<MirrorThreadToday | null> {
  const res = await fetch("/api/mirror-thread/today", { credentials: "include" });
  if (res.status === 204) {
    return null;
  }
  const data = (await res.json()) as MirrorThreadToday & { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "续照暂未就绪");
  }
  return data;
}

export function postMirrorThreadReadBeacon(payload: MirrorThreadReadBeacon): void {
  const body = JSON.stringify({
    insightDate: payload.insightDate,
    insightReadDurationMs: payload.insightReadDurationMs,
    generatedAt: payload.generatedAt,
  });
  const url = "/api/mirror-thread/read";
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(url, blob);
    return;
  }
  void fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

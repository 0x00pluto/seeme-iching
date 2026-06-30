export type MirrorThreadToday = {
  sourceReportId: string;
  echoText: string;
  shiftText: string;
  optionalPrompt: string | null;
  insightDate: string;
  generatedAt: string;
  sourceReportExpiresAt: string;
  sourceQuestion: string;
  userReply?: string | null;
};

export type MirrorThreadReadBeacon = {
  insightDate: string;
  insightReadDurationMs: number;
  generatedAt: string;
};

export type MirrorThreadReplyResult = {
  insightDate: string;
  replyText: string;
  updatedAt: string;
};

export type MirrorThreadReplyListItem = {
  insightDate: string;
  replyText: string;
  updatedAt: string;
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

export async function putMirrorThreadReply(params: {
  replyText: string;
  insightDate?: string;
}): Promise<MirrorThreadReplyResult> {
  const res = await fetch("/api/mirror-thread/reply", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      replyText: params.replyText,
      insightDate: params.insightDate,
    }),
  });
  const data = (await res.json()) as MirrorThreadReplyResult & { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "回笔保存失败");
  }
  return data;
}

export async function fetchMirrorThreadReplies(
  limit = 7,
): Promise<MirrorThreadReplyListItem[]> {
  const res = await fetch(`/api/mirror-thread/replies?limit=${limit}`, {
    credentials: "include",
  });
  const data = (await res.json()) as {
    items?: MirrorThreadReplyListItem[];
    error?: string;
    detail?: string;
  };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "回笔列表读取失败");
  }
  return data.items ?? [];
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

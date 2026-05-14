export type SharedReportPayload = {
  question: string;
  lines: unknown;
  interpretation: string;
};

export async function fetchSharedReport(token: string): Promise<SharedReportPayload> {
  const res = await fetch(`/api/share/${encodeURIComponent(token)}`);
  const data = (await res.json()) as SharedReportPayload & { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "加载失败");
  }
  return {
    question: data.question ?? "",
    lines: data.lines,
    interpretation: data.interpretation ?? "",
  };
}

export async function postArchiveShare(archiveId: string): Promise<{ token: string; path: string }> {
  const res = await fetch(`/api/archives/${encodeURIComponent(archiveId)}/share`, {
    method: "POST",
    credentials: "include",
  });
  const data = (await res.json()) as { token?: string; path?: string; error?: string; detail?: string };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "生成分享链接失败");
  }
  if (!data.token || !data.path) {
    throw new Error("生成分享链接失败");
  }
  return { token: data.token, path: data.path };
}

export async function deleteArchiveShare(archiveId: string): Promise<{ revoked: number }> {
  const res = await fetch(`/api/archives/${encodeURIComponent(archiveId)}/share`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = (await res.json()) as { revoked?: number; error?: string; detail?: string };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "停止分享失败");
  }
  return { revoked: typeof data.revoked === "number" ? data.revoked : 0 };
}

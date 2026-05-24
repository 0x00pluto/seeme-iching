import type { HistoryItem } from "@/components/IChing/History";

const jsonHeaders = { "Content-Type": "application/json" };

export const ARCHIVE_ALREADY_SAVED_CODE = "ARCHIVE_ALREADY_SAVED";

export type PostArchiveBody = {
  client_session_id: string;
  question: string;
  lines: HistoryItem["lines"];
  interpretation: string;
  deep_inquiry_questions?: string[];
};

export type PatchArchiveBody = {
  interpretation?: string;
  deep_inquiry_questions?: string[];
};

export async function fetchArchives(): Promise<{ items: HistoryItem[] }> {
  const res = await fetch("/api/archives", { credentials: "include" });
  const data = (await res.json()) as { items?: HistoryItem[]; error?: string; detail?: string };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "加载档案失败");
  }
  return { items: data.items ?? [] };
}

/** 成功返回 `HistoryItem`；201 新建或 200 upsert 更新。 */
export async function postArchive(body: PostArchiveBody): Promise<HistoryItem> {
  const res = await fetch("/api/archives", {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    item?: HistoryItem;
    code?: string;
    error?: string;
    detail?: string;
  };
  if (res.status === 409 && data.code === ARCHIVE_ALREADY_SAVED_CODE && data.item) {
    return data.item;
  }
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "保存失败");
  }
  if (!data.item) {
    throw new Error("保存响应缺少 item");
  }
  return data.item;
}

export async function patchArchive(id: string, body: PatchArchiveBody): Promise<HistoryItem> {
  const res = await fetch(`/api/archives/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    item?: HistoryItem;
    error?: string;
    detail?: string;
  };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "更新档案失败");
  }
  if (!data.item) {
    throw new Error("更新响应缺少 item");
  }
  return data.item;
}

export async function clearArchives(): Promise<void> {
  const res = await fetch("/api/archives", { method: "DELETE", credentials: "include" });
  const data = (await res.json()) as { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "清空失败");
  }
}

export async function deleteArchiveById(id: string): Promise<void> {
  const res = await fetch(`/api/archives/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  const data = (await res.json()) as { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error([data.error, data.detail].filter(Boolean).join("：") || "删除失败");
  }
}

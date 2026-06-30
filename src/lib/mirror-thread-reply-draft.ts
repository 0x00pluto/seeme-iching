const DRAFT_KEY_PREFIX = "mirror_thread_reply_draft_";

function draftKey(insightDate: string): string {
  return `${DRAFT_KEY_PREFIX}${insightDate}`;
}

export function loadMirrorThreadReplyDraft(insightDate: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(insightDate));
    return raw?.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function saveMirrorThreadReplyDraft(insightDate: string, text: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const trimmed = text.trim();
    if (!trimmed) {
      localStorage.removeItem(draftKey(insightDate));
      return;
    }
    localStorage.setItem(draftKey(insightDate), text);
  } catch {
    // ignore quota / private mode
  }
}

export function clearMirrorThreadReplyDraft(insightDate: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(draftKey(insightDate));
  } catch {
    // ignore
  }
}

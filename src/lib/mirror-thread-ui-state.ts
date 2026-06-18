const STORAGE_KEY = "iching_mirror_thread_ui";

export type MirrorThreadUiMode = "expanded" | "compact";

export type MirrorThreadUiState = {
  userId: string;
  insightDate: string;
  generatedAt: string;
  mode: MirrorThreadUiMode;
};

export function readMirrorThreadUiState(): MirrorThreadUiState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MirrorThreadUiState;
    if (
      !parsed.userId ||
      !parsed.insightDate ||
      !parsed.generatedAt ||
      (parsed.mode !== "expanded" && parsed.mode !== "compact")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeMirrorThreadUiState(state: MirrorThreadUiState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function clearMirrorThreadUiState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 与当前续照对齐；日期或生成时刻变化则视为新的一天/新续照，默认 expanded */
export function resolveMirrorThreadUiMode(
  userId: string | undefined,
  insight: { insightDate: string; generatedAt: string } | null | undefined,
): MirrorThreadUiMode {
  if (!userId || !insight) return "expanded";
  const stored = readMirrorThreadUiState();
  if (
    !stored ||
    stored.userId !== userId ||
    stored.insightDate !== insight.insightDate ||
    stored.generatedAt !== insight.generatedAt
  ) {
    return "expanded";
  }
  return stored.mode;
}

export function persistMirrorThreadUiMode(
  userId: string,
  insight: { insightDate: string; generatedAt: string },
  mode: MirrorThreadUiMode,
): void {
  writeMirrorThreadUiState({
    userId,
    insightDate: insight.insightDate,
    generatedAt: insight.generatedAt,
    mode,
  });
}

export function truncateEchoPreview(text: string, maxLen = 28): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

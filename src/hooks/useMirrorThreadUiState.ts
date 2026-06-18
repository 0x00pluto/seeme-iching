import {
  persistMirrorThreadUiMode,
  resolveMirrorThreadUiMode,
  type MirrorThreadUiMode,
} from "@/lib/mirror-thread-ui-state";
import type { MirrorThreadToday } from "@/lib/mirror-thread-api";
import { useCallback, useEffect, useState } from "react";

export function useMirrorThreadUiState(
  userId: string | undefined,
  insight: MirrorThreadToday | null,
): {
  mode: MirrorThreadUiMode;
  dismiss: () => void;
  expand: () => void;
} {
  const [mode, setMode] = useState<MirrorThreadUiMode>(() =>
    resolveMirrorThreadUiMode(userId, insight ?? undefined),
  );

  useEffect(() => {
    setMode(resolveMirrorThreadUiMode(userId, insight ?? undefined));
  }, [userId, insight?.insightDate, insight?.generatedAt]);

  const dismiss = useCallback(() => {
    if (!userId || !insight) return;
    persistMirrorThreadUiMode(userId, insight, "compact");
    setMode("compact");
  }, [userId, insight]);

  const expand = useCallback(() => {
    if (!userId || !insight) return;
    persistMirrorThreadUiMode(userId, insight, "expanded");
    setMode("expanded");
  }, [userId, insight]);

  return { mode, dismiss, expand };
}

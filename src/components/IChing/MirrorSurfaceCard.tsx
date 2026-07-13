import {
  formatSurfaceWhisperLine,
  MIRROR_SURFACE_LANDING_EMPTY_WHISPER,
} from "@/lib/mirror-surface-copy";
import type { MirrorThreadSurfaceItem } from "@/lib/mirror-thread-api";
import { cn } from "@/lib/utils";
import React from "react";

type MirrorSurfaceWhisperProps = {
  items: MirrorThreadSurfaceItem[];
  onOpenArchives: () => void;
  className?: string;
};

/**
 * Landing 耳语：一行近期足迹，贴在输入框上方；点整行进档案。
 * 视觉对齐「查看 · 今日续照」strip，不做成第二 Hero。
 */
export function MirrorSurfaceWhisper({
  items,
  onOpenArchives,
  className,
}: MirrorSurfaceWhisperProps) {
  const line = formatSurfaceWhisperLine(items);
  if (!line) return null;

  return (
    <button
      type="button"
      onClick={onOpenArchives}
      className={cn(
        "mx-auto block bg-bg px-3 font-serif text-xs tracking-[0.28em] text-brand/70 transition-colors hover:text-brand",
        className,
      )}
      aria-label={line}
    >
      {line}
    </button>
  );
}

type MirrorSurfaceEmptyWhisperProps = {
  className?: string;
};

/** Landing 空态：输入框上方一句轻提示，无卡片、无第二 CTA */
export function MirrorSurfaceEmptyWhisper({ className }: MirrorSurfaceEmptyWhisperProps) {
  return (
    <p
      className={cn(
        "mx-auto text-center font-serif text-xs tracking-[0.2em] text-ink/25 italic",
        className,
      )}
    >
      {MIRROR_SURFACE_LANDING_EMPTY_WHISPER}
    </p>
  );
}

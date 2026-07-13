/**
 * 镜脉打开面文案（prd-00007）
 *
 * 禁用词（验收零命中）：宜、忌、大吉、今日运势、签到、连续天数、打卡、领奖、必走、天机
 */

import type { MirrorThreadSurfaceItem } from "@/lib/mirror-thread-api";

export const MIRROR_SURFACE_EMPTY_TITLE = "开始你的镜脉";
export const MIRROR_SURFACE_PRINCIPLE = "不预言命运，只映照叙事";
export const MIRROR_SURFACE_EMPTY_CTA = "写下此刻，开始镜脉";
/** Landing 耳语：你的近期足迹 · 大畜 */
export const MIRROR_SURFACE_WHISPER_PREFIX = "你的近期足迹";
/** Landing 空态轻提示（非独立卡片） */
export const MIRROR_SURFACE_LANDING_EMPTY_WHISPER = "写下此刻，开始你的镜脉";

/** Landing 一行耳语：你的近期足迹 · 大畜（仅最近一卦，不抢戏） */
export function formatSurfaceWhisperLine(items: MirrorThreadSurfaceItem[]): string {
  const first = items[0];
  if (!first?.hexagramName) return "";
  return `${MIRROR_SURFACE_WHISPER_PREFIX} · ${first.hexagramName}`;
}

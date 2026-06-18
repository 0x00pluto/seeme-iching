import type { MirrorThreadToday } from "@/lib/mirror-thread-api";

/** 继续照见时预填起卦意念：追问优先，其次来源档案 question，最后回响截断 */
export function buildContinueQuestion(insight: MirrorThreadToday): string {
  if (insight.optionalPrompt?.trim()) return insight.optionalPrompt.trim();
  if (insight.sourceQuestion?.trim()) return insight.sourceQuestion.trim();
  return insight.echoText.replace(/\s+/g, " ").trim().slice(0, 120);
}

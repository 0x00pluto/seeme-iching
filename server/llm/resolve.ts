import type { AiProvider } from "./types";

function normalizeProvider(raw: string): AiProvider | null {
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "ark" || v === "volcengine" || v === "volcano") return "ark";
  if (v === "kimi" || v === "moonshot") return "kimi";
  return null;
}

/**
 * `SEEME_AI_PROVIDER` 优先；未设置时可读 `AI_PROVIDER`（便于与外部平台命名对齐）。
 * 默认 `ark`，与历史部署一致。
 */
export function resolveAiProvider(): AiProvider {
  const primary = process.env.SEEME_AI_PROVIDER?.trim() ?? "";
  const fallback = process.env.AI_PROVIDER?.trim() ?? "";
  const chosen = primary || fallback;
  const normalized = normalizeProvider(chosen);
  if (normalized) return normalized;
  if (chosen) {
    console.warn(
      `[llm/resolve] Unknown SEEME_AI_PROVIDER / AI_PROVIDER="${chosen}", falling back to ark`
    );
  }
  return "ark";
}

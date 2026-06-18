const SELF_OBSERVATION_SECTION = "\n\n### 自我觉察\n";

/** 从 Markdown 正文中摘 1 句作为回响：觉察优先，否则阴影之镜段，否则全文首句 */
export function extractEchoText(interpretation: string): string {
  const full = interpretation.trim();
  if (!full) return "照见尚未写下痕迹，但叙事线仍在此处等候。";

  const selfIdx = full.indexOf(SELF_OBSERVATION_SECTION);
  if (selfIdx >= 0) {
    const section = full.slice(selfIdx + SELF_OBSERVATION_SECTION.length).trim();
    const fromSection = firstMeaningfulSentence(section);
    if (fromSection) return fromSection;
  }

  const bodyOnly = selfIdx >= 0 ? full.slice(0, selfIdx).trim() : full;
  const shadowSentence = extractShadowMirrorSentence(bodyOnly);
  if (shadowSentence) return shadowSentence;

  return firstMeaningfulSentence(bodyOnly) ?? full.slice(0, 120).trim();
}

function firstMeaningfulSentence(text: string): string | null {
  const cleaned = text
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .trim();
  const parts = cleaned.split(/(?<=[。！？!?])\s*/);
  for (const part of parts) {
    const s = part.replace(/\s+/g, " ").trim();
    if (s.length >= 8) return s.length > 160 ? `${s.slice(0, 157)}…` : s;
  }
  const line = cleaned.split(/\n+/).find((l) => l.trim().length >= 8);
  if (!line) return null;
  const s = line.trim();
  return s.length > 160 ? `${s.slice(0, 157)}…` : s;
}

function extractShadowMirrorSentence(body: string): string | null {
  const shadowIdx = body.search(/阴影之镜/);
  if (shadowIdx < 0) return null;
  const after = body.slice(shadowIdx);
  const sectionEnd = after.search(/\n(?:#{1,3}\s|\d+\s*[·\.]\s*)/);
  const section = (sectionEnd > 0 ? after.slice(0, sectionEnd) : after).trim();
  const withoutHeader = section.replace(/^[^\n]*阴影之镜[^\n]*\n?/, "").trim();
  return firstMeaningfulSentence(withoutHeader);
}

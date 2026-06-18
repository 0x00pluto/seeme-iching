/**
 * 镜脉续照 · Seed 结构化 LLM prompt（一次输出 echo + 7 档 shift + optional）。
 */

export type MirrorThreadSeedLlmOutput = {
  echoText: string;
  shiftByDayOffset: Record<string, string>;
  optionalPrompt: string | null;
};

const SHIFT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "default"] as const;

const FORBIDDEN_WORDS = ["streak", "打卡", "连续登录", "连续签到", "奖励", "任务", "断签", "补签"];

export function buildMirrorThreadSeedUserPrompt(params: {
  question: string;
  interpretation: string;
  deepInquiryQuestions?: string[] | null;
  lines?: number[] | null;
}): string {
  const { question, interpretation, deepInquiryQuestions, lines } = params;

  const deepBlock =
    deepInquiryQuestions && deepInquiryQuestions.length > 0
      ? `\n【深入追问（若有）】\n${deepInquiryQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";

  const linesBlock =
    lines && lines.length === 6
      ? `\n【卦象爻值】\n${lines.join(", ")}（6/7/8/9 分别代表老阴/少阳/少阴/老阳）`
      : "";

  return `
你是镜微的内省引导者。请基于用户的观心报告，输出 **唯一一段 JSON**（不要 Markdown 代码块、不要其它文字）。

【用户当时的意念】
${question.trim() || "未提供具体问题"}

【观心报告全文（echo 必须从此 verbatim 选句，禁止改写或编造）】
${interpretation.trim()}${deepBlock}${linesBlock}

【输出 JSON schema】
{
  "echoText": "从观心报告原文中选取 1 句最触动、最能映照用户的句子，必须是报告中的 verbatim 子串",
  "shiftByDayOffset": {
    "1": "隔一夜再照，80-120 字",
    "2": "隔 2 日再照，80-120 字，语义须与 1 不同",
    "3": "…",
    "4": "…",
    "5": "…",
    "6": "…",
    "7": "隔 7 日再照，80-120 字",
    "default": "缺席较久（>7 天）再照，80-120 字，无断签/愧疚/任务感"
  },
  "optionalPrompt": "若有余力，1 条苏格拉底式追问；可空字符串"
}

【必须遵守】
- echoText 必须是观心报告中的 **原文句子**，禁止 AI 改写或编造金句。
- shiftByDayOffset 的键必须齐全："1" 到 "7" 以及 "default"；每档 80–120 字；**各档语义须不同**，禁止复制粘贴同一段。
- "1" 偏隔一夜；"4"-"7" 可自然提及隔了数日；default 用于缺席较久，禁止断签、愧疚话术。
- 照见叙事与感受，不断言命运、不给吉凶、不给行动清单式「答案」。
- 邀请式语气（若你愿意、不妨）；第二人称「你」。
- 禁用词：${FORBIDDEN_WORDS.join("、")}。
- optionalPrompt 可为空字符串；若有内容须为 1 条温柔追问。
`.trim();
}

function containsForbiddenWord(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some((w) => lower.includes(w.toLowerCase()) || text.includes(w));
}

function parseShiftByDayOffset(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const key of SHIFT_KEYS) {
    const val = obj[key];
    if (typeof val !== "string" || !val.trim()) return null;
    result[key] = val.trim();
  }
  return result;
}

function isShiftLengthOk(text: string): boolean {
  const len = text.length;
  return len >= 40 && len <= 200;
}

export function validateMirrorThreadSeedOutput(
  parsed: MirrorThreadSeedLlmOutput,
  interpretation: string,
): { ok: true } | { ok: false; reason: string } {
  const echo = parsed.echoText.trim();
  if (!echo || echo.length < 8) {
    return { ok: false, reason: "echoText 过短或为空" };
  }
  if (!interpretation.includes(echo)) {
    return { ok: false, reason: "echoText 不是 interpretation 的子串" };
  }
  if (containsForbiddenWord(echo)) {
    return { ok: false, reason: "echoText 含禁用词" };
  }

  const shifts = parsed.shiftByDayOffset;
  for (const key of SHIFT_KEYS) {
    const text = shifts[key];
    if (!text || !isShiftLengthOk(text)) {
      return { ok: false, reason: `shiftByDayOffset["${key}"] 字数不在 40–200` };
    }
    if (containsForbiddenWord(text)) {
      return { ok: false, reason: `shiftByDayOffset["${key}"] 含禁用词` };
    }
  }

  const uniqueShifts = new Set(SHIFT_KEYS.map((k) => shifts[k]));
  if (uniqueShifts.size < 4) {
    return { ok: false, reason: "shift 各档语义过于雷同（重复过多）" };
  }

  const optional = parsed.optionalPrompt?.trim() ?? "";
  if (optional && containsForbiddenWord(optional)) {
    return { ok: false, reason: "optionalPrompt 含禁用词" };
  }

  return { ok: true };
}

export function parseMirrorThreadSeedJson(
  text: string,
  interpretation: string,
): { ok: true; data: MirrorThreadSeedLlmOutput } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    return { ok: false, reason: "JSON 解析失败" };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "根节点须为 object" };
  }

  const obj = raw as Record<string, unknown>;
  const echoText = typeof obj.echoText === "string" ? obj.echoText.trim() : "";
  const shiftByDayOffset = parseShiftByDayOffset(obj.shiftByDayOffset);
  if (!shiftByDayOffset) {
    return { ok: false, reason: "shiftByDayOffset 键不全或无效" };
  }

  let optionalPrompt: string | null = null;
  if (obj.optionalPrompt === null || obj.optionalPrompt === undefined || obj.optionalPrompt === "") {
    optionalPrompt = null;
  } else if (typeof obj.optionalPrompt === "string") {
    optionalPrompt = obj.optionalPrompt.trim() || null;
  } else {
    return { ok: false, reason: "optionalPrompt 须为 string 或空" };
  }

  const data: MirrorThreadSeedLlmOutput = { echoText, shiftByDayOffset, optionalPrompt };
  const validation = validateMirrorThreadSeedOutput(data, interpretation);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  return { ok: true, data };
}

export { SHIFT_KEYS };

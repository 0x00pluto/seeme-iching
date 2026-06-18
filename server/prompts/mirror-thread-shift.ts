/**
 * 镜脉续照 · 位移段短 prompt（80–120 字，镜微用户语言）。
 */

export function buildMirrorThreadShiftUserPrompt(params: {
  echoText: string;
  question: string;
  daysSinceSaved: number;
}): string {
  const { echoText, question, daysSinceSaved } = params;
  const absenceHint =
    daysSinceSaved > 1
      ? `距上次照见已过 ${daysSinceSaved} 天，位移段可自然提及隔了一些日子，同一句话往往会显出不同质地；禁止断签、愧疚或任务感话术。`
      : "距上次照见为隔日或同日语境，可写「隔了一夜」类温柔再照。";

  return `
你是镜微的内省引导者。请基于用户档案中的「回响句」，写一段 80–120 字的「位移」短文。

【用户当时的意念】
${question.trim() || "未提供具体问题"}

【回响句（须自然呼应，可轻点引用，勿整段复读）】
${echoText}

【时间语境】
${absenceHint}

【必须遵守】
- 照见叙事与感受，不断言命运、不给吉凶、不给行动清单式「答案」。
- 邀请式语气（若你愿意、不妨）；第二人称「你」。
- 禁用：打卡、签到、连续登录、奖励、任务、streak、断签、补签。
- 只输出位移正文，不要标题、不要 Markdown、不要 JSON。
`.trim();
}

export function buildAbsenceShiftFallback(daysSinceSaved: number): string {
  return `距你上次照见，已过 ${daysSinceSaved} 天。隔了一些日子，同一句话往往会显出不同的质地——镜微不想替你下结论，只是想请你再照一次。`;
}

export function buildOvernightShiftFallback(echoText: string): string {
  return `隔了一夜，${echoText} 是否多了一层滋味？照见不是为了给答案，而是多一个温柔的停顿。`;
}

/** 若有余力：纯规则苏格拉底式追问（R0 无 LLM） */
export function buildOptionalPromptRule(echoText: string): string {
  const snippet = echoText.length > 24 ? `${echoText.slice(0, 24)}…` : echoText;
  return `若有余力，不妨再想一想：「${snippet}」里，哪一个词或感受，此刻最先浮上心头？`;
}

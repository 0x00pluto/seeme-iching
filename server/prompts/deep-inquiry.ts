/**
 * 基于已生成的观心报告，产出三条「深入方向」问句（JSON 契约）。
 * 迭代 Pro prompt 时主要改此文件。
 */

const JSON_CONTRACT = `
你必须只输出一个 JSON 对象，不要 Markdown 代码围栏、不要前后说明文字。
JSON 结构严格如下（键名不可改）：
{
  "deepInquiry": [
    "第一条问句，字符串",
    "第二条问句，字符串",
    "第三条问句，字符串"
  ]
}

要求：
- deepInquiry 必须恰好 3 条，每条为一句完整中文问句，以问号结尾。
- 三条问句必须互不重复，且紧扣下面给出的「用户意念」与「观心报告」内容，帮助用户自我叙事觉察。
- 禁止算命、断吉凶、预言未来；禁止恐吓或绝对化断言。
- 语气：温柔、克制、可作答；像心理咨询师的一次邀请，而非说教。
`.trim();

export function buildDeepInquiryUserPrompt(params: {
  question: string;
  interpretation: string;
  benName: string;
  huName: string;
  cuoName: string;
  zongName: string;
}): string {
  const q = params.question.trim() || "未提供具体问题";
  const report = params.interpretation.trim() || "（报告为空）";
  return `
你是一位熟悉叙事疗法与易经意象的心理内省引导者。

【用户意念】
${q}

【四面镜子卦名（供你把握语境，勿在问句里堆砌卦名术语）】
本卦：${params.benName}；互卦：${params.huName}；错卦：${params.cuoName}；综卦：${params.zongName}

【观心报告全文】
${report}

${JSON_CONTRACT}
  `.trim();
}

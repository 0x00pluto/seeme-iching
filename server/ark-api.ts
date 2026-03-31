/**
 * 方舟 AI 调用逻辑：供 Express（本机/自建 Node）与 Vercel Serverless（api/*）共用。
 */
import OpenAI from "openai";

export const ARK_BASE_URL_DEFAULT = "https://ark.cn-beijing.volces.com/api/coding/v3";
export const ARK_MODEL_DEFAULT = "ark-code-latest";

export const ERR_NO_ARK_KEY =
  "服务端未配置 ARK_API_KEY。请在火山方舟控制台创建 API Key 并写入环境变量：https://www.volcengine.com/docs/82379/1541594";

export function formatArkFailure(error: unknown): { error: string; detail: string } {
  const detail = error instanceof Error ? error.message : String(error);
  const lower = detail.toLowerCase();

  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key")
  ) {
    return {
      error: "API Key 无效或未授权。请检查环境变量 ARK_API_KEY 是否与火山方舟控制台一致。",
      detail,
    };
  }

  if (
    lower.includes("endpoint") ||
    lower.includes("not found") ||
    lower.includes("invalid model") ||
    lower.includes("does not exist")
  ) {
    return {
      error:
        "模型不可用。Coding Plan 默认使用 ARK_MODEL=ark-code-latest；若使用常规在线推理，请将 ARK_BASE_URL 设为 .../api/v3 且 ARK_MODEL 为接入点 ID（ep- 开头）。",
      detail,
    };
  }

  if (
    lower.includes("insufficient") ||
    lower.includes("balance") ||
    lower.includes("quota") ||
    lower.includes("余额") ||
    lower.includes("欠费")
  ) {
    return {
      error: "账户余额或调用额度不足，请前往火山引擎控制台检查计费与配额。",
      detail,
    };
  }

  return {
    error:
      "AI 调用失败，请检查网络、ARK_API_KEY、ARK_BASE_URL（Coding 用 .../api/coding/v3）与 ARK_MODEL（默认 ark-code-latest 或 ep- 接入点）。",
    detail,
  };
}

export function getArkClient() {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.ARK_BASE_URL?.trim() || ARK_BASE_URL_DEFAULT,
  });
}

export function getArkModelId(): string {
  return process.env.ARK_MODEL?.trim() || ARK_MODEL_DEFAULT;
}

function buildInterpretUserPrompt(question: unknown, benGua: unknown, huGua: unknown, cuoGua: unknown, zongGua: unknown) {
  const bg = benGua as { name?: string } | undefined;
  const hg = huGua as { name?: string } | undefined;
  const cg = cuoGua as { name?: string } | undefined;
  const zg = zongGua as { name?: string } | undefined;
  return `
        你是一位精通易经哲学与深度心理学的引导者。
        
        用户的问题/意念: "${question || "未提供具体问题，请进行一般性指引"}"
        
        系统通过四面“镜子”捕捉到了以下卦象：
        1. 现状之镜 (本卦): ${bg?.name} - 代表当前事态的外部表现与现状。
        2. 内心之镜 (互卦): ${hg?.name} - 代表事态内部隐藏的动机、用户的真实内心状态。
        3. 阴影之镜 (错卦): ${cg?.name} - 代表被忽视的对立面、潜意识中的恐惧或盲点。
        4. 视角之镜 (综卦): ${zg?.name} - 代表换位思考后的客观环境或事态的另一面。
        
        请基于这四重维度的交织，为用户提供一份深度的“内省报告”。
        报告应避免迷信色彩，侧重于心理分析与行动建议：
        - “观照现状”：分析本卦揭示的处境。
        - “洞察内心”：通过互卦揭示用户可能未察觉的深层渴望或矛盾。
        - “直面阴影”：通过错卦提醒用户需要注意的盲区。
        - “通变之道”：综合四卦，给出如何调整心态或应对的建议。
        
        请使用优雅、克制、富有启发性的中文。
      `;
}

function buildChatSystemInstruction(question: unknown, interpretation: unknown, round: unknown) {
  return `你是一位深度心理咨询师与易经哲学引导者。
      
      当前对话背景：
      - 用户的问题: "${question}"
      - 初始卦象解读: "${interpretation}"
      - 当前轮次: ${round}/8
      
      你的目标：
      1. 协助用户看见自己的“叙事”（即他们是如何定义自己和处境的）。
      2. 引导用户发现不同视角的自己（通过错卦、综卦的启发）。
      3. 探索新的可能性转变。
      
      对话规则：
      - 每次只提一个深刻的问题。
      - 语气要优雅、克制、富有同理心。
      - 严禁算命或玄学说教，侧重心理觉察。
      - 如果是最后一轮（第8轮），请进行总结并给出一个充满希望的结语。
      - 保持对话的连贯性，基于用户的回答进行追问。`;
}

export type ArkJsonResponse = Record<string, unknown>;

export type ArkStreamDelta =
  | { type: "delta"; delta: string }
  | { type: "error"; error: string; detail?: string }
  | { type: "done" };

export async function runInterpretApi(body: unknown): Promise<{ status: number; json: ArkJsonResponse }> {
  try {
    const b = body as {
      question?: unknown;
      benGua?: unknown;
      huGua?: unknown;
      cuoGua?: unknown;
      zongGua?: unknown;
    };
    const client = getArkClient();
    if (!client) {
      return { status: 500, json: { error: ERR_NO_ARK_KEY } };
    }
    const modelId = getArkModelId();
    const userContent = buildInterpretUserPrompt(b.question, b.benGua, b.huGua, b.cuoGua, b.zongGua);
    const completion = (await client.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: userContent }],
      stream: false,
    })) as OpenAI.Chat.ChatCompletion;
    const text = completion.choices[0]?.message?.content ?? "";
    return { status: 200, json: { text } };
  } catch (error) {
    console.error("Interpret API Error:", error);
    const { error: msg, detail } = formatArkFailure(error);
    return { status: 500, json: { error: msg, detail } };
  }
}

export async function runChatApi(body: unknown): Promise<{ status: number; json: ArkJsonResponse }> {
  try {
    const b = body as {
      messages?: { role: string; content: string }[];
      question?: unknown;
      interpretation?: unknown;
      round?: unknown;
      input?: unknown;
    };
    const client = getArkClient();
    if (!client) {
      return { status: 500, json: { error: ERR_NO_ARK_KEY } };
    }
    const modelId = getArkModelId();
    const systemInstruction = buildChatSystemInstruction(b.question, b.interpretation, b.round);
    const history = Array.isArray(b.messages)
      ? b.messages.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(m.content ?? ""),
        }))
      : [];
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...history,
      { role: "user", content: String(b.input ?? "") },
    ];
    const completion = (await client.chat.completions.create({
      model: modelId,
      messages: chatMessages,
      stream: false,
    })) as OpenAI.Chat.ChatCompletion;
    const text = completion.choices[0]?.message?.content ?? "";
    return { status: 200, json: { text } };
  } catch (error) {
    console.error("Chat API Error:", error);
    const { error: msg, detail } = formatArkFailure(error);
    return { status: 500, json: { error: msg, detail } };
  }
}

export async function* runInterpretStream(body: unknown): AsyncGenerator<ArkStreamDelta, void, void> {
  try {
    const b = body as {
      question?: unknown;
      benGua?: unknown;
      huGua?: unknown;
      cuoGua?: unknown;
      zongGua?: unknown;
    };
    const client = getArkClient();
    if (!client) {
      yield { type: "error", error: ERR_NO_ARK_KEY };
      return;
    }
    const modelId = getArkModelId();
    const userContent = buildInterpretUserPrompt(b.question, b.benGua, b.huGua, b.cuoGua, b.zongGua);

    const stream = await client.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: userContent }],
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) yield { type: "delta", delta };
    }
    yield { type: "done" };
  } catch (error) {
    console.error("Interpret Stream Error:", error);
    const { error: msg, detail } = formatArkFailure(error);
    yield { type: "error", error: msg, detail };
  }
}

export async function* runChatStream(body: unknown): AsyncGenerator<ArkStreamDelta, void, void> {
  try {
    const b = body as {
      messages?: { role: string; content: string }[];
      question?: unknown;
      interpretation?: unknown;
      round?: unknown;
      input?: unknown;
    };
    const client = getArkClient();
    if (!client) {
      yield { type: "error", error: ERR_NO_ARK_KEY };
      return;
    }
    const modelId = getArkModelId();
    const systemInstruction = buildChatSystemInstruction(b.question, b.interpretation, b.round);
    const history = Array.isArray(b.messages)
      ? b.messages.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(m.content ?? ""),
        }))
      : [];
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemInstruction },
      ...history,
      { role: "user", content: String(b.input ?? "") },
    ];

    const stream = await client.chat.completions.create({
      model: modelId,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) yield { type: "delta", delta };
    }
    yield { type: "done" };
  } catch (error) {
    console.error("Chat Stream Error:", error);
    const { error: msg, detail } = formatArkFailure(error);
    yield { type: "error", error: msg, detail };
  }
}

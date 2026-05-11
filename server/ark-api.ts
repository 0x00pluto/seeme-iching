/**
 * 方舟 AI 调用逻辑：供 Express（本机/自建 Node）与 Vercel Serverless（api/*）共用。
 */
import OpenAI from "openai";
import { buildDeepInquiryUserPrompt } from "./prompts/deep-inquiry.js";
import { buildInterpretReportUserPrompt } from "./prompts/interpret-report.js";
import { buildChatSystemInstruction } from "./prompts/chat-dialogue.js";

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

function parseDeepInquiryJson(text: string): string[] | null {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const arr = (obj as { deepInquiry?: unknown }).deepInquiry;
  if (!Array.isArray(arr) || arr.length !== 3) return null;
  const out = arr.map((x) => String(x ?? "").trim()).filter((s) => s.length > 0);
  if (out.length !== 3) return null;
  return out;
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
    const userContent = buildInterpretReportUserPrompt(b.question, b.benGua, b.huGua, b.cuoGua, b.zongGua);
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

export async function runDeepInquiryApi(body: unknown): Promise<{ status: number; json: ArkJsonResponse }> {
  try {
    const b = body as {
      question?: unknown;
      interpretation?: unknown;
      benGua?: unknown;
      huGua?: unknown;
      cuoGua?: unknown;
      zongGua?: unknown;
    };
    const interpretation = String(b.interpretation ?? "").trim();
    if (!interpretation) {
      return { status: 400, json: { error: "interpretation 不能为空" } };
    }
    const question = String(b.question ?? "").trim() || "未提供具体问题";
    const benName = (b.benGua as { name?: string } | undefined)?.name?.trim() || "未知";
    const huName = (b.huGua as { name?: string } | undefined)?.name?.trim() || "未知";
    const cuoName = (b.cuoGua as { name?: string } | undefined)?.name?.trim() || "未知";
    const zongName = (b.zongGua as { name?: string } | undefined)?.name?.trim() || "未知";

    const client = getArkClient();
    if (!client) {
      return { status: 500, json: { error: ERR_NO_ARK_KEY } };
    }
    const modelId = getArkModelId();
    const userContent = buildDeepInquiryUserPrompt({
      question,
      interpretation,
      benName,
      huName,
      cuoName,
      zongName,
    });

    const completion = (await client.chat.completions.create({
      model: modelId,
      messages: [{ role: "user", content: userContent }],
      stream: false,
      response_format: { type: "json_object" },
    })) as OpenAI.Chat.ChatCompletion;

    const text = completion.choices[0]?.message?.content ?? "";
    const deepInquiry = parseDeepInquiryJson(text);
    if (!deepInquiry) {
      return {
        status: 502,
        json: {
          error: "模型返回的 JSON 无效或 deepInquiry 不是长度为 3 的字符串数组",
          detail: text.slice(0, 800),
        },
      };
    }
    return { status: 200, json: { deepInquiry } };
  } catch (error) {
    console.error("Deep Inquiry API Error:", error);
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
      direction?: unknown;
    };
    const client = getArkClient();
    if (!client) {
      return { status: 500, json: { error: ERR_NO_ARK_KEY } };
    }
    const modelId = getArkModelId();
    const systemInstruction = buildChatSystemInstruction(b.question, b.interpretation, b.round, b.direction);
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
    const userContent = buildInterpretReportUserPrompt(b.question, b.benGua, b.huGua, b.cuoGua, b.zongGua);

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
      direction?: unknown;
    };
    const client = getArkClient();
    if (!client) {
      yield { type: "error", error: ERR_NO_ARK_KEY };
      return;
    }
    const modelId = getArkModelId();
    const systemInstruction = buildChatSystemInstruction(b.question, b.interpretation, b.round, b.direction);
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

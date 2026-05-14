/**
 * LLM 业务编排（观心报告 / 深入问句 / 深度对话）：供 Express 与 Vercel `api/*` 共用。
 * 供应商细节见 `server/llm/`（`getActiveLlmBackend()`），此处不写 if(provider)。
 */
import OpenAI from "openai";
import { buildDeepInquiryUserPrompt } from "./prompts/deep-inquiry.js";
import { buildInterpretReportUserPrompt } from "./prompts/interpret-report.js";
import { buildChatSystemInstruction } from "./prompts/chat-dialogue.js";
import { getActiveLlmBackend } from "./llm/registry.js";
import type { LlmBackend } from "./llm/types.js";

export type { AiProvider } from "./llm/types.js";
export { resolveAiProvider } from "./llm-provider.js";
export {
  ARK_BASE_URL_DEFAULT,
  ARK_MODEL_DEFAULT,
  ERR_NO_ARK_KEY,
  formatArkFailure,
  getArkClient,
  getArkModelId,
} from "./llm/providers/ark.js";

/** 不向用户展示 Kimi thinking / reasoning，只取正文 `content`。 */
function chatCompletionAssistantContentOnly(
  message: { content?: string | null; reasoning_content?: unknown } | null | undefined
): string {
  if (!message || typeof message !== "object") return "";
  return message.content ?? "";
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

async function* streamTextDeltas(
  llm: LlmBackend,
  params: Omit<OpenAI.Chat.ChatCompletionCreateParams, "model" | "stream"> & {
    model?: string;
    stream: true;
  }
): AsyncGenerator<ArkStreamDelta, void, void> {
  const client = llm.getOpenAI();
  if (!client) {
    yield { type: "error", error: llm.errNoKey };
    return;
  }
  const raw = await client.chat.completions.create(
    llm.patchCompletionParams({
      ...params,
      model: params.model ?? llm.getModelId(),
      stream: true,
    })
  );
  const stream = raw as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;
  for await (const chunk of stream) {
    const rawDelta = chunk.choices?.[0]?.delta as { content?: string | null; reasoning_content?: unknown } | undefined;
    const delta = rawDelta?.content ?? "";
    if (delta) yield { type: "delta", delta };
  }
  yield { type: "done" };
}

export async function runInterpretApi(body: unknown): Promise<{ status: number; json: ArkJsonResponse }> {
  const llm = getActiveLlmBackend();
  try {
    const b = body as {
      question?: unknown;
      benGua?: unknown;
      huGua?: unknown;
      cuoGua?: unknown;
      zongGua?: unknown;
    };
    const userContent = buildInterpretReportUserPrompt(b.question, b.benGua, b.huGua, b.cuoGua, b.zongGua);

    const client = llm.getOpenAI();
    if (!client) {
      return { status: 500, json: { error: llm.errNoKey } };
    }
    const completion = (await client.chat.completions.create(
      llm.patchCompletionParams({
        model: llm.getModelId(),
        messages: [{ role: "user", content: userContent }],
        stream: false,
      })
    )) as OpenAI.Chat.ChatCompletion;
    const text = chatCompletionAssistantContentOnly(
      completion.choices[0]?.message as { content?: string | null; reasoning_content?: unknown }
    );
    return { status: 200, json: { text } };
  } catch (error) {
    console.error("Interpret API Error:", error);
    const { error: msg, detail } = llm.formatFailure(error);
    return { status: 500, json: { error: msg, detail } };
  }
}

export async function runDeepInquiryApi(body: unknown): Promise<{ status: number; json: ArkJsonResponse }> {
  const llm = getActiveLlmBackend();
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

    const userContent = buildDeepInquiryUserPrompt({
      question,
      interpretation,
      benName,
      huName,
      cuoName,
      zongName,
    });

    const client = llm.getOpenAI();
    if (!client) {
      return { status: 500, json: { error: llm.errNoKey } };
    }
    const completion = (await client.chat.completions.create(
      llm.patchCompletionParams({
        model: llm.getModelId(),
        messages: [{ role: "user", content: userContent }],
        stream: false,
        response_format: { type: "json_object" },
      })
    )) as OpenAI.Chat.ChatCompletion;

    const text = chatCompletionAssistantContentOnly(
      completion.choices[0]?.message as { content?: string | null; reasoning_content?: unknown }
    );
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
    const { error: msg, detail } = llm.formatFailure(error);
    return { status: 500, json: { error: msg, detail } };
  }
}

export async function runChatApi(body: unknown): Promise<{ status: number; json: ArkJsonResponse }> {
  const llm = getActiveLlmBackend();
  try {
    const b = body as {
      messages?: { role: string; content: string }[];
      question?: unknown;
      interpretation?: unknown;
      round?: unknown;
      input?: unknown;
      direction?: unknown;
    };
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

    const client = llm.getOpenAI();
    if (!client) {
      return { status: 500, json: { error: llm.errNoKey } };
    }
    const completion = (await client.chat.completions.create(
      llm.patchCompletionParams({
        model: llm.getModelId(),
        messages: chatMessages,
        stream: false,
      })
    )) as OpenAI.Chat.ChatCompletion;
    const text = chatCompletionAssistantContentOnly(
      completion.choices[0]?.message as { content?: string | null; reasoning_content?: unknown }
    );
    return { status: 200, json: { text } };
  } catch (error) {
    console.error("Chat API Error:", error);
    const { error: msg, detail } = llm.formatFailure(error);
    return { status: 500, json: { error: msg, detail } };
  }
}

export async function* runInterpretStream(body: unknown): AsyncGenerator<ArkStreamDelta, void, void> {
  const llm = getActiveLlmBackend();
  try {
    const b = body as {
      question?: unknown;
      benGua?: unknown;
      huGua?: unknown;
      cuoGua?: unknown;
      zongGua?: unknown;
    };
    const userContent = buildInterpretReportUserPrompt(b.question, b.benGua, b.huGua, b.cuoGua, b.zongGua);
    yield* streamTextDeltas(llm, {
      messages: [{ role: "user", content: userContent }],
      stream: true,
    });
  } catch (error) {
    console.error("Interpret Stream Error:", error);
    const { error: msg, detail } = llm.formatFailure(error);
    yield { type: "error", error: msg, detail };
  }
}

export async function* runChatStream(body: unknown): AsyncGenerator<ArkStreamDelta, void, void> {
  const llm = getActiveLlmBackend();
  try {
    const b = body as {
      messages?: { role: string; content: string }[];
      question?: unknown;
      interpretation?: unknown;
      round?: unknown;
      input?: unknown;
      direction?: unknown;
    };
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
    yield* streamTextDeltas(llm, { messages: chatMessages, stream: true });
  } catch (error) {
    console.error("Chat Stream Error:", error);
    const { error: msg, detail } = llm.formatFailure(error);
    yield { type: "error", error: msg, detail };
  }
}

import OpenAI from "openai";
import type { LlmBackend } from "../types.js";

export const MOONSHOT_BASE_URL_DEFAULT = "https://api.moonshot.cn/v1";
export const KIMI_MODEL_DEFAULT = "kimi-k2.6";

export const ERR_NO_MOONSHOT_KEY =
  "服务端未配置 MOONSHOT_API_KEY。请在 Kimi 开放平台创建 API Key 并写入环境变量：https://platform.kimi.com/console/api-keys";

export function formatKimiFailure(error: unknown): { error: string; detail: string } {
  const detail = error instanceof Error ? error.message : String(error);
  const lower = detail.toLowerCase();

  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid_api_key")
  ) {
    return {
      error: "API Key 无效或未授权。请检查环境变量 MOONSHOT_API_KEY 是否与 Kimi 控制台一致。",
      detail,
    };
  }

  if (
    lower.includes("not found") ||
    lower.includes("invalid model") ||
    lower.includes("does not exist") ||
    lower.includes("model_not_found")
  ) {
    return {
      error:
        "模型不可用。请检查 KIMI_MODEL（默认 kimi-k2.6）与账号可用模型列表：https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md",
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
      error: "账户余额或调用额度不足，请前往 Kimi 开放平台检查计费与配额。",
      detail,
    };
  }

  return {
    error:
      "AI 调用失败，请检查网络、MOONSHOT_API_KEY、MOONSHOT_BASE_URL（默认 https://api.moonshot.cn/v1）与 KIMI_MODEL。",
    detail,
  };
}

function getKimiClient(): OpenAI | null {
  const apiKey = process.env.MOONSHOT_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.MOONSHOT_BASE_URL?.trim() || MOONSHOT_BASE_URL_DEFAULT,
  });
}

function getKimiModelId(): string {
  return process.env.KIMI_MODEL?.trim() || KIMI_MODEL_DEFAULT;
}

/**
 * 是否请求 Kimi K2 系「思考」能力。默认关闭；设 `KIMI_THINKING_ENABLED=1|true|yes|on` 开启（服务端自测）。
 * 产品侧仍只展示正文，不展示 reasoning（见 ark-api 流式/非流式只读 `content`）。
 */
export function isKimiThinkingEnabledFromEnv(): boolean {
  const v = process.env.KIMI_THINKING_ENABLED?.trim().toLowerCase() ?? "";
  if (!v) return false;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Kimi K2.x / thinking 系列模型支持 `thinking` 请求体；v1 等旧 id 不传以免 API 拒识未知字段。 */
function kimiModelSupportsThinkingBody(model: string): boolean {
  const m = model.trim().toLowerCase();
  return m.includes("kimi-k2") || m.includes("k2-thinking");
}

/**
 * K2 系须显式传 `thinking`；默认 disabled。`KIMI_THINKING_ENABLED` 开启时为 enabled（服务端日志可见）。
 * @see https://platform.kimi.com/docs/guide/kimi-k2-6-quickstart.md
 */
function kimiCompletionCreateParams(base: OpenAI.Chat.ChatCompletionCreateParams): OpenAI.Chat.ChatCompletionCreateParams {
  const model = typeof base.model === "string" && base.model.trim() ? base.model : getKimiModelId();
  if (!kimiModelSupportsThinkingBody(model)) {
    return base;
  }
  const thinkingType = isKimiThinkingEnabledFromEnv() ? ("enabled" as const) : ("disabled" as const);
  return {
    ...base,
    thinking: { type: thinkingType },
  } as unknown as OpenAI.Chat.ChatCompletionCreateParams;
}

export const kimiBackend: LlmBackend = {
  id: "kimi",
  errNoKey: ERR_NO_MOONSHOT_KEY,
  getOpenAI: getKimiClient,
  getModelId: getKimiModelId,
  formatFailure: formatKimiFailure,
  patchCompletionParams: kimiCompletionCreateParams,
};

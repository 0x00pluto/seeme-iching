import OpenAI from "openai";
import type { LlmBackend } from "../types";

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

export function getArkClient(): OpenAI | null {
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

export const arkBackend: LlmBackend = {
  id: "ark",
  errNoKey: ERR_NO_ARK_KEY,
  getOpenAI: getArkClient,
  getModelId: getArkModelId,
  formatFailure: formatArkFailure,
  patchCompletionParams: (params) => params,
};

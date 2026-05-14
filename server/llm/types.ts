import OpenAI from "openai";

/** 已注册的 LLM 供应商 id；新增供应商时扩展此联合类型并在 registry 中注册。 */
export type AiProvider = "ark" | "kimi";

/** 各供应商封装：client、model、请求体补丁、错误文案。业务层只依赖此接口，不写 if(provider)。 */
export interface LlmBackend {
  readonly id: AiProvider;
  /** 未配置 API Key 时返回前端的固定提示 */
  readonly errNoKey: string;
  getOpenAI(): OpenAI | null;
  getModelId(): string;
  formatFailure(error: unknown): { error: string; detail: string };
  /** 在发往 OpenAI 兼容端点前合并供应商专属字段（如 Kimi 的 thinking） */
  patchCompletionParams(params: OpenAI.Chat.ChatCompletionCreateParams): OpenAI.Chat.ChatCompletionCreateParams;
}

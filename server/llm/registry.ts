import { arkBackend } from "./providers/ark.js";
import { kimiBackend } from "./providers/kimi.js";
import { resolveAiProvider } from "./resolve.js";
import type { AiProvider, LlmBackend } from "./types.js";

const backends: Record<AiProvider, LlmBackend> = {
  ark: arkBackend,
  kimi: kimiBackend,
};

export function getActiveLlmBackend(): LlmBackend {
  return backends[resolveAiProvider()];
}

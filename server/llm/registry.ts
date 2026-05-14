import { arkBackend } from "./providers/ark";
import { kimiBackend } from "./providers/kimi";
import { resolveAiProvider } from "./resolve";
import type { AiProvider, LlmBackend } from "./types";

const backends: Record<AiProvider, LlmBackend> = {
  ark: arkBackend,
  kimi: kimiBackend,
};

export function getActiveLlmBackend(): LlmBackend {
  return backends[resolveAiProvider()];
}

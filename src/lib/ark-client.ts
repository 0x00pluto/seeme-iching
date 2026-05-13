type Role = "system" | "user" | "assistant";

export type ArkChatMessage = { role: Role; content: string };

export type StreamCallbacks = {
  onDelta: (delta: string) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
};

export type StreamOptions = {
  signal?: AbortSignal;
};

/** POST /api/interpret/deep-inquiry 成功响应契约 */
export type DeepInquiryResponse = {
  deepInquiry: [string, string, string];
};

// 当前实现：前端只走同源流式代理，不在浏览器直连方舟（避免 CORS / key 暴露）。
// 对应后端端点：/api/interpret/stream、/api/interpret/deep-inquiry 与 /api/chat/stream

export class InterpretDailyQuotaError extends Error {
  readonly code = "INTERPRET_DAILY_QUOTA" as const;
  constructor(
    message: string,
    public readonly payload: {
      limit: number;
      used: number;
      resetsAt: string;
      timezone?: string;
    }
  ) {
    super(message);
    this.name = "InterpretDailyQuotaError";
  }
}

function parseSseLines(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { events: parts, rest };
}

function extractDataLines(eventChunk: string): string[] {
  const lines = eventChunk.split("\n");
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
  }
  return dataLines;
}

export async function streamInterpret(
  args: {
    question?: string;
    benGua?: { name?: string };
    huGua?: { name?: string };
    cuoGua?: { name?: string };
    zongGua?: { name?: string };
  },
  cb: StreamCallbacks,
  opt?: StreamOptions
) {
  return streamViaProxy("/api/interpret/stream", args, cb, opt);
}

export async function fetchDeepInquiry(
  args: {
    question?: string;
    interpretation: string;
    benGua?: { name?: string };
    huGua?: { name?: string };
    cuoGua?: { name?: string };
    zongGua?: { name?: string };
  },
  opt?: StreamOptions
): Promise<DeepInquiryResponse> {
  const res = await fetch("/api/interpret/deep-inquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: opt?.signal,
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: string; detail?: string } | undefined)?.error ?? res.statusText;
    const detail = (json as { detail?: string } | undefined)?.detail;
    throw new Error(detail ? `${err}\n\n${detail}` : err);
  }
  const arr = (json as { deepInquiry?: unknown } | undefined)?.deepInquiry;
  if (!Array.isArray(arr) || arr.length !== 3) {
    throw new Error("deepInquiry 响应格式无效");
  }
  const deepInquiry = arr.map((x) => String(x ?? "").trim()) as [string, string, string];
  if (deepInquiry.some((s) => !s)) {
    throw new Error("deepInquiry 含空字符串");
  }
  return { deepInquiry };
}

export async function streamDeepChat(
  args: {
    question: string;
    interpretation: string;
    round: number;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    input: string;
    direction?: string;
  },
  cb: StreamCallbacks,
  opt?: StreamOptions
) {
  return streamViaProxy(
    "/api/chat/stream",
    {
      messages: args.messages,
      question: args.question,
      interpretation: args.interpretation,
      round: args.round,
      input: args.input,
      ...(args.direction?.trim() ? { direction: args.direction.trim() } : {}),
    },
    cb,
    opt
  );
}

async function streamViaProxy(path: string, body: unknown, cb: StreamCallbacks, opt?: StreamOptions) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opt?.signal,
  });

  if (!res.ok || !res.body) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await res.json()) as {
        code?: string;
        error?: string;
        detail?: string;
        limit?: number;
        used?: number;
        resetsAt?: string;
        timezone?: string;
      };
      if (j.code === "INTERPRET_DAILY_QUOTA") {
        throw new InterpretDailyQuotaError(j.error ?? "本日解读次数已用完", {
          limit: j.limit ?? 3,
          used: j.used ?? j.limit ?? 3,
          resetsAt: j.resetsAt ?? "",
          timezone: j.timezone,
        });
      }
      const base = j.error ?? `代理请求失败（HTTP ${res.status}）`;
      const detail = j.detail ?? "";
      throw new Error(detail ? `${base}\n\n${detail}` : base);
    }
    const detail = await res.text().catch(() => "");
    const base = `代理请求失败（HTTP ${res.status}）`;
    throw new Error(detail ? `${base}\n\n${detail}` : base);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseLines(buf);
      buf = rest;

      for (const eventChunk of events) {
        const dataLines = extractDataLines(eventChunk);
        for (const data of dataLines) {
          if (!data) continue;
          if (data === "[DONE]") {
            cb.onDone?.();
            return;
          }
          let json: unknown;
          try {
            json = JSON.parse(data);
          } catch {
            continue;
          }
          const err = (json as { error?: string; detail?: string } | undefined)?.error;
          if (typeof err === "string" && err) {
            const detail = (json as { detail?: string } | undefined)?.detail ?? "";
            throw new Error(detail ? `${err}\n\n${detail}` : err);
          }

          const delta =
            (json as { choices?: Array<{ delta?: { content?: string } }> | undefined })?.choices?.[0]?.delta?.content ??
            "";
          if (delta) cb.onDelta(delta);
        }
      }
    }
    cb.onDone?.();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

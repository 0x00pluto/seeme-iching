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

// 当前实现：前端只走同源流式代理，不在浏览器直连方舟（避免 CORS / key 暴露）。
// 对应后端端点：/api/interpret/stream 与 /api/chat/stream

function buildInterpretUserPrompt(args: {
  question?: string;
  benGua?: { name?: string };
  huGua?: { name?: string };
  cuoGua?: { name?: string };
  zongGua?: { name?: string };
}): string {
  const q = args.question?.trim() || "未提供具体问题，请进行一般性指引";
  return `
你是一位精通易经哲学与深度心理学的引导者。

用户的问题/意念: "${q}"

系统通过四面“镜子”捕捉到了以下卦象：
1. 现状之镜 (本卦): ${args.benGua?.name ?? "未知"} - 代表当前事态的外部表现与现状。
2. 内心之镜 (互卦): ${args.huGua?.name ?? "未知"} - 代表事态内部隐藏的动机、用户的真实内心状态。
3. 阴影之镜 (错卦): ${args.cuoGua?.name ?? "未知"} - 代表被忽视的对立面、潜意识中的恐惧或盲点。
4. 视角之镜 (综卦): ${args.zongGua?.name ?? "未知"} - 代表换位思考后的客观环境或事态的另一面。

请基于这四重维度的交织，为用户提供一份深度的“内省报告”。
报告应避免迷信色彩，侧重于心理分析与行动建议：
- “观照现状”：分析本卦揭示的处境。
- “洞察内心”：通过互卦揭示用户可能未察觉的深层渴望或矛盾。
- “直面阴影”：通过错卦提醒用户需要注意的盲区。
- “通变之道”：综合四卦，给出如何调整心态或应对的建议。

请使用优雅、克制、富有启发性的中文。
  `.trim();
}

function buildChatSystemInstruction(args: { question: string; interpretation: string; round: number }): string {
  return `你是一位深度心理咨询师与易经哲学引导者。

当前对话背景：
- 用户的问题: "${args.question}"
- 初始卦象解读: "${args.interpretation}"
- 当前轮次: ${args.round}/8

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

export async function streamDeepChat(
  args: {
    question: string;
    interpretation: string;
    round: number;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    input: string;
  },
  cb: StreamCallbacks,
  opt?: StreamOptions
) {
  return streamViaProxy(
    "/api/chat/stream",
    { messages: args.messages, question: args.question, interpretation: args.interpretation, round: args.round, input: args.input },
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


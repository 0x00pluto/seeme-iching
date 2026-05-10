/**
 * Vercel Serverless：POST /api/chat/stream
 * 注意：在 Vercel 上仍会受 maxDuration 限制（当前 300s），SSE 到点会被掐断。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runChatStream } from "../../server/ark-api.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 300,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    for await (const evt of runChatStream(req.body)) {
      if (evt.type === "delta") {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: evt.delta } }] })}\n\n`);
      } else if (evt.type === "error") {
        res.write(`data: ${JSON.stringify({ error: evt.error, detail: evt.detail ?? "" })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      } else if (evt.type === "done") {
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ error: "服务器内部错误", detail: message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch {
        // ignore
      }
    }
  }
}


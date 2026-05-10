/**
 * Vercel Serverless：POST /api/interpret
 * 与本地 Express 共用 `server/ark-api.ts` 逻辑；需在 Vercel 环境变量中配置 ARK_API_KEY 等。
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runInterpretApi } from "../server/ark-api.js";

/** 显式 Node 运行时：OpenAI SDK 依赖 Node API，勿用 Edge。 */
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
    const { status, json } = await runInterpretApi(req.body);
    res.status(status).json(json);
  } catch (e) {
    console.error("api/interpret handler:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(500).json({ error: "服务器内部错误", detail: message });
    }
  }
}

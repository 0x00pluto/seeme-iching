/**
 * Vercel Serverless：POST /api/interpret
 * 与本地 Express 共用 `server/ark-api.ts` 逻辑；需在 Vercel 环境变量中配置 ARK_API_KEY 等。
 */
import { runInterpretApi } from "../server/ark-api.ts";

type ApiReq = { method?: string; body?: unknown };
type ApiRes = {
  status: (code: number) => { json: (body: unknown) => void };
};

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  const { status, json } = await runInterpretApi(req.body);
  res.status(status).json(json);
}

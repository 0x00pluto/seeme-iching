/**
 * Vercel Serverless：POST /api/chat
 */
import { runChatApi } from "../server/ark-api.ts";

type ApiReq = { method?: string; body?: unknown };
type ApiRes = {
  status: (code: number) => { json: (body: unknown) => void };
};

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  const { status, json } = await runChatApi(req.body);
  res.status(status).json(json);
}

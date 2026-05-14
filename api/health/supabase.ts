/**
 * Vercel Serverless：GET /api/health/supabase
 * Verifies SUPABASE_* env and a PostgREST read on public.connectivity_check.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { probeSupabaseConnectivity } from "../../server/supabase-client";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }
    const result = await probeSupabaseConnectivity();
    if (result.ok === false) {
      res.status(503).json({ ok: false, error: result.error });
      return;
    }
    res.status(200).json({ ok: true, via: "supabase-js" });
  } catch (e) {
    console.error("api/health/supabase:", e);
    const message = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.status(503).json({ ok: false, error: message });
    }
  }
}

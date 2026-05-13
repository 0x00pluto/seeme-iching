import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let singleton: SupabaseClient | null = null;

/**
 * Reads server-only Supabase credentials. Throws if misconfigured (fail fast in dev).
 */
export function getSupabaseServerEnv(): { url: string; serviceRoleKey: string } {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url) {
    throw new Error("Missing env SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");
  }
  return { url, serviceRoleKey };
}

/**
 * Service-role client for Express / Vercel `api/*` only. Never import from `src/`.
 */
export function createServerSupabase(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseServerEnv();
  if (!singleton) {
    singleton = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return singleton;
}

export type SupabaseConnectivityResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * PostgREST round-trip against `public.connectivity_check` (see supabase/migrations).
 * Safe for HTTP handlers: does not throw.
 */
export async function probeSupabaseConnectivity(): Promise<SupabaseConnectivityResult> {
  try {
    const sb = createServerSupabase();
    const { data, error } = await sb
      .from("connectivity_check")
      .select("id")
      .eq("id", "singleton")
      .maybeSingle();
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.id) {
      return { ok: false, error: "connectivity_check row missing" };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

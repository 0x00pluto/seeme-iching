import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let singleton: SupabaseClient | null = null;

/** 仅用于 Auth API（OTP），不落会话到服务端内存；使用 anon key */
export function getSupabaseAuthClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const anon = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  if (!singleton) {
    singleton = createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return singleton;
}

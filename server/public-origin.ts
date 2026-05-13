/** 同源魔法链接回调地址（路径固定，需在 Supabase Redirect URLs 中放行） */
export const AUTH_CALLBACK_PATH = "/auth/callback";

function firstHeader(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : undefined;
}

/**
 * 解析对外 Origin（魔法链接 redirect）。
 * 优先 APP_PUBLIC_ORIGIN（反代/预览域名与浏览器不一致时使用）。
 */
export function resolvePublicOrigin(req: {
  headers: Partial<Record<string, string | string[] | undefined>>;
  protocol?: string;
}): string {
  const fixed = process.env.APP_PUBLIC_ORIGIN?.trim().replace(/\/$/, "");
  if (fixed) return fixed;

  const xfProto = firstHeader(req.headers["x-forwarded-proto"]);
  const xfHost = firstHeader(req.headers["x-forwarded-host"]);
  const host = xfHost ?? firstHeader(req.headers["host"]) ?? "localhost:3000";
  let proto =
    xfProto ??
    (typeof req.protocol === "string" ? req.protocol.replace(/:$/, "") : undefined) ??
    "http";
  if (proto !== "http" && proto !== "https") proto = "http";
  return `${proto}://${host}`;
}

export function buildAuthCallbackUrl(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${AUTH_CALLBACK_PATH}`;
}

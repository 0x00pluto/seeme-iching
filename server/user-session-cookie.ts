import { createHmac, timingSafeEqual } from "node:crypto";

/** HttpOnly 会话 Cookie（HMAC-SHA256），与业务 JWT 分离 */
export const USER_SESSION_COOKIE_NAME = "seeme_user_session";

export type UserSessionPayload = {
  sub: string;
  email: string;
  /** unix seconds */
  exp: number;
};

const DEFAULT_SESSION_DAYS = 7;

export function getSessionTtlSeconds(): number {
  const raw = process.env.AUTH_SESSION_DURATION_DAYS?.trim();
  if (!raw) return DEFAULT_SESSION_DAYS * 86_400;
  const days = Number(raw);
  if (!Number.isFinite(days) || days <= 0) return DEFAULT_SESSION_DAYS * 86_400;
  return Math.floor(days * 86_400);
}

function getSessionSecret(): string {
  const secret = process.env.USER_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing USER_SESSION_SECRET");
  }
  return secret;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function signPayload(payloadBase64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
}

export function encodeUserSessionToken(payload: UserSessionPayload): string {
  const secret = getSessionSecret();
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = signPayload(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
}

export function parseUserSessionToken(token: string | undefined): UserSessionPayload | null {
  if (!token) return null;
  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  const secret = getSessionSecret();
  const expected = signPayload(payloadBase64, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8"),
    ) as UserSessionPayload;
    if (!payload.email || !payload.sub || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp * 1000 <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function readCookieValue(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  const found = cookies.find((c) => c.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : undefined;
}

/** Express / Vercel Response：追加 Set-Cookie（兼容 appendHeader / append） */
export function appendSessionCookie(
  res: unknown,
  token: string,
  maxAgeSeconds: number,
): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${USER_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ["Secure"] : []),
  ];
  const line = parts.join("; ");
  const r = res as {
    appendHeader?: (name: string, value: string) => void;
    append?: (name: string, value: string) => void;
  };
  if (typeof r.appendHeader === "function") {
    r.appendHeader("Set-Cookie", line);
  } else if (typeof r.append === "function") {
    r.append("Set-Cookie", line);
  } else {
    (res as { setHeader(name: string, value: string): void }).setHeader("Set-Cookie", line);
  }
}

export function appendClearSessionCookie(res: unknown): void {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${USER_SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ];
  const line = parts.join("; ");
  const r = res as {
    appendHeader?: (name: string, value: string) => void;
    append?: (name: string, value: string) => void;
  };
  if (typeof r.appendHeader === "function") {
    r.appendHeader("Set-Cookie", line);
  } else if (typeof r.append === "function") {
    r.append("Set-Cookie", line);
  } else {
    (res as { setHeader(name: string, value: string): void }).setHeader("Set-Cookie", line);
  }
}

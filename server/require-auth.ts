import { getSessionFromRequest } from "./auth-handlers";
import type { UserSessionPayload } from "./user-session-cookie";

/** 未登录 / 会话失效时统一返回的 401 响应体；调用方决定 res.status().json()。 */
export const UNAUTHORIZED_RESPONSE = {
  status: 401,
  body: { error: "请先登录" },
} as const;

/**
 * 通用登录守卫：纯函数，同时服务 Express 与 Vercel handler。
 * 未登录或会话失效 → 返回 null；调用方负责回 401 并 return。
 */
export function requireAuth(cookieHeader: string | undefined): UserSessionPayload | null {
  return getSessionFromRequest(cookieHeader);
}

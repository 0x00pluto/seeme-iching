/**
 * Express 入口：`/api/*` 与 `server/ark-api.ts` 共用逻辑；LLM 供应商由 `SEEME_AI_PROVIDER`（ark | kimi）决定，见 `server/llm/resolve.ts` 与 `server/llm/registry.ts`。
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import {
  runChatApi,
  runChatStream,
  runDeepInquiryApi,
  runInterpretApi,
  runInterpretStream,
} from "./server/ark-api.js";
import { pipeArkStreamToSse } from "./server/pipe-ark-sse.js";
import { flushHeadersAndInitialSsePing } from "./server/sse-warmup.js";
import { probeSupabaseConnectivity } from "./server/supabase-client.js";
import {
  handleSendLoginOtp,
  handleVerifyLoginOtp,
  handleExchangeSession,
  handleLogout,
  handleMe,
} from "./server/auth-handlers.js";
import {
  consumeInterpretQuota,
  ensureDeepChatMembershipAllowed,
  isQuotaBackendConfigured,
} from "./server/membership-quota.js";
import {
  handleArchivesDeleteAll,
  handleArchivesDeleteOne,
  handleArchivesGet,
  handleArchivesPatch,
  handleArchivesPost,
} from "./server/archives-handlers.js";
import {
  handleArchiveShareDelete,
  handleArchiveSharePost,
  handleShareGet,
} from "./server/share-handlers.js";
import {
  handleMirrorThreadRead,
  handleMirrorThreadToday,
} from "./server/mirror-thread-handlers.js";
import { requireAuth, UNAUTHORIZED_RESPONSE } from "./server/require-auth.js";
import { appendSessionCookie, appendClearSessionCookie } from "./server/user-session-cookie.js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/auth/send-otp", async (req, res) => {
    const result = await handleSendLoginOtp(req.body);
    res.status(result.status).json(result.json);
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    const result = await handleVerifyLoginOtp(req.body, (token, maxAge) => {
      appendSessionCookie(res, token, maxAge);
    });
    res.status(result.status).json(result.json);
  });

  app.post("/api/auth/session", async (req, res) => {
    const result = await handleExchangeSession(req.body, (token, maxAge) => {
      appendSessionCookie(res, token, maxAge);
    });
    res.status(result.status).json(result.json);
  });

  app.post("/api/auth/logout", (_req, res) => {
    appendClearSessionCookie(res);
    const result = handleLogout();
    res.status(result.status).json(result.json);
  });

  app.get("/api/auth/me", async (req, res) => {
    const result = await handleMe(req.headers.cookie);
    res.status(result.status).json(result.json);
  });

  app.get("/api/archives", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const result = await handleArchivesGet(req.headers.cookie);
    res.status(result.status).json(result.json);
  });

  app.post("/api/archives", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const result = await handleArchivesPost(req.headers.cookie, req.body);
    res.status(result.status).json(result.json);
  });

  app.delete("/api/archives", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const result = await handleArchivesDeleteAll(req.headers.cookie);
    res.status(result.status).json(result.json);
  });

  app.patch("/api/archives/:id", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const result = await handleArchivesPatch(req.headers.cookie, req.params.id ?? "", req.body);
    res.status(result.status).json(result.json);
  });

  app.delete("/api/archives/:id", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const result = await handleArchivesDeleteOne(req.headers.cookie, req.params.id ?? "");
    res.status(result.status).json(result.json);
  });

  app.post("/api/archives/:id/share", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const result = await handleArchiveSharePost(req.headers.cookie, req.params.id ?? "");
    res.status(result.status).json(result.json);
  });

  app.delete("/api/archives/:id/share", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const result = await handleArchiveShareDelete(req.headers.cookie, req.params.id ?? "");
    res.status(result.status).json(result.json);
  });

  app.get("/api/share/:token", async (req, res) => {
    const result = await handleShareGet(req.params.token ?? "");
    if (result.cacheControl) {
      res.setHeader("Cache-Control", result.cacheControl);
    }
    res.status(result.status).json(result.json);
  });

  app.get("/api/mirror-thread/today", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const result = await handleMirrorThreadToday(req.headers.cookie);
    if (result.status === 204) {
      res.status(204).end();
      return;
    }
    res.status(result.status).json(result.json ?? {});
  });

  app.post("/api/mirror-thread/read", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const result = await handleMirrorThreadRead(req.headers.cookie, req.body);
    if (result.status === 204) {
      res.status(204).end();
      return;
    }
    res.status(result.status).json(result.json);
  });

  app.get("/api/health/supabase", async (_req, res) => {
    try {
      const result = await probeSupabaseConnectivity();
      if (result.ok === false) {
        res.status(503).json({ ok: false, error: result.error });
        return;
      }
      res.status(200).json({ ok: true, via: "supabase-js" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(503).json({ ok: false, error: message });
    }
  });

  app.post("/api/interpret", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const { status, json } = await runInterpretApi(req.body);
    res.status(status).json(json);
  });

  app.post("/api/interpret/deep-inquiry", async (req, res) => {
    if (!requireAuth(req.headers.cookie)) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const { status, json } = await runDeepInquiryApi(req.body);
    res.status(status).json(json);
  });

  app.post("/api/chat", async (req, res) => {
    const session = requireAuth(req.headers.cookie);
    if (!session) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const gate = await ensureDeepChatMembershipAllowed(session.sub);
    if (!gate.allowed) {
      res.status(gate.status).json(gate.body);
      return;
    }
    const { status, json } = await runChatApi(req.body);
    res.status(status).json(json);
  });

  app.post("/api/interpret/stream", async (req, res) => {
    const session = requireAuth(req.headers.cookie);
    if (!session) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    if (!isQuotaBackendConfigured()) {
      res.status(503).json({ error: "解读额度服务未配置", detail: "缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY" });
      return;
    }
    try {
      const quota = await consumeInterpretQuota(session.sub);
      if (!quota.allowed) {
        res.status(429).json(quota.body);
        return;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(503).json({ error: "解读额度校验失败", detail: message });
      return;
    }
    try {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      flushHeadersAndInitialSsePing(res);
      await pipeArkStreamToSse(res, runInterpretStream(req.body));
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
  });

  app.post("/api/chat/stream", async (req, res) => {
    const session = requireAuth(req.headers.cookie);
    if (!session) {
      res.status(UNAUTHORIZED_RESPONSE.status).json(UNAUTHORIZED_RESPONSE.body);
      return;
    }
    const gate = await ensureDeepChatMembershipAllowed(session.sub);
    if (!gate.allowed) {
      res.status(gate.status).json(gate.body);
      return;
    }
    try {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      flushHeadersAndInitialSsePing(res);
      await pipeArkStreamToSse(res, runChatStream(req.body));
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
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

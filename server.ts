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

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
    const { status, json } = await runInterpretApi(req.body);
    res.status(status).json(json);
  });

  app.post("/api/interpret/deep-inquiry", async (req, res) => {
    const { status, json } = await runDeepInquiryApi(req.body);
    res.status(status).json(json);
  });

  app.post("/api/chat", async (req, res) => {
    const { status, json } = await runChatApi(req.body);
    res.status(status).json(json);
  });

  app.post("/api/interpret/stream", async (req, res) => {
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

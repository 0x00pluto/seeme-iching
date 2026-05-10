import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { runChatApi, runChatStream, runInterpretApi, runInterpretStream } from "./server/ark-api.js";
import { pipeArkStreamToSse } from "./server/pipe-ark-sse.js";
import {
  chatStreamMeta,
  createSseStreamLog,
  interpretStreamMeta,
} from "./server/sse-stream-log.js";
import { flushHeadersAndInitialSsePing } from "./server/sse-warmup.js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/interpret", async (req, res) => {
    const { status, json } = await runInterpretApi(req.body);
    res.status(status).json(json);
  });

  app.post("/api/chat", async (req, res) => {
    const { status, json } = await runChatApi(req.body);
    res.status(status).json(json);
  });

  app.post("/api/interpret/stream", async (req, res) => {
    const log = createSseStreamLog("POST /api/interpret/stream", interpretStreamMeta(req.body));
    req.on("close", () => {
      log.clientDisconnected("incoming_message_close");
    });
    try {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      flushHeadersAndInitialSsePing(res);
      log.sseHeadersSet();
      await pipeArkStreamToSse(res, runInterpretStream(req.body), log);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!res.headersSent) {
        log.streamEnd("handler_exception_before_headers", { detail: message });
        res.status(500).json({ error: "服务器内部错误", detail: message });
      } else {
        log.streamEnd("handler_exception_after_headers", { detail: message });
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
    const log = createSseStreamLog("POST /api/chat/stream", chatStreamMeta(req.body));
    req.on("close", () => {
      log.clientDisconnected("incoming_message_close");
    });
    try {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      flushHeadersAndInitialSsePing(res);
      log.sseHeadersSet();
      await pipeArkStreamToSse(res, runChatStream(req.body), log);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!res.headersSent) {
        log.streamEnd("handler_exception_before_headers", { detail: message });
        res.status(500).json({ error: "服务器内部错误", detail: message });
      } else {
        log.streamEnd("handler_exception_after_headers", { detail: message });
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

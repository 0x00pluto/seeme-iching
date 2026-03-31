import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { runChatApi, runChatStream, runInterpretApi, runInterpretStream } from "./server/ark-api.js";

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
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    for await (const evt of runInterpretStream(req.body)) {
      if (evt.type === "delta") {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: evt.delta } }] })}\n\n`);
      } else if (evt.type === "error") {
        res.write(`data: ${JSON.stringify({ error: evt.error, detail: evt.detail ?? "" })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      } else if (evt.type === "done") {
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  });

  app.post("/api/chat/stream", async (req, res) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    for await (const evt of runChatStream(req.body)) {
      if (evt.type === "delta") {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: evt.delta } }] })}\n\n`);
      } else if (evt.type === "error") {
        res.write(`data: ${JSON.stringify({ error: evt.error, detail: evt.detail ?? "" })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      } else if (evt.type === "done") {
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
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

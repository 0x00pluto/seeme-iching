import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/interpret", async (req, res) => {
    try {
      const { question, benGua, huGua, cuoGua, zongGua } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "API key not configured on server" });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          baseUrl: process.env.GOOGLE_GEMINI_BASE_URL || "https://api.aicodewith.com/gemini_cli"
        }
      });
      const modelId = process.env.GEMINI_MODEL || "gemini-3-pro-preview";

      const prompt = `
        你是一位精通易经哲学与深度心理学的引导者。
        
        用户的问题/意念: "${question || "未提供具体问题，请进行一般性指引"}"
        
        系统通过四面“镜子”捕捉到了以下卦象：
        1. 现状之镜 (本卦): ${benGua?.name} - 代表当前事态的外部表现与现状。
        2. 内心之镜 (互卦): ${huGua?.name} - 代表事态内部隐藏的动机、用户的真实内心状态。
        3. 阴影之镜 (错卦): ${cuoGua?.name} - 代表被忽视的对立面、潜意识中的恐惧或盲点。
        4. 视角之镜 (综卦): ${zongGua?.name} - 代表换位思考后的客观环境或事态的另一面。
        
        请基于这四重维度的交织，为用户提供一份深度的“内省报告”。
        报告应避免迷信色彩，侧重于心理分析与行动建议：
        - “观照现状”：分析本卦揭示的处境。
        - “洞察内心”：通过互卦揭示用户可能未察觉的深层渴望或矛盾。
        - “直面阴影”：通过错卦提醒用户需要注意的盲区。
        - “通变之道”：综合四卦，给出如何调整心态或应对的建议。
        
        请使用优雅、克制、富有启发性的中文。
      `;

      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      res.json({ text: response.text });
    } catch (error) {
      console.error("Interpret API Error:", error);
      res.status(500).json({ error: "AI 解读生成失败，请检查网络或 API 配置。" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, question, interpretation, round, input } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "API key not configured on server" });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          baseUrl: process.env.GOOGLE_GEMINI_BASE_URL || "https://api.aicodewith.com/gemini_cli"
        }
      });
      const modelId = process.env.GEMINI_MODEL || "gemini-3-pro-preview";

      const systemInstruction = `你是一位深度心理咨询师与易经哲学引导者。
      
      当前对话背景：
      - 用户的问题: "${question}"
      - 初始卦象解读: "${interpretation}"
      - 当前轮次: ${round}/8
      
      你的目标：
      1. 协助用户看见自己的“叙事”（即他们是如何定义自己和处境的）。
      2. 引导用户发现不同视角的自己（通过错卦、综卦的启发）。
      3. 探索新的可能性转变。
      
      对话规则：
      - 每次只提一个深刻的问题。
      - 语气要优雅、克制、富有同理心。
      - 严禁算命或玄学说教，侧重心理觉察。
      - 如果是最后一轮（第8轮），请进行总结并给出一个充满希望的结语。
      - 保持对话的连贯性，基于用户的回答进行追问。`;

      const chat = ai.chats.create({
        model: modelId,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }]
        },
        history: messages.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }))
      });

      const response = await chat.sendMessage({ message: input });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Chat API Error:", error);
      res.status(500).json({ error: "抱歉，由于意念波动（网络错误），我暂时无法回应。请稍后再试。" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
